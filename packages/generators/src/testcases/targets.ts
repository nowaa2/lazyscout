import type { TargetRef, UIElement } from '@lazyscout/core'

export function toTargetRef(element: UIElement): TargetRef {
  const needsDisambiguation = element.matchCount !== undefined && element.matchCount > 1
  const disambiguation = needsDisambiguation
    ? {
        nth:
          element.scopeMatchCount && element.scopeMatchCount > 1
            ? element.scopeIndex
            : element.contextSelector || element.contextText
              ? undefined
              : element.matchIndex,
        matchCount: element.matchCount,
        contextText: element.contextText,
        contextSelector: element.contextSelector,
        contextTestId: element.contextTestId
      }
    : undefined
  // Every recorded way of addressing the element is carried through, so the
  // generator can rank them and the runtime resolver can fall back. Picking a
  // single strategy here is what used to leave one brittle locator.
  // Undefined keys are dropped so a stored Test Case stays small and diffable.
  const identity = defined({
    testId: element.testId,
    testIdAttribute: element.testIdAttribute,
    elementId: element.id,
    attributeName: element.name,
    tagName: element.tagName,
    cssSelector: element.cssSelector
  })
  if (element.accessibleName) {
    return { role: element.role, name: element.accessibleName, ...identity, ...disambiguation }
  }
  if (element.placeholder) {
    return { role: element.role, placeholder: element.placeholder, ...identity, ...disambiguation }
  }
  return { role: element.role, ...identity, ...disambiguation }
}

function defined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>
}

export function labelOf(element: UIElement): string {
  return element.accessibleName || element.placeholder || element.name || element.id || element.tagName
}

export function sampleValueFor(element: UIElement): string {
  const hint = `${element.inputType || ''} ${element.name || ''} ${element.accessibleName || ''}`.toLowerCase()

  if (element.inputType === 'email' || hint.includes('email') || hint.includes('อีเมล')) {
    return 'qa.tester@example.com'
  }
  if (element.inputType === 'password' || hint.includes('password') || hint.includes('รหัสผ่าน')) {
    return 'Passw0rd!23'
  }
  if (element.inputType === 'tel' || hint.includes('phone') || hint.includes('โทร')) return '0812345678'
  if (element.inputType === 'number') return '1'
  if (element.inputType === 'date') return '2026-01-01'
  if (element.inputType === 'url') return 'https://example.com'
  if (element.kind === 'textarea') return 'Sample text for testing'
  return 'test data'
}
