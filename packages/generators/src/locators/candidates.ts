import type { TargetRef } from '@lazyscout/core'

/** A named Playwright locator expression, ready to embed in generated source. */
export type LocatorCandidate = [kind: string, expression: string]

/**
 * Build-time attributes such as Vue's `data-v-98c615fa` change whenever the
 * component is recompiled, so they must never become a locator.
 */
const GENERATED_ATTRIBUTE = /\bdata-v-[0-9a-f]{6,}\b/i

/** Ids like `input-1734029384` are assigned per render and are not stable. */
const GENERATED_ID = /\d{4,}/

const DEFAULT_TEST_ID_ATTRIBUTE = 'data-testid'

/**
 * Ranked locator candidates for one recorded element, most stable first:
 * explicit automation attribute, stable id, semantic locator, name attribute,
 * then the recorded CSS path. The runtime resolver requires a unique visible
 * match, so a candidate that is ambiguous on the live page costs nothing —
 * it is simply skipped in favour of the next one.
 */
export function buildLocatorCandidates(target: TargetRef): LocatorCandidate[] {
  const candidates: LocatorCandidate[] = []
  const push = (kind: string, expression: string | undefined): void => {
    if (!expression || GENERATED_ATTRIBUTE.test(expression)) return
    if (candidates.some(([, existing]) => existing === expression)) return
    candidates.push([kind, expression])
  }

  push(...testIdCandidate(target))
  push('id', target.elementId && !GENERATED_ID.test(target.elementId) ? cssLocator(id(target.elementId)) : undefined)
  push('semantic locator', semanticCandidate(target))
  push('name', target.attributeName ? cssLocator(attribute('name', target.attributeName, target.tagName)) : undefined)
  push('recorded CSS', target.cssSelector ? cssLocator(normalizeCssSelector(target.cssSelector)) : undefined)

  // A target with nothing but a structural path still needs one candidate.
  if (candidates.length === 0) push('recorded CSS', cssLocator(normalizeCssSelector(target.cssSelector ?? '')))
  return candidates
}

function testIdCandidate(target: TargetRef): [string, string | undefined] {
  if (!target.testId) return ['test id', undefined]
  const attributeName = target.testIdAttribute ?? DEFAULT_TEST_ID_ATTRIBUTE
  // getByTestId resolves against Playwright's configured testIdAttribute, so it
  // is only correct for the default. Any other recorded attribute is matched
  // literally instead of being rewritten.
  return attributeName === DEFAULT_TEST_ID_ATTRIBUTE
    ? ['test id', `page.getByTestId(${quote(target.testId)})`]
    : [attributeName, cssLocator(attribute(attributeName, target.testId))]
}

function semanticCandidate(target: TargetRef): string | undefined {
  const base =
    target.role && target.name
      ? `page.getByRole(${quote(target.role)}, { name: ${quote(target.name)}, exact: true })`
      : target.label
        ? `page.getByLabel(${quote(target.label)}, { exact: true })`
        : target.placeholder
          ? `page.getByPlaceholder(${quote(target.placeholder)})`
          : target.text
            ? `page.getByText(${quote(target.text)})`
            : undefined
  if (!base) return undefined

  const context = target.contextTestId
    ? `page.getByTestId(${quote(target.contextTestId)})`
    : target.contextSelector
      ? `page.locator(${quote(target.contextSelector)})`
      : undefined
  const scoped = context
    ? target.contextText
      ? `${context}.filter({ hasText: ${quote(target.contextText)} }).${base.slice(5)}`
      : `${context}.${base.slice(5)}`
    : base
  return target.nth === undefined ? scoped : `${scoped}.nth(${target.nth})`
}

/** Human-readable label for resolver diagnostics. */
export function describeTarget(target: TargetRef): string {
  return (
    target.name ??
    target.label ??
    target.placeholder ??
    target.text ??
    target.testId ??
    target.elementId ??
    target.attributeName ??
    target.cssSelector ??
    'target'
  )
}

/**
 * An attribute selector's value is a quoted CSS string, not an identifier, so
 * only `\` and `"` need escaping. Characters such as `:` are literal here and
 * escaping them (`input\:username`) would fail to match.
 */
function attribute(name: string, value: string, tagName?: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `${tagName ? tagName.toLowerCase() : ''}[${name}="${escaped}"]`
}

/** An id selector is an identifier, where `:` and other specials do need escaping. */
function id(value: string): string {
  return `#${value.replace(/[^\w-]/g, (character) => `\\${character}`)}`
}

function cssLocator(selector: string): string {
  return `page.locator(${quoteCssSelector(selector)})`
}

/** Undo over-escaping applied by an earlier recorder before re-quoting. */
function normalizeCssSelector(value: string): string {
  return value.replace(/\\(["'])/g, '$1')
}

function quoteCssSelector(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

const quote = (value: string): string => JSON.stringify(value)
