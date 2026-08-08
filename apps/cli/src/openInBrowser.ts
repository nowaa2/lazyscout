import { spawn } from 'node:child_process'

/** เปิด URL ด้วยเบราว์เซอร์ประจำเครื่อง — เปิดไม่ได้ก็ไม่ถือว่าพัง แค่ให้ผู้ใช้กดลิงก์เอง */
export async function openInBrowser(url: string): Promise<void> {
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]]

  try {
    const child = spawn(command as string, args as string[], { stdio: 'ignore', detached: true })
    child.on('error', () => undefined)
    child.unref()
  } catch {
    // ไม่ต้องทำอะไร — ข้อความบอก URL ถูกพิมพ์ไปแล้ว
  }
}
