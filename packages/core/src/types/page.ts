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
  'navigate' | 'click' | 'openModal' | 'closeDialog' | 'selectTab' | 'expandAccordion' | 'openDropdown' | 'other'
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
  | 'unknown'

export type ExploreIssue = {
  url: string
  code: ExploreIssueCode
  message: string
}

export type ExploreOptions = {
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
}

export type ExploreStats = {
  browser?: string
  pagesVisited: number

  urlsSkipped: number
  durationMs: number
  limitReached: 'max-pages' | 'max-depth' | 'total-timeout' | 'none'
}

export type ExploreResult = {
  startUrl: string
  origin: string
  pages: PageInfo[]
  issues: ExploreIssue[]
  stats: ExploreStats
  actionGraph: ActionGraph
}
