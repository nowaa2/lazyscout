import type { FastifyInstance } from 'fastify'
import type { AutomationRunRequest, AutomationRunResponse } from '@lazyscout/core'
import { isUnsafeAutoClick, redactSensitiveText } from '@lazyscout/core'
import { isBlockedLabel, normalizeBlockedKeywords } from '@lazyscout/explorer'
import { dirname } from 'node:path'
import { config } from '../config.js'
import { AuthProfileBusyError, acquireAuthLock } from '../auth/authLock.js'
import { authStatePath, loadAuthSnapshot } from '../auth/authState.js'
import { browserProfileDirectory, saveRunLog } from '../workspace.js'
import { redactCliError, runPlaywrightCli } from './playwrightCliRunner.js'

const MAX_STEPS = 100
const MAX_LOGS = 250
const MAX_SOURCE_LENGTH = 200_000
const STEP_TIMEOUT_MS = 20_000
type ActiveRun = { close?: () => Promise<void>; stopped: boolean }
const activeRuns = new Map<string, ActiveRun>()

export function registerAutomationRunRoute(app: FastifyInstance, workspaceRoot: string): void {
  app.post('/api/automation/stop', async (request, reply) => {
    const runId = (request.body as { runId?: string } | undefined)?.runId
    if (!runId) return reply.status(400).send({ error: { code: 'invalid-run', message: 'Run ID is required.' } })
    const active = activeRuns.get(runId)
    if (!active) return reply.send({ stopped: false })
    active.stopped = true
    await active.close?.().catch(() => undefined)
    return reply.send({ stopped: true })
  })

  app.post('/api/automation/run', async (request, reply) => {
    const body = request.body as Partial<AutomationRunRequest>
    const testCase = body.testCase
    const secrets = body.secrets
    const framework = body.framework ?? 'playwright'
    const runId = body.runId || crypto.randomUUID()
    const blockedKeywords = normalizeBlockedKeywords(body.blockedKeywords)
    if (!testCase || !Array.isArray(testCase.steps))
      return reply
        .status(400)
        .send({ error: { code: 'invalid-test-case', message: 'The requested Test Case was not found.' } })
    if (testCase.steps.length > MAX_STEPS)
      return reply
        .status(400)
        .send({ error: { code: 'run-limit', message: `Step count exceeds the limit of ${MAX_STEPS}` } })
    if (typeof body.code === 'string' && body.code.length > MAX_SOURCE_LENGTH)
      return reply
        .status(400)
        .send({ error: { code: 'source-limit', message: 'Generated source exceeds the size limit.' } })

    const logs: AutomationRunResponse['logs'] = []
    const secretValues = [
      body.secrets?.email,
      body.secrets?.username,
      body.secrets?.password,
      body.secrets?.apiToken,
      process.env.LAZYSCOUT_TEST_EMAIL,
      process.env.LAZYSCOUT_TEST_USERNAME,
      process.env.LAZYSCOUT_TEST_PASSWORD,
      process.env.LAZYSCOUT_API_TOKEN,
      ...(secrets?.variables ? Object.values(secrets.variables) : [])
    ].filter((value): value is string => Boolean(value))
    const addLog = (level: AutomationRunResponse['logs'][number]['level'], message: string, durationMs?: number) => {
      if (logs.length >= MAX_LOGS) return
      logs.push({
        timestamp: new Date().toISOString(),
        level,
        message: redactSensitiveText(message, secretValues),
        ...(durationMs === undefined ? {} : { durationMs })
      })
    }
    const persistLog = async (status: AutomationRunResponse['status']) => {
      if (!body.projectId) return
      await saveRunLog(workspaceRoot, body.projectId, testCase.id, status, logs).catch((error) =>
        addLog('warn', `Could not save run log: ${error instanceof Error ? error.message : String(error)}`)
      )
    }

    addLog('info', `$ lazyscout test --case ${testCase.id}`)
    addLog('info', `Starting Playwright Test CLI: ${testCase.title}`)
    addLog('info', `Test budget: ${MAX_STEPS} steps · ${STEP_TIMEOUT_MS / 1000}s per action · ${MAX_LOGS} log lines`)
    if (!body.code?.trim() && testCase.steps.length === 0) {
      addLog('warn', 'This Test Case has no Steps or Playwright code to run')
      await persistLog('blocked')
      return reply.send({ status: 'blocked', framework, logs })
    }
    if (testCase.automationStatus === 'manual') {
      addLog('info', 'Manual Test Case accepted: running the provided Playwright source or Steps')
    }
    if (framework === 'cypress') {
      addLog('warn', 'Cypress code generation is available; local runner uses Playwright only.')
      await persistLog('unsupported')
      return reply.send({ status: 'unsupported', framework, logs })
    }
    const sourceForSafety = body.code?.trim() || ''
    const unsafeLine = sourceForSafety
      .split(/\r?\n/)
      .find(
        (line) => /\.click\s*\(\s*\)/.test(line) && (isUnsafeAutoClick(line) || isBlockedLabel(blockedKeywords, line))
      )
    if (unsafeLine) {
      addLog('warn', 'Blocked by the LazyScout click safety policy')
      await persistLog('blocked')
      return reply.send({ status: 'blocked', framework, logs })
    }

    const active: ActiveRun = { stopped: false }
    activeRuns.set(runId, active)

    // A saved snapshot carries the session cookies a profile directory drops.
    const profileDirectory = body.projectId ? await browserProfileDirectory(workspaceRoot, body.projectId) : undefined
    const projectDirectory = profileDirectory ? dirname(profileDirectory) : undefined
    const snapshot = projectDirectory ? await loadAuthSnapshot(projectDirectory).catch(() => undefined) : undefined

    // Two runs on one rotating refresh token sign each other out.
    let releaseAuthLock: (() => Promise<void>) | undefined
    if (projectDirectory && snapshot) {
      try {
        releaseAuthLock = await acquireAuthLock(projectDirectory, 'runner', {
          log: (message) => addLog('info', message)
        })
      } catch (error) {
        activeRuns.delete(runId)
        if (error instanceof AuthProfileBusyError) {
          addLog('warn', error.message)
          await persistLog('blocked')
          return reply.status(409).send({ error: { code: error.code, message: error.message } })
        }
        throw error
      }
    }

    try {
      if (snapshot) addLog('info', '[Auth] Restoring authenticated state')
      const result = await runPlaywrightCli({
        source: body.code,
        testCase,
        testCaseId: testCase.id,
        secrets: body.secrets,
        secretValues,
        headless: config.headless,
        ...(snapshot && projectDirectory ? { authStatePath: authStatePath(projectDirectory) } : {}),
        profileDirectory,
        addLog,
        onProcess: (child) => {
          active.close = async () => {
            if (process.platform === 'win32' && child.pid) {
              const killer = (await import('node:child_process')).spawn(
                'taskkill',
                ['/pid', String(child.pid), '/T', '/F'],
                {
                  windowsHide: true,
                  stdio: 'ignore'
                }
              )
              await new Promise<void>((resolve) => killer.once('close', () => resolve()))
            } else child.kill('SIGTERM')
          }
        }
      })
      await persistLog(result.status)
      return reply.send({
        status: result.status,
        framework,
        logs,
        ...(result.error ? { error: redactCliError(result.error, secretValues) } : {}),
        screenshots: result.screenshots,
        screenshot: result.screenshots.at(-1)
      })
    } catch (error) {
      const message = redactCliError(error, secretValues)
      if (active.stopped) {
        addLog('warn', 'Run stopped by user')
        await persistLog('stopped')
        return reply.send({ status: 'stopped', framework, logs })
      }
      addLog('fail', message)
      await persistLog('failed')
      return reply.send({ status: 'failed', framework, logs, error: message })
    } finally {
      activeRuns.delete(runId)
      await releaseAuthLock?.().catch(() => undefined)
    }
  })
}
