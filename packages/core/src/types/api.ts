import type {
  ActionGraph,
  CoverageReport,
  ExploreIssue,
  ExploreStats,
  ExplorationMode,
  PageInfo,
  RunEvent,
  TransitionRecord
} from './page.js'
import type { TestCase, TestCaseLanguage } from './testcase.js'
import type { TestDataRow } from './testdata.js'

export type AnalyzeRequest = {
  url: string
  maxPages?: number
  maxDepth?: number
  language?: TestCaseLanguage
  includeApiChecks?: boolean
  waitAfterNavigationMs?: number
  /** Labels the Project refuses to click. Empty or absent means nothing is blocked. */
  blockedKeywords?: string[]
  /** Explores with this Project's signed-in browser profile instead of a blank one. */
  projectId?: string
  startPath?: string
  scopePath?: string
  mode?: ExplorationMode
  debug?: boolean
}

export type AnalyzeResponse = {
  startUrl: string
  origin: string
  pages: PageInfo[]
  testCases: TestCase[]
  testData: TestDataRow[]
  issues: ExploreIssue[]
  stats: ExploreStats
  actionGraph: ActionGraph
  runEvents: RunEvent[]
  apiChecks: ApiCheck[]
  /** What happened to every discovered element. Optional for older Projects. */
  coverage?: CoverageReport
  /** Observed before/after records for each executed action. */
  transitions?: TransitionRecord[]
}

export type ApiCheck = {
  id: string
  method: string
  url: string
  expectedStatus?: number
  observedStatus?: number
  sourceUrl: string
  status: 'observed' | 'needs-auth' | 'needs-review'
  durationMs?: number
  note?: string
}
export type ProjectSecrets = {
  email?: string
  username?: string
  password?: string
  apiToken?: string
  variables?: Record<string, string>
}
export type ApiCheckRunRequest = { apiCheck: ApiCheck; secrets?: ProjectSecrets; allowUnsafe?: boolean }
export type ApiCheckRunResponse = {
  status: 'passed' | 'failed' | 'needs-auth'
  statusCode?: number
  durationMs: number
  message: string
}

export type ExportCsvRequest = {
  testCases: TestCase[]

  testData?: TestDataRow[]
}

export type AutomationRunRequest = {
  testCase: TestCase
  framework?: 'playwright' | 'cypress'
  code?: string
  secrets?: ProjectSecrets
  runId?: string
  projectId?: string
  /** Labels the Project refuses to click. Empty or absent means nothing is blocked. */
  blockedKeywords?: string[]
}
export type AutomationLog = {
  timestamp: string
  level: 'info' | 'pass' | 'fail' | 'warn'
  message: string
  durationMs?: number
}
export type AutomationScreenshot = {
  name: string
  dataUrl: string
  capturedAt: string
  testCaseId: string
  status: 'passed' | 'failed'
}
export type AutomationRunResponse = {
  status: 'passed' | 'failed' | 'blocked' | 'unsupported' | 'stopped'
  framework: 'playwright' | 'cypress'
  logs: AutomationLog[]
  error?: string
  screenshot?: AutomationScreenshot
  screenshots?: AutomationScreenshot[]
}

export type ApiErrorResponse = {
  error: {
    code: string
    message: string
    hint?: string
  }
}

export type LoadTestRequest = {
  url: string
  virtualUsers: number
  requestsPerUser: number
  intervalMs: number
  confirmed: boolean
}
export type LoadTestResponse = {
  total: number
  passed: number
  failed: number
  averageMs: number
  minMs: number
  maxMs: number
  requestsPerSecond: number
  errors: string[]
  requests: Array<{
    id: number
    virtualUser: number
    iteration: number
    method: 'GET'
    url: string
    finalUrl?: string
    statusCode?: number
    statusText?: string
    durationMs: number
    passed: boolean
    responseBytes?: number
    error?: string
  }>
}
