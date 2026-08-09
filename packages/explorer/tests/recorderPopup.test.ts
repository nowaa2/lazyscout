import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core'
import { attachRecorder, type RecorderHandle } from '../src/recorder/attachRecorder.js'

/**
 * SSO sign-in happens in a window.open() popup. Playwright creates that page
 * object after the popup's first document has started, so addInitScript never
 * reaches it and the recorder has to inject itself. Without that injection a
 * Google login records nothing at all.
 */
describe('recording follows a popup window', () => {
  let browser: Browser
  let context: BrowserContext
  let page: Page
  let handle: RecorderHandle

  const PAGE = 'http://recorder.test/opener'
  const POPUP = 'http://recorder.test/consent'
  const BODIES: Record<string, string> = {
    '/opener': '<!doctype html><title>Opener</title><button id="open">Open</button>',
    '/consent':
      '<!doctype html><title>Consent</title><label for="u">Account</label><input id="u"><button id="allow">Allow</button>'
  }

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true })
    context = await browser.newContext()
    // Served by the browser itself, so the test needs no listening port.
    await context.route('http://recorder.test/**', async (route, request) => {
      const path = new URL(request.url()).pathname
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: BODIES[path] ?? '<!doctype html><title>x</title>'
      })
    })
    handle = await attachRecorder(context, 'about:blank')
    page = await context.newPage()
    await page.goto(PAGE, { waitUntil: 'domcontentloaded' })
  }, 60_000)

  afterAll(async () => {
    await browser?.close().catch(() => undefined)
  })

  it('records clicks and typing that happen inside the popup', async () => {
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.evaluate((url) => window.open(url, 'sso'), POPUP)
    ])
    await popup.waitForLoadState('domcontentloaded')

    await popup.getByLabel('Account').fill('qa@example.com')
    await popup.getByRole('button', { name: 'Allow' }).click()
    await popup.waitForTimeout(600)

    const steps = handle.steps()
    const filled = steps.find((step) => step.type === 'fill')
    const clicked = steps.find((step) => step.type === 'click')

    expect(filled).toMatchObject({ type: 'fill', value: 'qa@example.com' })
    expect(clicked).toMatchObject({ type: 'click', target: { name: 'Allow' } })
  }, 60_000)
})
