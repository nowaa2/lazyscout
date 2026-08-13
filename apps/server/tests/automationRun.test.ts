import { createServer, type Server } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { TestCase } from '@lazyscout/core'
import { generatePlaywrightFromFlow, generatePlaywrightTest } from '@lazyscout/generators'
import type { GuidedFlow } from '@lazyscout/core'
import { runPlaywrightCli } from '../src/routes/playwrightCliRunner.js'

const CLI_TEST_TIMEOUT = 60_000

describe('real Playwright Test CLI runner', () => {
  let server: Server
  let url: string
  const testCase: TestCase = {
    id: 'TC-CLI-001',
    module: 'HOME',
    title: 'Generated page has a login link',
    preconditions: [],
    steps: [
      { type: 'navigate', url: '' },
      { type: 'assertVisible', target: { role: 'link', name: 'เข้าสู่ระบบ' } },
      { type: 'click', target: { role: 'link', name: 'เข้าสู่ระบบ' } },
      { type: 'assertUrl', urlContains: '/login' }
    ],
    expectedResult: 'The login page opens.',
    type: 'positive',
    priority: 'medium',
    automationStatus: 'ready',
    sourceUrl: ''
  }

  beforeAll(async () => {
    server = createServer((request, response) => {
      response.setHeader('content-type', 'text/html; charset=utf-8')
      if (request.url === '/validation') {
        response.end(`
          <form id="validation-form">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" required>
            <button id="submit" type="submit">Submit</button>
            <p id="error" role="alert" hidden>Account was not found</p>
          </form>
          <script>
            document.querySelector('#validation-form').addEventListener('submit', (event) => {
              event.preventDefault()
              document.querySelector('#error').hidden = false
            })
          </script>
        `)
        return
      }
      if (request.url === '/login') {
        response.end('<h1>Login</h1>')
        return
      }
      // Renders its form only after a delay, like a client-rendered app. The
      // attribute is data-test, not Playwright's default data-testid.
      if (request.url === '/deferred') {
        response.end(`
          <div id="app"></div>
          <script>
            setTimeout(() => {
              document.getElementById('app').innerHTML =
                '<input id="username" data-test="input:username" name="username" placeholder="ชื่อผู้ใช้">'
            }, 1500)
          </script>
        `)
        return
      }
      response.end('<a href="/login">เข้าสู่ระบบ</a>')
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not start')
    url = `http://127.0.0.1:${address.port}`
    testCase.sourceUrl = url
    testCase.steps[0] = { type: 'navigate', url }
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  })

  it(
    'runs Scout-generated Playwright source through the real CLI',
    async () => {
      const logs: Array<{ level: 'info' | 'pass' | 'fail' | 'warn'; message: string }> = []
      const result = await runPlaywrightCli({
        source: generatePlaywrightTest(testCase),
        testCase,
        testCaseId: testCase.id,
        secretValues: [],
        addLog: (level, message) => logs.push({ level, message })
      })

      expect(result.status, logs.map((entry) => entry.message).join('\n')).toBe('passed')
      expect(logs.some((entry) => entry.message.includes('Running 1 test'))).toBe(true)
      expect(logs.some((entry) => entry.message.includes('passed'))).toBe(true)
    },
    CLI_TEST_TIMEOUT
  )

  it(
    'waits for a late-rendered element instead of failing on the first sweep',
    async () => {
      const deferredCase: TestCase = {
        ...testCase,
        id: 'TC-DEFERRED-001',
        title: 'Late-rendered field is reachable',
        sourceUrl: `${url}/deferred`,
        steps: [
          { type: 'navigate', url: `${url}/deferred` },
          {
            type: 'fill',
            target: {
              role: 'textbox',
              placeholder: 'ชื่อผู้ใช้',
              testId: 'input:username',
              testIdAttribute: 'data-test',
              elementId: 'username',
              attributeName: 'username',
              tagName: 'input'
            },
            value: 'qa-tester'
          }
        ]
      }
      const logs: Array<{ level: string; message: string }> = []
      const result = await runPlaywrightCli({
        source: generatePlaywrightTest(deferredCase),
        testCase: deferredCase,
        testCaseId: deferredCase.id,
        secretValues: [],
        addLog: (level, message) => logs.push({ level, message })
      })

      const output = logs.map((entry) => entry.message).join('\n')
      expect(result.status, output).toBe('passed')
      // It must resolve through the recorded data-test attribute, and only
      // after the element appears — proving the resolver polled rather than
      // giving up on the first sweep.
      expect(output).toContain('[Locator] ชื่อผู้ใช้ -> data-test')
    },
    CLI_TEST_TIMEOUT
  )

  it(
    'runs native and server validation assertions through the real CLI',
    async () => {
      const validationCase: TestCase = {
        ...testCase,
        id: 'TC-VALIDATION-001',
        title: 'Validation matrix is executable',
        sourceUrl: `${url}/validation`,
        steps: [
          { type: 'navigate', url: `${url}/validation` },
          {
            type: 'fill',
            target: { role: 'textbox', name: 'Email', cssSelector: '#email' },
            value: 'invalid-email'
          },
          { type: 'click', target: { role: 'button', name: 'Submit', cssSelector: '#submit' } },
          { type: 'assertInvalid', target: { role: 'textbox', name: 'Email', cssSelector: '#email' } },
          {
            type: 'fill',
            target: { role: 'textbox', name: 'Email', cssSelector: '#email' },
            value: 'tester@example.com'
          },
          { type: 'click', target: { role: 'button', name: 'Submit', cssSelector: '#submit' } },
          { type: 'assertValidation' }
        ]
      }
      const logs: Array<{ level: 'info' | 'pass' | 'fail' | 'warn'; message: string }> = []
      const result = await runPlaywrightCli({
        source: generatePlaywrightTest(validationCase),
        testCase: validationCase,
        testCaseId: validationCase.id,
        secretValues: [],
        addLog: (level, message) => logs.push({ level, message })
      })

      expect(result.status, logs.map((entry) => entry.message).join('\n')).toBe('passed')
      expect(logs.some((entry) => entry.message.includes('passed'))).toBe(true)
    },
    CLI_TEST_TIMEOUT
  )

  it(
    'runs Record-style edited source and returns a screenshot',
    async () => {
      const logs: Array<{ level: 'info' | 'pass' | 'fail' | 'warn'; message: string }> = []
      const result = await runPlaywrightCli({
        source: `import { test } from '@playwright/test'
test('recorded flow', async ({ page }) => {
  await page.goto(${JSON.stringify(url)})
  await page.getByRole('link', { name: 'เข้าสู่ระบบ' }).click()
  await page.screenshot({ path: 'recorded-login.png', fullPage: true })
})`,
        testCase,
        testCaseId: 'TC-REC-001',
        secretValues: [],
        addLog: (level, message) => logs.push({ level, message })
      })

      expect(result.status).toBe('passed')
      expect(result.screenshots).toHaveLength(1)
      expect(result.screenshots[0].name).toContain('recorded-login.png')
      expect(logs.some((entry) => entry.message.includes('passed'))).toBe(true)
    },
    CLI_TEST_TIMEOUT
  )

  it(
    'falls back to the recorded CSS selector when a role locator is ambiguous',
    async () => {
      const duplicateServer = createServer((_request, response) => {
        response.setHeader('content-type', 'text/html; charset=utf-8')
        response.end('<nav><a id="recorded" href="#done">Courses</a></nav><a href="#other">Courses</a>')
      })
      await new Promise<void>((resolve) => duplicateServer.listen(0, '127.0.0.1', resolve))
      const address = duplicateServer.address()
      if (!address || typeof address === 'string') throw new Error('Duplicate locator test server did not start')
      const duplicateUrl = `http://127.0.0.1:${address.port}`
      const duplicateCase: TestCase = {
        ...testCase,
        id: 'TC-REC-FALLBACK-001',
        title: 'Recorded locator fallback',
        steps: [
          { type: 'navigate', url: duplicateUrl },
          { type: 'click', target: { role: 'link', name: 'Courses', cssSelector: '#recorded' } },
          { type: 'assertUrl', urlContains: '#done' }
        ]
      }
      const logs: Array<{ level: 'info' | 'pass' | 'fail' | 'warn'; message: string }> = []
      try {
        const result = await runPlaywrightCli({
          source: generatePlaywrightTest(duplicateCase),
          testCase: duplicateCase,
          testCaseId: duplicateCase.id,
          secretValues: [],
          addLog: (level, message) => logs.push({ level, message })
        })
        expect(result.status).toBe('passed')
        expect(logs.some((entry) => entry.message.includes('[Locator] Courses -> recorded CSS'))).toBe(true)
      } finally {
        await new Promise<void>((resolve, reject) =>
          duplicateServer.close((error) => (error ? reject(error) : resolve()))
        )
      }
    },
    CLI_TEST_TIMEOUT
  )

  it(
    'runs a structured Guided Flow through the real CLI',
    async () => {
      const guidedFlow: GuidedFlow = {
        id: 'flow-login-link',
        name: 'Open login link',
        baseUrl: url,
        steps: [
          { id: 'navigate', type: 'navigate', path: '/' },
          { id: 'click', type: 'click', target: { strategy: 'role', role: 'link', name: 'เข้าสู่ระบบ' } },
          { id: 'assert', type: 'assert', assertion: { type: 'url', value: '/login' } }
        ]
      }
      const logs: Array<{ level: 'info' | 'pass' | 'fail' | 'warn'; message: string }> = []
      const result = await runPlaywrightCli({
        source: generatePlaywrightFromFlow(guidedFlow),
        testCase,
        testCaseId: 'TC-FLOW-001',
        secretValues: [],
        addLog: (level, message) => logs.push({ level, message })
      })

      expect(result.status).toBe('passed')
      expect(logs.some((entry) => entry.message.includes('passed'))).toBe(true)
    },
    CLI_TEST_TIMEOUT
  )

  it(
    'can run a Guided Flow with the saved browser profile fixture',
    async () => {
      const profileDirectory = await mkdtemp(join(tmpdir(), 'lazyscout-profile-'))
      try {
        const result = await runPlaywrightCli({
          source: generatePlaywrightFromFlow({
            id: 'flow-profile',
            name: 'Profile flow',
            baseUrl: url,
            steps: [{ id: 'navigate', type: 'navigate', path: '/' }]
          }),
          testCase,
          testCaseId: 'TC-FLOW-PROFILE',
          secretValues: [],
          profileDirectory,
          addLog: () => undefined
        })
        expect(result.status).toBe('passed')
      } finally {
        await rm(profileDirectory, { recursive: true, force: true })
      }
    },
    CLI_TEST_TIMEOUT
  )
})
