import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { UIElement, UIPattern } from '@lazyscout/core'
import { exploreWithScope } from '../src/index.js'

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'fixtures',
  'demo-site',
  'patterns.html'
)
const TIMEOUT = 90_000

describe('deterministic pattern inventory', () => {
  let server: Server
  let url: string
  let controls: UIElement[]
  let result: Awaited<ReturnType<typeof exploreWithScope>>

  beforeAll(async () => {
    const html = await readFile(FIXTURE, 'utf8')
    server = createServer((request, response) => {
      if (request.url === '/app.css') {
        response.writeHead(200, { 'content-type': 'text/css' }).end('')
        return
      }
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Fixture server did not start')
    url = `http://127.0.0.1:${address.port}/patterns`

    result = await exploreWithScope(
      url,
      {
        mode: 'current-page',
        debug: false,
        limits: {
          maxPages: 1,
          maxDepth: 0,
          maxStates: 40,
          maxActionsPerState: 8,
          maxTotalActions: 40,
          maxActionRetries: 1,
          explorationTimeoutMs: 60_000
        }
      },
      { waitAfterNavigationMs: 250, blockedKeywords: ['delete'] }
    )
    controls = result.pages[0]?.state?.controls ?? []
  }, TIMEOUT)

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  })

  const find = (selectorFragment: string): UIElement | undefined =>
    controls.find((control) => control.cssSelector.includes(selectorFragment) || control.id === selectorFragment)

  const patternsFound = (): Set<UIPattern> =>
    new Set(controls.map((control) => control.uiPattern).filter(Boolean) as UIPattern[])

  it('collects the page without error', () => {
    expect(result.pages).toHaveLength(1)
    expect(controls.length).toBeGreaterThan(10)
  })

  it.each<[string, UIPattern]>([
    ['tab-billing', 'tab'],
    ['newsletter', 'checkbox'],
    ['plan-pro', 'radio'],
    ['dark-mode', 'switch'],
    ['country', 'select'],
    ['nickname', 'text-input'],
    ['quantity', 'number-input'],
    ['volume', 'slider'],
    ['avatar', 'file-upload'],
    ['open-address', 'dialog-opener']
  ])('classifies #%s as %s from its markup', (id, expected) => {
    expect(find(id)?.uiPattern).toBe(expected)
  })

  it('records the evidence behind each classification', () => {
    expect(find('tab-billing')?.patternEvidence).toBe('role="tab"')
    expect(find('avatar')?.patternEvidence).toContain('file')
  })

  it('binds a control to the container it declares', () => {
    expect(find('tab-billing')?.relation?.controls).toBe('panel-billing')
    expect(find('open-address')?.relation?.controls).toBe('address-dialog')
  })

  it('captures the container each control sits in', () => {
    expect(find('nickname')?.context?.container).toBe('form')
  })

  it('leaves an element that declares nothing as unknown rather than guessing', () => {
    const widget = find('sync-widget')
    expect(widget).toBeDefined()
    expect(widget?.uiPattern).toBe('unknown')
    expect(widget?.risk).toBe('needs-review')
  })

  it('marks destructive and session-ending controls without executing them', () => {
    expect(find('delete-account')?.risk).toBe('destructive')
    const executed = result.actionGraph.edges.filter((edge) => edge.status === 'visited')
    expect(executed.some((edge) => (edge.action.target ?? '').toLowerCase().includes('delete account'))).toBe(false)
  })

  it('covers the whole catalogue of patterns present on the page', () => {
    const found = patternsFound()
    for (const expected of ['tab', 'checkbox', 'radio', 'switch', 'select', 'text-input', 'unknown'] as UIPattern[]) {
      expect(found, `missing ${expected}`).toContain(expected)
    }
  })

  it('reports coverage with a reason for every discovered element', () => {
    const coverage = result.coverage
    expect(coverage).toBeDefined()
    expect(coverage!.elementsDiscovered).toBeGreaterThan(0)
    expect(coverage!.entries.every((entry) => Boolean(entry.reason))).toBe(true)
    expect(coverage!.unknown).toBeGreaterThan(0)
    expect(coverage!.byPattern.length).toBeGreaterThan(3)
  })

  it('records a transition for each executed action', () => {
    expect(result.transitions).toBeDefined()
    for (const transition of result.transitions!) {
      expect(transition.sourceStateId).toBeTruthy()
      expect(transition.urlBefore).toBeTruthy()
      expect(['changed', 'unchanged', 'failed', 'blocked', 'timeout']).toContain(transition.result)
    }
  })

  it('does not create a duplicate state for an unchanged fingerprint', () => {
    const fingerprints = result.actionGraph.states.map((state) => state.fingerprint)
    expect(new Set(fingerprints).size).toBe(fingerprints.length)
  })
})
