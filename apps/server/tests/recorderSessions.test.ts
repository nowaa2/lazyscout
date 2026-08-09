import { afterEach, describe, expect, it } from 'vitest'
import { chromium, type BrowserContext } from 'playwright-core'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RecorderSessions, type RecorderLaunch } from '../src/recorderSessions.js'

const PROJECT = 'project-recorder-test'
const profiles: string[] = []
const contexts: BrowserContext[] = []

/** Same lifecycle as the real launcher, without a visible window. */
async function launchHeadless(): Promise<RecorderLaunch> {
  const profile = await mkdtemp(join(tmpdir(), 'lazyscout-session-'))
  profiles.push(profile)
  const context = await chromium.launchPersistentContext(profile, { headless: true })
  contexts.push(context)
  return { context, label: 'Headless Chromium', close: () => context.close() }
}

afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close().catch(() => undefined)))
  await Promise.all(profiles.splice(0).map((profile) => rm(profile, { recursive: true, force: true })))
})

describe('RecorderSessions', () => {
  it('starts idle and reports recording once started', async () => {
    const sessions = new RecorderSessions(launchHeadless)
    expect(sessions.state(PROJECT).status).toBe('idle')
    expect(sessions.isRunning(PROJECT)).toBe(false)

    const started = await sessions.start(PROJECT, 'about:blank')
    expect(started.status).toBe('recording')
    expect(sessions.isRunning(PROJECT)).toBe(true)

    await sessions.closeAll()
  }, 60_000)

  it('stops on its own when the operator closes the browser window', async () => {
    const sessions = new RecorderSessions(launchHeadless)
    await sessions.start(PROJECT, 'about:blank')

    const context = contexts[contexts.length - 1]
    await Promise.all(context.pages().map((page) => page.close()))
    // Give the close handler a turn before asserting.
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(sessions.state(PROJECT).status).toBe('stopped')
    expect(sessions.isRunning(PROJECT)).toBe(false)
  }, 60_000)

  it('refuses a second recording while one is running and allows one after stop', async () => {
    const sessions = new RecorderSessions(launchHeadless)
    await sessions.start(PROJECT, 'about:blank')
    expect(sessions.isRunning(PROJECT)).toBe(true)

    const stopped = await sessions.stop(PROJECT)
    expect(stopped.status).toBe('stopped')
    expect(sessions.isRunning(PROJECT)).toBe(false)

    const restarted = await sessions.start(PROJECT, 'about:blank')
    expect(restarted.status).toBe('recording')
    await sessions.closeAll()
  }, 90_000)

  it('keeps returning the finished steps after stopping', async () => {
    const sessions = new RecorderSessions(launchHeadless)
    await sessions.start(PROJECT, 'about:blank')
    await sessions.stop(PROJECT)

    const first = sessions.state(PROJECT)
    const second = sessions.state(PROJECT)
    expect(first.status).toBe('stopped')
    expect(second.steps).toEqual(first.steps)
  }, 60_000)

  it('stopping an unknown Project is a no-op', async () => {
    const sessions = new RecorderSessions(launchHeadless)
    expect((await sessions.stop('never-started')).status).toBe('idle')
  })
})
