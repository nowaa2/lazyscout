import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright-core'
import { executeEditedCode, locator, parseEditedLocator } from '../src/routes/automationRun.js'

/** A login button reachable by role, id, and test id, so every strategy has something to hit. */
const FIXTURE = `<!doctype html>
<html>
  <body>
    <label for="email">Email address</label>
    <input id="email" name="email" placeholder="you@example.com" />
    <button id="login" data-testid="login" name="login">Login</button>
  </body>
</html>`

let browser: Browser
let page: Page

beforeAll(async () => {
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage()
  await page.setContent(FIXTURE)
}, 60_000)

afterAll(async () => {
  await browser?.close().catch(() => undefined)
})

describe('structured target resolution', () => {
  it('resolves a role + name target the Explorer and Recorder produce', async () => {
    await expect(locator(page, { role: 'button', name: 'Login' }).count()).resolves.toBe(1)
  })

  it('resolves a CSS target', async () => {
    await expect(locator(page, { cssSelector: '#login' }).count()).resolves.toBe(1)
  })

  it('resolves a data-testid CSS target', async () => {
    await expect(locator(page, { cssSelector: '[data-testid="login"]' }).count()).resolves.toBe(1)
  })

  it('resolves label and placeholder targets', async () => {
    await expect(locator(page, { label: 'Email address' }).count()).resolves.toBe(1)
    await expect(locator(page, { placeholder: 'you@example.com' }).count()).resolves.toBe(1)
  })

  it('fails in a controlled way when a Playwright expression is stored as a CSS selector', async () => {
    const target = { cssSelector: `getByRole('button', { name: 'Login' })` }
    await expect(locator(page, target).count()).rejects.toThrow()
  })
})

describe('edited source locator parsing', () => {
  const parses = (expression: string) => parseEditedLocator(page, expression)

  it('accepts the shapes the generator emits', () => {
    expect(parses(`page.getByRole("button", { name: "Login" })`).label).toBe('Login')
    expect(parses(`page.getByLabel("Email address")`).label).toBe('Email address')
    expect(parses(`page.getByPlaceholder("you@example.com")`).label).toBe('you@example.com')
    expect(parses(`page.getByText("Login")`).label).toBe('Login')
    expect(parses(`page.locator("#login")`).label).toBe('#login')
  })

  it('accepts single-quoted locators, the form Playwright documents', async () => {
    const target = parses(`page.getByRole('button', { name: 'Login' })`)
    expect(target.label).toBe('Login')
    await expect(target.locator.count()).resolves.toBe(1)
  })

  it('accepts getByTestId', async () => {
    await expect(parses(`page.getByTestId("login")`).locator.count()).resolves.toBe(1)
  })

  it('accepts an index suffix so a strict-mode match can be narrowed', async () => {
    await expect(parses(`page.getByRole("button", { name: "Login" }).first()`).locator.count()).resolves.toBe(1)
    await expect(parses(`page.locator("button").last()`).locator.count()).resolves.toBe(1)
    await expect(parses(`page.locator("button").nth(0)`).locator.count()).resolves.toBe(1)
  })

  it('reports a controlled error for a locator without the page prefix', () => {
    expect(() => parses(`getByRole("button", { name: "Login" })`)).toThrow(/Unsupported locator/)
  })

  it('reports a controlled error for an unknown locator method', () => {
    expect(() => parses(`page.getByAltText("logo")`)).toThrow(/Unsupported locator/)
  })

  it('explains what it expected instead of failing bare', () => {
    expect(() => parses(`page.getByAltText("logo")`)).toThrow(/Expected page\.getByRole/)
  })

  it('never executes a malformed locator as code', () => {
    // A resolver that evaluated its input would run this; an explicit parser rejects it.
    const injected = `page.locator("a"); process.exit(1)`
    expect(() => parses(injected)).toThrow(/Unsupported locator/)
    expect(() => parses(`page.locator(process.env.HOME)`)).toThrow(/Unsupported locator/)
  })
})

describe('edited source statements', () => {
  const run = (source: string) => executeEditedCode(page, source, 'TC-001', [], () => undefined, [])

  it('runs a single-quoted click and fill end to end', async () => {
    await page.setContent(FIXTURE)
    await run(
      [
        `await page.getByLabel('Email address').fill('qa@example.com')`,
        `await page.getByRole('button', { name: 'Login' }).click()`
      ].join('\n')
    )
    await expect(page.locator('#email').inputValue()).resolves.toBe('qa@example.com')
  })

  it('surfaces the locator error instead of crashing the run', async () => {
    await page.setContent(FIXTURE)
    await expect(run(`await page.getByAltText("logo").click()`)).rejects.toThrow(/Unsupported/)
  })

  it('still refuses statements it cannot execute', async () => {
    await page.setContent(FIXTURE)
    await expect(run(`await page.getByRole('button', { name: 'Login' }).hover()`)).rejects.toThrow(
      /Unsupported edited Playwright statement/
    )
  })
})
