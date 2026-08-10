import type { Page } from 'playwright-core'
import type {
  ActionGraph,
  ApiObservation,
  ExploreIssue,
  ExploreOptions,
  ExploreResult,
  PageInfo,
  PageState,
  StateEdge,
  UrlPolicy
} from '@lazyscout/core'
import { LOCAL_QA_POLICY, checkTargetUrl, isCrawlableUrl, isSameOrigin, normalizeUrl, redactUrl } from '@lazyscout/core'
import { collectPageData } from './browser/domCollector.js'
import { mapToPageModel } from './mapToPageModel.js'
import { ExplorerError, toExploreIssue } from './errors.js'
import { launchBrowser } from './launchBrowser.js'
import { canFollowLink, isBlockedLabel } from './safety.js'

export const DEFAULT_EXPLORE_OPTIONS: ExploreOptions = {
  maxPages: 20,
  maxDepth: 3,
  pageTimeoutMs: 20_000,
  totalTimeoutMs: 120_000,
  waitAfterNavigationMs: 750,
  maxStatesPerPage: 8,
  maxActionsPerState: 8,
  maxTotalStates: 80,
  actionTimeoutMs: 2_000,
  stateDiscoveryTimeoutMs: 350,
  blockedKeywords: [],
  maxNavigationProbesPerPage: 6
}

type QueueItem = { url: string; depth: number }

export async function exploreWebsite(
  startUrl: string,
  options: Partial<ExploreOptions> = {},
  policy: UrlPolicy = LOCAL_QA_POLICY
): Promise<ExploreResult> {
  const config: ExploreOptions = { ...DEFAULT_EXPLORE_OPTIONS, ...options }
  const startedAt = Date.now()

  const check = checkTargetUrl(startUrl, policy)
  if (!check.ok) throw new ExplorerError(check.code, check.message)

  const origin = check.url.origin
  const entryUrl = normalizeUrl(check.url.toString())

  const pages: PageInfo[] = []
  const issues: ExploreIssue[] = []
  const visited = new Set<string>()
  const queue: QueueItem[] = [{ url: entryUrl, depth: 0 }]
  const actionGraph: ActionGraph = {
    states: [],
    edges: [],
    visitedStateIds: [],
    visitedActionKeys: [],
    failedActionKeys: [],
    blockedActionKeys: []
  }
  let urlsSkipped = 0
  let limitReached: ExploreResult['stats']['limitReached'] = 'none'

  // A Project profile carries the cookies left by Open login browser, so the crawl
  // starts on the signed-in application rather than bouncing back to the login page.
  const launched = await launchBrowser(config.browserProfileDir ? { userDataDir: config.browserProfileDir } : {})
  const { context, label: browserLabel } = launched

  try {
    context.setDefaultTimeout(config.pageTimeoutMs)
    const page = await context.newPage()

    while (queue.length > 0) {
      if (pages.length >= config.maxPages) {
        limitReached = 'max-pages-reached'
        urlsSkipped += queue.length
        break
      }
      if (Date.now() - startedAt > config.totalTimeoutMs) {
        limitReached = 'timeout-reached'
        urlsSkipped += queue.length
        break
      }

      const item = queue.shift()!
      if (visited.has(item.url)) continue
      visited.add(item.url)

      const result = await visitPage(page, item, config, config.blockedKeywords)

      if (result.kind === 'issue') {
        issues.push(result.issue)
        continue
      }

      const finalKey = normalizeUrl(result.page.finalUrl)
      if (finalKey !== item.url && visited.has(finalKey)) {
        urlsSkipped++
        continue
      }
      visited.add(finalKey)
      pages.push(result.page)
      addState(actionGraph, result.page.state)
      await discoverSafeStates(page, result.page, config, origin, actionGraph)

      if (item.depth >= config.maxDepth) {
        if (result.page.links.length > 0) limitReached = limitReached === 'none' ? 'max-depth-reached' : limitReached
        continue
      }

      const enqueue = (href: string | undefined): void => {
        if (!href) return
        if (!isSameOrigin(href, origin) || !isCrawlableUrl(href)) {
          urlsSkipped++
          return
        }
        const next = normalizeUrl(href)
        if (visited.has(next) || queue.some((queued) => queued.url === next)) return
        queue.push({ url: next, depth: item.depth + 1 })
      }

      for (const link of result.page.links) {
        if (!canFollowLink(link.href, link.accessibleName, config.blockedKeywords)) continue
        enqueue(link.href)
      }

      await probeNavigationControls(
        page,
        result.page,
        config,
        origin,
        actionGraph,
        enqueue,
        () => Date.now() - startedAt > config.totalTimeoutMs
      )
    }
  } finally {
    await launched.close().catch(() => undefined)
  }

  addNavigationEdges(pages, actionGraph, config.blockedKeywords)

  return {
    startUrl: entryUrl,
    origin,
    pages,
    issues,
    stats: {
      browser: browserLabel,
      pagesVisited: pages.length,
      urlsSkipped,
      durationMs: Date.now() - startedAt,
      limitReached
    },
    actionGraph
  }
}

function addNavigationEdges(pages: PageInfo[], graph: ActionGraph, keywords: readonly string[]): void {
  for (const page of pages) {
    const source = page.state
    if (!source) continue
    for (const link of page.links) {
      if (!link.href || !link.accessibleName) continue
      const safe = canFollowLink(link.href, link.accessibleName, keywords)
      const target = pages.find((candidate) => candidate.finalUrl === link.href || candidate.url === link.href)?.state
      const action = {
        id: `${source.id}|navigate|${link.cssSelector}`,
        type: 'navigate' as const,
        description: `Navigate to “${link.accessibleName}”`,
        target: link.accessibleName,
        selector: link.cssSelector,
        locator: { role: link.role, name: link.accessibleName },
        safe,
        reason: safe ? undefined : 'Link matched the Project click filter and was not opened'
      }
      addEdge(graph, source.id, target?.id, action, safe && target ? 'visited' : safe ? 'discovered' : 'blocked')
      if (!safe) graph.blockedActionKeys.push(action.id)
    }
  }
}

function addState(graph: ActionGraph, state: PageState | undefined): void {
  if (!state || graph.states.some((candidate) => candidate.id === state.id)) return
  graph.states.push(state)
  graph.visitedStateIds.push(state.id)
}

async function discoverSafeStates(
  page: Page,
  source: PageInfo,
  config: ExploreOptions,
  origin: string,
  graph: ActionGraph
): Promise<void> {
  const initial = source.state
  if (!initial || graph.states.length >= config.maxTotalStates) return
  const sourceUrl = source.finalUrl
  const interactions = initial.interactions.slice(0, config.maxActionsPerState)
  let statesForPage = 1

  for (const interaction of interactions) {
    if (statesForPage >= config.maxStatesPerPage || graph.states.length >= config.maxTotalStates) break
    const action = actionFromInteraction(initial.id, interaction, config.blockedKeywords)
    const actionKey = action.id
    if (graph.visitedActionKeys.includes(actionKey) || graph.failedActionKeys.includes(actionKey)) continue

    if (!action.safe) {
      addEdge(graph, initial.id, undefined, action, 'blocked')
      graph.blockedActionKeys.push(actionKey)
      continue
    }

    try {
      await page.locator(interaction.cssSelector).click({ timeout: config.actionTimeoutMs })
      await page.waitForTimeout(config.stateDiscoveryTimeoutMs)
      if (!isSameOrigin(page.url(), origin)) {
        addEdge(
          graph,
          initial.id,
          undefined,
          { ...action, safe: false, reason: 'Action left the approved origin' },
          'blocked'
        )
        graph.blockedActionKeys.push(actionKey)
        continue
      }
      const raw = await page.evaluate(collectPageData)
      const observed = mapToPageModel(
        raw,
        {
          url: page.url(),
          finalUrl: page.url(),
          depth: source.depth,
          statusCode: source.statusCode
        },
        config.blockedKeywords
      ).state
      if (!observed) continue
      addState(graph, observed)
      addEdge(graph, initial.id, observed.id, action, 'visited')
      graph.visitedActionKeys.push(actionKey)
      if (observed.id !== initial.id) statesForPage += 1
    } catch (error) {
      addEdge(graph, initial.id, undefined, action, 'failed')
      graph.failedActionKeys.push(actionKey)
    } finally {
      await page
        .goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: config.pageTimeoutMs })
        .catch(() => undefined)
      await page.waitForTimeout(Math.min(config.waitAfterNavigationMs, 300))
    }
  }
}

/**
 * A menu that routes without an `<a href>` — a button or a `role="button"` in an
 * application shell — is invisible to link crawling, which is why exploring a
 * signed-in application used to stop at the page it started on. Clicking one and
 * keeping where it lands is the only way to reach the rest.
 */
async function probeNavigationControls(
  page: Page,
  source: PageInfo,
  config: ExploreOptions,
  origin: string,
  graph: ActionGraph,
  enqueue: (href: string | undefined) => void,
  outOfTime: () => boolean
): Promise<void> {
  if (config.maxNavigationProbesPerPage <= 0) return
  const sourceUrl = source.finalUrl
  const sourceKey = normalizeUrl(sourceUrl)
  const stateId = source.state?.id
  const candidates = source.buttons
    .filter((button) => button.accessibleName && !button.destructive && !button.disabled)
    .slice(0, config.maxNavigationProbesPerPage)

  for (const candidate of candidates) {
    if (outOfTime()) break
    const action: StateEdge['action'] = {
      id: `${stateId ?? sourceKey}|navigate|${candidate.cssSelector}`,
      type: 'navigate',
      description: `Navigate by clicking “${candidate.accessibleName}”`,
      target: candidate.accessibleName,
      selector: candidate.cssSelector,
      locator: { role: candidate.role, name: candidate.accessibleName },
      safe: true
    }
    if (graph.visitedActionKeys.includes(action.id) || graph.failedActionKeys.includes(action.id)) continue

    try {
      if (normalizeUrl(page.url()) !== sourceKey) {
        await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: config.pageTimeoutMs })
      }
      await page.locator(candidate.cssSelector).click({ timeout: config.actionTimeoutMs })
      await page.waitForTimeout(config.stateDiscoveryTimeoutMs)

      const reached = page.url()
      // Staying put means the control opened a dialog or a tab, which discoverSafeStates records.
      if (normalizeUrl(reached) === sourceKey) continue
      if (!isSameOrigin(reached, origin)) {
        if (stateId)
          addEdge(
            graph,
            stateId,
            undefined,
            { ...action, safe: false, reason: 'Action left the approved origin' },
            'blocked'
          )
        graph.blockedActionKeys.push(action.id)
        continue
      }
      enqueue(reached)
      if (stateId) addEdge(graph, stateId, undefined, action, 'discovered')
      graph.visitedActionKeys.push(action.id)
    } catch {
      if (stateId) addEdge(graph, stateId, undefined, action, 'failed')
      graph.failedActionKeys.push(action.id)
    }
  }

  // The crawl loop expects the page where it left it.
  if (normalizeUrl(page.url()) !== sourceKey) {
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: config.pageTimeoutMs }).catch(() => undefined)
  }
}

function actionFromInteraction(
  stateId: string,
  interaction: PageState['interactions'][number],
  keywords: readonly string[]
): StateEdge['action'] {
  const type =
    interaction.kind === 'tab'
      ? 'selectTab'
      : interaction.kind === 'accordion'
        ? 'expandAccordion'
        : interaction.kind === 'dropdown'
          ? 'openDropdown'
          : interaction.expanded
            ? 'closeDialog'
            : 'openModal'
  const blocked = isBlockedLabel(keywords, interaction.name)
  const description = `${type === 'selectTab' ? 'Select' : type === 'expandAccordion' ? 'Expand' : 'Open'} “${interaction.name}”`
  return {
    id: `${stateId}|${type}|${interaction.cssSelector}`,
    type,
    description,
    target: interaction.name,
    selector: interaction.cssSelector,
    locator: { role: interaction.role, name: interaction.name },
    safe: !blocked,
    reason: blocked ? 'Action matched the Project click filter and was not executed' : undefined
  }
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

type VisitResult = { kind: 'page'; page: PageInfo } | { kind: 'issue'; issue: ExploreIssue }

async function visitPage(
  page: Page,
  item: QueueItem,
  config: ExploreOptions,
  keywords: readonly string[]
): Promise<VisitResult> {
  try {
    const apiRequests: ApiObservation[] = []
    const requestStarted = new Map<string, number>()
    const onRequest = (request: import('playwright-core').Request) => {
      if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch')
        requestStarted.set(request.url(), Date.now())
    }
    const onResponse = (response: import('playwright-core').Response) => {
      const request = response.request()
      if (request.resourceType() !== 'xhr' && request.resourceType() !== 'fetch') return
      apiRequests.push({
        id: `api-${apiRequests.length + 1}`,
        method: request.method(),
        url: redactUrl(request.url()),
        status: response.status(),
        durationMs: Date.now() - (requestStarted.get(request.url()) ?? Date.now()),
        resourceType: request.resourceType() as 'xhr' | 'fetch',
        sourceUrl: redactUrl(item.url),
        contentType: response.headers()['content-type']
      })
    }
    page.on('request', onRequest)
    page.on('response', onResponse)
    const response = await page.goto(item.url, {
      waitUntil: 'domcontentloaded',
      timeout: config.pageTimeoutMs
    })

    const status = response?.status()
    if (status !== undefined && status >= 400) {
      return {
        kind: 'issue',
        issue: { url: item.url, code: 'http-error', message: `The server returned HTTP ${status}.` }
      }
    }

    await page
      .waitForLoadState('networkidle', { timeout: Math.min(config.pageTimeoutMs, 5_000) })
      .catch(() => undefined)
    await page.waitForTimeout(config.waitAfterNavigationMs)
    const challengeText = `${await page.title()} ${await page
      .locator('body')
      .innerText()
      .catch(() => '')}`.toLowerCase()
    if (
      challengeText.includes('cloudflare') ||
      challengeText.includes('checking your browser') ||
      challengeText.includes('verify you are human') ||
      challengeText.includes('just a moment')
    ) {
      return {
        kind: 'issue',
        issue: {
          url: item.url,
          code: 'cloudflare',
          message: 'Cloudflare/browser challenge — self check the website in a browser and try again'
        }
      }
    }

    const finalUrl = page.url()
    const raw = await page.evaluate(collectPageData)
    page.off('request', onRequest)
    page.off('response', onResponse)

    return {
      kind: 'page',
      page: mapToPageModel(
        raw,
        {
          url: item.url,
          finalUrl,
          depth: item.depth,
          statusCode: status,
          apiRequests
        },
        keywords
      )
    }
  } catch (error) {
    return { kind: 'issue', issue: toExploreIssue(item.url, error) }
  }
}
