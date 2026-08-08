import { chromium, type Browser } from 'playwright-core'
import { ExplorerError } from './errors.js'

/** เบราว์เซอร์ที่ลองใช้ตามลำดับ — ตัวแรกที่เปิดได้คือตัวที่ใช้ */
const CANDIDATES = [
  { channel: undefined, label: 'Chromium ของ Playwright' },
  { channel: 'chrome', label: 'Google Chrome' },
  { channel: 'msedge', label: 'Microsoft Edge' }
] as const

export type LaunchedBrowser = {
  browser: Browser
  /** ชื่อเบราว์เซอร์ที่ใช้จริง เอาไว้แสดงใน CLI */
  label: string
}

/**
 * เปิดเบราว์เซอร์โดยไม่บังคับให้ผู้ใช้ต้องโหลด Chromium ก่อน
 *
 * เราใช้ playwright-core ซึ่งไม่ดาวน์โหลดเบราว์เซอร์เอง (npx จึงเริ่มทำงานได้เร็ว)
 * แล้วอาศัยเบราว์เซอร์ที่มีอยู่ในเครื่องแทน — เครื่องที่ทำงาน QA แทบทุกเครื่องมี Chrome หรือ Edge อยู่แล้ว
 */
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
    `เปิดเบราว์เซอร์ไม่ได้ (ลองแล้ว: ${failures.join(', ')})`,
    'ติดตั้ง Google Chrome หรือ Microsoft Edge หรือรัน "npx playwright install chromium" แล้วลองใหม่'
  )
}
