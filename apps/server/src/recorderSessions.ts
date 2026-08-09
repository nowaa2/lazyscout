import type { RecorderState, TestStep } from '@lazyscout/core'
import { attachRecorder, type RecorderHandle } from '@lazyscout/explorer'
import type { BrowserContext } from 'playwright-core'

export type RecorderLaunch = {
  context: BrowserContext
  label: string
  close: () => Promise<void>
}

/** Injected so tests can drive the lifecycle without a visible browser. */
export type LaunchRecorderBrowser = (projectId: string) => Promise<RecorderLaunch>

type Session = {
  projectId: string
  startUrl: string
  startedAt: string
  browserLabel: string
  handle: RecorderHandle
  close: () => Promise<void>
  closed: boolean
  finalSteps?: TestStep[]
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
      steps: session.finalSteps ?? session.handle.steps()
    }
  }

  async start(projectId: string, startUrl: string): Promise<RecorderState> {
    const launched = await this.launch(projectId)

    // Registered before the first navigation so the session can never be left
    // recording when the operator closes the window straight away.
    const handle = await attachRecorder(launched.context, startUrl, {
      onEnded: () => {
        const current = this.sessions.get(projectId)
        if (current) void this.finish(current)
      }
    })

    const session: Session = {
      projectId,
      startUrl,
      startedAt: new Date().toISOString(),
      browserLabel: launched.label,
      handle,
      close: launched.close,
      closed: false
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
}
