import type { FastifyInstance } from 'fastify'
import type { ApiCheck, AnalyzeRequest, AnalyzeResponse } from '@lazyscout/core'
import { checkTargetUrl } from '@lazyscout/core'
import { ExplorerError, exploreWebsite } from '@lazyscout/explorer'
import { generateTestCases, generateTestData } from '@lazyscout/generators'
import { clamp, config } from '../config.js'
import { toApiError } from '../toApiError.js'

export function registerAnalyzeRoute(app: FastifyInstance): void {
  app.post('/api/analyze', async (request, reply) => {
    const body = (request.body ?? {}) as Partial<AnalyzeRequest>

    if (typeof body.url !== 'string' || !body.url.trim()) {
      return reply.status(400).send({
        error: { code: 'invalid-url', message: 'กรุณาระบุ URL ที่ต้องการวิเคราะห์' }
      })
    }

    const check = checkTargetUrl(body.url, config.urlPolicy)
    if (!check.ok) {
      return reply.status(400).send({ error: { code: check.code, message: check.message } })
    }

    try {
      const result = await exploreWebsite(
        check.url.toString(),
        {
          maxPages: clamp(body.maxPages, 1, config.limits.maxPages, config.limits.maxPages),
          maxDepth: clamp(body.maxDepth, 0, config.limits.maxDepth, config.limits.maxDepth),
          waitAfterNavigationMs: clamp(body.waitAfterNavigationMs, 0, 5000, 750)
        },
        config.urlPolicy
      )

      if (result.pages.length === 0) {
        const firstIssue = result.issues[0]
        throw new ExplorerError(
          firstIssue?.code ?? 'navigation-failed',
          firstIssue?.message ?? 'เปิดเว็บไซต์ไม่สำเร็จ',
          'ตรวจสอบว่า URL ถูกต้องและเว็บไซต์กำลังทำงานอยู่'
        )
      }

      const testCases = generateTestCases(result.pages, { language: body.language ?? 'en' })
      const runEvents = [
        { timestamp: new Date(Date.now() - result.stats.durationMs).toISOString(), eventType: 'run-started' as const, result: 'running' as const, message: 'Explorer run started' },
        ...result.pages.flatMap((page) => [
          { timestamp: new Date().toISOString(), eventType: 'page-discovered' as const, currentUrl: page.finalUrl, currentStateId: page.state?.id, result: 'passed' as const, message: `Page discovered: ${page.title || page.finalUrl}` },
          ...(page.state?.interactions ?? []).map((interaction) => ({ timestamp: new Date().toISOString(), eventType: (result.actionGraph.blockedActionKeys.some((key) => key.endsWith(`|${interaction.cssSelector}`)) ? 'action-blocked' : 'action-discovered') as 'action-blocked' | 'action-discovered', currentUrl: page.finalUrl, currentStateId: page.state?.id, result: (result.actionGraph.blockedActionKeys.some((key) => key.endsWith(`|${interaction.cssSelector}`)) ? 'blocked' : 'warning') as 'blocked' | 'warning', message: `${interaction.kind}: ${interaction.name}` }))
        ]),
        ...result.issues.map((issue) => ({ timestamp: new Date().toISOString(), eventType: 'error' as const, currentUrl: issue.url, result: 'failed' as const, error: issue.message, message: issue.message })),
        { timestamp: new Date().toISOString(), eventType: 'run-completed' as const, result: result.issues.length ? 'warning' as const : 'passed' as const, durationMs: result.stats.durationMs, message: 'Analysis completed' }
      ]
      const response: AnalyzeResponse = {
        startUrl: result.startUrl,
        origin: result.origin,
        pages: result.pages,
        testCases,
        testData: generateTestData(result.pages),
        issues: result.issues,
        stats: result.stats,
        actionGraph: result.actionGraph,
        runEvents,
        apiChecks: body.includeApiChecks ? buildApiChecks(result.pages) : []
      }
      return reply.send(response)
    } catch (error) {
      request.log.error({ err: error }, 'analyze failed')
      const { status, body: errorBody } = toApiError(error)
      return reply.status(status).send(errorBody)
    }
  })
}

function buildApiChecks(pages: AnalyzeResponse['pages']): ApiCheck[] {
  const seen = new Set<string>()
  const checks: ApiCheck[] = []
  for (const page of pages) for (const request of page.apiRequests) {
    const key = `${request.method}:${request.url}`
    if (seen.has(key)) continue
    seen.add(key)
    const authRequired = request.status === 401 || request.status === 403
    checks.push({ id: `API-${String(checks.length + 1).padStart(3, '0')}`, method: request.method, url: request.url, observedStatus: request.status, expectedStatus: authRequired ? undefined : request.status && request.status < 400 ? 200 : undefined, sourceUrl: request.sourceUrl, durationMs: request.durationMs, status: authRequired ? 'needs-auth' : request.status && request.status >= 400 ? 'needs-review' : 'observed', note: authRequired ? 'Requires auth profile or token before execution.' : undefined })
  }
  return checks
}
