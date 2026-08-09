import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildApp, ensureWorkspace, resolveWorkspaceRoot } from '@lazyscout/server'
import { openInBrowser } from '../openInBrowser.js'
import { VERSION } from '../version.js'

export type ServeOptions = {
  port?: number
  open: boolean
  workspace?: string
}

const DEFAULT_PORT = 4321

const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), 'web')

export async function runServe(options: ServeOptions): Promise<void> {
  const workspaceRoot = resolveWorkspaceRoot(options.workspace)
  await ensureWorkspace(workspaceRoot)
  const app = buildApp({ staticDir: WEB_DIR, logLevel: 'warn', appVersion: VERSION, workspaceRoot })
  const port = await listenOnFreePort(app, options.port ?? DEFAULT_PORT)
  const url = `http://localhost:${port}`

  console.log(`\n  🚀 LazyScout is now available.  ${url}`)
  console.log(`  📁 Workspace: ${workspaceRoot}`)
  console.log('  Press Ctrl+C to exit \n')

  if (options.open) await openInBrowser(url)
}

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
  throw new Error(`No free port found in the specified range ${startPort}-${startPort + 19}`)
}
