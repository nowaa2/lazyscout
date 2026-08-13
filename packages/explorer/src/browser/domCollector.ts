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

  /**
   * Text content the way the accessible name algorithm builds it: a space is
   * inserted around every non-inline descendant. Plain `textContent` glues
   * block siblings together, so `<a><div>Icon</div><div>Orders</div></a>`
   * became "IconOrders" while Playwright computes "Icon Orders" — and a
   * `getByRole` locator built from the former matched nothing.
   */
  function renderedText(el: Element): string {
    let text = ''
    const walk = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent ?? ''
        return
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return
      const element = node as Element
      const style = window.getComputedStyle(element as HTMLElement)
      if (style.display === 'none' || style.visibility === 'hidden') return
      // Replaced content contributes its alternative text, not its children.
      if (element instanceof HTMLImageElement) {
        const alt = element.getAttribute('alt')
        if (alt) text += ` ${alt} `
        return
      }
      const inline = style.display === 'inline' || style.display === 'contents'
      if (!inline) text += ' '
      for (const child of Array.from(element.childNodes)) walk(child)
      if (!inline) text += ' '
    }
    for (const child of Array.from(el.childNodes)) walk(child)
    return text
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

    const ownText = cleanText(renderedText(el))
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

  const TEST_ID_ATTRIBUTES = ['data-testid', 'data-test-id', 'data-test', 'data-qa', 'data-cy']

  /** The automation attribute this element carries, with its real name kept. */
  function testIdOf(el: Element): { attribute: string; value: string } | undefined {
    for (const attribute of TEST_ID_ATTRIBUTES) {
      const value = attr(el, attribute)
      if (value) return { attribute, value }
    }
    return undefined
  }

  /** Reads a tri-state ARIA flag: true, false, or absent. */
  function ariaFlag(el: Element, name: string): boolean | undefined {
    const value = el.getAttribute(name)
    return value === null ? undefined : value === 'true'
  }

  /** Attribute relationships that tie a control to the region it drives. */
  function relationOf(el: Element): RawElement['relation'] {
    const relation = {
      controls: attr(el, 'aria-controls'),
      labelledBy: attr(el, 'aria-labelledby'),
      describedBy: attr(el, 'aria-describedby'),
      owns: attr(el, 'aria-owns'),
      target: attr(el, 'data-target') || attr(el, 'data-bs-target') || attr(el, 'data-modal') || attr(el, 'data-drawer')
    }
    return Object.values(relation).some(Boolean) ? relation : undefined
  }

  const CONTAINERS: Array<[NonNullable<RawElement['context']>['container'], string]> = [
    ['dialog', '[role="dialog"], [role="alertdialog"], dialog, [aria-modal="true"]'],
    ['tab-panel', '[role="tabpanel"]'],
    ['menu', '[role="menu"], [role="listbox"]'],
    ['table-row', 'tr, [role="row"]'],
    ['form', 'form'],
    ['card', '[class*="card" i], article']
  ]

  /** Nearest meaningful ancestor, used to scope locators and explain a case. */
  function contextOf(el: Element): RawElement['context'] {
    for (const [container, selector] of CONTAINERS) {
      const found = el.closest(selector)
      if (!found) continue
      return {
        container,
        containerSelector: cssSelector(found),
        containerName:
          accessibleName(found) ||
          cleanText(found.querySelector('h1, h2, h3, legend, caption')?.textContent) ||
          undefined
      }
    }
    return { container: 'page' }
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
      testId: testIdOf(el)?.value,
      // Kept so the generator matches the attribute the page really uses
      // instead of rewriting it to Playwright's default `data-testid`.
      testIdAttribute: testIdOf(el)?.attribute,
      id: el.id || undefined,
      ariaLabel: attr(el, 'aria-label'),
      describedBy: attr(el, 'aria-describedby'),
      visible: true,
      readOnly: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.readOnly : undefined,
      checked:
        el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')
          ? el.checked
          : ariaFlag(el, 'aria-checked'),
      expanded: ariaFlag(el, 'aria-expanded'),
      selected: ariaFlag(el, 'aria-selected'),
      multiple: el instanceof HTMLSelectElement || el instanceof HTMLInputElement ? el.multiple : undefined,
      accept: el instanceof HTMLInputElement && el.type === 'file' ? attr(el, 'accept') : undefined,
      hasPopup: attr(el, 'aria-haspopup') || attr(el, 'data-toggle') || attr(el, 'data-bs-toggle'),
      relation: relationOf(el),
      context: contextOf(el),
      href: el instanceof HTMLAnchorElement ? el.href : undefined,
      options,
      required,
      disabled,
      minLength:
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
          ? el.minLength >= 0
            ? el.minLength
            : undefined
          : undefined,
      maxLength:
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
          ? el.maxLength >= 0
            ? el.maxLength
            : undefined
          : undefined,
      min: el instanceof HTMLInputElement ? attr(el, 'min') : undefined,
      max: el instanceof HTMLInputElement ? attr(el, 'max') : undefined,
      step: el instanceof HTMLInputElement ? attr(el, 'step') : undefined,
      pattern: el instanceof HTMLInputElement ? attr(el, 'pattern') : undefined,
      autocomplete: attr(el, 'autocomplete'),
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

  /**
   * Controls that carry no native semantics but are demonstrably interactive:
   * they declare a widget role, an ARIA relationship, a toggle attribute, or
   * are reachable by keyboard. Collected so they become review cases with
   * evidence instead of being invisible to the run.
   */
  const WIDGET_SELECTOR = [
    '[role="tab"]',
    '[role="switch"]',
    '[role="slider"]',
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]',
    '[role="option"]',
    '[role="combobox"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="link"]',
    '[role="treeitem"]',
    'summary',
    '[aria-expanded]',
    '[aria-haspopup]',
    '[aria-controls]',
    '[data-toggle]',
    '[data-bs-toggle]',
    '[data-target]',
    '[data-bs-target]',
    '[data-modal]',
    '[data-drawer]',
    '[data-tab]',
    '[onclick]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ')

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
    // Everything interactive that the native groups above do not already cover.
    widgets: Array.from(document.querySelectorAll(WIDGET_SELECTOR))
      .filter(isCollectable)
      .filter((el) => !el.matches(`a[href], ${BUTTON_SELECTOR}, ${INPUT_SELECTOR}, textarea, select`))
      .slice(0, MAX_PER_GROUP)
      .map((el) => toRawElement(el, 'button', attr(el, 'role') || 'generic')),
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
        // The container this control owns, so the explorer can scope its
        // collection to what actually opened rather than the whole document.
        const controls = element.getAttribute('aria-controls')
        const targetSelector =
          element.getAttribute('data-target') ||
          element.getAttribute('data-bs-target') ||
          element.getAttribute('data-modal') ||
          element.getAttribute('data-drawer')
        // Clicking a <details> does nothing; only its <summary> toggles it.
        const clickable = element.tagName === 'DETAILS' ? (element.querySelector('summary') ?? element) : element
        return {
          kind,
          name: accessibleName(element),
          role,
          cssSelector: cssSelector(clickable),
          expanded: expanded === null ? undefined : expanded === 'true',
          visible: true,
          controlsSelector: controls ? `#${CSS.escape(controls)}` : targetSelector || undefined,
          evidence:
            role === 'tab'
              ? 'role="tab"'
              : popup
                ? `aria-haspopup="${popup}"`
                : toggle
                  ? `data-toggle="${toggle}"`
                  : dataModal
                    ? 'data-modal'
                    : dataDrawer
                      ? 'data-drawer'
                      : accordion
                        ? 'details[data-accordion]'
                        : expanded !== null
                          ? 'aria-expanded'
                          : '<select>'
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
