

export type {
  AnalyzeRequest,
  AnalyzeResponse,
  ApiErrorResponse,
  AutomationRunResponse,
  ApiCheck,
  ApiCheckRunResponse,
  ApiCheckRunRequest,
  ProjectSecrets,
  AutomationStatus,
  ExploreIssue,
  ExploreStats,
  FormInfo,
  PageInfo,
  TargetRef,
  TestCase,
  TestCasePriority,
  TestCaseType,
  TestDataRow,
  TestStep,
  RunEvent,
  UIElement,
  TestCaseLanguage
} from '@lazyscout/core'

export type ResultTab = 'testcases' | 'testdata' | 'apichecks'

export type TestCaseFilters = {
  search: string
  module: string
  type: string
  priority: string
}

export const EMPTY_FILTERS: TestCaseFilters = {
  search: '',
  module: 'all',
  type: 'all',
  priority: 'all'
}
