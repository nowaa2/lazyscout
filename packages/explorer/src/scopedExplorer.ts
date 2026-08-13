import type { Page } from 'playwright-core'
import type {
  ActionGraph,
  DiscoveryLog,
  EntryFlowStep,
  ExplorerAction,
  TransitionRecord,
  ExplorationConfig,
  ExplorationEndReason,
  ExplorationLimits,
  ExplorationSummary,
  ExploreIssue,
  ExploreOptions,
  ExploreResult,
  ExploreStats,
  PageInfo,
  PageState,
  SafeActionCandidate,
  StateEdge,
  StateRestoreStrategy
} from '@lazyscout/core'
import {
  CoverageTracker,
  LOCAL_QA_POLICY,
  checkTargetUrl,
  isCrawlableUrl,
  isSameOrigin,
  normalizeUrl,
  redactUrl,
  isSessionEndingLabel,
  isBlockedLabel
} from '@lazyscout/core'
import { collectPageData } from './browser/domCollector.js'
import { mapToPageModel } from './mapToPageModel.js'
import { ExplorerError, toExploreIssue } from './errors.js'
import { launchBrowser } from './launchBrowser.js'

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_LIMITS: ExplorationLimits = {
  maxPages: 20,
  maxStates: 80,
  maxDepth: 3,
  maxActionsPerState: 8,
  maxTotalActions: 200,
  maxActionRetries: 2,
  explorationTimeoutMs: 300_000
}

const DEFAULT_CONFIG: ExplorationConfig = {
  mode: 'site',
  debug: false,
  limits: DEFAULT_LIMITS,
  continueAfterLogin: true
}

/** How many dialogs deep to follow before treating it as a state loop. */
const MAX_MODAL_DEPTH = 3

// ---------------------------------------------------------------------------
// Scoped Explorer
// ---------------------------------------------------------------------------

export async function exploreWithScope(
  startUrl: string,
  explorationConfig: Partial<ExplorationConfig> = {},
  exploreOptions: Partial<ExploreOptions> = {}
): Promise<ExploreResult> {
  const config: ExplorationConfig = {
    ...DEFAULT_CONFIG,
    ...explorationConfig,
    limits: { ...DEFAULT_LIMITS, ...explorationConfig.limits }
  }
  const abortIfRequested = () => {
    if (exploreOptions.signal?.aborted)
      throw new ExplorerError('browser-error', 'Scout stopped because the client disconnected.')
  }
  const legacyOptions: ExploreOptions = {
    maxPages: config.limits.maxPages,
    maxDepth: config.limits.maxDepth,
    maxStatesPerPage: config.limits.maxActionsPerState,
    maxActionsPerState: config.limits.maxActionsPerState,
    maxTotalStates: config.limits.maxStates,
    actionTimeoutMs: 3_000,
    stateDiscoveryTimeoutMs: 500,
    pageTimeoutMs: 25_000,
    totalTimeoutMs: config.limits.explorationTimeoutMs,
    waitAfterNavigationMs: 750,
    blockedKeywords: [],
    maxNavigationProbesPerPage: 8,
    ...exploreOptions
  }

  const startedAt = Date.now()
  const logs: DiscoveryLog[] = []
  const debug = (message: string, context?: DiscoveryLog['context']): void => {
    if (config.debug) {
      logs.push({ timestamp: new Date().toISOString(), level: 'debug', message, context })
    }
    logs.push({ timestamp: new Date().toISOString(), level: 'info', message, context })
  }

  const check = checkTargetUrl(startUrl, LOCAL_QA_POLICY)
  if (!check.ok) throw new ExplorerError(check.code, check.message)

  const origin = check.url.origin
  const entryUrl = normalizeUrl(check.url.toString())

  const pages: PageInfo[] = []
  const issues: ExploreIssue[] = []
  const visitedStates = new Set<string>()
  const visitedUrls = new Set<string>()

  // State-level queue: each item is a (url, stateId, entryFlow) to explore from
  type StateQueueItem = {
    url: string
    stateId?: string
    depth: number
    entryFlow: EntryFlowStep[]
  }
  const stateQueue: StateQueueItem[] = []

  const actionGraph: ActionGraph = {
    states: [],
    edges: [],
    visitedStateIds: [],
    visitedActionKeys: [],
    failedActionKeys: [],
    blockedActionKeys: []
  }

  let totalActionsExecuted = 0
  let totalActionsBlocked = 0
  let totalActionsFailed = 0
  let totalActionsRetried = 0
  let urlsSkippedByScope = 0
  let modalStatesDiscovered = 0
  let endReason: ExplorationEndReason = 'queue-exhausted'

  const transitions: TransitionRecord[] = []
  const coverage = new CoverageTracker()

  /**
   * Record what an action actually did. Expected results are written from these
   * observations, so an action with no observable change is reported as
   * `unchanged` rather than being given an invented outcome.
   */
  function recordTransition(
    from: PageState,
    action: ExplorerAction,
    before: { url: string; fingerprint: string },
    after: { url: string; state?: PageState },
    result: TransitionRecord['result'],
    durationMs?: number
  ): void {
    const beforeText = new Set(from.stateContent)
    const afterText = after.state?.stateContent ?? []
    transitions.push({
      sourceStateId: from.id,
      destinationStateId: after.state?.id,
      actionId: action.id,
      actionType: action.type,
      targetLocator: action.selector,
      urlBefore: before.url,
      urlAfter: after.url,
      fingerprintBefore: before.fingerprint,
      fingerprintAfter: after.state?.fingerprint ?? before.fingerprint,
      result,
      visibleDialogsAfter: after.state?.visibleDialogs,
      headingsAfter: after.state?.headings,
      addedText: afterText.filter((text) => !beforeText.has(text)).slice(0, 10),
      removedText: from.stateContent.filter((text) => !afterText.includes(text)).slice(0, 10),
      validationMessagesAfter: after.state?.validationMessages,
      durationMs
    })
  }

  function isWithinScope(url: string): boolean {
    if (!config.scopePath) return true
    try {
      const path = new URL(url).pathname
      const scope = config.scopePath.replace(/\/$/, '')
      return path === scope || path.startsWith(scope + '/')
    } catch {
      return false
    }
  }

  function isSessionEnding(name: string | undefined, text: string | undefined): boolean {
    return isSessionEndingLabel(name, text)
  }

  // Sidebar / navigation region detection
  async function discoverNavigationRegions(page: Page, currentState: PageState): Promise<SafeActionCandidate[]> {
    const candidates: SafeActionCandidate[] = []
    try {
      const navItems = await page.evaluate(() => {
        // Same accessible-name rules the collector uses: a space around every
        // non-inline descendant. Reading textContent here glued a sidebar
        // item's icon to its label ("•Overview") and no role locator matched.
        const renderedText = (element: Element): string => {
          let text = ''
          const walk = (node: Node): void => {
            if (node.nodeType === Node.TEXT_NODE) {
              text += node.textContent ?? ''
              return
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return
            const child = node as Element
            const style = window.getComputedStyle(child as HTMLElement)
            if (style.visibility === 'hidden') return
            if (child instanceof HTMLImageElement) {
              const alt = child.getAttribute('alt')
              if (alt) text += ` ${alt} `
              return
            }
            const inline = style.display === 'inline' || style.display === 'contents'
            if (!inline) text += ' '
            for (const grandChild of Array.from(child.childNodes)) walk(grandChild)
            if (!inline) text += ' '
          }
          for (const child of Array.from(element.childNodes)) walk(child)
          return text.replace(/\s+/g, ' ').trim()
        }

        const results: { name: string; role: string; href: string | null; cssSelector: string }[] = []
        const navRegions = document.querySelectorAll(
          'nav a[href], aside a[href], [role="navigation"] a[href], [role="menu"] [role="menuitem"], [role="menubar"] [role="menuitem"]'
        )
        navRegions.forEach((el) => {
          const anchor = el as HTMLAnchorElement
          // A collapsed submenu's links cannot be clicked. Offering them here
          // made every one fail and, because a failed action is remembered,
          // they were then skipped in the state where they were finally
          // visible. They are discovered again once their section expands.
          if (el.getClientRects().length === 0) return
          const name = el.getAttribute('aria-label')?.trim() || renderedText(el)
          // A long name is still the element's real name; truncating it would
          // break the locator, so keep the entry and let the CSS fallback work.
          if (!name) return
          const cssSel = el.id
            ? `#${CSS.escape(el.id)}`
            : `${el.tagName.toLowerCase()}[href="${(anchor.getAttribute('href') || '').replace(/["\\]/g, '\\$&')}"]`
          results.push({
            name,
            role: el.getAttribute('role') || 'link',
            href: anchor.href || null,
            cssSelector: cssSel
          })
        })
        return results.slice(0, 40)
      })

      for (const item of navItems) {
        if (!item.href) continue
        const action: StateEdge['action'] = {
          // Scoped to the state, so failing here cannot blacklist the same link
          // in a state where it is reachable.
          id: `${currentState.id}|nav|${item.cssSelector}`,
          type: 'navigate',
          description: `Navigate to “${item.name}” via sidebar`,
          target: item.name,
          selector: item.cssSelector,
          locator: { role: item.role, name: item.name },
          safe: true
        }
        if (isSessionEnding(item.name, undefined)) {
          action.safe = false
          action.reason = 'session-ending action'
        }
        if (isBlockedLabel(legacyOptions.blockedKeywords, item.name, item.href)) {
          action.safe = false
          action.reason = 'Action matched the Project click filter'
        }
        candidates.push({
          priority: 2,
          action,
          locator: { role: item.role, name: item.name, cssSelector: item.cssSelector },
          kind: 'sidebar-nav',
          restoreStrategy: 'goto'
        })
      }
    } catch {
      // navigation discovery is best-effort
    }
    return candidates
  }

  async function discoverSafeCandidates(page: Page, currentState: PageState): Promise<SafeActionCandidate[]> {
    const candidates: SafeActionCandidate[] = []

    // 1. Links (priority 1 - navigation links)
    for (const link of currentState.controls.filter((c) => c.kind === 'link' && c.href)) {
      if (isSessionEnding(link.accessibleName, link.text)) {
        candidates.push({
          priority: 10,
          action: {
            id: `${currentState.id}|navigate|${link.cssSelector}`,
            type: 'navigate',
            description: `Navigate to “${link.accessibleName}”`,
            target: link.accessibleName,
            selector: link.cssSelector,
            locator: { role: link.role, name: link.accessibleName },
            safe: false,
            reason: 'session-ending action'
          },
          locator: { role: link.role, name: link.accessibleName, cssSelector: link.cssSelector },
          kind: 'navigation-link',
          restoreStrategy: 'goto'
        })
        continue
      }
      const blocked = isBlockedLabel(legacyOptions.blockedKeywords, link.accessibleName, link.href, link.text)
      candidates.push({
        priority: blocked ? 10 : 1,
        action: {
          id: `${currentState.id}|navigate|${link.cssSelector}`,
          type: 'navigate',
          description: `Navigate to “${link.accessibleName}”`,
          target: link.accessibleName,
          selector: link.cssSelector,
          locator: { role: link.role, name: link.accessibleName },
          safe: !blocked,
          reason: blocked ? 'Action matched the Project click filter' : undefined
        },
        locator: { role: link.role, name: link.accessibleName, cssSelector: link.cssSelector },
        kind: 'navigation-link',
        restoreStrategy: 'goto'
      })
    }

    // 2. Sidebar/navigation regions (priority 2)
    try {
      const navCandidates = await discoverNavigationRegions(page, currentState)
      candidates.push(...navCandidates)
    } catch {
      // best-effort
    }

    // 3. Tabs (priority 3)
    for (const interaction of currentState.interactions.filter((i) => i.kind === 'tab')) {
      const blocked = isBlockedLabel(legacyOptions.blockedKeywords, interaction.name)
      candidates.push({
        priority: blocked ? 10 : 3,
        action: {
          id: `${currentState.id}|selectTab|${interaction.cssSelector}`,
          type: 'selectTab',
          description: `Select tab “${interaction.name}”`,
          target: interaction.name,
          selector: interaction.cssSelector,
          locator: { role: interaction.role, name: interaction.name },
          safe: !blocked,
          reason: blocked ? 'Action matched the Project click filter' : undefined
        },
        locator: { role: interaction.role, name: interaction.name, cssSelector: interaction.cssSelector },
        kind: 'tab',
        restoreStrategy: 'select-tab'
      })
    }

    // 4. Pagination (priority 4)
    const paginationSelectors =
      '[aria-label*="page" i], [aria-label*="หน้า" i], .pagination a, .pager a, [rel="next"], [rel="prev"]'
    try {
      const pagItems = await page.evaluate((sel) => {
        return Array.from(document.querySelectorAll(sel))
          .filter((el) => {
            const htmlEl = el as HTMLElement
            return htmlEl.offsetParent !== null
          })
          .slice(0, 10)
          .map((el) => ({
            name: (el.getAttribute('aria-label') || el.textContent?.replace(/\s+/g, ' ').trim() || '') as string,
            role: el.getAttribute('role') || 'link',
            href: (el as HTMLAnchorElement).href || null,
            cssSelector: el.id ? `#${CSS.escape((el as HTMLElement).id)}` : el.tagName.toLowerCase()
          }))
      }, paginationSelectors)

      for (const item of pagItems) {
        if (!item.name) continue
        const blocked = isSessionEnding(item.name, undefined)
        candidates.push({
          priority: blocked ? 10 : 4,
          action: {
            id: `${currentState.id}|pagination|${item.cssSelector}`,
            type: 'pagination',
            description: `Go to page “${item.name}”`,
            target: item.name,
            selector: item.cssSelector,
            locator: { role: item.role, name: item.name },
            safe: !blocked,
            reason: blocked ? 'session-ending action' : undefined
          },
          locator: { role: item.role, name: item.name },
          kind: 'pagination',
          restoreStrategy: 'goto'
        })
      }
    } catch {
      // best-effort
    }

    // 5. Modal openers (priority 5)
    for (const interaction of currentState.interactions.filter(
      (i) => i.kind === 'dialog' || i.kind === 'drawer' || i.kind === 'popover'
    )) {
      const blocked = isBlockedLabel(legacyOptions.blockedKeywords, interaction.name)
      candidates.push({
        priority: blocked ? 10 : 5,
        action: {
          id: `${currentState.id}|openModal|${interaction.cssSelector}`,
          type: 'openModal',
          description: `Open “${interaction.name}”`,
          target: interaction.name,
          selector: interaction.cssSelector,
          locator: { role: interaction.role, name: interaction.name },
          safe: !blocked,
          reason: blocked ? 'Action matched the Project click filter' : undefined
        },
        locator: { role: interaction.role, name: interaction.name, cssSelector: interaction.cssSelector },
        kind: 'modal-opener',
        restoreStrategy: 'close-dialog'
      })
    }

    // 6. Dropdowns (priority 6)
    for (const interaction of currentState.interactions.filter((i) => i.kind === 'dropdown')) {
      const blocked = isBlockedLabel(legacyOptions.blockedKeywords, interaction.name)
      candidates.push({
        priority: blocked ? 10 : 6,
        action: {
          id: `${currentState.id}|openDropdown|${interaction.cssSelector}`,
          type: 'openDropdown',
          description: `Open dropdown “${interaction.name}”`,
          target: interaction.name,
          selector: interaction.cssSelector,
          locator: { role: interaction.role, name: interaction.name },
          safe: !blocked,
          reason: blocked ? 'Action matched the Project click filter' : undefined
        },
        locator: { role: interaction.role, name: interaction.name, cssSelector: interaction.cssSelector },
        kind: 'dropdown',
        restoreStrategy: 'goto'
      })
    }

    // 7. Accordions (priority 7)
    for (const interaction of currentState.interactions.filter((i) => i.kind === 'accordion')) {
      const blocked = isBlockedLabel(legacyOptions.blockedKeywords, interaction.name)
      candidates.push({
        priority: blocked ? 10 : 7,
        action: {
          id: `${currentState.id}|expandAccordion|${interaction.cssSelector}`,
          type: 'expandAccordion',
          description: `Expand “${interaction.name}”`,
          target: interaction.name,
          selector: interaction.cssSelector,
          locator: { role: interaction.role, name: interaction.name },
          safe: !blocked,
          reason: blocked ? 'Action matched the Project click filter' : undefined
        },
        locator: { role: interaction.role, name: interaction.name, cssSelector: interaction.cssSelector },
        kind: 'accordion',
        restoreStrategy: 'goto'
      })
    }

    // 8. Breadcrumbs (priority 8)
    try {
      const bcItems = await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll('nav[aria-label*="breadcrumb" i] a, .breadcrumb a, [role="navigation"] ol a')
        )
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .slice(0, 10)
          .map((el) => ({
            name: (el.textContent?.replace(/\s+/g, ' ').trim() || '') as string,
            href: (el as HTMLAnchorElement).href || null,
            cssSelector: el.id ? `#${CSS.escape((el as HTMLElement).id)}` : 'a'
          }))
      })
      for (const item of bcItems) {
        if (!item.name || !item.href) continue
        candidates.push({
          priority: 8,
          action: {
            id: `${currentState.id}|breadcrumb|${item.cssSelector}`,
            type: 'breadcrumb',
            description: `Navigate breadcrumb “${item.name}”`,
            target: item.name,
            selector: item.cssSelector,
            locator: { name: item.name },
            safe: true
          },
          locator: { name: item.name },
          kind: 'breadcrumb',
          restoreStrategy: 'goto'
        })
      }
    } catch {
      // best-effort
    }

    // 9. Buttons that might be navigation (priority 9)
    for (const button of currentState.controls.filter(
      (c) => c.kind === 'button' && !c.disabled && !c.destructive && c.accessibleName
    )) {
      if (isSessionEnding(button.accessibleName, button.text)) {
        candidates.push({
          priority: 10,
          action: {
            id: `${currentState.id}|navigate|${button.cssSelector}`,
            type: 'navigate',
            description: `Navigate by clicking “${button.accessibleName}”`,
            target: button.accessibleName,
            selector: button.cssSelector,
            locator: { role: button.role, name: button.accessibleName },
            safe: false,
            reason: 'session-ending action'
          },
          locator: { role: button.role, name: button.accessibleName },
          kind: 'other-safe',
          restoreStrategy: 'goto'
        })
        continue
      }
      const blocked = isBlockedLabel(legacyOptions.blockedKeywords, button.accessibleName, button.text)
      candidates.push({
        priority: blocked ? 10 : 9,
        action: {
          id: `${currentState.id}|navigate|${button.cssSelector}`,
          type: 'navigate',
          description: `Navigate by clicking “${button.accessibleName}”`,
          target: button.accessibleName,
          selector: button.cssSelector,
          locator: { role: button.role, name: button.accessibleName },
          safe: !blocked,
          reason: blocked ? 'Action matched the Project click filter' : undefined
        },
        locator: { role: button.role, name: button.accessibleName },
        kind: 'other-safe',
        restoreStrategy: 'goto'
      })
    }

    // Sort by priority
    candidates.sort((a, b) => a.priority - b.priority)
    return candidates
  }

  // State restore
  /**
   * Re-apply the non-navigation actions that led to a state — expanding a
   * menu, opening a tab — so the page is back in that state before it is
   * collected. Best-effort: a control that no longer exists is skipped rather
   * than failing the whole queue item.
   */
  async function replayEntryFlow(page: Page, entryFlow: EntryFlowStep[]): Promise<void> {
    // Most flows are pure navigation and survive a reload on their own, so the
    // replay cost is only paid by states that were opened in-page.
    const inPageSteps = entryFlow.filter((step) => step.action.selector && step.action.type !== 'navigate')
    if (inPageSteps.length === 0) return
    for (const step of inPageSteps) {
      const selector = step.action.selector
      if (!selector) continue
      try {
        const target = page.locator(selector).first()
        if ((await target.count()) === 0) continue
        if (!(await target.isVisible())) continue
        await target.click({ timeout: legacyOptions.actionTimeoutMs })
        await page.waitForTimeout(legacyOptions.stateDiscoveryTimeoutMs)
      } catch {
        // The state may simply not be reachable from here anymore.
      }
    }
  }

  async function restoreState(
    page: Page,
    targetUrl: string,
    strategy: StateRestoreStrategy,
    entryFlow: EntryFlowStep[]
  ): Promise<void> {
    switch (strategy) {
      case 'goto':
        await page
          .goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: legacyOptions.pageTimeoutMs })
          .catch(() => undefined)
        await page.waitForTimeout(legacyOptions.waitAfterNavigationMs)
        // A reload resets the page to its collapsed form. Without replaying the
        // actions that opened this state, every remaining action in the state
        // would target a control that is no longer on screen.
        await replayEntryFlow(page, entryFlow)
        break
      case 'reload':
        await page
          .reload({ waitUntil: 'domcontentloaded', timeout: legacyOptions.pageTimeoutMs })
          .catch(() => undefined)
        await page.waitForTimeout(legacyOptions.waitAfterNavigationMs)
        await replayEntryFlow(page, entryFlow)
        break
      case 'close-dialog':
        try {
          await page.keyboard.press('Escape')
          await page.waitForTimeout(300)
        } catch {
          // best-effort
        }
        break
      case 'select-tab':
        // Already handled by the action itself, just wait
        await page.waitForTimeout(legacyOptions.stateDiscoveryTimeoutMs)
        break
      case 'entry-replay':
        // Replay the entry flow steps
        for (const step of entryFlow) {
          try {
            if (step.action.selector) {
              await page
                .locator(step.action.selector)
                .click({ timeout: legacyOptions.actionTimeoutMs })
                .catch(() => undefined)
              await page.waitForTimeout(legacyOptions.stateDiscoveryTimeoutMs)
            }
          } catch {
            // best-effort replay
          }
        }
        break
      case 'none':
      default:
        break
    }
  }

  // Check if auth was lost (redirected to login)
  function isAuthLost(currentUrl: string, page: Page): boolean {
    try {
      const path = new URL(currentUrl).pathname.toLowerCase()
      return path.includes('/login') || path.includes('/signin') || path.includes('/auth')
    } catch {
      return false
    }
  }

  // Retry logic
  async function executeWithRetry(
    page: Page,
    candidate: SafeActionCandidate,
    currentUrl: string,
    entryFlow: EntryFlowStep[],
    maxRetries: number
  ): Promise<{ success: boolean; newUrl?: string; authLost?: boolean }> {
    // Ordered fallbacks rather than a single locator: a role+name locator can
    // miss when the accessible name is computed differently, or match several
    // elements, and the recorded selector still resolves in both cases.
    const locatorsFor = (): Array<() => ReturnType<Page['locator']>> => {
      const options: Array<() => ReturnType<Page['locator']>> = []
      const { role, name, testId, cssSelector } = candidate.locator
      if (testId) options.push(() => page.getByTestId(testId))
      if (role && name) {
        options.push(() =>
          page.getByRole(role as 'button' | 'link' | 'tab' | 'menuitem', { name, exact: true }).first()
        )
        options.push(() => page.getByRole(role as 'button' | 'link' | 'tab' | 'menuitem', { name }).first())
      }
      if (cssSelector) options.push(() => page.locator(cssSelector).first())
      return options
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Resolve locator fresh each time
        const options = locatorsFor()
        if (options.length === 0) return { success: false }
        let locator: ReturnType<Page['locator']> | undefined
        for (const build of options) {
          const next = build()
          if ((await next.count()) > 0) {
            locator = next
            break
          }
        }
        if (!locator) throw new Error('No locator candidate matched')

        await locator.click({ timeout: legacyOptions.actionTimeoutMs })
        await page.waitForTimeout(legacyOptions.stateDiscoveryTimeoutMs)

        const newUrl = page.url()
        return { success: true, newUrl }
      } catch (_error) {
        if (attempt < maxRetries) {
          totalActionsRetried++
          debug(`Retrying action: ${candidate.action.description} (attempt ${attempt + 1}/${maxRetries})`, {
            actionId: candidate.action.id,
            retryCount: attempt + 1
          })
          // Restore state before retry
          await restoreState(page, currentUrl, candidate.restoreStrategy, entryFlow)
          await page.waitForTimeout(500)
        }
      }
    }
    return { success: false }
  }

  // Modal/dialog exploration
  async function exploreModal(
    page: Page,
    parentState: PageState,
    _sourceUrl: string,
    entryFlow: EntryFlowStep[],
    depth = 1
  ): Promise<{ state?: PageState; candidates: SafeActionCandidate[] }> {
    // Nested dialogs are explored, but only to a bounded depth so a modal that
    // reopens itself cannot spin the run.
    if (depth > MAX_MODAL_DEPTH) {
      debug(`Modal depth limit reached (${MAX_MODAL_DEPTH})`, { stateId: parentState.id })
      return { candidates: [] }
    }
    try {
      // The topmost open dialog is the one that just opened. Scoping collection
      // to it keeps the page behind the modal out of the modal's inventory.
      const containerSelector = await page.evaluate(() => {
        const open = Array.from(
          document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]')
        ).filter((element) => {
          const style = window.getComputedStyle(element as HTMLElement)
          return style.display !== 'none' && style.visibility !== 'hidden'
        })
        const container = open.at(-1)
        if (!container) return undefined
        if (container.id) return `#${CSS.escape(container.id)}`
        container.setAttribute('data-lazyscout-modal', 'true')
        return '[data-lazyscout-modal="true"]'
      })
      if (!containerSelector) return { candidates: [] }

      const raw = await page.evaluate(collectPageData)
      const pageModel = mapToPageModel(
        raw,
        { url: page.url(), finalUrl: page.url(), depth, statusCode: 200 },
        legacyOptions.blockedKeywords
      )
      const collected = pageModel.state
      if (!collected) return { candidates: [] }

      // Keep only what actually lives inside the container that opened.
      const modalState: PageState = {
        ...collected,
        parentStateId: parentState.id,
        containerSelector,
        depth,
        controls: collected.controls.filter(
          (control) =>
            control.context?.container === 'dialog' || control.context?.containerSelector === containerSelector
        )
      }

      if (visitedStates.has(modalState.id)) return { candidates: [] }
      visitedStates.add(modalState.id)
      addState(actionGraph, modalState)
      modalStatesDiscovered += 1

      debug(`State discovered: ${modalState.name} (modal depth ${depth}, ${modalState.controls.length} controls)`, {
        stateId: modalState.id,
        url: page.url()
      })

      const modalCandidates = await discoverSafeCandidates(page, modalState)
      const safeCandidates = modalCandidates.filter((c) => c.action.safe).slice(0, legacyOptions.maxActionsPerState)

      for (const mc of safeCandidates) {
        if (actionGraph.visitedActionKeys.includes(mc.action.id) || actionGraph.failedActionKeys.includes(mc.action.id))
          continue
        if (!mc.action.safe) {
          addEdge(actionGraph, modalState.id, undefined, mc.action, 'blocked')
          actionGraph.blockedActionKeys.push(mc.action.id)
          totalActionsBlocked++
          debug(`Blocked: ${mc.action.target} (${mc.action.reason || 'unsafe'})`, {
            actionId: mc.action.id,
            stateId: modalState.id
          })
          continue
        }

        const result = await executeWithRetry(page, mc, page.url(), entryFlow, config.limits.maxActionRetries)
        totalActionsExecuted++

        if (!result.success) {
          totalActionsFailed++
          addEdge(actionGraph, modalState.id, undefined, mc.action, 'failed')
          actionGraph.failedActionKeys.push(mc.action.id)
          debug(`Failed: ${mc.action.target}`, { actionId: mc.action.id, stateId: modalState.id })
          continue
        }

        actionGraph.visitedActionKeys.push(mc.action.id)
        const newRaw = await page.evaluate(collectPageData)
        const newModel = mapToPageModel(
          newRaw,
          { url: page.url(), finalUrl: page.url(), depth, statusCode: 200 },
          legacyOptions.blockedKeywords
        )
        const newState = newModel.state
        if (newState && !visitedStates.has(newState.id)) {
          visitedStates.add(newState.id)
          addState(actionGraph, { ...newState, parentStateId: modalState.id, depth })
          addEdge(actionGraph, modalState.id, newState.id, mc.action, 'visited')
          debug(`New state in modal: ${newState.name}`, { stateId: newState.id })

          // A dialog opened from inside this one is explored as its own state.
          if (newState.visibleDialogs.length > modalState.visibleDialogs.length) {
            await exploreModal(page, modalState, page.url(), entryFlow, depth + 1)
          }
        }
      }

      // Close modal after exploration
      try {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
      } catch {
        // ignore
      }

      return { state: modalState, candidates: modalCandidates }
    } catch {
      return { candidates: [] }
    }
  }

  // ======================================================================
  // Main exploration loop
  // ======================================================================

  const launched = await launchBrowser(
    legacyOptions.browserProfileDir ? { userDataDir: legacyOptions.browserProfileDir } : {}
  )
  const { context, label: browserLabel } = launched

  // Navigate to start URL or start path
  let targetStartUrl: string = entryUrl
  if (config.startPath) {
    try {
      targetStartUrl = new URL(config.startPath, entryUrl).toString()
      debug(`Start path resolved: ${targetStartUrl}`)
    } catch {
      debug(`Invalid start path: ${config.startPath}, using base URL`)
    }
  }

  try {
    context.setDefaultTimeout(legacyOptions.pageTimeoutMs)
    const page = await context.newPage()
    debug(`Navigating to: ${redactUrl(targetStartUrl)}`)
    const response = await page.goto(targetStartUrl, {
      waitUntil: 'domcontentloaded',
      timeout: legacyOptions.pageTimeoutMs
    })

    if (!response || (response.status() >= 400 && response.status() < 600)) {
      const status = response?.status()
      if (status && status >= 400) {
        issues.push({
          url: targetStartUrl,
          code: 'http-error',
          message: `The server returned HTTP ${status}.`
        })
        endReason = 'queue-exhausted'
      }
    } else {
      await page
        .waitForLoadState('networkidle', { timeout: Math.min(legacyOptions.pageTimeoutMs, 5_000) })
        .catch(() => undefined)
      await page.waitForTimeout(legacyOptions.waitAfterNavigationMs)

      // Collect initial page
      const raw = await page.evaluate(collectPageData)
      const initialPage = mapToPageModel(
        raw,
        { url: targetStartUrl, finalUrl: page.url(), depth: 0, statusCode: response.status() },
        legacyOptions.blockedKeywords
      )
      pages.push(initialPage)
      visitedUrls.add(normalizeUrl(initialPage.finalUrl))

      if (initialPage.state) {
        visitedStates.add(initialPage.state.id)
        addState(actionGraph, initialPage.state)
        debug(`State discovered: ${initialPage.state.name}`, {
          stateId: initialPage.state.id,
          url: redactUrl(initialPage.finalUrl)
        })
      }

      // Build initial entry flow
      const entryFlow: EntryFlowStep[] = []
      if (config.startPath && config.startPath !== '/') {
        entryFlow.push({
          url: targetStartUrl,
          action: {
            id: 'entry|start-path',
            type: 'navigate',
            description: `Navigate to start path: ${config.startPath}`,
            target: config.startPath,
            safe: true
          },
          stateId: initialPage.state?.id
        })
      }

      // Enqueue initial state for exploration
      stateQueue.push({
        url: initialPage.finalUrl,
        stateId: initialPage.state?.id,
        depth: 0,
        entryFlow
      })

      // Main queue loop
      while (stateQueue.length > 0) {
        abortIfRequested()
        // Check limits
        if (pages.length >= config.limits.maxPages) {
          endReason = 'max-pages-reached'
          debug(`Limit reached: max pages (${config.limits.maxPages})`)
          break
        }
        if (actionGraph.states.length >= config.limits.maxStates) {
          endReason = 'max-states-reached'
          debug(`Limit reached: max states (${config.limits.maxStates})`)
          break
        }
        if (totalActionsExecuted >= config.limits.maxTotalActions) {
          endReason = 'max-total-actions-reached'
          debug(`Limit reached: max total actions (${config.limits.maxTotalActions})`)
          break
        }
        if (Date.now() - startedAt > config.limits.explorationTimeoutMs) {
          endReason = 'timeout-reached'
          debug(`Limit reached: timeout (${config.limits.explorationTimeoutMs}ms)`)
          break
        }

        const item = stateQueue.shift()!
        if (item.depth > config.limits.maxDepth) continue

        // Navigate to the state's URL if we're not already there
        const currentUrl = normalizeUrl(page.url())
        const targetUrl = normalizeUrl(item.url)
        if (currentUrl !== targetUrl) {
          try {
            await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: legacyOptions.pageTimeoutMs })
            await page.waitForTimeout(legacyOptions.waitAfterNavigationMs)
          } catch (error) {
            issues.push(toExploreIssue(item.url, error))
            continue
          }
        }

        // Check for auth loss
        if (isAuthLost(page.url(), page)) {
          debug(`Auth lost, attempting recovery`, { url: redactUrl(page.url()) })
          // Try to restore by going back to the target
          try {
            await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: legacyOptions.pageTimeoutMs })
            await page.waitForTimeout(legacyOptions.waitAfterNavigationMs)
            if (isAuthLost(page.url(), page)) {
              debug(`Auth recovery failed`, { url: redactUrl(page.url()) })
              issues.push({
                url: item.url,
                code: 'auth-lost',
                message: 'Authentication was lost during exploration and could not be recovered.'
              })
              endReason = 'auth-lost-unrecoverable'
              break
            }
            debug(`Auth recovered`)
          } catch {
            endReason = 'auth-lost-unrecoverable'
            break
          }
        }

        // Get current state
        const collect = async () =>
          mapToPageModel(
            await page.evaluate(collectPageData),
            { url: item.url, finalUrl: page.url(), depth: item.depth, statusCode: 200 },
            legacyOptions.blockedKeywords
          )
        let currentModel = await collect()

        // A state reached by expanding a menu or opening a tab does not survive
        // the navigation above, so the actions that produced it are replayed.
        // Only when the page is not already in that state — replaying a toggle
        // against an already-open menu would close it again.
        const wantedState = item.stateId ? actionGraph.states.find((state) => state.id === item.stateId) : undefined
        if (wantedState && currentModel.state && currentModel.state.fingerprint !== wantedState.fingerprint) {
          await replayEntryFlow(page, item.entryFlow)
          currentModel = await collect()
        }

        const currentState = currentModel.state
        if (!currentState) continue

        if (!visitedStates.has(currentState.id)) {
          visitedStates.add(currentState.id)
          addState(actionGraph, currentState)
        }

        if (config.mode === 'current-page') continue

        // Discover safe actions
        const candidates = await discoverSafeCandidates(page, currentState)
        const safeActions = candidates
          .filter((c) => c.action.safe)
          .filter((c) => !actionGraph.visitedActionKeys.includes(c.action.id))
          .filter((c) => !actionGraph.failedActionKeys.includes(c.action.id))
          .slice(0, config.limits.maxActionsPerState)

        debug(`State: ${currentState.name} — Found ${candidates.length} candidates, ${safeActions.length} safe`, {
          stateId: currentState.id,
          url: redactUrl(page.url()),
          queueSize: stateQueue.length
        })

        for (const candidate of candidates) {
          if (!candidate.action.safe && candidate.action.reason) {
            totalActionsBlocked++
            addEdge(actionGraph, currentState.id, undefined, candidate.action, 'blocked')
            actionGraph.blockedActionKeys.push(candidate.action.id)
            const blockReason = isSessionEnding(candidate.action.target, undefined)
              ? 'session-ending action'
              : candidate.action.reason
            debug(`Blocked: ${candidate.action.target} (${blockReason})`, {
              actionId: candidate.action.id,
              stateId: currentState.id
            })
          }
        }

        for (const candidate of safeActions) {
          if (totalActionsExecuted >= config.limits.maxTotalActions) break
          if (Date.now() - startedAt > config.limits.explorationTimeoutMs) break

          actionGraph.visitedActionKeys.push(candidate.action.id)
          const beforeUrl = page.url()
          const actionStartedAt = Date.now()

          // Check scope for navigation actions
          if (
            candidate.kind === 'navigation-link' ||
            candidate.kind === 'sidebar-nav' ||
            candidate.kind === 'breadcrumb'
          ) {
            const href = candidate.action.target
            if (href && !isWithinScope(href)) {
              urlsSkippedByScope++
              debug(`Skipped: ${candidate.action.target} (outside scope ${config.scopePath || 'root'})`, {
                actionId: candidate.action.id,
                reason: `outside scope ${config.scopePath || 'root'}`
              })
              continue
            }
          }

          const result = await executeWithRetry(
            page,
            candidate,
            beforeUrl,
            item.entryFlow,
            config.limits.maxActionRetries
          )
          totalActionsExecuted++

          if (!result.success) {
            totalActionsFailed++
            addEdge(actionGraph, currentState.id, undefined, candidate.action, 'failed')
            actionGraph.failedActionKeys.push(candidate.action.id)
            recordTransition(
              currentState,
              candidate.action,
              { url: beforeUrl, fingerprint: currentState.fingerprint },
              { url: page.url() },
              'failed',
              Date.now() - actionStartedAt
            )
            debug(`Failed: ${candidate.action.target}`, { actionId: candidate.action.id })
            // Restore state and continue
            await restoreState(page, beforeUrl, candidate.restoreStrategy, item.entryFlow)
            continue
          }

          const afterUrl = page.url()
          const normalizedAfter = normalizeUrl(afterUrl)

          // Check scope again after navigation
          if (!isWithinScope(afterUrl)) {
            urlsSkippedByScope++
            debug(`Skipped (after navigation): ${redactUrl(afterUrl)} (outside scope)`, {
              url: redactUrl(afterUrl),
              reason: 'outside scope'
            })
            await restoreState(page, beforeUrl, candidate.restoreStrategy, item.entryFlow)
            continue
          }

          // Check for auth loss
          if (isAuthLost(afterUrl, page)) {
            debug(`Auth lost after action: ${candidate.action.target}`, { url: redactUrl(afterUrl) })
            await restoreState(page, beforeUrl, 'goto', item.entryFlow)
            continue
          }

          // Collect new state
          const newRaw = await page.evaluate(collectPageData)
          const newModel = mapToPageModel(
            newRaw,
            { url: beforeUrl, finalUrl: afterUrl, depth: item.depth + 1, statusCode: 200 },
            legacyOptions.blockedKeywords
          )
          const newState = newModel.state

          // Whether anything actually changed decides what the generator may
          // assert. An unchanged action becomes a review case, not a claim.
          const changed = Boolean(
            newState && (newState.fingerprint !== currentState.fingerprint || afterUrl !== beforeUrl)
          )
          recordTransition(
            currentState,
            candidate.action,
            { url: beforeUrl, fingerprint: currentState.fingerprint },
            { url: afterUrl, state: newState },
            changed ? 'changed' : 'unchanged',
            Date.now() - actionStartedAt
          )

          if (newState && !visitedStates.has(newState.id)) {
            visitedStates.add(newState.id)
            addState(actionGraph, { ...newState, parentStateId: currentState.id, depth: item.depth + 1 })
            addEdge(actionGraph, currentState.id, newState.id, candidate.action, 'visited')
            debug(`New state: ${newState.name}`, { stateId: newState.id, url: redactUrl(afterUrl) })

            // Add page if new URL
            if (!visitedUrls.has(normalizedAfter)) {
              visitedUrls.add(normalizedAfter)
              if (isSameOrigin(afterUrl, origin) && isCrawlableUrl(afterUrl)) {
                pages.push(newModel)
              }
            }

            // Explore modals in new state
            await exploreModal(page, newState, afterUrl, item.entryFlow)

            // Enqueue new state for further exploration
            const newEntryFlow = [...item.entryFlow, { url: afterUrl, action: candidate.action, stateId: newState.id }]
            stateQueue.push({
              url: afterUrl,
              stateId: newState.id,
              depth: item.depth + 1,
              entryFlow: newEntryFlow
            })
          } else if (newState) {
            addEdge(actionGraph, currentState.id, newState.id, candidate.action, 'visited')
          } else {
            addEdge(actionGraph, currentState.id, undefined, candidate.action, 'visited')
          }

          // Restore state for next action
          if (normalizedAfter !== normalizeUrl(beforeUrl)) {
            await restoreState(page, beforeUrl, candidate.restoreStrategy, item.entryFlow)
          }
        }
      }
    }
  } catch (error) {
    issues.push(toExploreIssue(targetStartUrl || entryUrl, error))
    if (endReason === 'queue-exhausted') {
      endReason = 'browser-crash'
    }
  } finally {
    await launched.close().catch(() => undefined)
  }

  // Build summary
  const summary: ExplorationSummary = {
    pagesDiscovered: pages.length,
    statesDiscovered: actionGraph.states.length,
    transitions: actionGraph.edges.filter((e) => e.status === 'visited').length,
    actionsExecuted: totalActionsExecuted,
    actionsBlocked: totalActionsBlocked,
    actionsFailed: totalActionsFailed,
    actionsRetried: totalActionsRetried,
    urlsSkippedByScope,
    endReason,
    endReasonDetail: getEndReasonDetail(endReason, config)
  }

  const stats: ExploreStats = {
    browser: browserLabel,
    pagesVisited: pages.length,
    urlsSkipped: urlsSkippedByScope,
    durationMs: Date.now() - startedAt,
    limitReached: endReason,
    summary,
    discoveryLogs: logs
  }

  // Every control the run saw, with the reason it was or was not exercised.
  for (const state of actionGraph.states) {
    for (const control of state.controls) {
      const elementId = coverage.discover(control, state.id)
      if (control.disabled) coverage.record(elementId, 'disabled')
      else if (control.risk === 'session-ending') coverage.record(elementId, 'blocked-session-ending')
      else if (control.risk === 'destructive') coverage.record(elementId, 'blocked-destructive')
      else if (control.uiPattern === 'unknown') coverage.record(elementId, 'unknown-pattern')
    }
  }
  for (const edge of actionGraph.edges) {
    const state = actionGraph.states.find((candidate) => candidate.id === edge.fromStateId)
    const control = state?.controls.find((candidate) => candidate.cssSelector === edge.action.selector)
    if (!control?.elementId) continue
    if (edge.status === 'visited') coverage.record(control.elementId, 'tested')
    else if (edge.status === 'failed') coverage.record(control.elementId, 'failed')
    else if (edge.status === 'blocked') coverage.record(control.elementId, 'blocked-filter', edge.action.reason)
  }
  for (let index = 0; index < modalStatesDiscovered; index++) coverage.countModalState()

  return {
    startUrl: entryUrl,
    origin,
    pages,
    issues,
    stats,
    actionGraph,
    transitions,
    coverage: coverage.report()
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addState(graph: ActionGraph, state: PageState | undefined): void {
  if (!state || graph.states.some((s) => s.id === state.id)) return
  graph.states.push(state)
  graph.visitedStateIds.push(state.id)
}

function addEdge(
  graph: ActionGraph,
  fromStateId: string,
  toStateId: string | undefined,
  action: StateEdge['action'],
  status: StateEdge['status']
): void {
  const id = `${fromStateId}|${action.id}|${toStateId ?? status}`
  if (graph.edges.some((edge) => edge.id === id)) return
  graph.edges.push({ id, fromStateId, toStateId, action, status })
}

function getEndReasonDetail(reason: ExplorationEndReason, config: ExplorationConfig): string {
  switch (reason) {
    case 'queue-exhausted':
      return 'All discoverable states have been explored within the configured scope.'
    case 'max-pages-reached':
      return `Maximum page limit (${config.limits.maxPages}) reached.`
    case 'max-states-reached':
      return `Maximum state limit (${config.limits.maxStates}) reached.`
    case 'max-depth-reached':
      return `Maximum depth limit (${config.limits.maxDepth}) reached.`
    case 'max-total-actions-reached':
      return `Maximum total actions limit (${config.limits.maxTotalActions}) reached.`
    case 'timeout-reached':
      return `Exploration timeout (${config.limits.explorationTimeoutMs}ms) reached.`
    case 'no-safe-actions-remaining':
      return 'No safe actions remain to explore.'
    case 'auth-lost-unrecoverable':
      return 'Authentication was lost and could not be recovered.'
    case 'browser-crash':
      return 'Browser crashed or became unresponsive.'
    default:
      return 'Exploration ended.'
  }
}

// ---------------------------------------------------------------------------
// Backward-compatible entry point
// ---------------------------------------------------------------------------

export async function exploreWebsiteWithConfig(
  startUrl: string,
  explorationConfig: Partial<ExplorationConfig> = {},
  exploreOptions: Partial<ExploreOptions> = {}
): Promise<ExploreResult> {
  return exploreWithScope(startUrl, explorationConfig, exploreOptions)
}
