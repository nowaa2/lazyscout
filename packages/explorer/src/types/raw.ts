import type { ElementContext, ElementRelation, UIElementKind, UIInteraction } from '@lazyscout/core'

export type RawElement = {
  kind: UIElementKind
  role: string
  accessibleName: string
  text?: string
  tagName: string
  inputType?: string
  placeholder?: string
  name?: string
  ariaLabel?: string
  describedBy?: string
  visible?: boolean
  readOnly?: boolean
  checked?: boolean
  expanded?: boolean
  selected?: boolean
  multiple?: boolean
  accept?: string
  hasPopup?: string
  relation?: ElementRelation
  context?: ElementContext
  testId?: string
  /** Attribute the testId came from, e.g. `data-test`. */
  testIdAttribute?: string
  id?: string
  href?: string
  options?: string[]
  required: boolean
  disabled: boolean
  minLength?: number
  maxLength?: number
  min?: string
  max?: string
  step?: string
  pattern?: string
  autocomplete?: string
  cssSelector: string
  matchIndex?: number
  matchCount?: number
  scopeIndex?: number
  scopeMatchCount?: number
  contextText?: string
  contextSelector?: string
  contextTestId?: string
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
  /** Interactive elements with no native semantics: ARIA widgets, toggles. */
  widgets?: RawElement[]
  forms: RawForm[]
  visibleDialogs: string[]
  validationMessages: string[]
  interactions: UIInteraction[]
  stateContent: string[]
}
