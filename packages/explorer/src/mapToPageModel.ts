import type { FormInfo, PageInfo, UIElement } from '@lazyscout/core'
import type { RawElement, RawForm, RawPageData } from './types/raw.js'
import { isDestructiveLabel } from './safety.js'

/** เติมผลการตรวจ safety ให้ element ดิบ (ทำฝั่ง Node เพื่อให้ keyword อยู่ที่เดียว) */
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

/** RawPageData (จาก DOM) → PageInfo (Normalized Page Model) */
export function mapToPageModel(
  raw: RawPageData,
  meta: { url: string; finalUrl: string; depth: number; statusCode?: number }
): PageInfo {
  return {
    url: meta.url,
    finalUrl: meta.finalUrl,
    title: raw.title,
    depth: meta.depth,
    statusCode: meta.statusCode,
    headings: raw.headings,
    links: raw.links.map(toUIElement),
    buttons: raw.buttons.map(toUIElement),
    inputs: raw.inputs.map(toUIElement),
    textareas: raw.textareas.map(toUIElement),
    selects: raw.selects.map(toUIElement),
    forms: raw.forms.map(toFormInfo)
  }
}
