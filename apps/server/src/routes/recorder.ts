import type { FastifyInstance } from 'fastify'
import { checkTargetUrl } from '@lazyscout/core'
import { launchBrowser } from '@lazyscout/explorer'
import { browserProfileDirectory } from '../workspace.js'
import { config } from '../config.js'
import { RecorderSessions, type LaunchRecorderBrowser } from '../recorderSessions.js'

export type RecorderRouteOptions = {
  launch?: LaunchRecorderBrowser
}

export function registerRecorderRoutes(
  app: FastifyInstance,
  workspaceRoot: string,
  options: RecorderRouteOptions = {}
): void {
  // Reuses the Project profile, so a session created by Open login browser is
  // already signed in. Chromium locks the directory, so only one browser for a
  // Project can be open at a time.
  const launch: LaunchRecorderBrowser =
    options.launch ??
    (async (projectId) =>
      launchBrowser({ userDataDir: await browserProfileDirectory(workspaceRoot, projectId), headless: false }))

  const sessions = new RecorderSessions(launch)

  app.post<{ Params: { projectId: string } }>('/api/recorder/:projectId/start', async (request, reply) => {
    const { projectId } = request.params
    const body = request.body as { url?: string }
    if (!body?.url)
      return reply.status(400).send({ error: { code: 'invalid-url', message: 'A start URL is required.' } })

    const check = checkTargetUrl(body.url, config.urlPolicy)
    if (!check.ok) return reply.status(400).send({ error: { code: check.code, message: check.message } })

    if (sessions.isRunning(projectId))
      return reply.status(409).send({
        error: {
          code: 'recorder-busy',
          message: 'A recording is already running for this Project.',
          hint: 'Stop the current recording before starting another one.'
        }
      })

    try {
      return reply.send(await sessions.start(projectId, check.url.toString()))
    } catch (error) {
      return reply.status(500).send({
        error: {
          code: 'browser-error',
          message: error instanceof Error ? error.message : 'The browser could not be started.',
          hint: 'Close any other LazyScout browser for this Project and try again.'
        }
      })
    }
  })

  app.get<{ Params: { projectId: string } }>('/api/recorder/:projectId', async (request) =>
    sessions.state(request.params.projectId)
  )

  app.post<{ Params: { projectId: string } }>('/api/recorder/:projectId/stop', async (request, reply) =>
    reply.send(await sessions.stop(request.params.projectId))
  )

  app.addHook('onClose', async () => {
    await sessions.closeAll()
  })
}
