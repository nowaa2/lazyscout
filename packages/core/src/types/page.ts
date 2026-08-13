export type UIElementKind = 'link' | 'button' | 'input' | 'textarea' | 'select'
export type UIInteractionKind = 'dialog' | 'tab' | 'accordion' | 'dropdown' | 'drawer' | 'popover'
export type UIInteraction = {
  kind: UIInteractionKind
  name: string
  role: string
  cssSelector: string
  expanded?: boolean
  visible: boolean
  /** Container this control owns, from aria-controls / data-target. */
  controlsSelector?: string
  /** Why the classifier chose this kind, e.g. `aria-haspopup="dialog"`. */
  evidence?: string
}

/**
 * A UI pattern recognised deterministically from DOM and accessibility
 * attributes. `unknown` is a real outcome, not a failure: it routes the element
 * to a manual review case instead of inviting a guess about its behaviour.
 */
export type UIPattern =
  | 'text-input'
  | 'number-input'
  | 'date-input'
  | 'checkbox'
  | 'radio'
  | 'switch'
  | 'slider'
  | 'select'
  | 'combobox'
  | 'file-upload'
  | 'link'
  | 'navigation'
  | 'pagination'
  | 'button'
  | 'submit'
  | 'tab'
  | 'accordion'
  | 'menu'
  | 'dialog-opener'
  | 'table'
  | 'unknown'

/** Whether an action may be executed automatically. */
export type ElementRisk = 'safe' | 'needs-review' | 'destructive' | 'session-ending'

/** Where an element sits, used to scope locators and explain a Test Case. */
export type ElementContext = {
  container?: 'form' | 'dialog' | 'table-row' | 'card' | 'tab-panel' | 'menu' | 'page'
  containerSelector?: string
  containerName?: string
}

/** Attribute-level relationships between a control and the region it drives. */
export type ElementRelation = {
  controls?: string
  labelledBy?: string
  describedBy?: string
  target?: string
  owns?: string
}

export type UIElement = {
  kind: UIElementKind

  role: string

  accessibleName: string

  text?: string
  tagName: string
  inputType?: string
  placeholder?: string
  name?: string
  testId?: string
  /** Attribute the testId came from, e.g. `data-test`. */
  testIdAttribute?: string
  id?: string
  href?: string

  /** Stable identity for dedup and coverage, derived from locator + context. */
  elementId?: string
  /**
   * UI pattern this element was classified as. Distinct from `pattern`, which
   * is the HTML validation attribute.
   */
  uiPattern?: UIPattern
  /** Why the classifier chose that UI pattern, e.g. `role="tab"`. */
  patternEvidence?: string
  risk?: ElementRisk
  context?: ElementContext
  relation?: ElementRelation
  visible?: boolean
  readOnly?: boolean
  checked?: boolean
  expanded?: boolean
  selected?: boolean
  ariaLabel?: string
  describedBy?: string
  multiple?: boolean
  accept?: string
  /** Value of `aria-haspopup`, or the `data-toggle` verb the page declares. */
  hasPopup?: string

  options?: string[]
  required: boolean
  disabled: boolean
  minLength?: number
  maxLength?: number
  min?: string
  max?: string
  step?: string
  pattern?: string
  autocomplete?: string

  cssSelector: string

  matchIndex?: number
  matchCount?: number
  scopeIndex?: number
  scopeMatchCount?: number
  contextText?: string
  contextSelector?: string
  contextTestId?: string

  destructive: boolean
}

export type FormInfo = {
  id?: string
  name?: string
  action?: string
  method?: string
  accessibleName?: string
  fields: UIElement[]
  submitButtons: UIElement[]
}

export type PageInfo = {
  url: string

  finalUrl: string
  title: string

  depth: number
  statusCode?: number
  headings: string[]
  links: UIElement[]
  buttons: UIElement[]
  inputs: UIElement[]
  textareas: UIElement[]
  selects: UIElement[]
  forms: FormInfo[]
  apiRequests: ApiObservation[]

  state?: PageState
}

export type ApiObservation = {
  id: string
  method: string
  url: string
  status?: number
  durationMs?: number
  resourceType: 'xhr' | 'fetch'
  sourceUrl: string
  contentType?: string
}

export type ExplorerActionType =
  | 'navigate'
  | 'click'
  | 'openModal'
  | 'closeDialog'
  | 'selectTab'
  | 'expandAccordion'
  | 'openDropdown'
  | 'openDrawer'
  | 'expandMenu'
  | 'breadcrumb'
  | 'pagination'
  | 'other'

export type ExplorerAction = {
  id: string
  type: ExplorerActionType
  description: string
  target?: string
  selector?: string
  locator?: {
    role?: string
    name?: string
    label?: string
    placeholder?: string
    testId?: string
  }
  safe: boolean
  reason?: string
}
export type StateEdge = {
  id: string
  fromStateId: string
  toStateId?: string
  action: ExplorerAction
  status: 'visited' | 'discovered' | 'blocked' | 'failed'
}
export type ActionGraph = {
  states: PageState[]
  edges: StateEdge[]
  visitedStateIds: string[]
  visitedActionKeys: string[]
  failedActionKeys: string[]
  blockedActionKeys: string[]
}
export type RunEvent = {
  timestamp: string
  eventType:
    | 'run-started'
    | 'page-discovered'
    | 'state-discovered'
    | 'state-revisited'
    | 'transition-discovered'
    | 'action-discovered'
    | 'action-executed'
    | 'action-blocked'
    | 'action-failed'
    | 'run-completed'
    | 'error'
  currentUrl?: string
  currentStateId?: string
  action?: ExplorerAction
  result: 'running' | 'passed' | 'warning' | 'failed' | 'blocked'
  error?: string
  durationMs?: number
  message: string
}

export type PageState = {
  id: string
  url: string
  title: string
  name: string
  type: 'page' | UIInteractionKind | 'validation' | 'loading' | 'success' | 'error' | 'unknown'
  fingerprint: string
  visibleDialogs: string[]
  headings: string[]
  controls: UIElement[]
  interactions: UIInteraction[]
  stateContent: string[]
  validationMessages: string[]
  discoveredAt: string
  /** State this one was opened from, so a modal can be traced to its opener. */
  parentStateId?: string
  /** Selector of the container this state represents, for a modal or drawer. */
  containerSelector?: string
  /** Nesting level: 0 is the page, 1 a modal, 2 a modal opened from a modal. */
  depth?: number
}

/**
 * What was actually observed before and after one executed action. Expected
 * results are written from these records, never from the element's name.
 */
export type TransitionRecord = {
  sourceStateId: string
  destinationStateId?: string
  actionId: string
  actionType: ExplorerAction['type']
  targetLocator?: string
  urlBefore: string
  urlAfter: string
  fingerprintBefore: string
  fingerprintAfter: string
  result: 'changed' | 'unchanged' | 'failed' | 'blocked' | 'timeout'
  visibleDialogsAfter?: string[]
  headingsAfter?: string[]
  addedText?: string[]
  removedText?: string[]
  validationMessagesAfter?: string[]
  ariaStateAfter?: { expanded?: boolean; selected?: boolean; checked?: boolean }
  durationMs?: number
}

/** Why an element produced no executed action. */
export type CoverageReason =
  | 'tested'
  | 'skipped-limit'
  | 'skipped-duplicate'
  | 'blocked-destructive'
  | 'blocked-session-ending'
  | 'blocked-filter'
  | 'unknown-pattern'
  | 'not-visible'
  | 'disabled'
  | 'failed'

export type CoverageEntry = {
  elementId: string
  pattern: UIPattern
  reason: CoverageReason
  stateId?: string
  locator?: string
  name?: string
  detail?: string
}

export type CoverageReport = {
  elementsDiscovered: number
  knownPatterns: number
  tested: number
  skipped: number
  blocked: number
  unknown: number
  modalStates: number
  casesGenerated: number
  casesDeduplicated: number
  byPattern: Array<{ pattern: UIPattern; discovered: number; tested: number }>
  entries: CoverageEntry[]
}

export type ExploreIssueCode =
  | 'invalid-url'
  | 'blocked-url'
  | 'connection-refused'
  | 'dns-error'
  | 'ssl-error'
  | 'timeout'
  | 'page-crash'
  | 'http-error'
  | 'navigation-failed'
  | 'browser-error'
  | 'cloudflare'
  | 'challenge-blocked'
  | 'auth-lost'
  | 'scope-rejected'
  | 'session-ending'
  | 'unknown'

export type ExploreIssue = {
  url: string
  code: ExploreIssueCode
  message: string
}

export type ExploreOptions = {
  signal?: AbortSignal
  maxPages: number
  maxDepth: number

  pageTimeoutMs: number

  totalTimeoutMs: number
  waitAfterNavigationMs: number
  maxStatesPerPage: number
  maxActionsPerState: number
  maxTotalStates: number
  actionTimeoutMs: number
  stateDiscoveryTimeoutMs: number
  /** Labels the Project refuses to click. Empty means the explorer clicks anything it finds. */
  blockedKeywords: string[]
  /** Controls per page that are clicked to see whether they navigate somewhere new. */
  maxNavigationProbesPerPage: number
  /** Reuses a signed-in Project browser profile, so exploration starts past the login page. */
  browserProfileDir?: string
  /** Saved authenticated state, preferred over the profile directory. */
  authRestore?: AuthRestore
  /** Run the browser visibly; shared with the rest of the run. */
  headless?: boolean
}

export type ExplorationMode = 'current-page' | 'scope' | 'site'

export type ExplorationLimits = {
  maxPages: number
  maxStates: number
  maxDepth: number
  maxActionsPerState: number
  maxTotalActions: number
  maxActionRetries: number
  explorationTimeoutMs: number
}

export type DiscoveryLog = {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug' | 'blocked' | 'skipped' | 'retry'
  message: string
  context?: {
    url?: string
    stateId?: string
    actionId?: string
    reason?: string
    queueSize?: number
    retryCount?: number
  }
}

export type ExplorationEndReason =
  | 'queue-exhausted'
  | 'max-pages-reached'
  | 'max-states-reached'
  | 'max-depth-reached'
  | 'max-total-actions-reached'
  | 'timeout-reached'
  | 'no-safe-actions-remaining'
  | 'auth-lost-unrecoverable'
  | 'browser-crash'

export type ExplorationSummary = {
  pagesDiscovered: number
  statesDiscovered: number
  transitions: number
  actionsExecuted: number
  actionsBlocked: number
  actionsFailed: number
  actionsRetried: number
  urlsSkippedByScope: number
  endReason: ExplorationEndReason
  endReasonDetail?: string
}

export type EntryFlowStep = {
  url: string
  action: ExplorerAction
  stateId?: string
}

export type StateRestoreStrategy = 'goto' | 'reload' | 'close-dialog' | 'select-tab' | 'entry-replay' | 'none'

export type ExplorationConfig = {
  startPath?: string
  scopePath?: string
  mode: ExplorationMode
  debug: boolean
  limits: ExplorationLimits
  continueAfterLogin: boolean
}

/** A saved authenticated state handed to the explorer, opaque to it. */
export type AuthRestore = {
  storageState: unknown
  sessionStorage?: unknown
}

export type SafeActionCandidate = {
  priority: number
  action: ExplorerAction
  locator: {
    role?: string
    name?: string
    label?: string
    placeholder?: string
    testId?: string
    cssSelector?: string
  }
  kind:
    | 'navigation-link'
    | 'menu-item'
    | 'tab'
    | 'pagination'
    | 'modal-opener'
    | 'dropdown'
    | 'accordion'
    | 'drawer'
    | 'breadcrumb'
    | 'sidebar-nav'
    | 'submenu'
    | 'other-safe'
  restoreStrategy: StateRestoreStrategy
}

export type ExploreStats = {
  browser?: string
  pagesVisited: number
  urlsSkipped: number
  durationMs: number
  limitReached: ExplorationEndReason | 'none'
  summary?: ExplorationSummary
  discoveryLogs?: DiscoveryLog[]
}

export type ExploreResult = {
  startUrl: string
  origin: string
  pages: PageInfo[]
  issues: ExploreIssue[]
  stats: ExploreStats
  actionGraph: ActionGraph
  /** Observed before/after records for each executed action. */
  transitions?: TransitionRecord[]
  /** What happened to every discovered element. */
  coverage?: CoverageReport
}
