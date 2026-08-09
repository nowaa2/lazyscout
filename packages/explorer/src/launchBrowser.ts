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

export async function launchBrowser(
  options: { userDataDir?: string; headless?: boolean } = {}
): Promise<LaunchedBrowser> {
  const failures: string[] = []

  for (const candidate of CANDIDATES) {
    try {
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

  throw new ExplorerError(
    'browser-error',
    `unable to launch a browser (tried: ${failures.join(', ')})`,
    'Please install Google Chrome or Microsoft Edge or run "npx playwright install chromium" and try again'
  )
}
