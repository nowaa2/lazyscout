import { buildApp } from './app.js'
import { config } from './config.js'

const app = buildApp()

try {
  await app.listen({ host: config.host, port: config.port })
  app.log.info(`LazyScout API พร้อมใช้งานที่ http://${config.host}:${config.port}`)
} catch (error) {
  app.log.error({ err: error }, 'start server failed')
  process.exit(1)
}
