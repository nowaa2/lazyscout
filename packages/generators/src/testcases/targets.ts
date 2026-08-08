import type { TargetRef, UIElement } from '@lazyscout/core'

export function toTargetRef(element: UIElement): TargetRef {
  if (element.accessibleName) {
    return { role: element.role, name: element.accessibleName }
  }
  if (element.placeholder) {
    return { role: element.role, placeholder: element.placeholder }
  }
  return { role: element.role, cssSelector: element.cssSelector }
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
