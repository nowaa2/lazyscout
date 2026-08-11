export type {
  AnalyzeRequest,
  AnalyzeResponse,
  ApiErrorResponse,
  AutomationRunResponse,
  AutomationScreenshot,
  AutomationLog,
  ApiCheck,
  ApiCheckRunResponse,
  ApiCheckRunRequest,
  LoadTestResponse,
  LoadTestRequest,
  ProjectSecrets,
  AutomationStatus,
  ExploreIssue,
  ExploreStats,
  FormInfo,
  PageInfo,
  PageState,
  StateEdge,
  TargetRef,
  TestCase,
  TestCasePriority,
  TestCaseType,
  TestCaseExecutionStatus,
  TestDataRow,
  TestStep,
  RunEvent,
  UIElement,
  TestCaseLanguage,
  RecorderState,
  RecorderStatus
} from '@lazyscout/core'

export type ResultTab = 'testcases' | 'testdata' | 'apichecks' | 'bugreports' | 'screenshots'

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
