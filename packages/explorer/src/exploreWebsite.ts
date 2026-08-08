import type { Browser, Page } from 'playwright-core'
import type { ExploreIssue, ExploreOptions, ExploreResult, PageInfo, UrlPolicy } from '@lazyscout/core'
import { LOCAL_QA_POLICY, checkTargetUrl, isCrawlableUrl, isSameOrigin, normalizeUrl } from '@lazyscout/core'
import { collectPageData } from './browser/domCollector.js'
import { mapToPageModel } from './mapToPageModel.js'
import { ExplorerError, toExploreIssue } from './errors.js'
import { launchBrowser } from './launchBrowser.js'
import { canFollowLink } from './safety.js'

export const DEFAULT_EXPLORE_OPTIONS: ExploreOptions = {
  maxPages: 20,
  maxDepth: 3,
  pageTimeoutMs: 20_000,
  totalTimeoutMs: 120_000
}

type QueueItem = { url: string; depth: number }

/**
 * สำรวจเว็บไซต์แบบ BFS ภายใน origin เดียวกัน
 *
 * ความปลอดภัย (MVP): เดินทางด้วย link href เท่านั้น — ไม่คลิกปุ่ม ไม่ submit form
 * จึงไม่มีทางไปกระตุ้น action ที่เปลี่ยนข้อมูลของระบบที่กำลังทดสอบ
 */
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

  // หาเบราว์เซอร์ที่ใช้ได้ในเครื่อง — โยน ExplorerError พร้อมวิธีแก้ถ้าไม่เจอสักตัว
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

      // ถ้าถูก redirect ไปหน้าที่เก็บไปแล้ว ให้ถือเป็นหน้าซ้ำ
      const finalKey = normalizeUrl(result.page.finalUrl)
      if (finalKey !== item.url && visited.has(finalKey)) {
        urlsSkipped++
        continue
      }
      visited.add(finalKey)
      pages.push(result.page)

      // เก็บ link ที่ปลอดภัยและอยู่ origin เดียวกันเข้าคิวถัดไป
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
    }
  }
}

type VisitResult = { kind: 'page'; page: PageInfo } | { kind: 'issue'; issue: ExploreIssue }

/** เปิดหนึ่งหน้าและดึงข้อมูลออกมา — error ของหน้าเดียวต้องไม่ทำให้ทั้ง job ล้ม */
async function visitPage(page: Page, item: QueueItem, config: ExploreOptions): Promise<VisitResult> {
  try {
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

    // รอ JS ที่ render เนื้อหาเพิ่ม แต่ไม่ต้องรอจนครบถ้าเว็บมี polling
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined)

    const finalUrl = page.url()
    const raw = await page.evaluate(collectPageData)

    return {
      kind: 'page',
      page: mapToPageModel(raw, {
        url: item.url,
        finalUrl,
        depth: item.depth,
        statusCode: status
      })
    }
  } catch (error) {
    return { kind: 'issue', issue: toExploreIssue(item.url, error) }
  }
}
