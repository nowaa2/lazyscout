import type { ElementRisk, UIElement, UIPattern } from '../types/page.js'
import { isBlockedLabel, isUnsafeAutoClick } from '../safety/blocklist.js'

/**
 * Deterministic UI pattern classification.
 *
 * Every decision here is a lookup on a role, tag, type or ARIA attribute that
 * the page actually declares. Nothing is inferred from an element's wording —
 * an element whose markup does not match a catalogued pattern is reported as
 * `unknown` so the generator can raise a manual review case with evidence
 * instead of inventing an expected result.
 */
export type PatternMatch = {
  pattern: UIPattern
  /** The attribute or tag that decided the match, quoted for the Test Case. */
  evidence: string
}

type Rule = {
  pattern: UIPattern
  evidence: (element: UIElement) => string
  when: (element: UIElement) => boolean
}

const INPUT_TYPE_PATTERN: Record<string, UIPattern> = {
  text: 'text-input',
  email: 'text-input',
  password: 'text-input',
  search: 'text-input',
  tel: 'text-input',
  url: 'text-input',
  number: 'number-input',
  range: 'slider',
  date: 'date-input',
  'datetime-local': 'date-input',
  month: 'date-input',
  week: 'date-input',
  time: 'date-input',
  checkbox: 'checkbox',
  radio: 'radio',
  file: 'file-upload'
}

const ROLE_PATTERN: Record<string, UIPattern> = {
  tab: 'tab',
  switch: 'switch',
  slider: 'slider',
  checkbox: 'checkbox',
  radio: 'radio',
  combobox: 'combobox',
  listbox: 'select',
  menu: 'menu',
  menubar: 'menu',
  menuitem: 'menu',
  link: 'link',
  searchbox: 'text-input',
  textbox: 'text-input',
  spinbutton: 'number-input',
  grid: 'table',
  table: 'table',
  navigation: 'navigation'
}

/**
 * Ordered most specific first. The first rule whose `when` holds decides the
 * pattern, so an explicit `role` always beats a tag-name fallback.
 */
const RULES: Rule[] = [
  {
    pattern: 'tab',
    evidence: () => 'role="tab"',
    when: (element) => element.role === 'tab'
  },
  {
    pattern: 'dialog-opener',
    evidence: (element) =>
      element.hasPopup === 'dialog' ? 'aria-haspopup="dialog"' : `data-toggle="${element.hasPopup ?? 'modal'}"`,
    when: (element) => element.hasPopup === 'dialog' || element.hasPopup === 'modal' || element.hasPopup === 'drawer'
  },
  {
    pattern: 'menu',
    evidence: (element) =>
      element.role?.startsWith('menuitem') || element.role === 'menu' || element.role === 'menubar'
        ? `role="${element.role}"`
        : `aria-haspopup="${element.hasPopup}"`,
    when: (element) =>
      Boolean(element.role?.startsWith('menuitem')) ||
      element.role === 'menu' ||
      element.role === 'menubar' ||
      element.hasPopup === 'menu' ||
      element.hasPopup === 'listbox' ||
      element.hasPopup === 'dropdown'
  },
  {
    pattern: 'accordion',
    evidence: (element) => (element.tagName === 'summary' ? '<summary>' : 'aria-expanded'),
    when: (element) => element.tagName === 'summary' || element.expanded !== undefined
  },
  {
    pattern: 'file-upload',
    evidence: () => 'input type="file"',
    when: (element) => element.inputType === 'file'
  },
  {
    pattern: 'switch',
    evidence: () => 'role="switch"',
    when: (element) => element.role === 'switch'
  },
  {
    pattern: 'select',
    evidence: () => '<select>',
    when: (element) => element.tagName === 'select'
  },
  {
    pattern: 'combobox',
    evidence: () => 'role="combobox"',
    when: (element) => element.role === 'combobox'
  },
  {
    pattern: 'submit',
    evidence: (element) => `type="${element.inputType ?? 'submit'}"`,
    when: (element) =>
      element.inputType === 'submit' ||
      ((element.tagName === 'button' || element.role === 'button') && element.context?.container === 'form')
  },
  {
    pattern: 'pagination',
    evidence: () => 'rel="next"/"prev"',
    when: (element) =>
      element.kind === 'link' && /^(next|prev|previous|\d{1,3}|»|«|›|‹)$/i.test(element.accessibleName.trim())
  },
  {
    pattern: 'link',
    evidence: () => '<a href>',
    when: (element) => element.kind === 'link' || element.role === 'link'
  },
  {
    pattern: 'table',
    evidence: () => 'role="grid"',
    when: (element) => element.role === 'grid' || element.role === 'table'
  }
]

/** Classify one collected element. Never guesses from wording. */
export function matchPattern(element: UIElement): PatternMatch {
  for (const rule of RULES) {
    if (rule.when(element)) return { pattern: rule.pattern, evidence: rule.evidence(element) }
  }

  if (element.inputType && INPUT_TYPE_PATTERN[element.inputType]) {
    return { pattern: INPUT_TYPE_PATTERN[element.inputType], evidence: `input type="${element.inputType}"` }
  }
  if (element.kind === 'textarea') return { pattern: 'text-input', evidence: '<textarea>' }
  if (element.role && ROLE_PATTERN[element.role]) {
    return { pattern: ROLE_PATTERN[element.role], evidence: `role="${element.role}"` }
  }
  // `kind` is the collector's bucket, not a declaration by the page. Only the
  // tag, the role or the input type may establish a button.
  if (element.tagName === 'button') return { pattern: 'button', evidence: '<button>' }
  if (element.role === 'button') return { pattern: 'button', evidence: 'role="button"' }
  if (element.inputType === 'button' || element.inputType === 'reset') {
    return { pattern: 'button', evidence: `input type="${element.inputType}"` }
  }

  // No catalogued pattern matched. This is a reportable outcome, not an error.
  return { pattern: 'unknown', evidence: `tag="${element.tagName}" role="${element.role || 'none'}"` }
}

/**
 * How safe it is to execute this element automatically. Session-ending and
 * destructive controls are recorded and skipped, never clicked.
 */
export function classifyRisk(element: UIElement, blockedKeywords: readonly string[] = []): ElementRisk {
  const labels = [element.accessibleName, element.text, element.name, element.id, element.ariaLabel]
  if (isUnsafeAutoClick(...labels)) return 'session-ending'
  if (element.destructive || isBlockedLabel(blockedKeywords, ...labels)) return 'destructive'
  if (matchPattern(element).pattern === 'unknown') return 'needs-review'
  return 'safe'
}

/** Patterns the generator can produce an executable expected result for. */
export const AUTOMATABLE_PATTERNS: readonly UIPattern[] = [
  'text-input',
  'number-input',
  'date-input',
  'checkbox',
  'radio',
  'switch',
  'select',
  'link',
  'navigation',
  'pagination',
  'submit',
  'tab',
  'accordion'
]

/** Patterns that always require a tester to confirm the expected behaviour. */
export const REVIEW_ONLY_PATTERNS: readonly UIPattern[] = [
  'combobox',
  'slider',
  'file-upload',
  'menu',
  'dialog-opener',
  'table',
  'button',
  'unknown'
]

export function isAutomatable(pattern: UIPattern): boolean {
  return AUTOMATABLE_PATTERNS.includes(pattern)
}

/**
 * Stable identity for coverage and deduplication: the pattern plus the most
 * stable locator the collector found, scoped by its container.
 */
export function elementIdentity(element: UIElement, pattern: UIPattern): string {
  const locator =
    (element.testId && `${element.testIdAttribute ?? 'data-testid'}=${element.testId}`) ||
    (element.id && `#${element.id}`) ||
    (element.role && element.accessibleName && `${element.role}:${element.accessibleName}`) ||
    (element.name && `[name=${element.name}]`) ||
    element.cssSelector ||
    element.accessibleName
  return `${pattern}|${element.context?.containerSelector ?? ''}|${locator}`
}
