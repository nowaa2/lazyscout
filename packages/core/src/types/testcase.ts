export type TargetRef = {
  role?: string
  name?: string
  text?: string
  placeholder?: string
  label?: string
  testId?: string
  cssSelector?: string
  nth?: number
  matchCount?: number
  contextText?: string
  contextSelector?: string
  contextTestId?: string
}

export type NavigateStep = {
  type: 'navigate'
  url: string
  description?: string
}

export type ClickStep = {
  type: 'click'
  target: TargetRef
  description?: string
}

export type FillStep = {
  type: 'fill'
  target: TargetRef
  value: string
  description?: string
}

export type SelectStep = {
  type: 'select'
  target: TargetRef
  option: string
  description?: string
}

export type AssertVisibleStep = {
  type: 'assertVisible'
  target: TargetRef
  description?: string
}

export type AssertTextStep = {
  type: 'assertText'
  target?: TargetRef
  text: string
  description?: string
}

export type AssertUrlStep = {
  type: 'assertUrl'
  urlContains: string
  description?: string
}

export type ManualStep = {
  type: 'manual'
  description: string
}

export type TestStep =
  NavigateStep | ClickStep | FillStep | SelectStep | AssertVisibleStep | AssertTextStep | AssertUrlStep | ManualStep

export type TestCaseType = 'positive' | 'negative' | 'validation'

export type TestCasePriority = 'low' | 'medium' | 'high'

export type AutomationStatus = 'ready' | 'needs-data' | 'needs-review' | 'manual'
export type TestCaseExecutionStatus = 'pending' | 'passed' | 'failed'
export type TestCaseLanguage = 'th' | 'en'

export type TestCase = {
  id: string
  module: string
  folder?: string
  tags?: string[]
  requirements?: string[]
  title: string
  preconditions: string[]
  steps: TestStep[]
  expectedResult: string
  type: TestCaseType
  priority: TestCasePriority
  automationStatus: AutomationStatus
  status?: TestCaseExecutionStatus

  sourceUrl: string

  notes?: string
}
