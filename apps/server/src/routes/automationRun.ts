import type { FastifyInstance } from 'fastify'
import type { AutomationRunRequest, AutomationRunResponse, ProjectSecrets, TargetRef, TestStep } from '@lazyscout/core'
import { launchBrowser } from '@lazyscout/explorer'
import type { Locator, Page } from 'playwright-core'

const MAX_STEPS = 100
const MAX_LOGS = 250
const MAX_SOURCE_LENGTH = 200_000
const STEP_TIMEOUT_MS = 20_000

export function registerAutomationRunRoute(app: FastifyInstance): void {
  app.post('/api/automation/run', async (request, reply) => {
    const body = request.body as Partial<AutomationRunRequest>; const testCase = body.testCase; const secrets = body.secrets; const framework = body.framework ?? 'playwright'
    if (!testCase || !Array.isArray(testCase.steps)) return reply.status(400).send({ error: { code: 'invalid-test-case', message: 'ไม่พบ Test Case ที่ต้องการรัน' } })
    if (testCase.steps.length > MAX_STEPS) return reply.status(400).send({ error: { code: 'run-limit', message: 'จำนวน steps เกินขีดจำกัด ' + MAX_STEPS } })
    if (typeof body.code === 'string' && body.code.length > MAX_SOURCE_LENGTH) return reply.status(400).send({ error: { code: 'source-limit', message: 'Generated source มีขนาดใหญ่เกินไป' } })
    const logs: AutomationRunResponse['logs'] = []; const addLog = (level: AutomationRunResponse['logs'][number]['level'], message: string, durationMs?: number) => { if (logs.length < MAX_LOGS) logs.push({ timestamp: new Date().toISOString(), level, message, ...(durationMs === undefined ? {} : { durationMs }) }) }
    const started = Date.now(); addLog('info', '$ lazyscout test --case ' + testCase.id); addLog('info', 'Starting Playwright runner: ' + testCase.title); addLog('info', 'Test budget: ' + MAX_STEPS + ' steps · ' + STEP_TIMEOUT_MS / 1000 + 's per action · ' + MAX_LOGS + ' log lines')
    if (testCase.automationStatus === 'manual') { addLog('warn', 'Blocked: this case is marked manual and cannot be automated'); return reply.send({ status: 'blocked', framework, logs }) }
    if (framework === 'cypress') { addLog('warn', 'Cypress code generation is available; local runner uses Playwright only.'); return reply.send({ status: 'unsupported', framework, logs }) }
    let browser: Awaited<ReturnType<typeof launchBrowser>>['browser'] | undefined
    try {
      const launched = await launchBrowser(); browser = launched.browser; const context = await browser.newContext({ viewport: { width: 1366, height: 900 } }); context.setDefaultTimeout(STEP_TIMEOUT_MS); const page = await context.newPage()
      if (typeof body.code === 'string' && body.code.trim()) { addLog('info', 'Running edited automation source'); await executeEditedCode(page, body.code, addLog, secrets); addLog('pass', '✓ edited source completed') } else for (const step of testCase.steps) { const stepStarted = Date.now(); await executeStep(page, step, addLog, secrets); addLog('pass', `✓ ${step.type}`, Date.now() - stepStarted) }
      addLog('pass', `Completed ${testCase.id}`, Date.now() - started); return reply.send({ status: 'passed', framework, logs })
    } catch (error) { const message = error instanceof Error ? error.message : String(error); addLog('fail', `✕ ${message}`, Date.now() - started); return reply.send({ status: 'failed', framework, logs, error: message }) } finally { await browser?.close().catch(() => undefined) }
  })
}

async function executeEditedCode(page: Page, source: string, addLog: (level: 'info' | 'pass' | 'fail' | 'warn', message: string) => void, projectSecrets?: ProjectSecrets): Promise<void> {
  if (/\b(process|child_process|fs|readFile|writeFile|eval|Function)\b/.test(source)) throw new Error('Edited source contains a blocked server-side operation')
  const callback = source.indexOf('=> {'); const start = callback < 0 ? -1 : callback + 3; const end = source.lastIndexOf('})')
  if (start < 0 || end <= start) throw new Error('ไม่พบรูปแบบ Playwright test ที่ถูกต้อง')
  const body = replaceSecretPlaceholders(source.slice(start + 1, end), projectSecrets)
  const expect = (subject: Page | Locator) => ({ toBeVisible: async () => { if (subject === page || !(await (subject as Locator).isVisible())) throw new Error('Expected locator to be visible') }, toContainText: async (text: string) => { const actual = subject === page ? await page.locator('body').innerText() : await (subject as Locator).innerText(); if (!actual.includes(text)) throw new Error(`Expected text was not found: ${text}`) }, toHaveURL: async (pattern: RegExp) => { if (!pattern.test(page.url())) throw new Error(`URL did not match ${pattern}`) } })
  const execute = new Function('page', 'expect', `return (async () => {${body}\n})()`) as (currentPage: Page, currentExpect: typeof expect) => Promise<void>; addLog('info', '→ evaluating edited test body'); await execute(page, expect)
}
function replaceSecretPlaceholders(source: string, projectSecrets?: ProjectSecrets): string { return source.replace(/\{\{TEST_EMAIL\}\}|\{\{TEST_USERNAME\}\}|\{\{TEST_PASSWORD\}\}|\{\{API_TOKEN\}\}/g, (placeholder) => JSON.stringify(resolveSecret(placeholder, projectSecrets)).slice(1, -1)) }
async function executeStep(page: Page, step: TestStep, addLog: (level: 'info' | 'pass' | 'fail' | 'warn', message: string) => void, secrets?: ProjectSecrets): Promise<void> {
  switch (step.type) {
    case 'navigate': addLog('info', 'Target URL found: ' + step.url); addLog('info', '→ Navigating to ' + step.url); await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT_MS }); addLog('pass', 'Page ready: ' + (new URL(page.url()).pathname || '/')); addLog('info', 'Continuing with the next test step'); return
    case 'click': { const name = step.target.name ?? step.target.text ?? step.target.cssSelector ?? 'target'; addLog('info', 'Control found: ' + name); addLog('info', '→ Clicking ' + name); await locator(page, step.target).click(); addLog('pass', 'Action completed: ' + name); return }
    case 'fill': { const name = step.target.name ?? step.target.label ?? 'field'; const value = resolveSecret(step.value, secrets); addLog('info', 'Input found: ' + name); addLog('info', '→ Filling ' + name); await locator(page, step.target).fill(value); addLog('pass', 'Input ready: ' + name); return }
    case 'select': addLog('info', 'Dropdown found: ' + (step.target.name ?? step.target.label ?? 'select')); await locator(page, step.target).selectOption(step.option); addLog('pass', 'Selected option: ' + step.option); return
    case 'assertVisible': await locator(page, step.target).isVisible().then((visible) => { if (!visible) throw new Error('Expected element is not visible'); addLog('pass', 'Element visible: ' + (step.target.name ?? step.target.label ?? 'target')) }); return
    case 'assertText': { const bodyText = await page.locator('body').innerText(); if (!bodyText.includes(step.text)) throw new Error('Expected text was not found: ' + step.text); addLog('pass', 'Assertion passed: page contains "' + step.text + '"'); return }
    case 'assertUrl': if (!page.url().includes(step.urlContains)) throw new Error('URL does not contain ' + step.urlContains); addLog('pass', 'URL assertion passed: ' + page.url()); return
    case 'manual': throw new Error('Manual step requires Tester review')
  }
}
function resolveSecret(value: string, projectSecrets?: ProjectSecrets): string { const secrets: Record<string, string | undefined> = { '{{TEST_EMAIL}}': projectSecrets?.email ?? process.env.LAZYSCOUT_TEST_EMAIL, '{{TEST_USERNAME}}': projectSecrets?.username ?? process.env.LAZYSCOUT_TEST_USERNAME, '{{TEST_PASSWORD}}': projectSecrets?.password ?? process.env.LAZYSCOUT_TEST_PASSWORD, '{{API_TOKEN}}': projectSecrets?.apiToken ?? process.env.LAZYSCOUT_API_TOKEN }; const secret = secrets[value]; if (secret === undefined && value in secrets) throw new Error('Required secret is not configured for ' + value); return secret ?? value }
function locator(page: Page, target: TargetRef): Locator { if (target.role && target.name) return page.getByRole(target.role as any, { name: target.name }); if (target.label) return page.getByLabel(target.label); if (target.placeholder) return page.getByPlaceholder(target.placeholder); if (target.text) return page.getByText(target.text); return page.locator(target.cssSelector ?? '') }
