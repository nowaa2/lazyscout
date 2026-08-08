import Fastify, { type FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'
import { registerAnalyzeRoute } from './routes/analyze.js'
import { registerExportCsvRoute } from './routes/exportCsv.js'

export type AppOptions = {
  /** โฟลเดอร์ของหน้าเว็บที่ build แล้ว — ใส่เมื่อรันผ่าน CLI เพื่อให้เสิร์ฟ UI ได้ในตัว */
  staticDir?: string
  logLevel?: string
}

/** ประกอบ Fastify app (แยกจากการ listen เพื่อให้ CLI และเทสนำไปใช้ต่อได้) */
export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: { level: options.logLevel ?? process.env.LOG_LEVEL ?? 'info' },
    // การ crawl ใช้เวลานาน จึงต้องยืด timeout ของ request ให้พอ
    connectionTimeout: 0,
    bodyLimit: 10 * 1024 * 1024
  })

  app.get('/api/health', async () => ({ status: 'ok' }))

  registerAnalyzeRoute(app)
  registerExportCsvRoute(app)

  if (options.staticDir) {
    app.register(fastifyStatic, { root: options.staticDir })

    // SPA fallback: path ที่ไม่ใช่ /api ให้คืน index.html
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.status(404).send({ error: { code: 'not-found', message: 'ไม่พบ endpoint นี้' } })
      }
      return reply.sendFile('index.html')
    })
  } else {
    app.setNotFoundHandler(async (_request, reply) =>
      reply.status(404).send({ error: { code: 'not-found', message: 'ไม่พบ endpoint นี้' } })
    )
  }

  return app
}
