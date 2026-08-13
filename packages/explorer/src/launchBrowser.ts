import { chromium, type BrowserContext } from 'playwright-core'
import { ExplorerError } from './errors.js'

const CANDIDATES = [
  { channel: undefined, label: 'Playwright Chromium' },
  { channel: 'chrome', label: 'Google Chrome' },
  { channel: 'msedge', label: 'Microsoft Edge' }
] as const

export type LaunchedBrowser = {
  context: BrowserContext
  label: string
  close: () => Promise<void>
}

export type LaunchBrowserOptions = {
  userDataDir?: string
  headless?: boolean
  /**
   * A saved `storageState`. Preferred over `userDataDir` for anything that only
   * needs to reuse a login: it carries session cookies, which a profile
   * directory drops when the browser closes, and it takes no directory lock so
   * several runs can use it without fighting over the profile.
   */
  storageState?: unknown
}

export async function launchBrowser(options: LaunchBrowserOptions = {}): Promise<LaunchedBrowser> {
  const failures: string[] = []

  for (const candidate of CANDIDATES) {
    try {
      // A snapshot wins over the profile directory: it is the only one of the
      // two that survives a browser restart with the session intact.
      if (options.storageState) {
        const browser = await chromium.launch({
          headless: options.headless ?? true,
          ...(candidate.channel ? { channel: candidate.channel } : {})
        })
        const context = await browser.newContext({
          viewport: { width: 1366, height: 900 },
          storageState: options.storageState as Parameters<typeof browser.newContext>[0] extends {
            storageState?: infer S
          }
            ? S
            : never
        })
        return { context, label: candidate.label, close: () => browser.close() }
      }
      if (options.userDataDir) {
        const context = await chromium.launchPersistentContext(options.userDataDir, {
          headless: options.headless ?? true,
          viewport: { width: 1366, height: 900 },
          ...(candidate.channel ? { channel: candidate.channel } : {})
        })
        return { context, label: candidate.label, close: () => context.close() }
      }
      const browser = await chromium.launch({
        headless: options.headless ?? true,
        ...(candidate.channel ? { channel: candidate.channel } : {})
      })
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
      return { context, label: candidate.label, close: () => browser.close() }
    } catch (error) {
      failures.push(candidate.label)
      void error
    }
  }

  // Chromium locks a profile directory, so the usual cause here is another
  // LazyScout browser for the same Project rather than a missing browser.
  throw new ExplorerError(
    'browser-error',
    `unable to launch a browser (tried: ${failures.join(', ')})`,
    options.userDataDir
      ? 'Close any other LazyScout browser for this Project — the login browser and a recording both hold its profile — and try again'
      : 'Please install Google Chrome or Microsoft Edge or run "npx playwright install chromium" and try again'
  )
}
