import type { FastifyInstance } from 'fastify'
import type { AutomationScreenshot } from '@lazyscout/core'
import { launchBrowser } from '@lazyscout/explorer'
import {
  deleteBugReport,
  deleteProject,
  deleteScreenshot,
  browserProfileDirectory,
  listBugReports,
  listProjects,
  openWorkspace,
  readAutomation,
  readScreenshots,
  saveAutomation,
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
    const profile = await browserProfileDirectory(root, request.params.projectId)
    const launched = await launchBrowser({ userDataDir: profile, headless: false })
    const page = launched.context.pages()[0] ?? (await launched.context.newPage())
    await page.goto(body.url, { waitUntil: 'domcontentloaded' })
    return reply.send({ opened: true })
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
