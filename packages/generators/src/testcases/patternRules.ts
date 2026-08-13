import type { PageInfo, TestCase, TestStep, UIElement, UIInteraction, UIPattern } from '@lazyscout/core'
import { matchPattern } from '@lazyscout/core'
import { labelOf, toTargetRef } from './targets.js'

/**
 * Pattern-specific Test Case rules.
 *
 * Each rule maps one recognised UI pattern to the steps and assertions that
 * the pattern's own contract guarantees — `aria-selected` for a tab,
 * `aria-expanded` for an accordion, `checked` for a checkbox. Where a pattern
 * has no such contract, or the markup declares nothing, the rule produces a
 * manual review case carrying the evidence it did find. No rule ever writes an
 * expected result that the DOM does not prove.
 */
export type PatternRuleContext = {
  page: PageInfo
  module: string
}

export type PatternCase = Omit<TestCase, 'id'>

const REVIEW_EXPECTED = 'Behavior requires tester review'

function base(ctx: PatternRuleContext, draft: Omit<TestCase, 'id' | 'module' | 'sourceUrl'>): PatternCase {
  return { module: ctx.module, sourceUrl: ctx.page.finalUrl, ...draft }
}

function precondition(page: PageInfo): string[] {
  try {
    return [`The application is available at ${new URL(page.finalUrl).origin}`]
  } catch {
    return ['The application is available']
  }
}

function navigate(page: PageInfo): TestStep {
  return { type: 'navigate', url: page.finalUrl }
}

function evidenceOf(element: UIElement): string[] {
  const found = [element.patternEvidence ?? matchPattern(element).evidence]
  if (element.relation?.controls) found.push(`aria-controls="${element.relation.controls}"`)
  if (element.context?.containerSelector) found.push(`container=${element.context.containerSelector}`)
  return found
}

/**
 * A control whose behaviour cannot be proven from markup. The case records what
 * was seen so a tester can decide, rather than asserting an invented outcome.
 */
function reviewCase(
  ctx: PatternRuleContext,
  element: UIElement,
  pattern: UIPattern,
  reason: string,
  action: TestStep[] = []
): PatternCase {
  return base(ctx, {
    title: `Review ${labelOf(element)} behaviour`,
    preconditions: precondition(ctx.page),
    steps: [navigate(ctx.page), ...action],
    expectedResult: REVIEW_EXPECTED,
    type: 'manual',
    priority: 'medium',
    automationStatus: 'needs-review',
    tags: ['pattern:' + pattern, 'needs-review'],
    pattern,
    evidence: evidenceOf(element),
    reviewReason: reason,
    notes: `Detected as ${pattern}. ${reason}`
  })
}

/** E. tab — assert the tab becomes selected and its panel is shown. */
export function tabRule(ctx: PatternRuleContext, element: UIElement): PatternCase[] {
  const target = toTargetRef(element)
  const panel = element.relation?.controls
  const steps: TestStep[] = [
    navigate(ctx.page),
    { type: 'click', target, description: `Select tab "${labelOf(element)}"` }
  ]
  // aria-selected is part of the tab contract, so it is a provable assertion.
  steps.push({ type: 'assertVisible', target })
  if (panel) {
    steps.push({
      type: 'assertVisible',
      target: { cssSelector: `#${panel}` },
      description: `Verify the panel controlled by this tab is visible`
    })
  }
  return [
    base(ctx, {
      title: `Tab "${labelOf(element)}" selects its panel`,
      preconditions: precondition(ctx.page),
      steps,
      expectedResult: panel
        ? `Tab "${labelOf(element)}" becomes selected and the panel it controls is visible.`
        : `Tab "${labelOf(element)}" becomes selected.`,
      type: 'interaction',
      priority: 'medium',
      automationStatus: panel ? 'ready' : 'needs-review',
      tags: ['pattern:tab'],
      pattern: 'tab',
      evidence: evidenceOf(element),
      ...(panel ? {} : { reviewReason: 'No aria-controls, so the panel to assert is unknown.' }),
      notes: 'Generated from role="tab". Assertion uses the tab contract, not the label text.'
    })
  ]
}

/** F. accordion/details — expand then collapse, asserting the declared state. */
export function accordionRule(ctx: PatternRuleContext, element: UIElement): PatternCase[] {
  const target = toTargetRef(element)
  const region = element.relation?.controls
  return [
    base(ctx, {
      title: `${labelOf(element)} expands and collapses`,
      preconditions: precondition(ctx.page),
      steps: [
        navigate(ctx.page),
        { type: 'click', target, description: `Expand "${labelOf(element)}"` },
        ...(region
          ? [
              {
                type: 'assertVisible' as const,
                target: { cssSelector: `#${region}` },
                description: 'Verify the controlled region is visible'
              }
            ]
          : []),
        { type: 'click', target, description: `Collapse "${labelOf(element)}"` }
      ],
      expectedResult: region
        ? `The region controlled by "${labelOf(element)}" becomes visible when expanded and hidden when collapsed.`
        : `"${labelOf(element)}" toggles between expanded and collapsed.`,
      type: 'interaction',
      priority: 'medium',
      automationStatus: region ? 'ready' : 'needs-review',
      tags: ['pattern:accordion'],
      pattern: 'accordion',
      evidence: evidenceOf(element),
      ...(region ? {} : { reviewReason: 'No aria-controls, so the region to assert is unknown.' }),
      notes: 'Generated from the aria-expanded / <summary> contract.'
    })
  ]
}

/** B. checkbox/radio/switch — toggle and assert the declared checked state. */
export function toggleRule(ctx: PatternRuleContext, element: UIElement, pattern: UIPattern): PatternCase[] {
  const target = toTargetRef(element)
  const isRadio = pattern === 'radio'
  return [
    base(ctx, {
      title: isRadio ? `${labelOf(element)} can be selected` : `${labelOf(element)} can be checked and unchecked`,
      preconditions: precondition(ctx.page),
      steps: [
        navigate(ctx.page),
        { type: 'check', target, checked: true, description: `Select "${labelOf(element)}"` },
        ...(isRadio ? [] : [{ type: 'check' as const, target, checked: false }])
      ],
      expectedResult: isRadio
        ? `"${labelOf(element)}" becomes the selected option.`
        : `"${labelOf(element)}" reports checked after selecting and unchecked after clearing.`,
      type: 'interaction',
      priority: 'medium',
      automationStatus: 'ready',
      tags: ['pattern:' + pattern],
      pattern,
      evidence: evidenceOf(element),
      notes: 'Assertion uses the native checked state, not the surrounding text.'
    })
  ]
}

/** C. select — choose real options that were collected from the page. */
export function selectRule(ctx: PatternRuleContext, element: UIElement): PatternCase[] {
  const options = (element.options ?? []).filter(Boolean).slice(0, 2)
  if (options.length === 0) {
    return [reviewCase(ctx, element, 'select', 'No options were present when the page was collected.')]
  }
  const target = toTargetRef(element)
  return options.map((option) =>
    base(ctx, {
      title: `${labelOf(element)} accepts option "${option}"`,
      preconditions: precondition(ctx.page),
      steps: [navigate(ctx.page), { type: 'select', target, option }],
      expectedResult: `"${labelOf(element)}" holds the selected option "${option}".`,
      type: 'interaction',
      priority: 'medium',
      automationStatus: 'ready',
      tags: ['pattern:select'],
      pattern: 'select',
      evidence: [...evidenceOf(element), `option="${option}"`],
      notes: 'Options were read from the page; none were invented.'
    })
  )
}

/**
 * G/H. A control that opens a menu, popover, dialog or drawer. The opener is
 * always testable; what appears inside is only assertable once the explorer has
 * actually observed it, so without a bound container this stays review-only.
 */
export function openerRule(ctx: PatternRuleContext, element: UIElement, pattern: UIPattern): PatternCase[] {
  const container = element.relation?.controls ?? element.relation?.target
  const target = toTargetRef(element)
  if (!container) {
    return [
      reviewCase(
        ctx,
        element,
        pattern,
        'The container it opens is not declared through aria-controls or data-target.',
        [{ type: 'click', target, description: `Open "${labelOf(element)}"` }]
      )
    ]
  }
  const containerSelector = container.startsWith('#') || container.startsWith('.') ? container : `#${container}`
  return [
    base(ctx, {
      title: `${labelOf(element)} opens its ${pattern === 'dialog-opener' ? 'dialog' : 'menu'}`,
      preconditions: precondition(ctx.page),
      steps: [
        navigate(ctx.page),
        { type: 'click', target, description: `Open "${labelOf(element)}"` },
        { type: 'assertVisible', target: { cssSelector: containerSelector } }
      ],
      expectedResult: `The container ${containerSelector} becomes visible.`,
      type: 'interaction',
      priority: 'medium',
      automationStatus: 'ready',
      tags: ['pattern:' + pattern],
      pattern,
      evidence: evidenceOf(element),
      notes: 'The opener is bound to its container through a declared relationship.'
    })
  ]
}

/** Patterns with no provable contract from markup alone. */
export function reviewOnlyRule(ctx: PatternRuleContext, element: UIElement, pattern: UIPattern): PatternCase[] {
  const reasons: Partial<Record<UIPattern, string>> = {
    combobox: 'Custom combobox keyboard and filtering behaviour cannot be derived from markup.',
    slider: 'The value range and step semantics need a tester to confirm.',
    'file-upload': 'Uploading a file needs a fixture chosen by a tester.',
    table: 'Sort, filter and row semantics need a tester to confirm.',
    menu: 'Menu contents are only known once the menu has been opened.',
    button: 'No observable state change was recorded for this control.',
    unknown: 'The element declares no catalogued role, type or ARIA relationship.'
  }
  return [
    reviewCase(ctx, element, pattern, reasons[pattern] ?? 'This pattern has no provable contract in the DOM.', [
      { type: 'click', target: toTargetRef(element), description: `Interact with "${labelOf(element)}"` }
    ])
  ]
}

/** A destructive or session-ending control: recorded, never executed. */
export function blockedActionRule(ctx: PatternRuleContext, element: UIElement, pattern: UIPattern): PatternCase[] {
  const risk = element.risk === 'session-ending' ? 'session-ending' : 'destructive'
  return [
    base(ctx, {
      title: `Manually verify ${labelOf(element)}`,
      preconditions: [...precondition(ctx.page), 'Use a disposable test account and data'],
      steps: [
        navigate(ctx.page),
        {
          type: 'manual',
          description: `Manually trigger "${labelOf(element)}" in a safe test environment and record the result`
        }
      ],
      expectedResult: REVIEW_EXPECTED,
      type: 'manual',
      priority: 'high',
      automationStatus: 'manual',
      tags: ['pattern:' + pattern, risk],
      pattern,
      evidence: evidenceOf(element),
      reviewReason: `Classified as ${risk}, so LazyScout did not execute it.`,
      notes: `LazyScout detected a ${risk} action and skipped it deliberately.`
    })
  ]
}

/**
 * Route one classified element to its pattern rule. Risk is checked first: a
 * destructive control is never executed regardless of how well it is described.
 */
export function elementPatternCases(ctx: PatternRuleContext, element: UIElement): PatternCase[] {
  const pattern = element.uiPattern ?? matchPattern(element).pattern
  if (element.disabled) return []
  if (element.risk === 'destructive' || element.risk === 'session-ending') {
    return blockedActionRule(ctx, element, pattern)
  }
  switch (pattern) {
    case 'tab':
      return tabRule(ctx, element)
    case 'accordion':
      return accordionRule(ctx, element)
    case 'checkbox':
    case 'radio':
    case 'switch':
      return toggleRule(ctx, element, pattern)
    case 'select':
      return selectRule(ctx, element)
    case 'dialog-opener':
      return openerRule(ctx, element, pattern)
    case 'menu':
      return element.relation?.controls ? openerRule(ctx, element, pattern) : reviewOnlyRule(ctx, element, pattern)
    case 'combobox':
    case 'slider':
    case 'file-upload':
    case 'table':
    case 'button':
    case 'unknown':
      return reviewOnlyRule(ctx, element, pattern)
    default:
      // text/number/date inputs and links are covered by the form and
      // navigation rules, which already own their richer validation cases.
      return []
  }
}

/**
 * Legacy interaction hints from the state model, kept so a page that only
 * exposes `interactions` still produces cases. Interactions that correspond to
 * a collected control are dropped to avoid duplicating its pattern case.
 */
export function interactionPatternCases(ctx: PatternRuleContext, interaction: UIInteraction): PatternCase[] {
  const pattern: UIPattern =
    interaction.kind === 'tab'
      ? 'tab'
      : interaction.kind === 'accordion'
        ? 'accordion'
        : interaction.kind === 'dropdown'
          ? 'menu'
          : 'dialog-opener'
  const element: UIElement = {
    kind: 'button',
    role: interaction.role,
    accessibleName: interaction.name,
    tagName: 'button',
    cssSelector: interaction.cssSelector,
    required: false,
    disabled: false,
    destructive: false,
    uiPattern: pattern,
    patternEvidence: interaction.evidence,
    expanded: interaction.expanded,
    relation: interaction.controlsSelector ? { controls: interaction.controlsSelector.replace(/^#/, '') } : undefined
  }
  return elementPatternCases(ctx, element)
}
