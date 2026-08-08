import type { UIElementKind, UIInteraction } from '@lazyscout/core'

export type RawElement = {
  kind: UIElementKind
  role: string
  accessibleName: string
  text?: string
  tagName: string
  inputType?: string
  placeholder?: string
  name?: string
  id?: string
  href?: string
  options?: string[]
  required: boolean
  disabled: boolean
  cssSelector: string
}

export type RawForm = {
  id?: string
  name?: string
  action?: string
  method?: string
  accessibleName?: string
  fields: RawElement[]
  submitButtons: RawElement[]
}

export type RawPageData = {
  title: string
  headings: string[]
  links: RawElement[]
  buttons: RawElement[]
  inputs: RawElement[]
  textareas: RawElement[]
  selects: RawElement[]
  forms: RawForm[]
  visibleDialogs: string[]
  interactions: UIInteraction[]
  stateContent: string[]
}
