
import type { ActionGraph, ExploreIssue, ExploreStats, PageInfo, RunEvent } from './page.js'
import type { TestCase, TestCaseLanguage } from './testcase.js'
import type { TestDataRow } from './testdata.js'

export type AnalyzeRequest = {
  url: string
  maxPages?: number
  maxDepth?: number
  language?: TestCaseLanguage
  includeApiChecks?: boolean
  waitAfterNavigationMs?: number
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
}

export type ApiCheck = { id: string; method: string; url: string; expectedStatus?: number; observedStatus?: number; sourceUrl: string; status: 'observed' | 'needs-auth' | 'needs-review'; durationMs?: number; note?: string }
export type ProjectSecrets = { email?: string; username?: string; password?: string; apiToken?: string }
export type ApiCheckRunRequest = { apiCheck: ApiCheck; secrets?: ProjectSecrets }
export type ApiCheckRunResponse = { status: 'passed' | 'failed' | 'needs-auth'; statusCode?: number; durationMs: number; message: string }

export type ExportCsvRequest = {
  testCases: TestCase[]

  testData?: TestDataRow[]
}

export type AutomationRunRequest = { testCase: TestCase; framework?: 'playwright' | 'cypress'; code?: string; secrets?: ProjectSecrets }
export type AutomationLog = { timestamp: string; level: 'info' | 'pass' | 'fail' | 'warn'; message: string; durationMs?: number }
export type AutomationRunResponse = { status: 'passed' | 'failed' | 'blocked' | 'unsupported'; framework: 'playwright' | 'cypress'; logs: AutomationLog[]; error?: string }

export type ApiErrorResponse = {
  error: {
    code: string
    message: string
    hint?: string
  }
}
