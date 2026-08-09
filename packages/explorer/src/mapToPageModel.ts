import {
  fingerprintState,
  stateId,
  type FormInfo,
  type PageInfo,
  type PageState,
  type UIElement
} from '@lazyscout/core'
import type { RawElement, RawForm, RawPageData } from './types/raw.js'
import { isDestructiveLabel } from './safety.js'

function toUIElement(raw: RawElement): UIElement {
  return {
    ...raw,
    destructive: isDestructiveLabel(raw.accessibleName, raw.text, raw.name, raw.id)
  }
}

function toFormInfo(raw: RawForm): FormInfo {
  return {
    id: raw.id,
    name: raw.name,
    action: raw.action,
    method: raw.method,
    accessibleName: raw.accessibleName,
    fields: raw.fields.map(toUIElement),
    submitButtons: raw.submitButtons.map(toUIElement)
  }
}

export function mapToPageModel(
  raw: RawPageData,
  meta: { url: string; finalUrl: string; depth: number; statusCode?: number; apiRequests?: PageInfo['apiRequests'] }
): PageInfo {
  const links = raw.links.map(toUIElement)
  const buttons = raw.buttons.map(toUIElement)
  const inputs = raw.inputs.map(toUIElement)
  const textareas = raw.textareas.map(toUIElement)
  const selects = raw.selects.map(toUIElement)
  const controls = [...links, ...buttons, ...inputs, ...textareas, ...selects]
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
    forms: raw.forms.map(toFormInfo),
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
