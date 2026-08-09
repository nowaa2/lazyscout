import type { Browser, Page } from 'playwright-core'
import type {
  ActionGraph,
  ApiObservation,
  ExploreIssue,
  ExploreOptions,
  ExploreResult,
  PageInfo,
  StateEdge,
  UrlPolicy
} from '@lazyscout/core'
import { LOCAL_QA_POLICY, checkTargetUrl, isCrawlableUrl, isSameOrigin, normalizeUrl, redactUrl } from '@lazyscout/core'
import { collectPageData } from './browser/domCollector.js'
import { mapToPageModel } from './mapToPageModel.js'
import { ExplorerError, toExploreIssue } from './errors.js'
import { launchBrowser } from './launchBrowser.js'
import { canFollowLink, isDestructiveLabel } from './safety.js'

export const DEFAULT_EXPLORE_OPTIONS: ExploreOptions = {
  maxPages: 20,
  maxDepth: 3,
  pageTimeoutMs: 20_000,
  totalTimeoutMs: 120_000,
  waitAfterNavigationMs: 750
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
  let urlsSkipped = 0
  let limitReached: ExploreResult['stats']['limitReached'] = 'none'

  const { browser, label: browserLabel }: { browser: Browser; label: string } = await launchBrowser()

  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    context.setDefaultTimeout(config.pageTimeoutMs)
    const page = await context.newPage()

    while (queue.length > 0) {
      if (pages.length >= config.maxPages) {
        limitReached = 'max-pages'
        urlsSkipped += queue.length
        break
      }
      if (Date.now() - startedAt > config.totalTimeoutMs) {
        limitReached = 'total-timeout'
        urlsSkipped += queue.length
        break
      }

      const item = queue.shift()!
      if (visited.has(item.url)) continue
      visited.add(item.url)

      const result = await visitPage(page, item, config)

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

      if (item.depth >= config.maxDepth) {
        if (result.page.links.length > 0) limitReached = limitReached === 'none' ? 'max-depth' : limitReached
        continue
      }

      for (const link of result.page.links) {
        if (!canFollowLink(link.href, link.accessibleName)) continue
        if (!isSameOrigin(link.href!, origin) || !isCrawlableUrl(link.href!)) {
          urlsSkipped++
          continue
        }
        const next = normalizeUrl(link.href!)
        if (visited.has(next) || queue.some((queued) => queued.url === next)) continue
        queue.push({ url: next, depth: item.depth + 1 })
      }
    }
  } finally {
    await browser.close().catch(() => undefined)
  }

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
    actionGraph: buildActionGraph(pages)
  }
}

function buildActionGraph(pages: PageInfo[]): ActionGraph {
  const states = pages.flatMap((page) => (page.state ? [page.state] : []))
  const edges: StateEdge[] = []
  const visitedActionKeys: string[] = []
  const failedActionKeys: string[] = []
  const blockedActionKeys: string[] = []

  for (const page of pages) {
    const state = page.state
    if (!state) continue
    const fromStateId = state.id
    for (const link of page.links) {
      if (!link.href || !link.accessibleName) continue
      const targetPage = pages.find((candidate) => candidate.url === link.href || candidate.finalUrl === link.href)
      const action: StateEdge['action'] = {
        type: 'navigate',
        target: link.accessibleName,
        selector: link.cssSelector,
        safe: canFollowLink(link.href, link.accessibleName)
      }
      const key = `${fromStateId}|navigate|${link.cssSelector}`
      const status = action.safe ? (targetPage ? 'visited' : 'discovered') : 'blocked'
      edges.push({ fromStateId, toStateId: targetPage?.state?.id, action, status })
      if (status === 'visited') visitedActionKeys.push(key)
      if (status === 'blocked') blockedActionKeys.push(key)
    }
    for (const interaction of state.interactions) {
      const destructive = isDestructiveLabel(interaction.name)
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
      const key = `${fromStateId}|${type}|${interaction.cssSelector}`
      const action: StateEdge['action'] = {
        type,
        target: interaction.name,
        selector: interaction.cssSelector,
        safe: !destructive,
        reason: destructive ? 'Destructive action was discovered but not executed' : undefined
      }
      edges.push({ fromStateId, action, status: destructive ? 'blocked' : 'discovered' })
      if (destructive) blockedActionKeys.push(key)
    }
  }
  return {
    states,
    edges,
    visitedStateIds: states.map((state) => state.id),
    visitedActionKeys,
    failedActionKeys,
    blockedActionKeys
  }
}

type VisitResult = { kind: 'page'; page: PageInfo } | { kind: 'issue'; issue: ExploreIssue }

async function visitPage(page: Page, item: QueueItem, config: ExploreOptions): Promise<VisitResult> {
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
        issue: { url: item.url, code: 'http-error', message: `เซิร์ฟเวอร์ตอบกลับ HTTP ${status}` }
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
      page: mapToPageModel(raw, {
        url: item.url,
        finalUrl,
        depth: item.depth,
        statusCode: status,
        apiRequests
      })
    }
  } catch (error) {
    return { kind: 'issue', issue: toExploreIssue(item.url, error) }
  }
}
