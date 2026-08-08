import { fingerprintState, stateId, type FormInfo, type PageInfo, type UIElement } from '@lazyscout/core'
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
  const stateInput = { url: meta.finalUrl, title: raw.title, visibleDialogs: raw.visibleDialogs, headings: raw.headings, controls, interactions: raw.interactions, stateContent: raw.stateContent }
  const fingerprint = fingerprintState(stateInput)
  return {
    url: meta.url,
    finalUrl: meta.finalUrl,
    title: raw.title,
    depth: meta.depth,
    statusCode: meta.statusCode,
    headings: raw.headings,
    links, buttons, inputs, textareas, selects, forms: raw.forms.map(toFormInfo), apiRequests: meta.apiRequests ?? [],
    state: { id: stateId(meta.finalUrl, fingerprint), ...stateInput, fingerprint }
  }
}
