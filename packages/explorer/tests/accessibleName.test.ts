import { createServer, type Server } from 'node:http'
import { chromium, type Browser, type Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { collectPageData } from '../src/browser/domCollector.js'

/**
 * The collector's accessible name must equal the one Playwright computes,
 * because `getByRole(role, { name })` is built from it. Plain `textContent`
 * glues block siblings together — `<a><div>Icon</div><div>Orders</div></a>`
 * yielded "IconOrders" against Playwright's "Icon Orders", so every locator
 * for a link wrapping nested divs matched nothing.
 */
const CASES: Array<[label: string, html: string, expected: string]> = [
  ['plain text', '<a href="/a">Products</a>', 'Products'],
  ['nested divs', '<a href="/b"><div><div>Catalogue</div></div></a>', 'Catalogue'],
  ['icon beside label', '<a href="/c"><div><div>ICON</div><div>Orders</div></div></a>', 'ICON Orders'],
  [
    'label and description',
    '<a href="/d"><div><div>Reports</div><div>Monthly revenue</div></div></a>',
    'Reports Monthly revenue'
  ],
  ['inline span stays joined', '<a href="/e"><span>LS</span> LazyShop</a>', 'LS LazyShop'],
  ['deeply nested', '<a href="/f"><div><div><div><div>Deep</div></div></div></div></a>', 'Deep'],
  ['image alt contributes', '<a href="/g"><img src="data:," alt="Logo"><div>Home</div></a>', 'Logo Home'],
  ['hidden child excluded', '<a href="/h"><div style="display:none">HIDDEN</div><div>Visible</div></a>', 'Visible'],
  ['button with nested divs', '<button><div><div>Save</div><div>changes</div></div></button>', 'Save changes']
]

const HTML = `<!doctype html><html><body><ul>${CASES.map(([, html]) => `<li>${html}</li>`).join('')}</ul></body></html>`

describe('accessible name matches Playwright', () => {
  let server: Server
  let browser: Browser
  let page: Page
  let collected: Awaited<ReturnType<typeof collectPage>>

  const collectPage = async () => {
    const raw = await page.evaluate(collectPageData)
    return [...raw.links, ...raw.buttons]
  }

  beforeAll(async () => {
    server = createServer((_request, response) =>
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(HTML)
    )
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Fixture server did not start')
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${address.port}/`)
    collected = await collectPage()
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  })

  it.each(CASES.map(([label], index) => [label, index] as const))(
    'computes the name for %s the way the browser does',
    async (_label, index) => {
      const element = collected.find((candidate) => candidate.cssSelector.includes(`li:nth-of-type(${index + 1})`))
      expect(element, 'element was not collected at all').toBeDefined()
      expect(element!.accessibleName).toBe(CASES[index][2])

      // The name must actually resolve through a role locator, which is what
      // the generated Playwright code and the crawler both rely on.
      const role = element!.kind === 'link' ? 'link' : 'button'
      const matches = await page.getByRole(role, { name: element!.accessibleName, exact: true }).count()
      expect(matches, `getByRole could not resolve ${JSON.stringify(element!.accessibleName)}`).toBe(1)
    },
    30_000
  )

  it('never glues two block labels into one word', () => {
    for (const element of collected) {
      expect(element.accessibleName).not.toMatch(/[a-z][A-Z]{2,}/)
    }
  })
})

/**
 * The crawler clicks through `executeWithRetry`, which used to build a single
 * `getByRole` locator from the accessible name with no fallback. A menu of
 * `li > a` wrapping nested divs therefore failed every action.
 */
describe('crawler reaches links that wrap nested divs', () => {
  let server: Server
  let url: string

  beforeAll(async () => {
    const page = `<!doctype html><html><body>
      <ul>
        <li><a href="/orders"><div><div>ICON</div><div>Orders</div></div></a></li>
        <li><a href="/reports"><div><div>Reports</div><div>Monthly revenue</div></div></a></li>
      </ul>
    </body></html>`
    server = createServer((request, response) => {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      if (request.url === '/orders') return response.end('<h1>Orders page</h1>')
      if (request.url === '/reports') return response.end('<h1>Reports page</h1>')
      response.end(page)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Fixture server did not start')
    url = `http://127.0.0.1:${address.port}/`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  })

  it('executes both nested-div links instead of failing them', async () => {
    const { exploreWithScope } = await import('../src/index.js')
    const result = await exploreWithScope(
      url,
      {
        mode: 'site',
        debug: true,
        limits: {
          maxPages: 5,
          maxDepth: 2,
          maxStates: 20,
          maxActionsPerState: 8,
          maxTotalActions: 20,
          maxActionRetries: 1,
          explorationTimeoutMs: 60_000
        }
      },
      { waitAfterNavigationMs: 200, blockedKeywords: [] }
    )

    const failed = result.actionGraph.edges.filter((edge) => edge.status === 'failed')
    const visited = result.actionGraph.edges.filter((edge) => edge.status === 'visited')
    expect(failed, `failed: ${failed.map((edge) => edge.action.target).join(', ')}`).toHaveLength(0)
    expect(visited.length).toBeGreaterThanOrEqual(2)
    expect(result.pages.map((page) => page.finalUrl).join(' ')).toContain('/orders')
  }, 90_000)
})
