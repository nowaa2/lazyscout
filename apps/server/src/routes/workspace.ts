import { dirname } from 'node:path'
import type { Page } from 'playwright-core'
import type { FastifyInstance } from 'fastify'
import type { AutomationScreenshot } from '@lazyscout/core'
import { checkTargetUrl } from '@lazyscout/core'
import { launchBrowser, type LaunchedBrowser } from '@lazyscout/explorer'
import { config } from '../config.js'
import { AuthProfileBusyError, acquireAuthLock, currentAuthLock } from '../auth/authLock.js'
import {
  captureAuthSnapshot,
  clearAuthSnapshot,
  loadAuthSnapshot,
  readAuthMeta,
  restoreSessionStorage,
  saveAuthSnapshot,
  updateAuthMeta,
  verifyAuthState,
  waitForAuthSettle
} from '../auth/authState.js'
import {
  deleteBugReport,
  deleteProject,
  deleteScreenshot,
  browserProfileDirectory,
  browserProfileStatus,
  clearBrowserProfile,
  listBugReports,
  listProjects,
  openWorkspace,
  readAutomation,
  readGuidedFlows,
  readScreenshots,
  saveAutomation,
  saveGuidedFlows,
  saveBugReport,
  saveProject,
  saveReport,
  saveScreenshot,
  screenshotFile,
  type WorkspaceBugReport,
  type WorkspaceProject
} from '../workspace.js'

type ProjectParams = { projectId: string }
type ScreenshotParams = ProjectParams & { name: string }
type BugParams = ProjectParams & { bugId: string }

/** A login window waiting for the operator to finish signing in. */
type ActiveAuthSession = {
  launched: LaunchedBrowser
  release: () => Promise<void>
  headless: boolean
  projectDirectory: string
}
const authSessions = new Map<string, ActiveAuthSession>()

/** The Project folder, which is where the auth snapshot and lock live. */
async function projectPath(root: string, projectId: string): Promise<string> {
  return dirname(await browserProfileDirectory(root, projectId))
}

export function registerWorkspaceRoutes(app: FastifyInstance, root: string): void {
  app.get('/api/workspace', async () => ({ root, projects: await listProjects(root) }))

  app.post('/api/workspace/open', async (_request, reply) => {
    await openWorkspace(root)
    return reply.send({ opened: true, root })
  })

  app.put<{ Params: ProjectParams }>('/api/workspace/projects/:projectId', async (request, reply) => {
    const project = request.body as WorkspaceProject
    if (!project || project.id !== request.params.projectId)
      return reply.status(400).send({ error: { code: 'invalid-project', message: 'Project ID does not match.' } })
    await saveProject(root, project)
    return reply.send({ saved: true })
  })

  app.delete<{ Params: ProjectParams }>('/api/workspace/projects/:projectId', async (request, reply) => {
    await deleteProject(root, request.params.projectId)
    return reply.send({ deleted: true })
  })

  app.post<{ Params: ProjectParams }>('/api/workspace/projects/:projectId/auth-session', async (request, reply) => {
    const body = request.body as { url?: string }
    if (!body?.url)
      return reply.status(400).send({ error: { code: 'invalid-url', message: 'A login URL is required.' } })

    const check = checkTargetUrl(body.url, config.urlPolicy)
    if (!check.ok) return reply.status(400).send({ error: { code: check.code, message: check.message } })

    const { projectId } = request.params
    const projectDirectory = await projectPath(root, projectId)
    const log = (message: string) => request.log.info(message)

    let release: (() => Promise<void>) | undefined
    try {
      release = await acquireAuthLock(projectDirectory, 'login-browser', { log })
    } catch (error) {
      if (error instanceof AuthProfileBusyError)
        return reply.status(409).send({
          error: { code: error.code, message: error.message, hint: 'Close the other LazyScout browser and try again.' }
        })
      throw error
    }

    // Always visible. A person has to read the page and type credentials into
    // it, so a headless sign-in window is simply unusable — making this follow
    // the execution mode made "Open login browser" appear to do nothing.
    // Consistency still matters, but it is enforced by reporting the mismatch
    // on the snapshot rather than by hiding the window from the operator.
    const headless = false
    const launched = await launchBrowser({ userDataDir: await browserProfileDirectory(root, projectId), headless })
    const page = launched.context.pages()[0] ?? (await launched.context.newPage())
    await page.goto(check.url.toString(), { waitUntil: 'domcontentloaded' })
    await updateAuthMeta(projectDirectory, { status: 'verifying', detail: 'Waiting for the sign-in window to close' })

    // The snapshot is taken on an explicit capture call rather than on a URL
    // change: an application that redirects, exchanges a code and only then
    // sets its real cookie would otherwise be captured half signed-in.
    authSessions.set(projectId, { launched, release, headless, projectDirectory })
    log('[Auth] Login browser opened')
    return reply.send({ opened: true, headless })
  })

  /** Called once the operator has signed in; captures and stores the snapshot. */
  app.post<{ Params: ProjectParams }>(
    '/api/workspace/projects/:projectId/auth-session/capture',
    async (request, reply) => {
      const { projectId } = request.params
      const active = authSessions.get(projectId)
      if (!active)
        return reply.status(409).send({
          error: { code: 'no-login-browser', message: 'Open the login browser before capturing a session.' }
        })
      const log = (message: string) => request.log.info(message)
      // The window is closed and the lock released *before* replying. Cleaning
      // up in a `finally` after `reply.send` let the caller act on the response
      // while the lock was still held, so pressing Verify straight after
      // Capture was rejected as busy by a lock about to disappear.
      let meta: Awaited<ReturnType<typeof saveAuthSnapshot>> | undefined
      let failure: unknown
      try {
        log('[Auth] Recorded login completed')
        const page = active.launched.context.pages().find((candidate: Page) => !candidate.isClosed())
        await waitForAuthSettle(active.launched.context, page, { log })
        const { snapshot, indexedDb } = await captureAuthSnapshot(active.launched.context, { log })
        meta = await saveAuthSnapshot(active.projectDirectory, snapshot, {
          indexedDb,
          capturedHeadless: active.headless,
          log
        })
      } catch (error) {
        failure = error
      }

      authSessions.delete(projectId)
      await active.launched.close().catch(() => undefined)
      await active.release().catch(() => undefined)

      if (failure) throw failure
      return reply.send(meta)
    }
  )

  app.get<{ Params: ProjectParams }>('/api/workspace/projects/:projectId/auth-session/status', async (request) => {
    const { projectId } = request.params
    const projectDirectory = await projectPath(root, projectId)
    const meta = await readAuthMeta(projectDirectory)
    const lock = await currentAuthLock(projectDirectory)
    return {
      ...meta,
      // Kept so existing callers keep working; it describes the directory only
      // and never means the login still works.
      profile: await browserProfileStatus(root, projectId),
      lockedBy: lock?.holder,
      // Whether a sign-in window is still open and waiting to be captured.
      // Held on the server so closing and reopening the dialog does not lose it.
      loginBrowserOpen: authSessions.has(projectId),
      executionHeadless: config.headless,
      // A snapshot taken in a different browser mode can be rejected by an app
      // that binds a session to the browser it was issued to.
      browserModeMismatch: meta.capturedHeadless !== undefined && meta.capturedHeadless !== config.headless
    }
  })

  /** Opens a protected path with the snapshot restored and reports the result. */
  app.post<{ Params: ProjectParams }>(
    '/api/workspace/projects/:projectId/auth-session/verify',
    async (request, reply) => {
      const { projectId } = request.params
      const body = (request.body ?? {}) as { url?: string }
      if (!body.url)
        return reply.status(400).send({ error: { code: 'invalid-url', message: 'A protected URL is required.' } })
      const check = checkTargetUrl(body.url, config.urlPolicy)
      if (!check.ok) return reply.status(400).send({ error: { code: check.code, message: check.message } })

      const projectDirectory = await projectPath(root, projectId)
      const snapshot = await loadAuthSnapshot(projectDirectory)
      if (!snapshot)
        return reply.status(409).send({
          error: { code: 'no-auth-snapshot', message: 'Record a login before verifying it.' }
        })

      const log = (message: string) => request.log.info(message)
      let release: (() => Promise<void>) | undefined
      try {
        release = await acquireAuthLock(projectDirectory, 'scout', { log })
      } catch (error) {
        if (error instanceof AuthProfileBusyError)
          return reply.status(409).send({ error: { code: error.code, message: error.message } })
        throw error
      }

      await updateAuthMeta(projectDirectory, { status: 'verifying' })
      const launched = await launchBrowser({ storageState: snapshot.storageState, headless: config.headless })
      try {
        await restoreSessionStorage(launched.context, snapshot.sessionStorage)
        log('[Auth] Restoring authenticated state')
        const page = launched.context.pages()[0] ?? (await launched.context.newPage())
        const result = await verifyAuthState(page, check.url.toString(), { log })
        const meta = await updateAuthMeta(projectDirectory, {
          status: result.ok ? 'ready' : 'expired',
          verifiedAt: new Date().toISOString(),
          verifiedPath: new URL(check.url.toString()).pathname,
          detail: result.detail
        })
        if (result.ok) log('[Auth] READY')
        return reply.send(meta)
      } finally {
        await launched.close().catch(() => undefined)
        await release().catch(() => undefined)
      }
    }
  )

  app.delete<{ Params: ProjectParams }>('/api/workspace/projects/:projectId/auth-session', async (request, reply) => {
    const { projectId } = request.params
    await clearBrowserProfile(root, projectId)
    await clearAuthSnapshot(await projectPath(root, projectId))
    return reply.send({ cleared: true })
  })

  app.get<{ Params: ProjectParams }>('/api/workspace/projects/:projectId/screenshots', async (request) =>
    readScreenshots(root, request.params.projectId)
  )

  app.post<{ Params: ProjectParams }>('/api/workspace/projects/:projectId/screenshots', async (request) =>
    saveScreenshot(root, request.params.projectId, request.body as AutomationScreenshot)
  )

  app.get<{ Params: ScreenshotParams }>(
    '/api/workspace/projects/:projectId/screenshots/:name',
    async (request, reply) => {
      const image = await screenshotFile(root, request.params.projectId, request.params.name)
      const contentType = request.params.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
      return reply.header('Content-Type', contentType).header('Cache-Control', 'no-store').send(image)
    }
  )

  app.delete<{ Params: ScreenshotParams }>(
    '/api/workspace/projects/:projectId/screenshots/:name',
    async (request, reply) => {
      await deleteScreenshot(root, request.params.projectId, request.params.name)
      return reply.send({ deleted: true })
    }
  )

  app.get<{ Params: ProjectParams }>('/api/workspace/projects/:projectId/bugs', async (request) =>
    listBugReports(root, request.params.projectId)
  )

  app.put<{ Params: BugParams }>('/api/workspace/projects/:projectId/bugs/:bugId', async (request, reply) => {
    const report = request.body as WorkspaceBugReport
    if (!report || report.id !== request.params.bugId)
      return reply.status(400).send({ error: { code: 'invalid-bug', message: 'Bug ID does not match.' } })
    await saveBugReport(root, request.params.projectId, report)
    return reply.send({ saved: true })
  })

  app.delete<{ Params: BugParams }>('/api/workspace/projects/:projectId/bugs/:bugId', async (request, reply) => {
    await deleteBugReport(root, request.params.projectId, request.params.bugId)
    return reply.send({ deleted: true })
  })

  app.get<{ Params: ProjectParams }>('/api/workspace/projects/:projectId/automation', async (request) =>
    readAutomation(root, request.params.projectId)
  )

  app.get<{ Params: ProjectParams }>('/api/workspace/projects/:projectId/guided-flows', async (request) =>
    readGuidedFlows(root, request.params.projectId)
  )

  app.put<{ Params: ProjectParams }>('/api/workspace/projects/:projectId/guided-flows', async (request, reply) => {
    const body = request.body as { flows?: unknown }
    if (!Array.isArray(body?.flows))
      return reply
        .status(400)
        .send({ error: { code: 'invalid-guided-flows', message: 'Guided Flow list is required.' } })
    await saveGuidedFlows(root, request.params.projectId, body.flows as never[])
    return reply.send({ saved: true })
  })

  app.put<{ Params: ProjectParams }>('/api/workspace/projects/:projectId/automation', async (request, reply) => {
    await saveAutomation(root, request.params.projectId, request.body as Record<string, string>)
    return reply.send({ saved: true })
  })

  app.post<{ Params: ProjectParams }>('/api/workspace/projects/:projectId/reports', async (request, reply) => {
    const body = request.body as { name?: string; html?: string }
    if (!body?.html)
      return reply.status(400).send({ error: { code: 'invalid-report', message: 'Report HTML is required.' } })
    const name = await saveReport(root, request.params.projectId, body.name ?? 'quality-report.html', body.html)
    return reply.send({ saved: true, name })
  })
}
