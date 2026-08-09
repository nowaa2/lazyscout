import { chromium, type Browser } from 'playwright-core'
import { ExplorerError } from './errors.js'

const CANDIDATES = [
  { channel: undefined, label: 'Chromium ของ Playwright' },
  { channel: 'chrome', label: 'Google Chrome' },
  { channel: 'msedge', label: 'Microsoft Edge' }
] as const

export type LaunchedBrowser = {
  browser: Browser

  label: string
}

export async function launchBrowser(): Promise<LaunchedBrowser> {
  const failures: string[] = []

  for (const candidate of CANDIDATES) {
    try {
      const browser = await chromium.launch({
        headless: true,
        ...(candidate.channel ? { channel: candidate.channel } : {})
      })
      return { browser, label: candidate.label }
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
