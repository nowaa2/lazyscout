import type { FastifyInstance } from 'fastify'
import type { AutomationRunRequest, AutomationRunResponse, ProjectSecrets, TargetRef, TestStep } from '@lazyscout/core'
import { checkTargetUrl, redactSensitiveText, redactUrl } from '@lazyscout/core'
import { isDestructiveLabel, launchBrowser } from '@lazyscout/explorer'
import type { Locator, Page } from 'playwright-core'
import { config } from '../config.js'

const MAX_STEPS = 100
const MAX_LOGS = 250
const MAX_SOURCE_LENGTH = 200_000
const STEP_TIMEOUT_MS = 20_000
type ActiveRun = { browser?: Awaited<ReturnType<typeof launchBrowser>>['browser']; stopped: boolean }
const activeRuns = new Map<string, ActiveRun>()

export function registerAutomationRunRoute(app: FastifyInstance): void {
  app.post('/api/automation/stop', async (request, reply) => {
    const runId = (request.body as { runId?: string } | undefined)?.runId
    if (!runId) return reply.status(400).send({ error: { code: 'invalid-run', message: 'Run ID is required.' } })
    const active = activeRuns.get(runId)
    if (!active) return reply.send({ stopped: false })
    active.stopped = true
    await active.browser?.close().catch(() => undefined)
    return reply.send({ stopped: true })
  })
  app.post('/api/automation/run', async (request, reply) => {
    const body = request.body as Partial<AutomationRunRequest>
    const testCase = body.testCase
    const secrets = body.secrets
    const framework = body.framework ?? 'playwright'
    const runId = body.runId || crypto.randomUUID()
    if (!testCase || !Array.isArray(testCase.steps))
      return reply.status(400).send({ error: { code: 'invalid-test-case', message: 'ไม่พบ Test Case ที่ต้องการรัน' } })
    if (testCase.steps.length > MAX_STEPS)
      return reply.status(400).send({ error: { code: 'run-limit', message: 'จำนวน steps เกินขีดจำกัด ' + MAX_STEPS } })
    if (typeof body.code === 'string' && body.code.length > MAX_SOURCE_LENGTH)
      return reply.status(400).send({ error: { code: 'source-limit', message: 'Generated source มีขนาดใหญ่เกินไป' } })
    const logs: AutomationRunResponse['logs'] = []
    const secretValues = [
      secrets?.email,
      secrets?.username,
      secrets?.password,
      secrets?.apiToken,
      process.env.LAZYSCOUT_TEST_EMAIL,
      process.env.LAZYSCOUT_TEST_USERNAME,
      process.env.LAZYSCOUT_TEST_PASSWORD,
      process.env.LAZYSCOUT_API_TOKEN
    ].filter((value): value is string => Boolean(value))
    const addLog = (level: AutomationRunResponse['logs'][number]['level'], message: string, durationMs?: number) => {
      if (logs.length < MAX_LOGS)
        logs.push({
          timestamp: new Date().toISOString(),
          level,
          message: redactSensitiveText(message, secretValues),
          ...(durationMs === undefined ? {} : { durationMs })
        })
    }
    const started = Date.now()
    addLog('info', '$ lazyscout test --case ' + testCase.id)
    addLog('info', 'Starting Playwright runner: ' + testCase.title)
    addLog(
      'info',
      'Test budget: ' + MAX_STEPS + ' steps · ' + STEP_TIMEOUT_MS / 1000 + 's per action · ' + MAX_LOGS + ' log lines'
    )
    if (testCase.automationStatus === 'manual') {
      addLog('warn', 'Blocked: this case is marked manual and cannot be automated')
      return reply.send({ status: 'blocked', framework, logs })
    }
    if (framework === 'cypress') {
      addLog('warn', 'Cypress code generation is available; local runner uses Playwright only.')
      return reply.send({ status: 'unsupported', framework, logs })
    }
    const active: ActiveRun = { stopped: false }
    activeRuns.set(runId, active)
    let browser: Awaited<ReturnType<typeof launchBrowser>>['browser'] | undefined
    let page: Page | undefined
    try {
      const launched = await launchBrowser()
      browser = launched.browser
      active.browser = browser
      if (active.stopped) throw new Error('Run stopped by user')
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
      context.setDefaultTimeout(STEP_TIMEOUT_MS)
      page = await context.newPage()
      if (typeof body.code === 'string' && body.code.trim()) {
        addLog('info', 'Running edited automation source')
        await executeEditedCode(page, body.code, addLog, secrets)
        if (active.stopped) throw new Error('Run stopped by user')
        addLog('pass', '✓ edited source completed')
      } else
        for (const step of testCase.steps) {
          if (active.stopped) throw new Error('Run stopped by user')
          const stepStarted = Date.now()
          await executeStep(page, step, addLog, secrets)
          if (active.stopped) throw new Error('Run stopped by user')
          addLog('pass', `✓ ${step.type}`, Date.now() - stepStarted)
        }
      addLog('pass', `Completed ${testCase.id}`, Date.now() - started)
      return reply.send({
        status: 'passed',
        framework,
        logs,
        screenshot: await captureScreenshot(page, testCase.id, 'passed')
      })
    } catch (error) {
      const message = redactSensitiveText(error instanceof Error ? error.message : String(error), secretValues)
      if (active.stopped) {
        addLog('warn', 'Run stopped by user', Date.now() - started)
        return reply.send({ status: 'stopped', framework, logs })
      }
      addLog('fail', `✕ ${message}`, Date.now() - started)
      return reply.send({
        status: 'failed',
        framework,
        logs,
        error: message,
        screenshot: await captureScreenshot(page, testCase.id, 'failed')
      })
    } finally {
      activeRuns.delete(runId)
      await browser?.close().catch(() => undefined)
    }
  })
}

async function captureScreenshot(page: Page | undefined, testCaseId: string, status: 'passed' | 'failed') {
  if (!page) return undefined
  try {
    const image = await page.screenshot({ type: 'jpeg', quality: 65, fullPage: false })
    return {
      name: `${testCaseId}-${status}-${Date.now()}.jpg`,
      dataUrl: `data:image/jpeg;base64,${image.toString('base64')}`,
      capturedAt: new Date().toISOString(),
      testCaseId,
      status
    }
  } catch {
    return undefined
  }
}

async function executeEditedCode(
  page: Page,
  source: string,
  addLog: (level: 'info' | 'pass' | 'fail' | 'warn', message: string) => void,
  projectSecrets?: ProjectSecrets
): Promise<void> {
  const lines = source.split(/\r?\n/)
  let executed = 0

  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/;$/, '')
    if (!line || line.startsWith('import ') || line.startsWith('test(') || line === '})' || line === '});') continue
    if (line.startsWith('//')) continue
    if (++executed > MAX_STEPS) throw new Error(`Edited source exceeds the ${MAX_STEPS} action limit`)

    const gotoMatch = line.match(new RegExp(`^await page\\.goto\\((${STRING_LITERAL})\\)$`))
    if (gotoMatch) {
      const url = parseStringLiteral(gotoMatch[1])
      const checked = checkTargetUrl(url, config.urlPolicy)
      if (!checked.ok) throw new Error(checked.message)
      addLog('info', `→ Navigating to ${redactUrl(checked.url.toString())}`)
      await page.goto(checked.url.toString(), { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT_MS })
      continue
    }

    const waitMatch = line.match(/^await page\.waitForTimeout\((\d{1,5})\)$/)
    if (waitMatch) {
      const waitMs = Math.min(Number(waitMatch[1]), 5_000)
      addLog('info', `→ Waiting ${waitMs}ms`)
      await page.waitForTimeout(waitMs)
      continue
    }

    const clickMatch = line.match(/^await (page\..+)\.click\(\)$/)
    if (clickMatch) {
      const target = parseEditedLocator(page, clickMatch[1])
      await ensureSafeClick(target.locator, target.label)
      addLog('info', `→ Clicking ${target.label}`)
      await target.locator.click()
      continue
    }

    const fillMatch = line.match(new RegExp(`^await (page\\..+)\\.fill\\((${STRING_LITERAL})\\)$`))
    if (fillMatch) {
      const target = parseEditedLocator(page, fillMatch[1])
      addLog('info', `→ Filling ${target.label}`)
      await target.locator.fill(resolveSecret(parseStringLiteral(fillMatch[2]), projectSecrets))
      continue
    }

    const selectMatch = line.match(new RegExp(`^await (page\\..+)\\.selectOption\\((${STRING_LITERAL})\\)$`))
    if (selectMatch) {
      const target = parseEditedLocator(page, selectMatch[1])
      const option = parseStringLiteral(selectMatch[2])
      addLog('info', `→ Selecting an option in ${target.label}`)
      await target.locator.selectOption(option)
      continue
    }

    const visibleMatch = line.match(/^await expect\((page\..+)\)\.toBeVisible\(\)$/)
    if (visibleMatch) {
      const target = parseEditedLocator(page, visibleMatch[1])
      if (!(await target.locator.isVisible())) throw new Error(`Expected ${target.label} to be visible`)
      addLog('pass', `Element visible: ${target.label}`)
      continue
    }

    const textMatch = line.match(
      new RegExp(`^await expect\\((page(?:\\..+)?)\\)\\.toContainText\\((${STRING_LITERAL})\\)$`)
    )
    if (textMatch) {
      const expected = parseStringLiteral(textMatch[2])
      const actual =
        textMatch[1] === 'page'
          ? await page.locator('body').innerText()
          : await parseEditedLocator(page, textMatch[1]).locator.innerText()
      if (!actual.includes(expected)) throw new Error(`Expected text was not found: ${expected}`)
      addLog('pass', 'Text assertion passed')
      continue
    }

    const urlMatch = line.match(
      new RegExp(`^await expect\\(page\\)\\.toHaveURL\\(new RegExp\\((${STRING_LITERAL})\\)\\)$`)
    )
    if (urlMatch) {
      const expected = parseStringLiteral(urlMatch[1])
      if (!page.url().includes(expected)) throw new Error(`URL did not contain ${expected}`)
      addLog('pass', `URL assertion passed: ${redactUrl(page.url())}`)
      continue
    }

    throw new Error(`Unsupported edited Playwright statement: ${line.slice(0, 120)}`)
  }

  if (executed === 0) throw new Error('Edited source does not contain a supported Playwright action')
}

const STRING_LITERAL = '"(?:\\\\.|[^"\\\\])*"'

function parseStringLiteral(value: string): string {
  const parsed = JSON.parse(value) as unknown
  if (typeof parsed !== 'string') throw new Error('Edited Playwright arguments must be strings')
  return parsed
}

function parseEditedLocator(page: Page, expression: string): { locator: Locator; label: string } {
  const roleMatch = expression.match(
    new RegExp(`^page\\.getByRole\\((${STRING_LITERAL}),\\s*\\{\\s*name:\\s*(${STRING_LITERAL})\\s*\\}\\)$`)
  )
  if (roleMatch) {
    const role = parseStringLiteral(roleMatch[1])
    const name = parseStringLiteral(roleMatch[2])
    return { locator: page.getByRole(role as any, { name }), label: name }
  }

  for (const [method, create] of [
    ['getByLabel', (value: string) => page.getByLabel(value)],
    ['getByPlaceholder', (value: string) => page.getByPlaceholder(value)],
    ['getByText', (value: string) => page.getByText(value)],
    ['locator', (value: string) => page.locator(value)]
  ] as const) {
    const match = expression.match(new RegExp(`^page\\.${method}\\((${STRING_LITERAL})\\)$`))
    if (match) {
      const value = parseStringLiteral(match[1])
      return { locator: create(value), label: value }
    }
  }

  throw new Error(`Unsupported Playwright locator: ${expression.slice(0, 120)}`)
}
async function executeStep(
  page: Page,
  step: TestStep,
  addLog: (level: 'info' | 'pass' | 'fail' | 'warn', message: string) => void,
  secrets?: ProjectSecrets
): Promise<void> {
  switch (step.type) {
    case 'navigate':
      const checked = checkTargetUrl(step.url, config.urlPolicy)
      if (!checked.ok) throw new Error(checked.message)
      addLog('info', 'Target URL found: ' + redactUrl(checked.url.toString()))
      addLog('info', '→ Navigating to ' + redactUrl(checked.url.toString()))
      await page.goto(checked.url.toString(), { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT_MS })
      addLog('pass', 'Page ready: ' + (new URL(page.url()).pathname || '/'))
      addLog('info', 'Continuing with the next test step')
      return
    case 'click': {
      const name = step.target.name ?? step.target.text ?? step.target.cssSelector ?? 'target'
      const target = locator(page, step.target)
      await ensureSafeClick(target, name)
      addLog('info', 'Control found: ' + name)
      addLog('info', '→ Clicking ' + name)
      await target.click()
      addLog('pass', 'Action completed: ' + name)
      return
    }
    case 'fill': {
      const name = step.target.name ?? step.target.label ?? 'field'
      const value = resolveSecret(step.value, secrets)
      addLog('info', 'Input found: ' + name)
      addLog('info', '→ Filling ' + name)
      await locator(page, step.target).fill(value)
      addLog('pass', 'Input ready: ' + name)
      return
    }
    case 'select':
      addLog('info', 'Dropdown found: ' + (step.target.name ?? step.target.label ?? 'select'))
      await locator(page, step.target).selectOption(step.option)
      addLog('pass', 'Selected option: ' + step.option)
      return
    case 'assertVisible':
      await locator(page, step.target)
        .isVisible()
        .then((visible) => {
          if (!visible) throw new Error('Expected element is not visible')
          addLog('pass', 'Element visible: ' + (step.target.name ?? step.target.label ?? 'target'))
        })
      return
    case 'assertText': {
      const bodyText = await page.locator('body').innerText()
      if (!bodyText.includes(step.text)) throw new Error('Expected text was not found: ' + step.text)
      addLog('pass', 'Assertion passed: page contains "' + step.text + '"')
      return
    }
    case 'assertUrl':
      if (!page.url().includes(step.urlContains)) throw new Error('URL does not contain ' + step.urlContains)
      addLog('pass', 'URL assertion passed: ' + redactUrl(page.url()))
      return
    case 'manual':
      throw new Error('Manual step requires Tester review')
  }
}
function resolveSecret(value: string, projectSecrets?: ProjectSecrets): string {
  const secrets: Record<string, string | undefined> = {
    '{{TEST_EMAIL}}': projectSecrets?.email ?? process.env.LAZYSCOUT_TEST_EMAIL,
    '{{TEST_USERNAME}}': projectSecrets?.username ?? process.env.LAZYSCOUT_TEST_USERNAME,
    '{{TEST_PASSWORD}}': projectSecrets?.password ?? process.env.LAZYSCOUT_TEST_PASSWORD,
    '{{API_TOKEN}}': projectSecrets?.apiToken ?? process.env.LAZYSCOUT_API_TOKEN
  }
  const secret = secrets[value]
  if (secret === undefined && value in secrets) throw new Error('Required secret is not configured for ' + value)
  return secret ?? value
}
function locator(page: Page, target: TargetRef): Locator {
  if (target.role && target.name) return page.getByRole(target.role as any, { name: target.name })
  if (target.label) return page.getByLabel(target.label)
  if (target.placeholder) return page.getByPlaceholder(target.placeholder)
  if (target.text) return page.getByText(target.text)
  return page.locator(target.cssSelector ?? '')
}

async function ensureSafeClick(target: Locator, fallbackLabel: string): Promise<void> {
  const labels = await Promise.all([
    target.getAttribute('aria-label').catch(() => null),
    target.getAttribute('title').catch(() => null),
    target.getAttribute('name').catch(() => null),
    target.getAttribute('id').catch(() => null),
    target.innerText().catch(() => '')
  ])
  if (isDestructiveLabel(fallbackLabel, ...labels.map((value) => value ?? undefined))) {
    throw new Error(`Blocked destructive action: ${fallbackLabel}`)
  }
}
