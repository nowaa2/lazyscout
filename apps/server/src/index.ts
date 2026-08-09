import { buildApp, ensureWorkspace, resolveWorkspaceRoot } from './app.js'
import { config } from './config.js'

const workspaceRoot = resolveWorkspaceRoot()
await ensureWorkspace(workspaceRoot)
const app = buildApp({ workspaceRoot })

try {
  await app.listen({ host: config.host, port: config.port })
  app.log.info(`LazyScout API พร้อมใช้งานที่ http://${config.host}:${config.port}`)
  app.log.info(`LazyScout workspace: ${workspaceRoot}`)
} catch (error) {
  app.log.error({ err: error }, 'start server failed')
  process.exit(1)
}
