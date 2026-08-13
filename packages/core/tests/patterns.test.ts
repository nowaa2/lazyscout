import { describe, expect, it } from 'vitest'
import type { UIElement, UIPattern } from '../src/types/page.js'
import { buildCoverageReport, CoverageTracker } from '../src/patterns/coverage.js'
import { classifyRisk, elementIdentity, isAutomatable, matchPattern } from '../src/patterns/catalog.js'

function element(partial: Partial<UIElement> = {}): UIElement {
  return {
    kind: 'button',
    role: 'button',
    accessibleName: 'Action',
    tagName: 'button',
    cssSelector: '#a',
    required: false,
    disabled: false,
    destructive: false,
    ...partial
  }
}

const patternOf = (partial: Partial<UIElement>): UIPattern => matchPattern(element(partial)).pattern

describe('pattern catalog', () => {
  it.each([
    ['text', 'text-input'],
    ['email', 'text-input'],
    ['password', 'text-input'],
    ['search', 'text-input'],
    ['url', 'text-input'],
    ['tel', 'text-input'],
    ['number', 'number-input'],
    ['date', 'date-input'],
    ['time', 'date-input'],
    ['checkbox', 'checkbox'],
    ['radio', 'radio'],
    ['range', 'slider'],
    ['file', 'file-upload']
  ])('classifies input type=%s as %s', (inputType, expected) => {
    expect(patternOf({ kind: 'input', role: 'textbox', tagName: 'input', inputType })).toBe(expected)
  })

  it('classifies a textarea and a select from their tags', () => {
    expect(patternOf({ kind: 'textarea', tagName: 'textarea', role: 'textbox' })).toBe('text-input')
    expect(patternOf({ kind: 'select', tagName: 'select', role: 'combobox' })).toBe('select')
  })

  it.each([
    [{ role: 'tab' }, 'tab'],
    [{ role: 'switch' }, 'switch'],
    [{ role: 'menuitem' }, 'menu'],
    [{ role: 'combobox', tagName: 'div' }, 'combobox'],
    [{ role: 'grid' }, 'table'],
    [{ tagName: 'summary', role: 'generic' }, 'accordion'],
    [{ expanded: false, role: 'generic', tagName: 'div' }, 'accordion'],
    [{ hasPopup: 'dialog' }, 'dialog-opener'],
    [{ hasPopup: 'menu' }, 'menu']
  ])('classifies %o from its declared attributes', (partial, expected) => {
    expect(patternOf(partial as Partial<UIElement>)).toBe(expected)
  })

  it('prefers an explicit role over the tag name', () => {
    expect(patternOf({ tagName: 'div', role: 'tab' })).toBe('tab')
  })

  it('treats a plain link as a link and a numbered one as pagination', () => {
    expect(patternOf({ kind: 'link', role: 'link', tagName: 'a', accessibleName: 'Products' })).toBe('link')
    expect(patternOf({ kind: 'link', role: 'link', tagName: 'a', accessibleName: 'Next' })).toBe('pagination')
    expect(patternOf({ kind: 'link', role: 'link', tagName: 'a', accessibleName: '2' })).toBe('pagination')
  })

  it('reports an uncatalogued element as unknown rather than guessing', () => {
    const match = matchPattern(element({ kind: 'button', tagName: 'div', role: '', accessibleName: 'Sync now' }))
    expect(match.pattern).toBe('unknown')
    expect(match.evidence).toContain('tag="div"')
  })

  it('never infers a pattern from the element wording', () => {
    // Named like a dialog opener, but the markup declares nothing.
    expect(patternOf({ tagName: 'div', role: '', accessibleName: 'Open settings modal' })).toBe('unknown')
    // Named innocuously, but the markup declares a dialog.
    expect(patternOf({ tagName: 'div', role: '', accessibleName: 'x', hasPopup: 'dialog' })).toBe('dialog-opener')
  })

  it('records the evidence that decided each match', () => {
    expect(matchPattern(element({ role: 'tab' })).evidence).toBe('role="tab"')
    expect(matchPattern(element({ kind: 'input', tagName: 'input', inputType: 'email' })).evidence).toBe(
      'input type="email"'
    )
  })

  it('marks automatable and review-only patterns apart', () => {
    expect(isAutomatable('checkbox')).toBe(true)
    expect(isAutomatable('tab')).toBe(true)
    expect(isAutomatable('unknown')).toBe(false)
    expect(isAutomatable('file-upload')).toBe(false)
    expect(isAutomatable('combobox')).toBe(false)
  })
})

describe('risk classification', () => {
  it('marks a destructive element without executing it', () => {
    expect(classifyRisk(element({ destructive: true }))).toBe('destructive')
    expect(classifyRisk(element({ accessibleName: 'Delete account' }), ['delete'])).toBe('destructive')
  })

  it('marks an uncatalogued element as needs-review', () => {
    expect(classifyRisk(element({ tagName: 'div', role: '', accessibleName: 'Sync' }))).toBe('needs-review')
  })

  it('leaves a catalogued, non-destructive element safe', () => {
    expect(classifyRisk(element({ role: 'tab', accessibleName: 'Details' }))).toBe('safe')
  })
})

describe('element identity', () => {
  it('prefers the recorded automation attribute over structural css', () => {
    const id = elementIdentity(
      element({ testId: 'input:username', testIdAttribute: 'data-test', cssSelector: 'div > input' }),
      'text-input'
    )
    expect(id).toContain('data-test=input:username')
    expect(id).not.toContain('div > input')
  })

  it('separates two identical controls in different containers', () => {
    const inDialog = element({ context: { container: 'dialog', containerSelector: '#modal' } })
    const onPage = element({ context: { container: 'page' } })
    expect(elementIdentity(inDialog, 'button')).not.toBe(elementIdentity(onPage, 'button'))
  })
})

describe('coverage tracker', () => {
  it('counts each element once and keeps tested terminal', () => {
    const tracker = new CoverageTracker()
    const id = tracker.discover(element({ role: 'tab', accessibleName: 'One' }))
    tracker.discover(element({ role: 'tab', accessibleName: 'One' }))
    tracker.record(id, 'tested')
    tracker.record(id, 'skipped-limit')

    const report = tracker.report()
    expect(report.elementsDiscovered).toBe(1)
    expect(report.tested).toBe(1)
    expect(report.skipped).toBe(0)
  })

  it('separates blocked, unknown and skipped with a reason for each', () => {
    const tracker = new CoverageTracker()
    const destructive = tracker.discover(element({ accessibleName: 'Delete', destructive: true }))
    tracker.record(destructive, 'blocked-destructive', 'matched the Project click filter')
    tracker.discover(element({ tagName: 'div', role: '', accessibleName: 'Sync', cssSelector: '#sync' }))
    const tab = tracker.discover(element({ role: 'tab', accessibleName: 'Two', cssSelector: '#t2' }))
    tracker.record(tab, 'tested')

    const report = tracker.report()
    expect(report.elementsDiscovered).toBe(3)
    expect(report.blocked).toBe(1)
    expect(report.unknown).toBe(1)
    expect(report.tested).toBe(1)
    expect(report.knownPatterns).toBe(2)
    expect(report.entries.find((entry) => entry.elementId === destructive)?.detail).toContain('click filter')
  })

  it('summarises discovery and testing per pattern', () => {
    const report = buildCoverageReport([
      { elementId: 'a', pattern: 'tab', reason: 'tested' },
      { elementId: 'b', pattern: 'tab', reason: 'skipped-limit' },
      { elementId: 'c', pattern: 'unknown', reason: 'unknown-pattern' }
    ])
    expect(report.byPattern[0]).toEqual({ pattern: 'tab', discovered: 2, tested: 1 })
    expect(report.unknown).toBe(1)
  })
})
