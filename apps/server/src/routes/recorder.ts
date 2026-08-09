import type { FastifyInstance } from 'fastify'
import type { RecorderState, TestStep } from '@lazyscout/core'
import { checkTargetUrl } from '@lazyscout/core'
import { attachRecorder, launchBrowser, type RecorderHandle } from '@lazyscout/explorer'
import { browserProfileDirectory } from '../workspace.js'
import { config } from '../config.js'

type Session = {
  projectId: string
  startUrl: string
  startedAt: string
  browserLabel: string
  handle: RecorderHandle
  close: () => Promise<void>
  closed: boolean
  finalSteps?: TestStep[]
}

const sessions = new Map<string, Session>()

function stateOf(session: Session): RecorderState {
  return {
    projectId: session.projectId,
    status: session.closed ? 'stopped' : 'recording',
    startUrl: session.startUrl,
    startedAt: session.startedAt,
    browserLabel: session.browserLabel,
    steps: session.finalSteps ?? session.handle.steps()
  }
}

function idleState(projectId: string): RecorderState {
  return { projectId, status: 'idle', startUrl: '', startedAt: '', steps: [] }
}

async function endSession(session: Session): Promise<void> {
  if (session.closed) return
  session.finalSteps = session.handle.finalize()
  session.closed = true
  await session.close().catch(() => undefined)
}

export function registerRecorderRoutes(app: FastifyInstance, workspaceRoot: string): void {
  app.post<{ Params: { projectId: string } }>('/api/recorder/:projectId/start', async (request, reply) => {
    const { projectId } = request.params
    const body = request.body as { url?: string }
    if (!body?.url)
      return reply.status(400).send({ error: { code: 'invalid-url', message: 'A start URL is required.' } })

    const check = checkTargetUrl(body.url, config.urlPolicy)
    if (!check.ok) return reply.status(400).send({ error: { code: check.code, message: check.message } })
    const startUrl = check.url.toString()

    const existing = sessions.get(projectId)
    if (existing && !existing.closed)
      return reply.status(409).send({
        error: {
          code: 'recorder-busy',
          message: 'A recording is already running for this Project.',
          hint: 'Stop the current recording before starting another one.'
        }
      })

    // Reuses the Project profile, so a session created by Open login browser
    // is already signed in. Chromium locks the directory, so only one of the
    // two browsers can be open at a time.
    const profile = await browserProfileDirectory(workspaceRoot, projectId)
    let launched
    try {
      launched = await launchBrowser({ userDataDir: profile, headless: false })
    } catch (error) {
      return reply.status(500).send({
        error: {
          code: 'browser-error',
          message: error instanceof Error ? error.message : 'The browser could not be started.',
          hint: 'Close any other LazyScout browser for this Project and try again.'
        }
      })
    }

    const handle = await attachRecorder(launched.context, startUrl)
    const page = launched.context.pages()[0] ?? (await launched.context.newPage())
    await page.goto(startUrl, { waitUntil: 'domcontentloaded' })

    const session: Session = {
      projectId,
      startUrl,
      startedAt: new Date().toISOString(),
      browserLabel: launched.label,
      handle,
      close: launched.close,
      closed: false
    }
    sessions.set(projectId, session)

    // The operator closing the window ends the recording just like Stop does.
    launched.context.on('close', () => {
      void endSession(session)
    })

    return reply.send(stateOf(session))
  })

  app.get<{ Params: { projectId: string } }>('/api/recorder/:projectId', async (request) => {
    const session = sessions.get(request.params.projectId)
    return session ? stateOf(session) : idleState(request.params.projectId)
  })

  app.post<{ Params: { projectId: string } }>('/api/recorder/:projectId/stop', async (request, reply) => {
    const session = sessions.get(request.params.projectId)
    if (!session) return reply.send(idleState(request.params.projectId))
    await endSession(session)
    return reply.send(stateOf(session))
  })

  app.addHook('onClose', async () => {
    await Promise.all([...sessions.values()].map((session) => endSession(session)))
    sessions.clear()
  })
}
