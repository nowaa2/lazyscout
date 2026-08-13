export type TargetRef = {
  strategy?: 'role' | 'label' | 'placeholder' | 'text' | 'testid' | 'css'
  role?: string
  name?: string
  value?: string
  exact?: boolean
  text?: string
  placeholder?: string
  label?: string
  testId?: string
  /**
   * Attribute the testId was read from, when it is not Playwright's default
   * `data-testid`. Preserved so a recorded `data-test` is never silently
   * rewritten into a `data-testid` selector that matches nothing.
   */
  testIdAttribute?: string
  /** The element's `id` attribute, kept as its own ranked candidate. */
  elementId?: string
  /** The element's `name` attribute, kept as its own ranked candidate. */
  attributeName?: string
  /** Tag name, used to scope the `name` candidate as `input[name="..."]`. */
  tagName?: string
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

export type CheckStep = { type: 'check'; target: TargetRef; checked: boolean; description?: string }

export type WaitStep = {
  type: 'wait'
  mode: 'timeout' | 'url' | 'visible' | 'text'
  value: string
  target?: TargetRef
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

export type AssertInvalidStep = {
  type: 'assertInvalid'
  target: TargetRef
  description?: string
}

export type AssertValidationStep = {
  type: 'assertValidation'
  description?: string
}

export type ManualStep = {
  type: 'manual'
  description: string
}

export type TestStep =
  | NavigateStep
  | ClickStep
  | FillStep
  | SelectStep
  | CheckStep
  | WaitStep
  | AssertVisibleStep
  | AssertTextStep
  | AssertUrlStep
  | AssertInvalidStep
  | AssertValidationStep
  | ManualStep

export type TestCaseType =
  'positive' | 'negative' | 'validation' | 'navigation' | 'interaction' | 'accessibility' | 'manual'

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

  /** State this case was generated from, and the state that opened it. */
  stateId?: string
  parentStateId?: string
  /** The deterministic UI pattern this case was mapped from. */
  pattern?: string
  /**
   * What was observed in the DOM to justify the expected result — the attribute
   * matched, or the state transition recorded. Never an inferred business rule.
   */
  evidence?: string[]
  /** Why a case needs a tester: unknown pattern, no observable change, blocked. */
  reviewReason?: string
}
