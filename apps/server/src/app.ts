import Fastify, { type FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'
import { registerAnalyzeRoute } from './routes/analyze.js'
import { registerExportCsvRoute } from './routes/exportCsv.js'
import { registerAutomationRunRoute } from './routes/automationRun.js'
import { registerApiCheckRunRoute } from './routes/apiCheckRun.js'
import { registerLoadTestRoute } from './routes/loadTest.js'
import { registerVersionRoutes } from './routes/versions.js'

export type AppOptions = {
  staticDir?: string
  logLevel?: string
  appVersion?: string
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: { level: options.logLevel ?? process.env.LOG_LEVEL ?? 'info' },

    connectionTimeout: 0,
    bodyLimit: 10 * 1024 * 1024
  })

  const appVersion = options.appVersion ?? process.env.npm_package_version ?? '0.0.0-dev'

  app.get('/api/health', async () => ({ status: 'ok', version: appVersion }))

  registerAnalyzeRoute(app)
  registerExportCsvRoute(app)
  registerAutomationRunRoute(app)
  registerApiCheckRunRoute(app)
  registerLoadTestRoute(app)
  registerVersionRoutes(app, appVersion)

  if (options.staticDir) {
    app.register(fastifyStatic, { root: options.staticDir })

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
