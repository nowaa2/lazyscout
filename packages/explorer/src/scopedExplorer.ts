import type { Page } from 'playwright-core'
import type {
  ActionGraph,
  DiscoveryLog,
  EntryFlowStep,
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
  let endReason: ExplorationEndReason = 'queue-exhausted'

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
  async function discoverNavigationRegions(page: Page): Promise<SafeActionCandidate[]> {
    const candidates: SafeActionCandidate[] = []
    try {
      const navItems = await page.evaluate(() => {
        const results: { name: string; role: string; href: string | null; cssSelector: string }[] = []
        const navRegions = document.querySelectorAll(
          'nav a[href], aside a[href], [role="navigation"] a[href], [role="menu"] [role="menuitem"], [role="menubar"] [role="menuitem"]'
        )
        navRegions.forEach((el) => {
          const anchor = el as HTMLAnchorElement
          const name = (el.getAttribute('aria-label') || el.textContent?.replace(/\s+/g, ' ').trim() || '') as string
          if (!name || name.length > 80) return
          const cssSel = el.id
            ? `#${CSS.escape(el.id)}`
            : `${el.tagName.toLowerCase()}[href="${anchor.getAttribute('href') || ''}"]`
          results.push({
            name: name.slice(0, 80),
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
          id: `nav|${item.cssSelector}`,
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
          locator: { role: item.role, name: item.name },
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
          locator: { role: link.role, name: link.accessibleName },
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
        locator: { role: link.role, name: link.accessibleName },
        kind: 'navigation-link',
        restoreStrategy: 'goto'
      })
    }

    // 2. Sidebar/navigation regions (priority 2)
    try {
      const navCandidates = await discoverNavigationRegions(page)
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
        locator: { role: interaction.role, name: interaction.name },
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
        locator: { role: interaction.role, name: interaction.name },
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
        locator: { role: interaction.role, name: interaction.name },
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
        locator: { role: interaction.role, name: interaction.name },
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
  async function restoreState(
    page: Page,
    targetUrl: string,
    strategy: StateRestoreStrategy,
    _entryFlow: EntryFlowStep[]
  ): Promise<void> {
    switch (strategy) {
      case 'goto':
        await page
          .goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: legacyOptions.pageTimeoutMs })
          .catch(() => undefined)
        await page.waitForTimeout(legacyOptions.waitAfterNavigationMs)
        break
      case 'reload':
        await page
          .reload({ waitUntil: 'domcontentloaded', timeout: legacyOptions.pageTimeoutMs })
          .catch(() => undefined)
        await page.waitForTimeout(legacyOptions.waitAfterNavigationMs)
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
        for (const step of _entryFlow) {
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
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Resolve locator fresh each time
        let locator
        if (candidate.locator.cssSelector) {
          locator = page.locator(candidate.locator.cssSelector).first()
        } else if (candidate.locator.role && candidate.locator.name) {
          locator = page.getByRole(candidate.locator.role as 'button' | 'link' | 'tab' | 'menuitem', {
            name: candidate.locator.name
          })
        } else if (candidate.locator.testId) {
          locator = page.getByTestId(candidate.locator.testId)
        } else {
          return { success: false }
        }

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
    entryFlow: EntryFlowStep[]
  ): Promise<{ state?: PageState; candidates: SafeActionCandidate[] }> {
    try {
      const hasDialog = await page.evaluate(() => {
        return !!(
          document.querySelector('[role="dialog"]') ||
          document.querySelector('dialog[open]') ||
          document.querySelector('[aria-modal="true"]')
        )
      })
      if (!hasDialog) return { candidates: [] }

      const raw = await page.evaluate(collectPageData)
      const pageModel = mapToPageModel(
        raw,
        { url: page.url(), finalUrl: page.url(), depth: (parentState as any).depth ?? 0, statusCode: 200 },
        legacyOptions.blockedKeywords
      )
      const modalState = pageModel.state
      if (!modalState) return { candidates: [] }

      if (visitedStates.has(modalState.id)) return { candidates: [] }
      visitedStates.add(modalState.id)
      addState(actionGraph, modalState)

      debug(`State discovered: ${modalState.name} (modal)`, { stateId: modalState.id, url: page.url() })

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
          { url: page.url(), finalUrl: page.url(), depth: (parentState as any).depth ?? 0, statusCode: 200 },
          legacyOptions.blockedKeywords
        )
        const newState = newModel.state
        if (newState && !visitedStates.has(newState.id)) {
          visitedStates.add(newState.id)
          addState(actionGraph, newState)
          addEdge(actionGraph, modalState.id, newState.id, mc.action, 'visited')
          debug(`New state in modal: ${newState.name}`, { stateId: newState.id })
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
        const raw = await page.evaluate(collectPageData)
        const currentModel = mapToPageModel(
          raw,
          { url: item.url, finalUrl: page.url(), depth: item.depth, statusCode: 200 },
          legacyOptions.blockedKeywords
        )
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

          if (newState && !visitedStates.has(newState.id)) {
            visitedStates.add(newState.id)
            addState(actionGraph, newState)
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

  return {
    startUrl: entryUrl,
    origin,
    pages,
    issues,
    stats,
    actionGraph
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
