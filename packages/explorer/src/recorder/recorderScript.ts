/**
 * Runs inside the page under test, once per document, via addInitScript.
 *
 * It must be fully self-contained: Playwright serializes the function source
 * and evaluates it in a fresh realm, so it cannot close over module scope.
 *
 * The value of a password field is never read and never leaves the page. The
 * recorder reports `secret: true` instead and the server substitutes the
 * {{TEST_PASSWORD}} placeholder.
 */
export function recorderInitScript(): void {
  const scope = window as unknown as { __lazyscoutRecord?: (event: unknown) => Promise<void> }
  // Marked on the document, not the window. window.open() creates a popup on
  // about:blank and keeps the same window object when it navigates, so a
  // window-level flag would survive into the real document and make this
  // script return before attaching any listener. Every SSO popup would then
  // record nothing. A document is replaced on navigation, so it is the
  // correct scope for "already attached".
  const marker = document as unknown as { __lazyscoutRecorderReady?: boolean }
  if (marker.__lazyscoutRecorderReady) return
  marker.__lazyscoutRecorderReady = true

  const CLICKABLE =
    'a,button,input,select,textarea,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="checkbox"],[role="radio"],[role="option"]'
  const NON_TEXT_INPUTS = ['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image']
  const inspectState = window as unknown as {
    __lazyscoutInspectMode?: boolean
    __lazyscoutInspectTarget?: Element
    __lazyscoutInspectLocked?: boolean
  }

  const send = (event: unknown): void => {
    try {
      void scope.__lazyscoutRecord?.(event)
    } catch {
      // Recording must never break the site under test.
    }
  }

  const clean = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)

  const inputType = (element: Element): string =>
    element.tagName.toLowerCase() === 'input' ? (element as HTMLInputElement).type.toLowerCase() : ''

  const roleOf = (element: Element): string | undefined => {
    const explicit = element.getAttribute('role')
    if (explicit) return explicit
    const tag = element.tagName.toLowerCase()
    if (tag === 'a') return element.hasAttribute('href') ? 'link' : undefined
    if (tag === 'button') return 'button'
    if (tag === 'select') return 'combobox'
    if (tag === 'textarea') return 'textbox'
    if (/^h[1-6]$/.test(tag)) return 'heading'
    if (tag !== 'input') return undefined
    const type = inputType(element)
    if (type === 'button' || type === 'submit' || type === 'reset' || type === 'image') return 'button'
    if (type === 'checkbox') return 'checkbox'
    if (type === 'radio') return 'radio'
    if (type === 'range') return 'slider'
    if (type === 'number') return 'spinbutton'
    if (type === 'search') return 'searchbox'
    if (type === 'hidden') return undefined
    return 'textbox'
  }

  const labelOf = (element: Element): string | undefined => {
    const id = element.getAttribute('id')
    if (id) {
      const explicit = document.querySelector(`label[for="${CSS.escape(id)}"]`)
      const value = clean(explicit?.textContent)
      if (value) return value
    }
    const wrapping = element.closest('label')
    return clean(wrapping?.textContent) || undefined
  }

  /**
   * Text the way the accessible name algorithm builds it: a space around every
   * non-inline descendant. Plain `textContent` glues block siblings together,
   * producing a name that no `getByRole` locator can match.
   */
  const renderedText = (el: Element): string => {
    let text = ''
    const walk = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent ?? ''
        return
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return
      const child = node as Element
      const style = window.getComputedStyle(child as HTMLElement)
      if (style.display === 'none' || style.visibility === 'hidden') return
      if (child instanceof HTMLImageElement) {
        const alt = child.getAttribute('alt')
        if (alt) text += ` ${alt} `
        return
      }
      const inline = style.display === 'inline' || style.display === 'contents'
      if (!inline) text += ' '
      for (const grandChild of Array.from(child.childNodes)) walk(grandChild)
      if (!inline) text += ' '
    }
    for (const child of Array.from(el.childNodes)) walk(child)
    return text
  }

  const accessibleName = (element: Element): string | undefined => {
    const aria = clean(element.getAttribute('aria-label'))
    if (aria) return aria

    const labelledBy = element.getAttribute('aria-labelledby')
    if (labelledBy) {
      const parts = labelledBy.split(/\s+/).map((ref) => document.getElementById(ref)?.textContent ?? '')
      const joined = clean(parts.join(' '))
      if (joined) return joined
    }

    const label = labelOf(element)
    if (label) return label

    const title = clean(element.getAttribute('title'))
    if (title) return title

    const alt = clean(element.getAttribute('alt'))
    if (alt) return alt

    if (element.tagName.toLowerCase() === 'input') {
      const type = inputType(element)
      if (type === 'button' || type === 'submit' || type === 'reset') {
        const value = clean(element.getAttribute('value'))
        if (value) return value
      }
      return undefined
    }

    return clean(renderedText(element)) || undefined
  }

  const TEST_ID_ATTRIBUTES = ['data-testid', 'data-test-id', 'data-test', 'data-qa', 'data-cy']

  /** The automation attribute this element carries, with its real name kept. */
  const testIdOf = (element: Element): { attribute: string; value: string } | undefined => {
    for (const attribute of TEST_ID_ATTRIBUTES) {
      const value = element.getAttribute(attribute)
      if (value && value.trim()) return { attribute, value: value.trim() }
    }
    return undefined
  }

  /**
   * An attribute selector's value is a quoted CSS string, so only `\` and `"`
   * need escaping — `CSS.escape` would turn `input:username` into
   * `input\:username`, which matches nothing.
   */
  const attributeSelector = (name: string, value: string, tagName = ''): string =>
    `${tagName}[${name}="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`

  /** Last-resort selector. Prefers attributes a developer chose over positions. */
  const cssPath = (element: Element): string => {
    // Keep the attribute the page actually uses. Rewriting `data-test` to
    // `data-testid` produces a selector that matches nothing.
    const testId = testIdOf(element)
    if (testId) return attributeSelector(testId.attribute, testId.value)

    const id = element.getAttribute('id')
    // Ids containing long digit runs are usually generated per render.
    if (id && !/\d{4,}/.test(id)) return `#${CSS.escape(id)}`

    const name = element.getAttribute('name')
    if (name) return attributeSelector('name', name, element.tagName.toLowerCase())

    const parts: string[] = []
    let node: Element | null = element
    let depth = 0
    while (node && depth < 4) {
      const parent: Element | null = node.parentElement
      let part = node.tagName.toLowerCase()
      if (parent) {
        const tagName = node.tagName
        const siblings = Array.from(parent.children).filter((child) => child.tagName === tagName)
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`
      }
      parts.unshift(part)
      node = parent
      depth += 1
    }
    return parts.join(' > ')
  }

  const targetOf = (element: Element) => {
    const role = roleOf(element)
    const name = accessibleName(element)
    const matches =
      role && name
        ? Array.from(document.querySelectorAll(CLICKABLE)).filter(
            (candidate) =>
              roleOf(candidate) === role &&
              accessibleName(candidate)?.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0
          )
        : []
    const testId = testIdOf(element)
    const elementId = element.getAttribute('id') || undefined
    const target = {
      role,
      name,
      // Only offer text matching where there is no role to match on.
      text: role ? undefined : clean(element.textContent) || undefined,
      label: labelOf(element),
      placeholder: clean(element.getAttribute('placeholder')) || undefined,
      // Recorded verbatim so the generator can rank them without re-deriving
      // anything from the DOM it can no longer see.
      testId: testId?.value,
      testIdAttribute: testId?.attribute,
      elementId: elementId && !/\d{4,}/.test(elementId) ? elementId : undefined,
      attributeName: element.getAttribute('name') || undefined,
      tagName: element.tagName.toLowerCase(),
      cssSelector: cssPath(element)
    }
    return matches.length > 1 ? { ...target, matchCount: matches.length } : target
  }

  const inspectionOf = (element: Element, locked: boolean) => {
    const target = targetOf(element)
    const playwrightLocator =
      target.role && target.name
        ? `page.getByRole(${JSON.stringify(target.role)}, { name: ${JSON.stringify(target.name)}, exact: true })`
        : `page.locator(${JSON.stringify(target.cssSelector)})`
    return {
      locked,
      tagName: element.tagName.toLowerCase(),
      role: target.role,
      accessibleName: target.name,
      text: clean(element.textContent) || undefined,
      id: element.getAttribute('id') || undefined,
      name: element.getAttribute('name') || undefined,
      cssSelector: target.cssSelector,
      playwrightLocator
    }
  }

  const clearInspectHighlight = (): void => {
    const previous = inspectState.__lazyscoutInspectTarget
    if (previous) previous.removeAttribute('data-lazyscout-inspect')
    inspectState.__lazyscoutInspectTarget = undefined
  }

  const inspectCandidate = (origin: Element): Element | undefined => {
    const interactive = origin.closest(CLICKABLE)
    if (interactive) return interactive
    const directText = clean(
      Array.from(origin.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? '')
        .join(' ')
    )
    const hasStableIdentity = Boolean(
      origin.id ||
      origin.getAttribute('name') ||
      origin.getAttribute('data-testid') ||
      origin.getAttribute('aria-label') ||
      origin.getAttribute('title')
    )
    return directText || hasStableIdentity || getComputedStyle(origin).cursor === 'pointer' ? origin : undefined
  }

  const inspect = (element: Element, locked: boolean): void => {
    if (!document.querySelector('[data-lazyscout-inspect-style]')) {
      const style = document.createElement('style')
      style.setAttribute('data-lazyscout-inspect-style', 'true')
      style.textContent =
        '[data-lazyscout-inspect="true"]{outline:3px solid #7c3aed !important;outline-offset:3px !important;cursor:crosshair !important;}'
      document.documentElement.appendChild(style)
    }
    clearInspectHighlight()
    element.setAttribute('data-lazyscout-inspect', 'true')
    inspectState.__lazyscoutInspectTarget = element
    inspectState.__lazyscoutInspectLocked = locked
    send({ kind: 'inspect', inspection: inspectionOf(element, locked) })
  }

  document.addEventListener(
    'pointerover',
    (event) => {
      if (!inspectState.__lazyscoutInspectMode) return
      if (inspectState.__lazyscoutInspectLocked) return
      const origin = event.target instanceof Element ? event.target : null
      const element = origin ? inspectCandidate(origin) : undefined
      if (element) inspect(element, false)
    },
    true
  )

  document.addEventListener(
    'click',
    (event) => {
      if (!inspectState.__lazyscoutInspectMode) return
      const origin = event.target instanceof Element ? event.target : null
      event.preventDefault()
      event.stopImmediatePropagation()
      const element = origin ? inspectCandidate(origin) : undefined
      if (element) {
        inspect(element, true)
        return
      }
      clearInspectHighlight()
      inspectState.__lazyscoutInspectLocked = false
      send({ kind: 'inspect' })
    },
    true
  )

  document.addEventListener(
    'click',
    (event) => {
      const origin = event.target instanceof Element ? event.target : null
      const element = origin?.closest(CLICKABLE)
      if (!element) return

      const tag = element.tagName.toLowerCase()
      if (tag === 'select') return
      if (tag === 'textarea') return
      // Typing is recorded on change, so a focus click would only add noise.
      if (tag === 'input' && !NON_TEXT_INPUTS.includes(inputType(element))) return

      send({ kind: 'click', target: targetOf(element), url: location.href })
    },
    true
  )

  // A text field only fires 'change' when it loses focus, so a value typed
  // into the last field before the window is closed would never be recorded.
  // 'input' is debounced as a backstop; the dedupe on the Node side collapses
  // the two into one step.
  const pendingFlush = new WeakMap<Element, ReturnType<typeof setTimeout>>()

  const flushField = (element: Element): void => {
    const timer = pendingFlush.get(element)
    if (timer !== undefined) {
      clearTimeout(timer)
      pendingFlush.delete(element)
    }
    const tag = element.tagName.toLowerCase()
    if (tag === 'textarea') {
      send({
        kind: 'fill',
        target: targetOf(element),
        value: (element as HTMLTextAreaElement).value.slice(0, 200),
        url: location.href
      })
      return
    }
    if (tag !== 'input') return
    const input = element as HTMLInputElement
    const type = inputType(element)
    if (NON_TEXT_INPUTS.includes(type)) return
    if (type === 'password') {
      send({ kind: 'fill', target: targetOf(element), value: '', secret: true, url: location.href })
      return
    }
    send({ kind: 'fill', target: targetOf(element), value: input.value.slice(0, 200), url: location.href })
  }

  document.addEventListener(
    'input',
    (event) => {
      const element = event.target instanceof Element ? event.target : null
      if (!element) return
      const tag = element.tagName.toLowerCase()
      if (tag !== 'input' && tag !== 'textarea') return
      const existing = pendingFlush.get(element)
      if (existing !== undefined) clearTimeout(existing)
      pendingFlush.set(
        element,
        setTimeout(() => flushField(element), 400)
      )
    },
    true
  )

  document.addEventListener(
    'change',
    (event) => {
      const element = event.target instanceof Element ? event.target : null
      if (!element) return
      const tag = element.tagName.toLowerCase()

      if (tag === 'select') {
        const select = element as HTMLSelectElement
        const option = select.options[select.selectedIndex]
        send({
          kind: 'select',
          target: targetOf(element),
          option: clean(option?.text) || select.value,
          url: location.href
        })
        return
      }

      flushField(element)
    },
    true
  )

  // Last line of defence: commit whatever is still pending before the document
  // goes away, which covers closing the window straight after typing.
  window.addEventListener('pagehide', () => {
    const active = document.activeElement
    if (active) flushField(active)
  })
}
