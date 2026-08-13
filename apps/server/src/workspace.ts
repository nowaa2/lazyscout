import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { homedir, platform } from 'node:os'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import type {
  AnalyzeResponse,
  AutomationLog,
  AutomationScreenshot,
  TestCase,
  TestCaseLanguage,
  TestDataRow,
  GuidedFlow
} from '@lazyscout/core'
import { escapeCsvValue, exportTestCasesToCsv, TEST_DATA_CSV_COLUMNS, UTF8_BOM } from '@lazyscout/generators'

const execFileAsync = promisify(execFile)
const PROJECT_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/
const FILE_NAME = /^[^\\/:*?"<>|]{1,160}$/
const mutationQueues = new Map<string, Promise<unknown>>()

export type WorkspaceProject = {
  id: string
  name: string
  targetUrl: string
  createdAt: string
  updatedAt: string
  mode?: 'scout' | 'empty'
  testCaseLanguage?: TestCaseLanguage
  result: AnalyzeResponse
}

export type WorkspaceBugReport = {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in-progress' | 'resolved'
  testCaseId?: string
  actualResult: string
  expectedResult: string
  stepsToReproduce: string
  attachments: Array<{ name: string; type: string; dataUrl: string }>
  createdAt: string
}

export function defaultWorkspaceRoot(): string {
  return join(homedir(), 'LazyScout')
}

export function resolveWorkspaceRoot(value?: string): string {
  return resolve(value?.trim() || process.env.LAZYSCOUT_WORKSPACE || defaultWorkspaceRoot())
}

export async function ensureWorkspace(root: string): Promise<void> {
  await Promise.all([
    mkdir(join(root, 'projects'), { recursive: true }),
    mkdir(join(root, 'backups'), { recursive: true })
  ])
  const settingsPath = join(root, 'settings.json')
  try {
    await stat(settingsPath)
  } catch {
    await writeJson(settingsPath, { version: 1, workspaceRoot: root, createdAt: new Date().toISOString() })
  }
}

export async function listProjects(root: string): Promise<WorkspaceProject[]> {
  await ensureWorkspace(root)
  const entries = await readdir(join(root, 'projects'), { withFileTypes: true })
  const projects = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && PROJECT_ID.test(entry.name))
      .map((entry) => readProject(root, entry.name))
  )
  return projects
    .filter((project): project is WorkspaceProject => Boolean(project))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function saveProject(root: string, project: WorkspaceProject): Promise<void> {
  return enqueueMutation(`project:${project.id}`, async () => {
    const directory = await ensureProject(root, project.id)
    const normalized = normalizeResult(project.result)
    const { testCases, ...result } = normalized
    const testData = normalized.testData
    await Promise.all([
      writeJson(join(directory, 'project.json'), { ...project, result }),
      writeJson(join(directory, 'test-cases.json'), testCases),
      writeFileAtomic(join(directory, 'test-cases.csv'), exportTestCasesToCsv(testCases, testData)),
      writeFileAtomic(join(directory, 'test-data.csv'), testDataCsv(testData))
    ])
  })
}

export async function deleteProject(root: string, projectId: string): Promise<void> {
  return enqueueMutation(`project:${projectId}`, async () => {
    const source = projectDirectory(root, projectId)
    try {
      await stat(source)
    } catch {
      return
    }
    await ensureWorkspace(root)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    await rename(source, join(root, 'backups', `${projectId}-${timestamp}`))
  })
}

export async function readScreenshots(root: string, projectId: string): Promise<AutomationScreenshot[]> {
  const directory = await ensureProject(root, projectId)
  return readJson<AutomationScreenshot[]>(join(directory, 'screenshots', 'index.json'), [])
}

export async function saveScreenshot(
  root: string,
  projectId: string,
  screenshot: AutomationScreenshot
): Promise<AutomationScreenshot> {
  return enqueueMutation(`screenshots:${projectId}`, async () => {
    const directory = join(await ensureProject(root, projectId), 'screenshots')
    const match = screenshot.dataUrl.match(/^data:image\/(png|jpeg);base64,([a-zA-Z0-9+/=]+)$/)
    if (!match) throw new Error('Screenshot must be a PNG or JPEG data URL')
    const image = Buffer.from(match[2], 'base64')
    if (image.byteLength > 6 * 1024 * 1024) throw new Error('Screenshot exceeds the 6 MB limit')
    const extension = match[1] === 'jpeg' ? '.jpg' : '.png'
    const requested = safeFileName(screenshot.name, `screenshot-${Date.now()}${extension}`)
    const name = extname(requested)
      ? `${basename(requested, extname(requested))}${extension}`
      : `${requested}${extension}`
    await writeFileAtomic(join(directory, name), image)
    const current = await readScreenshots(root, projectId)
    const stored = { ...screenshot, name, dataUrl: screenshotUrl(projectId, name) }
    const next = [stored, ...current.filter((item) => item.name !== name)].slice(0, 50)
    await writeJson(join(directory, 'index.json'), next)
    return stored
  })
}

export async function deleteScreenshot(root: string, projectId: string, name: string): Promise<void> {
  const safeName = assertFileName(name)
  const directory = join(await ensureProject(root, projectId), 'screenshots')
  await rm(join(directory, safeName), { force: true })
  const current = await readScreenshots(root, projectId)
  await writeJson(
    join(directory, 'index.json'),
    current.filter((item) => item.name !== safeName)
  )
}

export async function screenshotFile(root: string, projectId: string, name: string): Promise<Buffer> {
  return readFile(join(await ensureProject(root, projectId), 'screenshots', assertFileName(name)))
}

export async function listBugReports(root: string, projectId: string): Promise<WorkspaceBugReport[]> {
  const directory = join(await ensureProject(root, projectId), 'bugs')
  const entries = await readdir(directory, { withFileTypes: true })
  const reports = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json')
      .map((entry) => readJson<WorkspaceBugReport | null>(join(directory, entry.name), null))
  )
  return reports.filter((report): report is WorkspaceBugReport => Boolean(report))
}

export async function saveBugReport(root: string, projectId: string, report: WorkspaceBugReport): Promise<void> {
  const directory = join(await ensureProject(root, projectId), 'bugs')
  await writeJson(join(directory, `${safeFileName(report.id, `BUG-${Date.now()}`)}.json`), report)
}

export async function deleteBugReport(root: string, projectId: string, bugId: string): Promise<void> {
  const directory = join(await ensureProject(root, projectId), 'bugs')
  await rm(join(directory, `${safeFileName(bugId, 'bug')}.json`), { force: true })
}

export async function readAutomation(root: string, projectId: string): Promise<Record<string, string>> {
  const directory = join(await ensureProject(root, projectId), 'automation')
  const index = await readJson<Record<string, string>>(join(directory, 'index.json'), {})
  const entries = await Promise.all(
    Object.entries(index).map(async ([key, name]) => {
      try {
        return [key, await readFile(join(directory, assertFileName(name)), 'utf8')] as const
      } catch {
        return undefined
      }
    })
  )
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry)))
}

export async function saveAutomation(
  root: string,
  projectId: string,
  overrides: Record<string, string>
): Promise<void> {
  const directory = join(await ensureProject(root, projectId), 'automation')
  const previous = await readJson<Record<string, string>>(join(directory, 'index.json'), {})
  const next: Record<string, string> = {}
  for (const [key, source] of Object.entries(overrides)) {
    if (typeof source !== 'string' || source.length > 200_000) throw new Error('Automation source exceeds the limit')
    const [framework, caseId] = key.split(':', 2)
    if ((framework !== 'playwright' && framework !== 'cypress') || !caseId) continue
    const extension = framework === 'playwright' ? '.spec.ts' : '.cy.ts'
    const name = `${framework}-${safeFileName(caseId, 'test-case')}${extension}`
    next[key] = name
    await writeFileAtomic(join(directory, name), source)
  }
  for (const name of Object.values(previous))
    if (!Object.values(next).includes(name)) await rm(join(directory, assertFileName(name)), { force: true })
  await writeJson(join(directory, 'index.json'), next)
}

export async function saveRunLog(
  root: string,
  projectId: string,
  testCaseId: string,
  status: string,
  logs: AutomationLog[]
): Promise<void> {
  const directory = join(await ensureProject(root, projectId), 'logs')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const name = `${timestamp}-${safeFileName(testCaseId, 'test-case')}.json`
  await writeJson(join(directory, name), { testCaseId, status, createdAt: new Date().toISOString(), logs })
}

export async function readGuidedFlows(root: string, projectId: string): Promise<GuidedFlow[]> {
  const directory = await ensureProject(root, projectId)
  return readJson<GuidedFlow[]>(join(directory, 'guided-flows.json'), [])
}

export async function saveGuidedFlows(root: string, projectId: string, flows: GuidedFlow[]): Promise<void> {
  if (!Array.isArray(flows) || flows.length > 100) throw new Error('Guided Flow limit exceeded')
  for (const flow of flows) {
    if (!flow?.id || !flow.name || !flow.baseUrl || !Array.isArray(flow.steps) || flow.steps.length > 200)
      throw new Error('Invalid Guided Flow')
  }
  const directory = await ensureProject(root, projectId)
  await writeJson(join(directory, 'guided-flows.json'), flows)
}

export async function saveReport(root: string, projectId: string, name: string, html: string): Promise<string> {
  if (typeof html !== 'string' || html.length > 2_000_000) throw new Error('Report exceeds the 2 MB limit')
  const directory = join(await ensureProject(root, projectId), 'reports')
  const fileName = `${safeFileName(name, `quality-report-${Date.now()}.html`).replace(/\.[^.]+$/, '')}.html`
  await writeFileAtomic(join(directory, fileName), html)
  return fileName
}

export async function openWorkspace(root: string): Promise<void> {
  await ensureWorkspace(root)
  if (platform() === 'win32') await execFileAsync('explorer.exe', [root], { windowsHide: true })
  else if (platform() === 'darwin') await execFileAsync('open', [root])
  else await execFileAsync('xdg-open', [root])
}

export async function browserProfileDirectory(root: string, projectId: string): Promise<string> {
  return join(await ensureProject(root, projectId), 'browser-profile')
}

export type BrowserProfileStatus = {
  profileExists: boolean
  browserDataDetected: boolean
  cookieStoreDetected: boolean
  lastModifiedAt?: string
}

export async function browserProfileStatus(root: string, projectId: string): Promise<BrowserProfileStatus> {
  const directory = join(projectDirectory(root, projectId), 'browser-profile')
  try {
    const entries = await readdir(directory)
    const candidates = [
      directory,
      join(directory, 'Local State'),
      join(directory, 'Default'),
      join(directory, 'Default', 'Cookies'),
      join(directory, 'Default', 'Local Storage')
    ]
    const modifiedTimes = await Promise.all(
      candidates.map(async (candidate) => {
        try {
          return (await stat(candidate)).mtimeMs
        } catch {
          return 0
        }
      })
    )
    return {
      profileExists: true,
      browserDataDetected: entries.includes('Default') || entries.includes('Local State'),
      cookieStoreDetected: modifiedTimes[3] > 0 || modifiedTimes[4] > 0,
      lastModifiedAt: new Date(Math.max(...modifiedTimes)).toISOString()
    }
  } catch {
    return { profileExists: false, browserDataDetected: false, cookieStoreDetected: false }
  }
}

export async function clearBrowserProfile(root: string, projectId: string): Promise<void> {
  const directory = join(projectDirectory(root, projectId), 'browser-profile')
  await rm(directory, { recursive: true, force: true })
}

async function readProject(root: string, projectId: string): Promise<WorkspaceProject | undefined> {
  try {
    const directory = projectDirectory(root, projectId)
    const project = await readJson<
      (Omit<WorkspaceProject, 'result'> & { result: Omit<AnalyzeResponse, 'testCases'> }) | undefined
    >(join(directory, 'project.json'), undefined)
    if (!project) return undefined
    const testCases = await readJson<TestCase[]>(join(directory, 'test-cases.json'), [])
    return { ...project, result: normalizeResult({ ...project.result, testCases }) }
  } catch {
    return undefined
  }
}

async function ensureProject(root: string, projectId: string): Promise<string> {
  await ensureWorkspace(root)
  const directory = projectDirectory(root, projectId)
  await Promise.all(
    ['automation', 'screenshots', 'bugs', 'reports', 'logs', 'browser-profile'].map((name) =>
      mkdir(join(directory, name), { recursive: true })
    )
  )
  return directory
}

function projectDirectory(root: string, projectId: string): string {
  if (!PROJECT_ID.test(projectId)) throw new Error('Invalid project ID')
  return containedPath(join(root, 'projects'), projectId)
}

function containedPath(root: string, value: string): string {
  const target = resolve(root, value)
  const relation = relative(resolve(root), target)
  if (!relation || relation.startsWith('..') || isAbsolute(relation)) throw new Error('Path is outside the workspace')
  return target
}

function assertFileName(value: string): string {
  if (!FILE_NAME.test(value) || value === '.' || value === '..') throw new Error('Invalid file name')
  return value
}

function safeFileName(value: string, fallback: string): string {
  const safe = basename(value)
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 120)
  return safe || fallback
}

function screenshotUrl(projectId: string, name: string): string {
  return `/api/workspace/projects/${encodeURIComponent(projectId)}/screenshots/${encodeURIComponent(name)}`
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function writeFileAtomic(path: string, value: string | Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporary, value)
  await rm(path, { force: true })
  await rename(temporary, path)
}

function testDataCsv(rows: TestDataRow[]): string {
  const toRow = (values: string[]) => values.map(escapeCsvValue).join(',')
  return (
    UTF8_BOM +
    [
      toRow([...TEST_DATA_CSV_COLUMNS]),
      ...rows.map((row) =>
        toRow([
          row.id,
          row.module,
          row.field,
          row.inputType,
          row.required ? 'yes' : 'no',
          row.validValue,
          row.invalidValue,
          row.note ?? '',
          row.sourceUrl
        ])
      )
    ].join('\r\n') +
    '\r\n'
  )
}

function normalizeResult(value: Partial<AnalyzeResponse> | undefined): AnalyzeResponse {
  const actionGraph = value?.actionGraph
  return {
    startUrl: value?.startUrl ?? '',
    origin: value?.origin ?? 'Manual test suite',
    pages: Array.isArray(value?.pages) ? value.pages : [],
    testCases: Array.isArray(value?.testCases) ? value.testCases : [],
    testData: Array.isArray(value?.testData) ? value.testData : [],
    issues: Array.isArray(value?.issues) ? value.issues : [],
    stats: value?.stats ?? { pagesVisited: 0, urlsSkipped: 0, durationMs: 0, limitReached: 'none' },
    actionGraph: {
      states: Array.isArray(actionGraph?.states) ? actionGraph.states : [],
      edges: Array.isArray(actionGraph?.edges) ? actionGraph.edges : [],
      visitedStateIds: Array.isArray(actionGraph?.visitedStateIds) ? actionGraph.visitedStateIds : [],
      visitedActionKeys: Array.isArray(actionGraph?.visitedActionKeys) ? actionGraph.visitedActionKeys : [],
      failedActionKeys: Array.isArray(actionGraph?.failedActionKeys) ? actionGraph.failedActionKeys : [],
      blockedActionKeys: Array.isArray(actionGraph?.blockedActionKeys) ? actionGraph.blockedActionKeys : []
    },
    runEvents: Array.isArray(value?.runEvents) ? value.runEvents : [],
    apiChecks: Array.isArray(value?.apiChecks) ? value.apiChecks : [],
    // Optional, so a Project saved before pattern coverage existed still loads.
    ...(value?.coverage ? { coverage: value.coverage } : {}),
    ...(Array.isArray(value?.transitions) ? { transitions: value.transitions } : {})
  }
}

function enqueueMutation<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = mutationQueues.get(key) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(action)
  mutationQueues.set(key, next)
  return next.finally(() => {
    if (mutationQueues.get(key) === next) mutationQueues.delete(key)
  })
}
