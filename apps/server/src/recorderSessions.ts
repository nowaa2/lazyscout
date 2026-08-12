import type { RecorderInspection, RecorderPointerCursor, RecorderState, TestStep } from '@lazyscout/core'
import { attachRecorder, type RecorderHandle } from '@lazyscout/explorer'
import type { BrowserContext, Page } from 'playwright-core'

export type RecorderLaunch = {
  context: BrowserContext
  label: string
  close: () => Promise<void>
}

/** Injected so tests can drive the lifecycle without a visible browser. */
export type LaunchRecorderBrowser = (projectId: string) => Promise<RecorderLaunch>

export type RecorderInteraction =
  | { type: 'click'; x: number; y: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'text'; text: string }
  | { type: 'key'; key: string }
  | { type: 'scroll'; deltaX: number; deltaY: number }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'reload' }
  | { type: 'navigate'; url: string }

type Session = {
  projectId: string
  startUrl: string
  startedAt: string
  browserLabel: string
  context: BrowserContext
  handle: RecorderHandle
  close: () => Promise<void>
  closed: boolean
  finalSteps?: TestStep[]
  inspection?: RecorderInspection
  pointerCursor: RecorderPointerCursor
  interactionQueue: Promise<void>
}

export function idleRecorderState(projectId: string): RecorderState {
  return { projectId, status: 'idle', startUrl: '', startedAt: '', steps: [] }
}

export class RecorderSessions {
  private readonly sessions = new Map<string, Session>()

  constructor(private readonly launch: LaunchRecorderBrowser) {}

  isRunning(projectId: string): boolean {
    const session = this.sessions.get(projectId)
    return Boolean(session && !session.closed)
  }

  state(projectId: string): RecorderState {
    const session = this.sessions.get(projectId)
    if (!session) return idleRecorderState(projectId)
    return {
      projectId: session.projectId,
      status: session.closed ? 'stopped' : 'recording',
      startUrl: session.startUrl,
      startedAt: session.startedAt,
      browserLabel: session.browserLabel,
      currentUrl: safeDisplayUrl(this.currentPage(session)?.url() ?? session.startUrl),
      pointerCursor: session.pointerCursor,
      steps: session.finalSteps ?? session.handle.steps(),
      inspection: session.inspection
    }
  }

  async start(projectId: string, startUrl: string): Promise<RecorderState> {
    const launched = await this.launch(projectId)

    // Registered before the first navigation so the session can never be left
    // recording when the operator closes the window straight away.
    let session!: Session
    const handle = await attachRecorder(launched.context, startUrl, {
      onEnded: () => {
        const current = this.sessions.get(projectId)
        if (current) void this.finish(current)
      },
      onInspection: (inspection) => {
        if (session) session.inspection = inspection
      }
    })

    session = {
      projectId,
      startUrl,
      startedAt: new Date().toISOString(),
      browserLabel: launched.label,
      context: launched.context,
      handle,
      close: launched.close,
      closed: false,
      pointerCursor: 'default',
      interactionQueue: Promise.resolve()
    }
    this.sessions.set(projectId, session)

    const page = launched.context.pages()[0] ?? (await launched.context.newPage())
    await page.goto(startUrl, { waitUntil: 'domcontentloaded' })

    return this.state(projectId)
  }

  async stop(projectId: string): Promise<RecorderState> {
    const session = this.sessions.get(projectId)
    if (!session) return idleRecorderState(projectId)
    await this.finish(session)
    return this.state(projectId)
  }

  async setInspectMode(projectId: string, enabled: boolean): Promise<RecorderState> {
    const session = this.sessions.get(projectId)
    if (!session || session.closed) return idleRecorderState(projectId)
    await session.handle.setInspectMode(enabled)
    if (!enabled) session.inspection = undefined
    return this.state(projectId)
  }

  async frame(projectId: string): Promise<Buffer> {
    const session = this.runningSession(projectId)
    const page = this.currentPage(session)
    if (!page) throw new Error('The recorder page is not available.')
    return page.screenshot({ type: 'jpeg', quality: 78, animations: 'disabled', caret: 'hide', timeout: 5000 })
  }

  async interact(projectId: string, interaction: RecorderInteraction): Promise<RecorderState> {
    const session = this.runningSession(projectId)
    session.interactionQueue = session.interactionQueue
      .catch(() => undefined)
      .then(async () => {
        const page = this.currentPage(session)
        if (!page) throw new Error('The recorder page is not available.')
        if (interaction.type === 'click') await page.mouse.click(interaction.x, interaction.y)
        else if (interaction.type === 'move') {
          await page.mouse.move(interaction.x, interaction.y)
          session.pointerCursor = await pointerCursorAt(page, interaction.x, interaction.y)
        } else if (interaction.type === 'text') await page.keyboard.insertText(interaction.text)
        else if (interaction.type === 'key') await page.keyboard.press(interaction.key)
        else if (interaction.type === 'scroll') await page.mouse.wheel(interaction.deltaX, interaction.deltaY)
        else if (interaction.type === 'navigate') {
          await page.goto(interaction.url, { waitUntil: 'domcontentloaded' })
          session.handle.recordNavigation(page.url())
        } else if (interaction.type === 'back') {
          await page.goBack({ waitUntil: 'domcontentloaded' })
          session.handle.recordNavigation(page.url())
        } else if (interaction.type === 'forward') {
          await page.goForward({ waitUntil: 'domcontentloaded' })
          session.handle.recordNavigation(page.url())
        } else {
          await page.reload({ waitUntil: 'domcontentloaded' })
          session.handle.recordNavigation(page.url(), true)
        }
      })
    await session.interactionQueue
    return this.state(projectId)
  }

  /**
   * Forgets a session once the operator has saved or discarded it, so reopening
   * the panel starts a fresh recording instead of the previous one.
   */
  async discard(projectId: string): Promise<RecorderState> {
    const session = this.sessions.get(projectId)
    this.sessions.delete(projectId)
    if (session) await this.finish(session)
    return idleRecorderState(projectId)
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.sessions.values()].map((session) => this.finish(session)))
    this.sessions.clear()
  }

  private async finish(session: Session): Promise<void> {
    if (session.closed) return
    session.finalSteps = session.handle.finalize()
    session.closed = true
    await session.close().catch(() => undefined)
  }

  private runningSession(projectId: string): Session {
    const session = this.sessions.get(projectId)
    if (!session || session.closed) throw new Error('No recorder is running for this Project.')
    return session
  }

  private currentPage(session: Session): Page | undefined {
    const pages = session.context.pages().filter((page) => !page.isClosed())
    return pages[pages.length - 1]
  }
}

async function pointerCursorAt(page: Page, x: number, y: number): Promise<RecorderPointerCursor> {
  return page
    .evaluate<RecorderPointerCursor>(
      `(() => {
        const element = document.elementFromPoint(${JSON.stringify(x)}, ${JSON.stringify(y)})
        if (!element) return 'default'
        const styleCursor = getComputedStyle(element).cursor
        if (['pointer', 'text', 'not-allowed', 'grab', 'crosshair'].includes(styleCursor)) return styleCursor
        const interactive = element.closest(
          'a[href],button,select,summary,label,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="checkbox"],[role="radio"],input[type="button"],input[type="submit"],input[type="checkbox"],input[type="radio"]'
        )
        if (interactive) return interactive.matches(':disabled,[aria-disabled="true"]') ? 'not-allowed' : 'pointer'
        const textInput = element.closest(
          'textarea,input:not([type]),input[type="text"],input[type="email"],input[type="password"],input[type="search"],input[type="url"],input[type="tel"],input[type="number"],[contenteditable="true"]'
        )
        return textInput ? 'text' : 'default'
      })()`
    )
    .catch(() => 'default')
}

function safeDisplayUrl(value: string): string {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return value.split(/[?#]/, 1)[0]
  }
}
