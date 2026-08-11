export type UIElementKind = 'link' | 'button' | 'input' | 'textarea' | 'select'
export type UIInteractionKind = 'dialog' | 'tab' | 'accordion' | 'dropdown' | 'drawer' | 'popover'
export type UIInteraction = {
  kind: UIInteractionKind
  name: string
  role: string
  cssSelector: string
  expanded?: boolean
  visible: boolean
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
  id?: string
  href?: string

  options?: string[]
  required: boolean
  disabled: boolean

  cssSelector: string

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
}
