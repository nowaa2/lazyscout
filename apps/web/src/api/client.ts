import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ApiCheck,
  ApiCheckRunResponse,
  ApiErrorResponse,
  AutomationRunResponse,
  AutomationScreenshot,
  LoadTestRequest,
  LoadTestResponse,
  ProjectSecrets,
  RecorderState,
  GuidedFlow,
  TestCase,
  TestDataRow
} from '../types'
import type { TestCaseLanguage } from '../types'

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

export type WorkspaceInfo = { root: string; projects: WorkspaceProject[] }

export class ApiError extends Error {
  readonly code: string
  readonly hint?: string

  constructor(code: string, message: string, hint?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.hint = hint
  }
}

export type PublishedAppVersion = {
  version: string
  tags: string[]
  publishedAt?: string
}

export type AppVersionInfo = {
  packageName: string
  currentVersion: string
  latestVersion?: string
  updateAvailable: boolean
  registryAvailable: boolean
  versions: PublishedAppVersion[]
  error?: string
}

export type AppVersionInstallResult = {
  installedVersion: string
  command: string
  output: string
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorResponse
    if (body?.error?.message) {
      return new ApiError(body.error.code, body.error.message, body.error.hint)
    }
  } catch {}
  return new ApiError('unknown', `The server returned status ${response.status}.`)
}

export async function analyzeWebsite(payload: AnalyzeRequest): Promise<AnalyzeResponse> {
  let response: Response
  try {
    response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch {
    throw new ApiError(
      'server-unreachable',
      'Could not reach the LazyScout API.',
      'Check that "npm run dev:server" is running.'
    )
  }

  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as AnalyzeResponse
}

export async function getAppVersions(): Promise<AppVersionInfo> {
  const response = await fetch('/api/versions')
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as AppVersionInfo
}

export async function installAppVersion(version: string): Promise<AppVersionInstallResult> {
  const response = await fetch('/api/versions/install', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version })
  })
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as AppVersionInstallResult
}

export async function downloadTestCasesCsv(testCases: TestCase[], testData: TestDataRow[] = []): Promise<void> {
  const response = await fetch('/api/export/csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testCases, testData })
  })

  if (!response.ok) throw await toApiError(response)

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `lazyscout-testcases-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function runAutomation(
  testCase: TestCase,
  framework: 'playwright' | 'cypress' = 'playwright',
  code?: string,
  secrets?: ProjectSecrets,
  runId?: string,
  projectId?: string,
  blockedKeywords?: string[],
  signal?: AbortSignal
): Promise<AutomationRunResponse> {
  const response = await fetch('/api/automation/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testCase, framework, code, secrets, runId, projectId, blockedKeywords }),
    signal
  })
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as AutomationRunResponse
}

export async function getWorkspace(): Promise<WorkspaceInfo> {
  return requestJson('/api/workspace')
}

export async function saveWorkspaceProject(project: WorkspaceProject): Promise<void> {
  await requestJson(`/api/workspace/projects/${encodeURIComponent(project.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project)
  })
}

export async function deleteWorkspaceProject(projectId: string): Promise<void> {
  await requestJson(`/api/workspace/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' })
}

export async function openWorkspaceAuthSession(projectId: string, url: string): Promise<void> {
  await requestJson(`/api/workspace/projects/${encodeURIComponent(projectId)}/auth-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  })
}

/** `ready` is only reachable after a verification against a protected page. */
export type AuthSessionState = 'not-configured' | 'recorded' | 'verifying' | 'ready' | 'expired' | 'invalid'

export type WorkspaceAuthSessionStatus = {
  status: AuthSessionState
  capturedAt?: string
  verifiedAt?: string
  verifiedPath?: string
  detail?: string
  /** Counts only. The values themselves never leave the server. */
  cookieCount?: number
  sessionCookieCount?: number
  originCount?: number
  sessionStorageOriginCount?: number
  indexedDb?: boolean
  capturedHeadless?: boolean
  executionHeadless?: boolean
  browserModeMismatch?: boolean
  lockedBy?: 'scout' | 'recorder' | 'runner' | 'login-browser'
  /** Describes the profile directory only; never means the login still works. */
  profile?: {
    profileExists: boolean
    browserDataDetected: boolean
    cookieStoreDetected: boolean
    lastModifiedAt?: string
  }
}

export async function getWorkspaceAuthSessionStatus(projectId: string): Promise<WorkspaceAuthSessionStatus> {
  return requestJson(`/api/workspace/projects/${encodeURIComponent(projectId)}/auth-session/status`)
}

/** Saves the signed-in state from the open login browser. */
export async function captureWorkspaceAuthSession(projectId: string): Promise<WorkspaceAuthSessionStatus> {
  return requestJson(`/api/workspace/projects/${encodeURIComponent(projectId)}/auth-session/capture`, {
    method: 'POST'
  })
}

/** Opens a protected path with the snapshot restored to prove it still works. */
export async function verifyWorkspaceAuthSession(projectId: string, url: string): Promise<WorkspaceAuthSessionStatus> {
  return requestJson(`/api/workspace/projects/${encodeURIComponent(projectId)}/auth-session/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  })
}

export async function getGuidedFlows(projectId: string): Promise<GuidedFlow[]> {
  return requestJson(`/api/workspace/projects/${encodeURIComponent(projectId)}/guided-flows`)
}

export async function saveGuidedFlows(projectId: string, flows: GuidedFlow[]): Promise<void> {
  await requestJson(`/api/workspace/projects/${encodeURIComponent(projectId)}/guided-flows`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flows })
  })
}

export type GuidedFlowRunResponse = AutomationRunResponse & {
  runId: string
  stepStatuses: Array<{ id: string; status: 'pending' | 'passed' | 'failed' }>
}

export async function runGuidedFlow(
  flow: GuidedFlow,
  projectId?: string,
  secrets?: ProjectSecrets,
  runId?: string
): Promise<GuidedFlowRunResponse> {
  return requestJson('/api/guided-flows/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flow, projectId, secrets, runId })
  })
}

export async function stopGuidedFlow(runId: string): Promise<{ stopped: boolean }> {
  return requestJson('/api/guided-flows/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId })
  })
}

export async function clearWorkspaceAuthSession(projectId: string): Promise<void> {
  await requestJson(`/api/workspace/projects/${encodeURIComponent(projectId)}/auth-session`, { method: 'DELETE' })
}

export async function startRecorder(projectId: string, url: string): Promise<RecorderState> {
  return requestJson<RecorderState>(`/api/recorder/${encodeURIComponent(projectId)}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  })
}

export async function getRecorderState(projectId: string): Promise<RecorderState> {
  return requestJson<RecorderState>(`/api/recorder/${encodeURIComponent(projectId)}`)
}

export async function stopRecorder(projectId: string): Promise<RecorderState> {
  return requestJson<RecorderState>(`/api/recorder/${encodeURIComponent(projectId)}/stop`, { method: 'POST' })
}

export async function setRecorderInspectMode(projectId: string, enabled: boolean): Promise<RecorderState> {
  return requestJson<RecorderState>(`/api/recorder/${encodeURIComponent(projectId)}/inspect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled })
  })
}

export type RecorderInteraction =
  | { type: 'click'; x: number; y: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'text'; text: string }
  | { type: 'key'; key: string }
  | { type: 'scroll'; deltaX: number; deltaY: number }
  | { type: 'navigate'; url: string }
  | { type: 'back' | 'forward' | 'reload' }

export function recorderFrameUrl(projectId: string, version: number): string {
  return `/api/recorder/${encodeURIComponent(projectId)}/frame?v=${version}`
}

export async function interactWithRecorder(
  projectId: string,
  interaction: RecorderInteraction
): Promise<RecorderState> {
  return requestJson<RecorderState>(`/api/recorder/${encodeURIComponent(projectId)}/interact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(interaction)
  })
}

export async function discardRecorder(projectId: string): Promise<RecorderState> {
  return requestJson<RecorderState>(`/api/recorder/${encodeURIComponent(projectId)}`, { method: 'DELETE' })
}

export async function openWorkspaceFolder(): Promise<void> {
  await requestJson('/api/workspace/open', { method: 'POST' })
}

export async function getWorkspaceScreenshots(projectId: string): Promise<AutomationScreenshot[]> {
  return requestJson(`/api/workspace/projects/${encodeURIComponent(projectId)}/screenshots`)
}

export async function saveWorkspaceScreenshot(
  projectId: string,
  screenshot: AutomationScreenshot
): Promise<AutomationScreenshot> {
  return requestJson(`/api/workspace/projects/${encodeURIComponent(projectId)}/screenshots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(screenshot)
  })
}

export async function deleteWorkspaceScreenshot(projectId: string, name: string): Promise<void> {
  await requestJson(
    `/api/workspace/projects/${encodeURIComponent(projectId)}/screenshots/${encodeURIComponent(name)}`,
    { method: 'DELETE' }
  )
}

export async function getWorkspaceAutomation(projectId: string): Promise<Record<string, string>> {
  return requestJson(`/api/workspace/projects/${encodeURIComponent(projectId)}/automation`)
}

export async function saveWorkspaceAutomation(projectId: string, overrides: Record<string, string>): Promise<void> {
  await requestJson(`/api/workspace/projects/${encodeURIComponent(projectId)}/automation`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(overrides)
  })
}

export async function saveWorkspaceReport(projectId: string, name: string, html: string): Promise<void> {
  await requestJson(`/api/workspace/projects/${encodeURIComponent(projectId)}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, html })
  })
}

export async function getWorkspaceBugs<T>(projectId: string): Promise<T[]> {
  return requestJson(`/api/workspace/projects/${encodeURIComponent(projectId)}/bugs`)
}

export async function saveWorkspaceBug<T extends { id: string }>(projectId: string, report: T): Promise<void> {
  await requestJson(`/api/workspace/projects/${encodeURIComponent(projectId)}/bugs/${encodeURIComponent(report.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report)
  })
}

export async function deleteWorkspaceBug(projectId: string, bugId: string): Promise<void> {
  await requestJson(`/api/workspace/projects/${encodeURIComponent(projectId)}/bugs/${encodeURIComponent(bugId)}`, {
    method: 'DELETE'
  })
}

async function requestJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as T
}
export async function stopAutomation(runId: string): Promise<void> {
  await fetch('/api/automation/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId }),
    keepalive: true
  })
}
export async function runLoadTest(payload: LoadTestRequest): Promise<LoadTestResponse> {
  const response = await fetch('/api/load-test/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as LoadTestResponse
}
export async function runApiCheck(
  apiCheck: ApiCheck,
  secrets?: ProjectSecrets,
  allowUnsafe = false
): Promise<ApiCheckRunResponse> {
  const response = await fetch('/api/api-check/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiCheck, secrets, allowUnsafe })
  })
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as ApiCheckRunResponse
}
