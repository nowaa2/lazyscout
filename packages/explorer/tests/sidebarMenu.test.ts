import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { exploreWithScope } from '../src/index.js'

/**
 * A sidebar built the way real applications build them: links wrapping several
 * layers of div, sections that start collapsed, labels repeated across
 * sections, and an icon-only entry. Reaching the entries inside a collapsed
 * section requires expanding it, and then re-expanding it after every
 * navigation resets the page.
 */
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures', 'demo-site', 'sidebar.html')

const ROUTES = [
  '/app/dashboard',
  '/app/sales/overview',
  '/app/sales/orders',
  '/app/sales/returns/open',
  '/app/sales/returns/closed',
  '/app/inventory/overview',
  '/app/inventory/stock',
  '/app/reports',
  '/app/help',
  '/app/activity/latest'
]

/** Reachable without expanding anything. */
const TOP_LEVEL = ['/app/dashboard', '/app/reports', '/app/help', '/app/activity/latest']
/** Reachable only after expanding one section. */
const ONE_LEVEL = ['/app/sales/overview', '/app/sales/orders', '/app/inventory/overview', '/app/inventory/stock']

describe('nested sidebar menu', () => {
  let server: Server
  let result: Awaited<ReturnType<typeof exploreWithScope>>
  let reached: Set<string>

  beforeAll(async () => {
    const html = await readFile(FIXTURE, 'utf8')
    server = createServer((request, response) => {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      const path = (request.url ?? '/').split('?')[0]
      if (ROUTES.includes(path)) return response.end(`<h1>${path}</h1><a href="/">Back</a>`)
      response.end(html)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Fixture server did not start')

    result = await exploreWithScope(
      `http://127.0.0.1:${address.port}/`,
      {
        mode: 'site',
        debug: true,
        // Bounded so the test stays quick. Before the fixes below, this budget
        // reached none of the collapsed-section routes at all.
        limits: {
          maxPages: 20,
          maxDepth: 3,
          maxStates: 60,
          maxActionsPerState: 12,
          maxTotalActions: 34,
          maxActionRetries: 1,
          explorationTimeoutMs: 120_000
        }
      },
      { waitAfterNavigationMs: 150, blockedKeywords: [] }
    )
    reached = new Set(result.pages.map((page) => new URL(page.finalUrl).pathname))
  }, 200_000)

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  })

  it.each(TOP_LEVEL)('reaches %s, which needs no expansion', (route) => {
    expect(reached.has(route)).toBe(true)
  })

  it('reaches routes inside a collapsed section', () => {
    // The crawler must expand the section, and re-expand it after each
    // navigation resets the page. None of these were reachable before.
    const found = ONE_LEVEL.filter((route) => reached.has(route))
    expect(found.length, `reached: ${[...reached].join(', ')}`).toBeGreaterThanOrEqual(2)
  })

  it('names a sidebar entry the way the browser does, not glued together', () => {
    const names = result.actionGraph.states.flatMap((state) =>
      state.controls.filter((control) => control.kind === 'link').map((control) => control.accessibleName)
    )
    expect(names.join(' | ')).toContain('• Overview')
    expect(names.join(' | ')).not.toContain('•Overview')
  })

  it('reads an icon-only entry from its aria-label', () => {
    const names = result.actionGraph.states.flatMap((state) => state.controls.map((control) => control.accessibleName))
    expect(names).toContain('Help centre')
  })

  it('does not queue links inside a collapsed section as failures', () => {
    // Offering a hidden link wasted an action and then blacklisted it for the
    // state where it was finally visible.
    const failedTopLevel = result.actionGraph.edges
      .filter((edge) => edge.status === 'failed')
      .map((edge) => edge.action.target)
      .filter((target) => TOP_LEVEL.some((route) => (target ?? '').includes(route)))
    expect(failedTopLevel).toHaveLength(0)
  })

  it('classifies the collapsible sections as accordions and the tabs as tabs', () => {
    const patterns = new Set(
      result.actionGraph.states.flatMap((state) => state.controls.map((control) => control.uiPattern))
    )
    expect(patterns).toContain('accordion')
    expect(patterns).toContain('tab')
  })
})
