import type { FastifyInstance } from 'fastify'
import type { AutomationRunResponse, GuidedFlow, ProjectSecrets } from '@lazyscout/core'
import { describeStep, isUnsafeAutoClick, redactSensitiveText } from '@lazyscout/core'
import { flowToTestCase, generatePlaywrightFromFlow } from '@lazyscout/generators'
import { browserProfileDirectory, saveRunLog } from '../workspace.js'
import { runPlaywrightCli } from './playwrightCliRunner.js'

type FlowRunRequest = {
  flow: GuidedFlow
  projectId?: string
  secrets?: ProjectSecrets
  runId?: string
}

type ActiveFlowRun = { stopped: boolean; close?: () => Promise<void> }
const activeRuns = new Map<string, ActiveFlowRun>()

export function registerGuidedFlowRunRoute(app: FastifyInstance, workspaceRoot: string): void {
  app.post('/api/guided-flows/stop', async (request, reply) => {
    const runId = (request.body as { runId?: string } | undefined)?.runId
    const active = runId ? activeRuns.get(runId) : undefined
    if (!active) return reply.send({ stopped: false })
    active.stopped = true
    await active.close?.().catch(() => undefined)
    return reply.send({ stopped: true })
  })

  app.post('/api/guided-flows/run', async (request, reply) => {
    const body = request.body as FlowRunRequest
    if (!body?.flow?.id || !body.flow.baseUrl || !Array.isArray(body.flow.steps) || body.flow.steps.length === 0)
      return reply
        .status(400)
        .send({ error: { code: 'invalid-guided-flow', message: 'A Guided Flow with steps is required.' } })

    const testCase = flowToTestCase(body.flow)
    const runId = body.runId || crypto.randomUUID()
    const logs: AutomationRunResponse['logs'] = []
    const secretValues = [
      body.secrets?.email,
      body.secrets?.username,
      body.secrets?.password,
      body.secrets?.apiToken,
      ...(body.secrets?.variables ? Object.values(body.secrets.variables) : [])
    ].filter((value): value is string => Boolean(value))
    const addLog = (level: AutomationRunResponse['logs'][number]['level'], message: string, durationMs?: number) => {
      logs.push({
        timestamp: new Date().toISOString(),
        level,
        message: redactSensitiveText(message, secretValues),
        ...(durationMs === undefined ? {} : { durationMs })
      })
    }
    const active: ActiveFlowRun = { stopped: false }
    activeRuns.set(runId, active)
    addLog('info', `[Flow] Start: ${body.flow.name}`)
    body.flow.steps.forEach((step, index) =>
      addLog('info', `[${index + 1}/${body.flow.steps.length}] ${describeStep(stepToTestStep(body.flow, step))}`)
    )
    const unsafeStep = body.flow.steps.find(
      (step) => step.type === 'click' && isUnsafeAutoClick(step.target.name, step.target.label, step.target.text)
    )
    if (unsafeStep) {
      addLog('warn', 'Blocked by the LazyScout safety policy')
      const response = {
        status: 'blocked',
        framework: 'playwright',
        runId,
        logs,
        stepStatuses: body.flow.steps.map((step) => ({ id: step.id, status: 'pending' }))
      }
      activeRuns.delete(runId)
      return reply.send(response)
    }

    try {
      const result = await runPlaywrightCli({
        testCase,
        testCaseId: testCase.id,
        source: generatePlaywrightFromFlow(body.flow),
        secrets: body.secrets,
        secretValues,
        profileDirectory: body.projectId ? await browserProfileDirectory(workspaceRoot, body.projectId) : undefined,
        addLog,
        onProcess: (child) => {
          active.close = async () => {
            if (child.pid && process.platform === 'win32') {
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
      const stepStatuses = body.flow.steps.map((_, index) => ({
        id: body.flow.steps[index].id,
        status: result.status === 'passed' ? 'passed' : index === body.flow.steps.length - 1 ? 'failed' : 'pending'
      }))
      if (body.projectId)
        await saveRunLog(workspaceRoot, body.projectId, testCase.id, result.status, logs).catch(() => undefined)
      return reply.send({ ...result, logs, runId, stepStatuses })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      addLog('fail', message)
      return reply.status(400).send({
        error: {
          code: message.includes('Required test variable') ? 'missing-test-variable' : 'guided-flow-run-failed',
          message,
          hint: message.includes('Required test variable')
            ? 'Open Project settings and configure the referenced test variable before running this Flow.'
            : 'Review the Guided Flow steps and CLI log, then run it again.'
        }
      })
    } finally {
      activeRuns.delete(runId)
    }
  })
}

function stepToTestStep(flow: GuidedFlow, step: GuidedFlow['steps'][number]) {
  return flowToTestCase({ ...flow, steps: [step] }).steps[0]
}
