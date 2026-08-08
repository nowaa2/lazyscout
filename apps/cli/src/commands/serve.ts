import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildApp } from '@lazyscout/server'
import { openInBrowser } from '../openInBrowser.js'

export type ServeOptions = {
  port?: number
  open: boolean
}

const DEFAULT_PORT = 4321
/** หน้าเว็บที่ build แล้วถูกคัดลอกมาไว้ข้าง ๆ ไฟล์ที่รันอยู่ (ดู build.mjs) */
const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), 'web')

/** เปิด API + หน้าเว็บในเครื่องผู้ใช้ แล้วเด้งเบราว์เซอร์ให้ */
export async function runServe(options: ServeOptions): Promise<void> {
  const app = buildApp({ staticDir: WEB_DIR, logLevel: 'warn' })
  const port = await listenOnFreePort(app, options.port ?? DEFAULT_PORT)
  const url = `http://localhost:${port}`

  console.log(`\n  LazyScout พร้อมใช้งานแล้วที่  ${url}`)
  console.log('  กด Ctrl+C เพื่อปิด\n')

  if (options.open) await openInBrowser(url)
}

/**
 * ลองพอร์ตถัดไปเรื่อย ๆ เมื่อพอร์ตที่ต้องการไม่ว่าง
 * (ผู้ใช้ไม่ควรต้องมานั่งหาว่าพอร์ตไหนว่าง)
 */
async function listenOnFreePort(app: ReturnType<typeof buildApp>, startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    try {
      await app.listen({ host: '127.0.0.1', port })
      return port
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'EADDRINUSE') throw error
    }
  }
  throw new Error(`หาพอร์ตว่างไม่ได้ในช่วง ${startPort}-${startPort + 19}`)
}
