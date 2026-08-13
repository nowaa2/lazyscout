import {
  classifyRisk,
  elementIdentity,
  fingerprintState,
  matchPattern,
  stateId,
  type FormInfo,
  type PageInfo,
  type PageState,
  type UIElement
} from '@lazyscout/core'
import type { RawElement, RawForm, RawPageData } from './types/raw.js'
import { isBlockedLabel } from './safety.js'

function toUIElement(raw: RawElement, keywords: readonly string[]): UIElement {
  const base: UIElement = {
    ...raw,
    destructive: isBlockedLabel(keywords, raw.accessibleName, raw.text, raw.name, raw.id)
  }
  // Classification happens once, here, so the explorer and the generator read
  // the same pattern rather than each re-deriving one.
  const { pattern, evidence } = matchPattern(base)
  return {
    ...base,
    uiPattern: pattern,
    patternEvidence: evidence,
    risk: classifyRisk(base, keywords),
    elementId: elementIdentity(base, pattern)
  }
}

function toFormInfo(raw: RawForm, keywords: readonly string[]): FormInfo {
  return {
    id: raw.id,
    name: raw.name,
    action: raw.action,
    method: raw.method,
    accessibleName: raw.accessibleName,
    fields: raw.fields.map((field) => toUIElement(field, keywords)),
    submitButtons: raw.submitButtons.map((button) => toUIElement(button, keywords))
  }
}

export function mapToPageModel(
  raw: RawPageData,
  meta: { url: string; finalUrl: string; depth: number; statusCode?: number; apiRequests?: PageInfo['apiRequests'] },
  blockedKeywords: readonly string[] = []
): PageInfo {
  const toElement = (element: RawElement) => toUIElement(element, blockedKeywords)
  const links = raw.links.map(toElement)
  const buttons = raw.buttons.map(toElement)
  const inputs = raw.inputs.map(toElement)
  const textareas = raw.textareas.map(toElement)
  const selects = raw.selects.map(toElement)
  const widgets = (raw.widgets ?? []).map(toElement)
  const controls = [...links, ...buttons, ...inputs, ...textareas, ...selects, ...widgets]
  const state = createPageState(raw, meta.finalUrl, controls)
  return {
    url: meta.url,
    finalUrl: meta.finalUrl,
    title: raw.title,
    depth: meta.depth,
    statusCode: meta.statusCode,
    headings: raw.headings,
    links,
    buttons,
    inputs,
    textareas,
    selects,
    forms: raw.forms.map((form) => toFormInfo(form, blockedKeywords)),
    apiRequests: meta.apiRequests ?? [],
    state
  }
}

export function createPageState(raw: RawPageData, url: string, controls: UIElement[]): PageState {
  const stateInput: Omit<PageState, 'id' | 'fingerprint'> = {
    url,
    title: raw.title,
    name: stateName(raw, url),
    type: stateType(raw),
    discoveredAt: new Date().toISOString(),
    visibleDialogs: raw.visibleDialogs,
    headings: raw.headings,
    controls,
    interactions: raw.interactions,
    stateContent: raw.stateContent,
    validationMessages: raw.validationMessages
  }
  const fingerprint = fingerprintState(stateInput)
  return { id: stateId(url, fingerprint), ...stateInput, fingerprint }
}

function stateName(raw: RawPageData, url: string): string {
  if (raw.visibleDialogs[0]) return raw.visibleDialogs[0]
  if (raw.validationMessages[0]) return raw.validationMessages[0]
  return raw.title || new URL(url).pathname || 'Page'
}

function stateType(raw: RawPageData): PageState['type'] {
  if (raw.visibleDialogs.length) return 'dialog'
  if (raw.validationMessages.length) return 'validation'
  return 'page'
}
