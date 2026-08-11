import { createRequire } from 'node:module'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AutomationLog, AutomationScreenshot, ProjectSecrets, TestCase } from '@lazyscout/core'
import { checkTargetUrl, redactSensitiveText } from '@lazyscout/core'
import { generatePlaywrightTest } from '@lazyscout/generators'
import { config } from '../config.js'

const require = createRequire(import.meta.url)
const CLI_ENTRY = require.resolve('@playwright/test/cli') as string
const MAX_SCREENSHOTS = 10

export type PlaywrightCliRun = {
  status: 'passed' | 'failed' | 'stopped'
  error?: string
  screenshots: AutomationScreenshot[]
  close: () => Promise<void>
}

type RunInput = {
  source?: string
  testCase: TestCase
  testCaseId: string
  secrets?: ProjectSecrets
  secretValues: string[]
  addLog: (level: AutomationLog['level'], message: string, durationMs?: number) => void
  onProcess?: (process: ChildProcess) => void
}

export async function runPlaywrightCli(input: RunInput): Promise<PlaywrightCliRun> {
  const started = Date.now()
  const source = resolveSource(input.source, input.testCase, input.secrets)
  validateLiteralNavigationUrls(source)

  const runDirectory = await mkdtemp(join(dirname(CLI_ENTRY), '.lazyscout-run-'))
  const specPath = join(runDirectory, `${safeName(input.testCaseId)}.spec.ts`)
  const configPath = join(runDirectory, 'playwright.config.mjs')
  await writeFile(specPath, source, 'utf8')
  await writeFile(configPath, createConfig(), 'utf8')

  const child = spawn(process.execPath, [CLI_ENTRY, 'test', '--config', configPath], {
    cwd: runDirectory,
    env: { ...process.env, FORCE_COLOR: '0' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  input.onProcess?.(child)

  let stopped = false
  let output = ''
  const appendOutput = (level: AutomationLog['level'], chunk: Buffer | string) => {
    output += String(chunk)
    const lines = output.split(/\r?\n/)
    output = lines.pop() ?? ''
    for (const line of lines) {
      const clean = stripAnsi(line).trim()
      if (clean) input.addLog(level, clean)
    }
  }
  child.stdout?.on('data', (chunk) => appendOutput('info', chunk))
  child.stderr?.on('data', (chunk) => appendOutput('warn', chunk))

  const close = async () => {
    if (child.exitCode !== null || child.killed) return
    stopped = true
    if (process.platform === 'win32' && child.pid) {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    } else child.kill('SIGTERM')
  }

  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once('close', (code, signal) => resolve({ code, signal }))
    child.once('error', () => resolve({ code: 1, signal: null }))
  })
  if (output.trim()) appendOutput(exit.code === 0 ? 'info' : 'warn', '\n' + output)

  const screenshots = await readScreenshots(runDirectory, input.testCaseId)
  const passed = exit.code === 0 && !stopped
  const status = stopped ? 'stopped' : passed ? 'passed' : 'failed'
  if (status === 'passed') input.addLog('pass', `Playwright Test completed: ${input.testCaseId}`, Date.now() - started)
  if (status === 'stopped') input.addLog('warn', 'Playwright Test stopped by user', Date.now() - started)
  if (status === 'failed')
    input.addLog('fail', `Playwright Test failed (exit code ${exit.code ?? 'unknown'})`, Date.now() - started)

  let error: string | undefined
  if (status === 'failed') {
    const result = await readFile(join(runDirectory, 'results.json'), 'utf8').catch(() => '')
    error = summarizeFailure(result) ?? 'Playwright Test failed. See the CLI output for details.'
    input.addLog('fail', error)
  }

  await rm(runDirectory, { recursive: true, force: true }).catch(() => undefined)
  return {
    status,
    error,
    screenshots: screenshots.map((item) => ({ ...item, status: status === 'passed' ? 'passed' : 'failed' })),
    close
  }
}

function resolveSource(source: string | undefined, testCase: TestCase, secrets?: ProjectSecrets): string {
  const generated = source?.trim() || generatePlaywrightTest(testCase)
  const resolved = replaceSecrets(generated, secrets)
  if (/\btest\s*\(/.test(resolved) && /@playwright\/test/.test(resolved)) return resolved
  return [
    `import { test, expect } from '@playwright/test'`,
    '',
    `test(${JSON.stringify(testCase.title)}, async ({ page }) => {`,
    resolved,
    '})',
    ''
  ].join('\n')
}

function replaceSecrets(source: string, secrets?: ProjectSecrets): string {
  const values: Record<string, string | undefined> = {
    TEST_EMAIL: secrets?.email ?? process.env.LAZYSCOUT_TEST_EMAIL,
    TEST_USERNAME: secrets?.username ?? process.env.LAZYSCOUT_TEST_USERNAME,
    TEST_PASSWORD: secrets?.password ?? process.env.LAZYSCOUT_TEST_PASSWORD,
    API_TOKEN: secrets?.apiToken ?? process.env.LAZYSCOUT_API_TOKEN
  }
  return source.replace(/\{\{(TEST_EMAIL|TEST_USERNAME|TEST_PASSWORD|API_TOKEN)\}\}/g, (_, key: string) => {
    const value = values[key]
    if (value === undefined) throw new Error(`Required secret is not configured for {{${key}}}`)
    return escapeStringContent(value)
  })
}

function escapeStringContent(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n')
}

function validateLiteralNavigationUrls(source: string): void {
  const pattern = /page\.goto\(\s*(['"])(.*?)\1/g
  for (const match of source.matchAll(pattern)) {
    const checked = checkTargetUrl(match[2], config.urlPolicy)
    if (!checked.ok) throw new Error(checked.message)
  }
}

function createConfig(): string {
  return `import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.',
  timeout: 20000,
  expect: { timeout: 20000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['line'], ['json', { outputFile: 'results.json' }]],
  use: { headless: true, actionTimeout: 20000, navigationTimeout: 20000, screenshot: 'off' }
})
`
}

async function readScreenshots(directory: string, testCaseId: string): Promise<AutomationScreenshot[]> {
  const files = await collectImages(directory)
  const screenshots: AutomationScreenshot[] = []
  for (const file of files.slice(0, MAX_SCREENSHOTS)) {
    const extension = file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg') ? 'jpeg' : 'png'
    const data = await readFile(file)
    screenshots.push({
      name: file.slice(directory.length + 1).replaceAll('\\', '/'),
      dataUrl: `data:image/${extension};base64,${data.toString('base64')}`,
      capturedAt: new Date().toISOString(),
      testCaseId,
      status: 'failed'
    })
  }
  return screenshots
}

async function collectImages(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await collectImages(path)))
    else if (/\.(png|jpe?g)$/i.test(entry.name)) files.push(path)
  }
  return files
}

function summarizeFailure(result: string): string | undefined {
  if (!result) return undefined
  try {
    const parsed = JSON.parse(result) as {
      suites?: Array<{ specs?: Array<{ tests?: Array<{ errors?: Array<{ message?: string }> }> }> }>
    }
    return parsed.suites
      ?.flatMap((suite) => suite.specs ?? [])
      .flatMap((spec) => spec.tests ?? [])
      .flatMap((test) => test.errors ?? [])[0]?.message
  } catch {
    return undefined
  }
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'test-case'
}

function stripAnsi(value: string): string {
  return value.replace(
    /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g,
    ''
  )
}

export function redactCliError(error: unknown, secretValues: string[]): string {
  return redactSensitiveText(error instanceof Error ? error.message : String(error), secretValues)
}
