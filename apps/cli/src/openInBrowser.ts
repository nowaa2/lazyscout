import { spawn } from 'node:child_process'

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

  }
}
