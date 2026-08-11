import type { RawElement, RawForm, RawPageData } from '../types/raw.js'

export function collectPageData(): RawPageData {
  const MAX_PER_GROUP = 80

  function cleanText(value: string | null | undefined): string {
    return (value || '').replace(/\s+/g, ' ').trim().slice(0, 200)
  }

  function attr(el: Element, name: string): string | undefined {
    const value = el.getAttribute(name)
    return value && value.trim() ? value.trim() : undefined
  }

  function accessibleName(el: Element): string {
    const ariaLabel = cleanText(el.getAttribute('aria-label'))
    if (ariaLabel) return ariaLabel

    const labelledBy = el.getAttribute('aria-labelledby')
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => cleanText(document.getElementById(id)?.textContent))
        .filter(Boolean)
        .join(' ')
      if (text) return text
    }

    const isFormField =
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement

    if (isFormField) {
      if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
        const labelText = cleanText(label?.textContent)
        if (labelText) return labelText
      }
      const wrappingLabel = el.closest('label')
      if (wrappingLabel) {
        const labelText = cleanText(wrappingLabel.textContent)
        if (labelText) return labelText
      }
      const placeholder = cleanText(el.getAttribute('placeholder'))
      if (placeholder) return placeholder
      const title = cleanText(el.getAttribute('title'))
      if (title) return title
      if (el instanceof HTMLInputElement && el.value && el.type !== 'text') return cleanText(el.value)
      return cleanText(el.getAttribute('name'))
    }

    const ownText = cleanText(el.textContent)
    if (ownText) return ownText

    const image = el.querySelector('img[alt]')
    const alt = cleanText(image?.getAttribute('alt'))
    if (alt) return alt

    return cleanText(el.getAttribute('title')) || cleanText(el.getAttribute('value'))
  }

  function cssSelector(el: Element): string {
    if (el.id) return `#${CSS.escape(el.id)}`

    const parts: string[] = []
    let current: Element | null = el
    let depth = 0

    while (current && current.nodeType === 1 && depth < 4) {
      let part = current.tagName.toLowerCase()
      const parent: Element | null = current.parentElement
      if (parent) {
        const sameTag = Array.from(parent.children).filter((child) => child.tagName === current!.tagName)
        if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(current) + 1})`
      }
      parts.unshift(part)
      if (current.id) {
        parts[0] = `#${CSS.escape(current.id)}`
        break
      }
      current = parent
      depth++
    }
    return parts.join(' > ')
  }

  function inputRole(input: HTMLInputElement): string {
    switch (input.type) {
      case 'checkbox':
        return 'checkbox'
      case 'radio':
        return 'radio'
      case 'search':
        return 'searchbox'
      case 'submit':
      case 'button':
      case 'reset':
      case 'image':
        return 'button'
      case 'range':
        return 'slider'
      case 'number':
        return 'spinbutton'
      default:
        return 'textbox'
    }
  }

  function toRawElement(el: Element, kind: RawElement['kind'], defaultRole: string): RawElement {
    const explicitRole = attr(el, 'role')
    let role = explicitRole || defaultRole
    let inputType: string | undefined
    let options: string[] | undefined

    if (el instanceof HTMLInputElement) {
      inputType = el.type
      if (!explicitRole) role = inputRole(el)
    }
    if (el instanceof HTMLSelectElement) {
      options = Array.from(el.options)
        .map((option) => cleanText(option.textContent))
        .slice(0, 30)
    }

    const disabled = (el as HTMLInputElement).disabled === true || el.getAttribute('aria-disabled') === 'true'
    const required = (el as HTMLInputElement).required === true || el.getAttribute('aria-required') === 'true'
    const context = el.closest(
      'form, fieldset, tr, [role="row"], li, section, article, aside, main, nav, dialog, [role="dialog"], [role="region"], .card, [class*="card" i]'
    )
    const contextAriaLabel = context?.getAttribute('aria-label')
    const contextHeading = context?.querySelector('h1, h2, h3')
    const rowLabel = context?.matches('tr, [role="row"]')
      ? context.querySelector('th, td, [role="cell"], [role="gridcell"]')
      : undefined
    const namedContainer = context?.querySelector('[data-title], [data-name], [data-label]')
    const contextText = cleanText(
      contextAriaLabel ||
        contextHeading?.textContent ||
        namedContainer?.getAttribute('data-title') ||
        namedContainer?.getAttribute('data-name') ||
        namedContainer?.getAttribute('data-label') ||
        rowLabel?.textContent
    )
    const contextTestId = context?.getAttribute('data-testid')?.trim() || undefined

    return {
      kind,
      role,
      accessibleName: accessibleName(el),
      text: cleanText(el.textContent) || undefined,
      tagName: el.tagName.toLowerCase(),
      inputType,
      placeholder: attr(el, 'placeholder'),
      name: attr(el, 'name'),
      testId: attr(el, 'data-testid'),
      id: el.id || undefined,
      href: el instanceof HTMLAnchorElement ? el.href : undefined,
      options,
      required,
      disabled,
      cssSelector: cssSelector(el),
      contextText: contextText || undefined,
      contextSelector: context ? cssSelector(context) : undefined,
      contextTestId
    }
  }

  function annotateMatches(elements: RawElement[]): void {
    const groups = new Map<string, RawElement[]>()
    for (const element of elements) {
      if (!element.accessibleName) continue
      const key = `${element.role}|${element.accessibleName}`
      const group = groups.get(key) ?? []
      group.push(element)
      groups.set(key, group)
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue
      group.forEach((element, index) => {
        element.matchIndex = index
        element.matchCount = group.length
      })
      const scopedGroups = new Map<string, RawElement[]>()
      for (const element of group) {
        if (!element.contextSelector) continue
        const scopedKey = element.contextSelector
        const scoped = scopedGroups.get(scopedKey) ?? []
        scoped.push(element)
        scopedGroups.set(scopedKey, scoped)
      }
      for (const scoped of scopedGroups.values()) {
        scoped.forEach((element, index) => {
          element.scopeIndex = index
          element.scopeMatchCount = scoped.length
        })
      }
    }
  }

  function isCollectable(el: Element): boolean {
    if (el.closest('[aria-hidden="true"]')) return false
    if (el instanceof HTMLInputElement && el.type === 'hidden') return false
    if (el instanceof HTMLElement) {
      const style = window.getComputedStyle(el)
      if (el.hidden || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
      if (el.getClientRects().length === 0) return false
    }
    return true
  }

  function collect(selector: string, kind: RawElement['kind'], defaultRole: string): RawElement[] {
    return Array.from(document.querySelectorAll(selector))
      .filter(isCollectable)
      .slice(0, MAX_PER_GROUP)
      .map((el) => toRawElement(el, kind, defaultRole))
  }

  const BUTTON_SELECTOR = 'button, input[type="submit"], input[type="button"], input[type="reset"], [role="button"]'
  const INPUT_SELECTOR =
    'input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="hidden"]):not([type="image"])'

  const forms: RawForm[] = Array.from(document.querySelectorAll('form'))
    .slice(0, 20)
    .map((form) => {
      const fields = Array.from(form.querySelectorAll(INPUT_SELECTOR + ', textarea, select'))
        .filter(isCollectable)
        .slice(0, 40)
        .map((el) => {
          const kind: RawElement['kind'] =
            el.tagName === 'TEXTAREA' ? 'textarea' : el.tagName === 'SELECT' ? 'select' : 'input'
          const defaultRole = el.tagName === 'SELECT' ? 'combobox' : 'textbox'
          return toRawElement(el, kind, defaultRole)
        })

      const submitButtons = Array.from(form.querySelectorAll(BUTTON_SELECTOR))
        .filter(isCollectable)
        .slice(0, 10)
        .map((el) => toRawElement(el, 'button', 'button'))

      return {
        id: form.id || undefined,
        name: attr(form, 'name'),
        action: form.getAttribute('action') || undefined,
        method: (form.getAttribute('method') || 'get').toLowerCase(),

        accessibleName: attr(form, 'aria-label') || attr(form, 'name') || form.id || undefined,
        fields,
        submitButtons
      }
    })

  const result: RawPageData = {
    title: document.title,
    headings: Array.from(document.querySelectorAll('h1, h2, h3'))
      .map((el) => cleanText(el.textContent))
      .filter(Boolean)
      .slice(0, 30),
    links: collect('a[href]', 'link', 'link'),
    buttons: collect(BUTTON_SELECTOR, 'button', 'button'),
    inputs: collect(INPUT_SELECTOR, 'input', 'textbox'),
    textareas: collect('textarea', 'textarea', 'textbox'),
    selects: collect('select', 'select', 'combobox'),
    forms,
    visibleDialogs: Array.from(
      document.querySelectorAll(
        '[role="dialog"], dialog[open], [aria-modal="true"], .modal-backdrop:not(.hidden), .modal:not(.hidden), .drawer:not(.hidden)'
      )
    )
      .filter(isCollectable)
      .map(
        (element) =>
          accessibleName(element) ||
          cleanText(element.querySelector('h1, h2, h3')?.textContent) ||
          cleanText(element.textContent).slice(0, 120)
      )
      .filter(Boolean)
      .slice(0, 20),
    interactions: Array.from(
      document.querySelectorAll(
        '[role="tab"], [role="tablist"] [aria-controls], [aria-expanded], [aria-haspopup], [data-toggle], [data-bs-toggle], [data-modal], [data-drawer], [data-tab], details[data-accordion], select'
      )
    )
      .filter(isCollectable)
      .map((element) => {
        const role = attr(element, 'role') || (element instanceof HTMLSelectElement ? 'combobox' : 'button')
        const expanded = element.getAttribute('aria-expanded')
        const popup = element.getAttribute('aria-haspopup')
        const toggle = element.getAttribute('data-toggle') || element.getAttribute('data-bs-toggle')
        const dataModal = element.hasAttribute('data-modal')
        const dataDrawer = element.hasAttribute('data-drawer')
        const dataTab = element.hasAttribute('data-tab')
        const accordion = element.matches('details[data-accordion]')
        const kind: 'dialog' | 'tab' | 'accordion' | 'dropdown' | 'drawer' | 'popover' =
          role === 'tab' || dataTab
            ? 'tab'
            : dataDrawer
              ? 'drawer'
              : popup === 'dialog' || toggle === 'modal' || dataModal
                ? 'dialog'
                : popup === 'menu' || popup === 'listbox' || toggle === 'dropdown'
                  ? 'dropdown'
                  : accordion
                    ? 'accordion'
                    : element instanceof HTMLSelectElement
                      ? 'dropdown'
                      : element.matches('[aria-expanded]')
                        ? 'accordion'
                        : 'dialog'
        return {
          kind,
          name: accessibleName(element),
          role,
          cssSelector: cssSelector(element),
          expanded: expanded === null ? undefined : expanded === 'true',
          visible: true
        }
      })
      .filter((item) => item.name)
      .slice(0, 40),
    stateContent: Array.from(document.querySelectorAll('[aria-live], [data-state], [data-testid*="state" i]'))
      .filter(isCollectable)
      .map((element) => cleanText(element.textContent))
      .filter(Boolean)
      .slice(0, 30),
    validationMessages: Array.from(
      document.querySelectorAll('[role="alert"], [aria-invalid="true"], .error, .errors, .invalid-feedback')
    )
      .filter(isCollectable)
      .map((element) => cleanText(element.textContent))
      .filter(Boolean)
      .slice(0, 20)
  }
  annotateMatches([...result.links, ...result.buttons, ...result.inputs, ...result.textareas, ...result.selects])
  annotateMatches(result.forms.flatMap((form) => [...form.fields, ...form.submitButtons]))
  return result
}
