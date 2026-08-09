import type { PageState } from '../types/page.js'

export function fingerprintState(input: Omit<PageState, 'fingerprint' | 'id'>): string {
  const canonical = JSON.stringify({
    url: input.url,
    title: input.title,
    visibleDialogs: [...input.visibleDialogs].sort(),
    headings: [...input.headings].sort(),
    controls: input.controls.map(({ kind, role, accessibleName, text, inputType, placeholder, disabled }) => ({
      kind,
      role,
      name: accessibleName,
      text,
      inputType,
      placeholder,
      disabled
    })),
    interactions: input.interactions.map(({ kind, name, role, expanded, visible }) => ({
      kind,
      name,
      role,
      expanded,
      visible
    })),
    stateContent: [...input.stateContent].sort(),
    validationMessages: [...input.validationMessages].sort()
  })
  let hash = 2166136261
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `state-${(hash >>> 0).toString(16).padStart(8, '0')}`
}
export function stateId(url: string, fingerprint: string): string {
  return `${url}#${fingerprint}`
}
