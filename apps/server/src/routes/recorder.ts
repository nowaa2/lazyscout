import type { FastifyInstance } from 'fastify'
import { checkTargetUrl } from '@lazyscout/core'
import { launchBrowser } from '@lazyscout/explorer'
import { browserProfileDirectory } from '../workspace.js'
import { config } from '../config.js'
import { RecorderSessions, type LaunchRecorderBrowser, type RecorderInteraction } from '../recorderSessions.js'

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
      launchBrowser({ userDataDir: await browserProfileDirectory(workspaceRoot, projectId), headless: true }))

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

  app.post<{ Params: { projectId: string } }>('/api/recorder/:projectId/inspect', async (request, reply) => {
    const body = request.body as { enabled?: boolean }
    return reply.send(await sessions.setInspectMode(request.params.projectId, body?.enabled === true))
  })

  app.get<{ Params: { projectId: string } }>('/api/recorder/:projectId/frame', async (request, reply) => {
    try {
      const frame = await sessions.frame(request.params.projectId)
      return reply.header('Content-Type', 'image/jpeg').header('Cache-Control', 'no-store').send(frame)
    } catch (error) {
      return reply.status(409).send({
        error: { code: 'recorder-frame-unavailable', message: error instanceof Error ? error.message : String(error) }
      })
    }
  })

  app.post<{ Params: { projectId: string } }>('/api/recorder/:projectId/interact', async (request, reply) => {
    let interaction = request.body as RecorderInteraction
    if (!isRecorderInteraction(interaction))
      return reply
        .status(400)
        .send({ error: { code: 'invalid-recorder-interaction', message: 'Invalid interaction.' } })
    if (interaction.type === 'navigate') {
      const check = checkTargetUrl(interaction.url, config.urlPolicy)
      if (!check.ok) return reply.status(400).send({ error: { code: check.code, message: check.message } })
      interaction = { type: 'navigate', url: check.url.toString() }
    }
    try {
      return reply.send(await sessions.interact(request.params.projectId, interaction))
    } catch (error) {
      return reply.status(409).send({
        error: { code: 'recorder-interaction-failed', message: error instanceof Error ? error.message : String(error) }
      })
    }
  })

  app.delete<{ Params: { projectId: string } }>('/api/recorder/:projectId', async (request, reply) =>
    reply.send(await sessions.discard(request.params.projectId))
  )

  app.addHook('onClose', async () => {
    await sessions.closeAll()
  })
}

function isRecorderInteraction(value: unknown): value is RecorderInteraction {
  if (!value || typeof value !== 'object') return false
  const interaction = value as Record<string, unknown>
  if (interaction.type === 'click' || interaction.type === 'move')
    return Number.isFinite(interaction.x) && Number.isFinite(interaction.y)
  if (interaction.type === 'text') return typeof interaction.text === 'string' && interaction.text.length <= 500
  if (interaction.type === 'key') return typeof interaction.key === 'string' && interaction.key.length <= 80
  if (interaction.type === 'scroll') return Number.isFinite(interaction.deltaX) && Number.isFinite(interaction.deltaY)
  if (interaction.type === 'navigate') return typeof interaction.url === 'string' && interaction.url.length <= 2048
  return interaction.type === 'back' || interaction.type === 'forward' || interaction.type === 'reload'
}
