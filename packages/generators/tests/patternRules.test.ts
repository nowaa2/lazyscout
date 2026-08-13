import { describe, expect, it } from 'vitest'
import type { PageInfo, UIElement } from '@lazyscout/core'
import { matchPattern, classifyRisk, elementIdentity } from '@lazyscout/core'
import { elementPatternCases } from '../src/testcases/patternRules.js'
import { generateTestCases } from '../src/index.js'

const page = { finalUrl: 'https://app.test/patterns', title: 'Patterns', headings: ['Patterns'] } as PageInfo
const ctx = { page, module: 'PATTERNS' }

/** Builds an element the way mapToPageModel would: classified, then risked. */
function element(partial: Partial<UIElement> = {}): UIElement {
  const base: UIElement = {
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
  const { pattern, evidence } = matchPattern(base)
  return {
    ...base,
    uiPattern: pattern,
    patternEvidence: evidence,
    risk: classifyRisk(base),
    elementId: elementIdentity(base, pattern)
  }
}

const only = (partial: Partial<UIElement>) => {
  const cases = elementPatternCases(ctx, element(partial))
  expect(cases.length).toBeGreaterThan(0)
  return cases[0]
}

describe('tab pattern', () => {
  it('asserts the panel the tab declares it controls', () => {
    const testCase = only({ role: 'tab', accessibleName: 'Billing', relation: { controls: 'panel-billing' } })
    expect(testCase.pattern).toBe('tab')
    expect(testCase.automationStatus).toBe('ready')
    expect(testCase.type).toBe('interaction')
    expect(JSON.stringify(testCase.steps)).toContain('#panel-billing')
    expect(testCase.evidence).toContain('role="tab"')
  })

  it('needs review when no panel is declared, instead of inventing one', () => {
    const testCase = only({ role: 'tab', accessibleName: 'Billing' })
    expect(testCase.automationStatus).toBe('needs-review')
    expect(testCase.reviewReason).toContain('aria-controls')
  })
})

describe('accordion pattern', () => {
  it('expands then collapses and asserts the controlled region', () => {
    const testCase = only({
      tagName: 'button',
      accessibleName: 'FAQ',
      expanded: false,
      relation: { controls: 'faq-region' }
    })
    expect(testCase.pattern).toBe('accordion')
    expect(testCase.automationStatus).toBe('ready')
    const clicks = testCase.steps.filter((step) => step.type === 'click')
    expect(clicks).toHaveLength(2)
    expect(JSON.stringify(testCase.steps)).toContain('#faq-region')
  })

  it('handles a native details/summary', () => {
    expect(only({ tagName: 'summary', role: 'generic', accessibleName: 'Shipping' }).pattern).toBe('accordion')
  })
})

describe('toggle patterns', () => {
  it('checks and unchecks a checkbox using the native state', () => {
    const testCase = only({ kind: 'input', tagName: 'input', inputType: 'checkbox', accessibleName: 'Newsletter' })
    expect(testCase.pattern).toBe('checkbox')
    expect(testCase.automationStatus).toBe('ready')
    expect(testCase.steps.filter((step) => step.type === 'check')).toHaveLength(2)
  })

  it('only selects a radio, never clears it', () => {
    const testCase = only({ kind: 'input', tagName: 'input', inputType: 'radio', accessibleName: 'Pro' })
    expect(testCase.pattern).toBe('radio')
    expect(testCase.steps.filter((step) => step.type === 'check')).toHaveLength(1)
  })

  it('treats an ARIA switch as a toggle', () => {
    expect(only({ role: 'switch', accessibleName: 'Dark mode' }).pattern).toBe('switch')
  })
})

describe('select pattern', () => {
  it('generates one case per real option, up to two', () => {
    const cases = elementPatternCases(
      ctx,
      element({
        kind: 'select',
        tagName: 'select',
        role: 'combobox',
        accessibleName: 'Country',
        options: ['Thailand', 'Japan', 'Laos']
      })
    )
    expect(cases).toHaveLength(2)
    expect(cases[0].evidence).toContain('option="Thailand"')
    expect(cases.every((testCase) => testCase.automationStatus === 'ready')).toBe(true)
  })

  it('never invents an option when the select is empty', () => {
    const testCase = only({ kind: 'select', tagName: 'select', role: 'combobox', accessibleName: 'Country' })
    expect(testCase.automationStatus).toBe('needs-review')
    expect(testCase.expectedResult).toBe('Behavior requires tester review')
  })
})

describe('opener patterns', () => {
  it('asserts the dialog container the opener declares', () => {
    const testCase = only({
      accessibleName: 'Add address',
      hasPopup: 'dialog',
      relation: { controls: 'address-dialog' }
    })
    expect(testCase.pattern).toBe('dialog-opener')
    expect(testCase.automationStatus).toBe('ready')
    expect(JSON.stringify(testCase.steps)).toContain('#address-dialog')
  })

  it('falls back to review when the opener declares no container', () => {
    const testCase = only({ accessibleName: 'Add address', hasPopup: 'dialog' })
    expect(testCase.automationStatus).toBe('needs-review')
    expect(testCase.type).toBe('manual')
  })
})

describe('unknown and review-only patterns', () => {
  it('produces a manual case with evidence rather than a guessed expectation', () => {
    const testCase = only({ tagName: 'div', role: '', accessibleName: 'Sync now', cssSelector: '#sync-widget' })
    expect(testCase.pattern).toBe('unknown')
    expect(testCase.type).toBe('manual')
    expect(testCase.automationStatus).toBe('needs-review')
    expect(testCase.expectedResult).toBe('Behavior requires tester review')
    expect(testCase.evidence?.join(' ')).toContain('tag="div"')
    expect(testCase.reviewReason).toBeTruthy()
  })

  it.each(['slider', 'file-upload'] as const)('keeps %s review-only', (pattern) => {
    const inputType = pattern === 'slider' ? 'range' : 'file'
    const testCase = only({ kind: 'input', tagName: 'input', inputType, accessibleName: 'X' })
    expect(testCase.pattern).toBe(pattern)
    expect(testCase.automationStatus).toBe('needs-review')
  })
})

describe('blocked actions', () => {
  it('records a destructive control as manual without an executable click', () => {
    const testCase = only({ accessibleName: 'Delete account', destructive: true })
    expect(testCase.automationStatus).toBe('manual')
    expect(testCase.type).toBe('manual')
    expect(testCase.reviewReason).toContain('destructive')
    expect(testCase.steps.some((step) => step.type === 'click')).toBe(false)
  })

  it('skips a disabled control entirely', () => {
    expect(elementPatternCases(ctx, element({ disabled: true, role: 'tab' }))).toHaveLength(0)
  })
})

describe('generateTestCases integration', () => {
  const control = (partial: Partial<UIElement>) => element(partial)
  const pageWithControls: PageInfo = {
    url: 'https://app.test/patterns',
    finalUrl: 'https://app.test/patterns',
    title: 'Patterns',
    depth: 0,
    headings: ['Patterns'],
    links: [],
    buttons: [],
    inputs: [],
    textareas: [],
    selects: [],
    forms: [],
    apiRequests: [],
    state: {
      id: 's1',
      url: 'https://app.test/patterns',
      title: 'Patterns',
      name: 'Patterns',
      type: 'page',
      fingerprint: 'f1',
      visibleDialogs: [],
      headings: ['Patterns'],
      controls: [
        control({
          role: 'tab',
          accessibleName: 'Billing',
          cssSelector: '#tab-billing',
          relation: { controls: 'panel-billing' }
        }),
        control({
          kind: 'input',
          tagName: 'input',
          inputType: 'checkbox',
          accessibleName: 'Newsletter',
          cssSelector: '#newsletter'
        }),
        control({ tagName: 'div', role: '', accessibleName: 'Sync now', cssSelector: '#sync-widget' }),
        control({ accessibleName: 'Delete account', destructive: true, cssSelector: '#delete-account' })
      ],
      interactions: [],
      stateContent: [],
      validationMessages: [],
      discoveredAt: new Date().toISOString()
    }
  }

  it('maps each collected control to its pattern case', () => {
    const cases = generateTestCases([pageWithControls])
    const patterns = cases.map((testCase) => testCase.pattern).filter(Boolean)
    expect(patterns).toEqual(expect.arrayContaining(['tab', 'checkbox', 'unknown']))
  })

  it('produces no expected result that the DOM does not prove', () => {
    for (const testCase of generateTestCases([pageWithControls])) {
      if (testCase.automationStatus === 'needs-review' || testCase.automationStatus === 'manual') continue
      expect(testCase.evidence?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('does not duplicate a control that is also listed as an interaction', () => {
    const withDuplicate: PageInfo = {
      ...pageWithControls,
      state: {
        ...pageWithControls.state!,
        interactions: [{ kind: 'tab', name: 'Billing', role: 'tab', cssSelector: '#tab-billing', visible: true }]
      }
    }
    const tabCases = generateTestCases([withDuplicate]).filter((testCase) => testCase.pattern === 'tab')
    expect(tabCases).toHaveLength(1)
  })
})
