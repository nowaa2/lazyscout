import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp } from '../apps/server/dist/app.js'

const workspace = await mkdtemp(join(tmpdir(), 'lazyscout-workspace-check-'))
const projectId = 'project-release-check'
const project = {
  id: projectId,
  name: 'Release Check',
  targetUrl: 'https://example.com',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  mode: 'scout',
  result: {
    startUrl: 'https://example.com',
    origin: 'https://example.com',
    pages: [],
    testCases: [
      {
        id: 'TC-HOME-001',
        module: 'HOME',
        title: 'Home opens',
        preconditions: [],
        steps: [{ type: 'navigate', url: 'https://example.com' }],
        expectedResult: 'Home is visible',
        type: 'positive',
        priority: 'high',
        automationStatus: 'manual',
        sourceUrl: 'https://example.com'
      }
    ],
    testData: [
      {
        id: 'TD-HOME-001',
        module: 'HOME',
        field: 'email',
        inputType: 'email',
        required: true,
        validValue: 'qa@example.com',
        invalidValue: 'invalid',
        note: 'Synthetic',
        sourceUrl: 'https://example.com'
      }
    ],
    issues: [],
    stats: { pagesVisited: 0, urlsSkipped: 0, durationMs: 0, limitReached: 'none' },
    actionGraph: {
      states: [],
      edges: [],
      visitedStateIds: [],
      visitedActionKeys: [],
      failedActionKeys: [],
      blockedActionKeys: []
    },
    runEvents: [],
    apiChecks: []
  }
}
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

let app = buildApp({ workspaceRoot: workspace, logLevel: 'silent', appVersion: 'workspace-check' })

try {
  await app.ready()
  await expectOk(
    app.inject({ method: 'PUT', url: `/api/workspace/projects/${projectId}`, payload: project }),
    'save project'
  )
  await Promise.all(
    ['first.png', 'second.png'].map((name) =>
      expectOk(
        app.inject({
          method: 'POST',
          url: `/api/workspace/projects/${projectId}/screenshots`,
          payload: {
            name,
            dataUrl: png,
            capturedAt: new Date().toISOString(),
            testCaseId: 'TC-HOME-001',
            status: 'passed'
          }
        }),
        `save ${name}`
      )
    )
  )
  await expectOk(
    app.inject({
      method: 'PUT',
      url: `/api/workspace/projects/${projectId}/bugs/BUG-001`,
      payload: {
        id: 'BUG-001',
        title: 'Synthetic defect',
        severity: 'low',
        status: 'open',
        actualResult: 'Actual',
        expectedResult: 'Expected',
        stepsToReproduce: 'Open the synthetic page',
        attachments: [],
        createdAt: new Date().toISOString()
      }
    }),
    'save bug'
  )
  await expectOk(
    app.inject({
      method: 'PUT',
      url: `/api/workspace/projects/${projectId}/automation`,
      payload: {
        'playwright:TC-HOME-001':
          "import { test } from '@playwright/test'\ntest('home', async ({ page }) => {\n  await page.goto(\"https://example.com\")\n})\n"
      }
    }),
    'save automation'
  )
  await expectOk(
    app.inject({
      method: 'POST',
      url: `/api/workspace/projects/${projectId}/reports`,
      payload: { name: 'quality-report.html', html: '<!doctype html><title>Release Check</title>' }
    }),
    'save report'
  )
  await expectOk(
    app.inject({
      method: 'POST',
      url: '/api/automation/run',
      payload: { projectId, framework: 'playwright', testCase: project.result.testCases[0] }
    }),
    'save run log'
  )
  await app.close()

  app = buildApp({ workspaceRoot: workspace, logLevel: 'silent', appVersion: 'workspace-check' })
  await app.ready()
  const workspaceResponse = await expectOk(app.inject({ method: 'GET', url: '/api/workspace' }), 'reload workspace')
  const screenshotResponse = await expectOk(
    app.inject({ method: 'GET', url: `/api/workspace/projects/${projectId}/screenshots` }),
    'reload screenshots'
  )
  const projectDirectory = join(workspace, 'projects', projectId)
  const required = [
    'project.json',
    'test-cases.json',
    'test-cases.csv',
    'test-data.csv',
    'automation',
    'screenshots',
    'bugs',
    'reports',
    'logs'
  ]
  const logs = await readdir(join(projectDirectory, 'logs'))
  const reports = await readdir(join(projectDirectory, 'reports'))
  const automation = await readFile(join(projectDirectory, 'automation', 'playwright-TC-HOME-001.spec.ts'), 'utf8')
  if (workspaceResponse.json().projects.length !== 1) throw new Error('Project did not reload from the workspace')
  if (screenshotResponse.json().length !== 2) throw new Error('Concurrent screenshots were not preserved')
  if (!(await Promise.all(required.map((name) => stat(join(projectDirectory, name)).then(() => true)))).every(Boolean))
    throw new Error('Workspace structure is incomplete')
  if (!logs.length || !reports.includes('quality-report.html') || !automation.includes('page.goto'))
    throw new Error('Workspace artifacts are incomplete')
  await expectOk(
    app.inject({ method: 'DELETE', url: `/api/workspace/projects/${projectId}` }),
    'move project to backup'
  )
  const afterDeleteResponse = await expectOk(
    app.inject({ method: 'GET', url: '/api/workspace' }),
    'reload workspace after deletion'
  )
  const backups = await readdir(join(workspace, 'backups'))
  if (!backups.some((name) => name.startsWith(`${projectId}-`))) throw new Error('Deleted Project was not backed up')
  if (afterDeleteResponse.json().projects.length !== 0) throw new Error('Deleted Project returned after reload')
  process.stdout.write('File workspace check passed.\n')
} finally {
  await app.close().catch(() => undefined)
  await rm(workspace, { recursive: true, force: true })
}

async function expectOk(responsePromise, action) {
  const response = await responsePromise
  if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(`${action}: ${response.body}`)
  return response
}
