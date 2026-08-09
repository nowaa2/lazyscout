import type { BrowserContext, Page } from 'playwright-core'
import type { TargetRef, TestStep } from '@lazyscout/core'
import { recorderInitScript } from './recorderScript.js'

export const SECRET_PLACEHOLDER = '{{TEST_PASSWORD}}'
export const MAX_RECORDED_STEPS = 200

export type RecorderEvent =
  | { kind: 'click'; target: TargetRef; url: string }
  | { kind: 'fill'; target: TargetRef; value: string; secret?: boolean; url: string }
  | { kind: 'select'; target: TargetRef; option: string; url: string }

export type RecorderHandle = {
  steps: () => TestStep[]
  /**
   * Steps plus a closing URL assertion when the last action navigated. Without
   * it a recorded login would click Submit and end, so the generated test would
   * pass even when the credentials were rejected.
   */
  finalize: () => TestStep[]
  currentUrl: () => string
}

export function closingAssertion(lastActionUrl: string, finalUrl: string): TestStep | undefined {
  if (!finalUrl || finalUrl === lastActionUrl) return undefined
  let path: string
  try {
    // Path only. A GET login form puts the password in the query string, and
    // tokens and session ids live there too, so it must never be asserted on.
    path = new URL(finalUrl).pathname
  } catch {
    return undefined
  }
  if (!path || path === '/') return undefined
  return { type: 'assertUrl', urlContains: path }
}

const sameTarget = (left: TargetRef, right: TargetRef): boolean =>
  left.cssSelector === right.cssSelector && left.role === right.role && left.name === right.name

/** Drops keys whose value is undefined so recorded steps serialize cleanly. */
function compactTarget(target: TargetRef): TargetRef {
  const entries = Object.entries(target).filter(([, value]) => value !== undefined && value !== '')
  return Object.fromEntries(entries) as TargetRef
}

export function buildStep(event: RecorderEvent): TestStep | undefined {
  const target = compactTarget(event.target)
  if (event.kind === 'click') return { type: 'click', target }
  if (event.kind === 'select') return { type: 'select', target, option: event.option }
  return { type: 'fill', target, value: event.secret ? SECRET_PLACEHOLDER : event.value }
}

/**
 * Records the operator's own clicks and typing in a visible browser.
 *
 * Only exposeBinding and addInitScript are used, both public Playwright APIs.
 * The init script re-runs on every document, so a login flow that navigates
 * across several pages keeps recording without re-attaching.
 */
export async function attachRecorder(context: BrowserContext, startUrl: string): Promise<RecorderHandle> {
  const steps: TestStep[] = []
  let lastUrl = ''
  let finalUrl = ''

  const pushNavigate = (url: string): void => {
    if (!url || url === 'about:blank' || url === lastUrl) return
    lastUrl = url
    if (steps.length < MAX_RECORDED_STEPS) steps.push({ type: 'navigate', url })
  }

  const record = (event: RecorderEvent): void => {
    if (steps.length >= MAX_RECORDED_STEPS) return
    // Emitted before the action so a step always follows the page it happened on.
    pushNavigate(event.url)

    const step = buildStep(event)
    if (!step) return

    // Editing one field repeatedly should stay a single fill.
    const previous = steps[steps.length - 1]
    if (
      step.type === 'fill' &&
      previous &&
      previous.type === 'fill' &&
      sameTarget(previous.target, step.target) &&
      previous.value !== SECRET_PLACEHOLDER
    ) {
      steps[steps.length - 1] = step
      return
    }

    steps.push(step)
  }

  await context.exposeBinding('__lazyscoutRecord', (_source, event) => {
    try {
      record(event as RecorderEvent)
    } catch {
      // A malformed event must not take the recording session down.
    }
  })
  await context.addInitScript(recorderInitScript)

  // Tracked separately from the step list: a trailing navigation becomes an
  // assertion rather than another navigate step.
  const watchPage = (page: Page): void => {
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return
      const url = frame.url()
      if (url && url !== 'about:blank') finalUrl = url
    })
  }
  context.pages().forEach(watchPage)
  context.on('page', watchPage)

  pushNavigate(startUrl)

  return {
    steps: () => steps.slice(),
    finalize: () => {
      const closing = closingAssertion(lastUrl, finalUrl)
      return closing ? [...steps, closing] : steps.slice()
    },
    currentUrl: () => lastUrl
  }
}
