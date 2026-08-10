import type { FastifyInstance } from 'fastify'
import type { ActionGraph, ApiCheck, AnalyzeRequest, AnalyzeResponse, PageState, TestCase } from '@lazyscout/core'
import { checkTargetUrl, redactSensitiveText } from '@lazyscout/core'
import { ExplorerError, exploreWithScope, normalizeBlockedKeywords } from '@lazyscout/explorer'
import { generateTestCases, generateTestData, localizeThai } from '@lazyscout/generators'
import { clamp, config } from '../config.js'
import { toApiError } from '../toApiError.js'
import { browserProfileDirectory } from '../workspace.js'

export function registerAnalyzeRoute(app: FastifyInstance, workspaceRoot: string): void {
  app.post('/api/analyze', async (request, reply) => {
    const body = (request.body ?? {}) as Partial<AnalyzeRequest>

    if (typeof body.url !== 'string' || !body.url.trim()) {
      return reply.status(400).send({
        error: { code: 'invalid-url', message: 'Provide a URL to analyze.' }
      })
    }

    const check = checkTargetUrl(body.url, config.urlPolicy)
    if (!check.ok) {
      return reply.status(400).send({ error: { code: check.code, message: check.message } })
    }

    // Without the Project profile the crawl signs out of everything the operator
    // signed into, and an application behind a login looks like one page.
    const browserProfileDir = body.projectId
      ? await browserProfileDirectory(workspaceRoot, body.projectId).catch(() => undefined)
      : undefined

    try {
      const result = await exploreWithScope(
        check.url.toString(),
        {
          startPath: body.startPath,
          scopePath: body.scopePath,
          mode: body.mode ?? 'site',
          debug: body.debug ?? false,
          limits: {
            maxPages: clamp(body.maxPages, 1, config.limits.maxPages, config.limits.maxPages),
            maxDepth: clamp(body.maxDepth, 0, config.limits.maxDepth, config.limits.maxDepth),
            maxStates: 80,
            maxActionsPerState: 8,
            maxTotalActions: 200,
            maxActionRetries: 2,
            explorationTimeoutMs: 300_000
          }
        },
        {
          waitAfterNavigationMs: clamp(body.waitAfterNavigationMs, 0, 5000, 750),
          blockedKeywords: normalizeBlockedKeywords(body.blockedKeywords),
          ...(browserProfileDir ? { browserProfileDir } : {})
        }
      )

      if (result.pages.length === 0) {
        const firstIssue = result.issues[0]
        throw new ExplorerError(
          firstIssue?.code ?? 'navigation-failed',
          firstIssue?.message ?? 'Could not open the website.',
          'Check that the URL is correct and the website is available.'
        )
      }

      const testCases = [
        ...generateTestCases(result.pages, { language: body.language ?? 'en' }),
        ...(body.language === 'th'
          ? localizeThai(generateStateFlowTestCases(result.actionGraph))
          : generateStateFlowTestCases(result.actionGraph))
      ]
      const runEvents = [
        {
          timestamp: new Date(Date.now() - result.stats.durationMs).toISOString(),
          eventType: 'run-started' as const,
          result: 'running' as const,
          message: 'Explorer run started'
        },
        ...result.pages.flatMap((page) => [
          {
            timestamp: new Date().toISOString(),
            eventType: 'page-discovered' as const,
            currentUrl: page.finalUrl,
            currentStateId: page.state?.id,
            result: 'passed' as const,
            message: `Page discovered: ${page.title || page.finalUrl}`
          },
          ...(page.state?.interactions ?? []).map((interaction) => ({
            timestamp: new Date().toISOString(),
            eventType: (result.actionGraph.blockedActionKeys.some((key) => key.endsWith(`|${interaction.cssSelector}`))
              ? 'action-blocked'
              : 'action-discovered') as 'action-blocked' | 'action-discovered',
            currentUrl: page.finalUrl,
            currentStateId: page.state?.id,
            result: (result.actionGraph.blockedActionKeys.some((key) => key.endsWith(`|${interaction.cssSelector}`))
              ? 'blocked'
              : 'warning') as 'blocked' | 'warning',
            message: `${interaction.kind}: ${interaction.name}`
          }))
        ]),
        ...result.actionGraph.states.map((state) => ({
          timestamp: state.discoveredAt,
          eventType: 'state-discovered' as const,
          currentUrl: state.url,
          currentStateId: state.id,
          result: 'passed' as const,
          message: `State observed: ${state.name || state.title || state.url}`
        })),
        ...result.actionGraph.edges.map((edge) => ({
          timestamp: new Date().toISOString(),
          eventType:
            edge.status === 'blocked'
              ? ('action-blocked' as const)
              : edge.status === 'failed'
                ? ('action-failed' as const)
                : edge.status === 'visited'
                  ? ('action-executed' as const)
                  : ('transition-discovered' as const),
          currentUrl: result.actionGraph.states.find((state) => state.id === edge.fromStateId)?.url,
          currentStateId: edge.fromStateId,
          action: edge.action,
          result:
            edge.status === 'blocked'
              ? ('blocked' as const)
              : edge.status === 'failed'
                ? ('failed' as const)
                : edge.status === 'visited'
                  ? ('passed' as const)
                  : ('warning' as const),
          message: edge.action.description
        })),
        ...result.issues.map((issue) => ({
          timestamp: new Date().toISOString(),
          eventType: 'error' as const,
          currentUrl: issue.url,
          result: 'failed' as const,
          error: issue.message,
          message: issue.message
        })),
        {
          timestamp: new Date().toISOString(),
          eventType: 'run-completed' as const,
          result: result.issues.length ? ('warning' as const) : ('passed' as const),
          durationMs: result.stats.durationMs,
          message: 'Analysis completed'
        }
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
      request.log.error(
        { message: redactSensitiveText(error instanceof Error ? error.message : String(error)) },
        'analyze failed'
      )
      const { status, body: errorBody } = toApiError(error)
      return reply.status(status).send(errorBody)
    }
  })
}

function generateStateFlowTestCases(graph: ActionGraph): TestCase[] {
  const states = new Map(graph.states.map((state) => [state.id, state]))
  let sequence = 1
  return graph.edges.flatMap((edge) => {
    if (edge.status !== 'visited' || !edge.toStateId || edge.fromStateId === edge.toStateId) return []
    const target = states.get(edge.toStateId)
    const source = states.get(edge.fromStateId)
    if (!target || !source) return []
    const observation = expectedObservation(target)
    const id = `TC-FLOW-${String(sequence).padStart(3, '0')}`
    sequence += 1
    return [
      {
        id,
        module: 'FLOW',
        tags: ['state-flow'],
        title: `${edge.action.description} reaches ${target.name}`,
        preconditions: [`The application is available at ${source.url}`],
        steps: [
          { type: 'navigate' as const, url: source.url },
          {
            type: 'click' as const,
            target: {
              role: edge.action.locator?.role,
              name: edge.action.locator?.name,
              cssSelector: edge.action.selector
            }
          }
        ],
        expectedResult: observation ?? 'Observed state requires tester review before automation.',
        type: target.type === 'validation' || target.type === 'error' ? 'validation' : 'positive',
        priority: 'medium',
        automationStatus: observation ? 'ready' : 'needs-review',
        sourceUrl: source.url,
        notes: observation
          ? 'Generated from an observed UI state transition.'
          : 'Explorer observed a new UI state but no stable assertion text.'
      }
    ]
  })
}

function expectedObservation(state: PageState): string | undefined {
  if (state.visibleDialogs[0]) return `Dialog "${state.visibleDialogs[0]}" is visible.`
  if (state.validationMessages[0]) return `Validation message "${state.validationMessages[0]}" is visible.`
  if (state.headings[0]) return `Heading "${state.headings[0]}" is visible.`
  return undefined
}

function buildApiChecks(pages: AnalyzeResponse['pages']): ApiCheck[] {
  const seen = new Set<string>()
  const checks: ApiCheck[] = []
  for (const page of pages)
    for (const request of page.apiRequests) {
      const key = `${request.method}:${request.url}`
      if (seen.has(key)) continue
      seen.add(key)
      const authRequired = request.status === 401 || request.status === 403
      const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())
      checks.push({
        id: `API-${String(checks.length + 1).padStart(3, '0')}`,
        method: request.method,
        url: request.url,
        observedStatus: request.status,
        expectedStatus: authRequired ? undefined : request.status && request.status < 400 ? 200 : undefined,
        sourceUrl: request.sourceUrl,
        durationMs: request.durationMs,
        status: !safeMethod
          ? 'needs-review'
          : authRequired
            ? 'needs-auth'
            : request.status && request.status >= 400
              ? 'needs-review'
              : 'observed',
        note: !safeMethod
          ? 'Observation only. LazyScout does not replay state-changing API methods automatically.'
          : authRequired
            ? 'Requires auth profile or token before execution.'
            : undefined
      })
    }
  return checks
}
