import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type BrowserContext } from 'playwright-core'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { attachRecorder } from '../src/recorder/attachRecorder.js'

/**
 * A persistent context outlives its last window, so closing the browser does
 * not emit context 'close'. Without page-level tracking the server would stay
 * in the recording state forever and the UI would poll without end.
 */
describe('recorder session ends when the operator closes the browser', () => {
  let profile: string
  let context: BrowserContext

  beforeAll(async () => {
    profile = await mkdtemp(join(tmpdir(), 'lazyscout-recorder-'))
    context = await chromium.launchPersistentContext(profile, { headless: true })
  }, 60_000)

  afterAll(async () => {
    await context.close().catch(() => undefined)
    await rm(profile, { recursive: true, force: true })
  })

  it('reports the end once the last page is closed, and only once', async () => {
    let ended = 0
    await attachRecorder(context, 'about:blank', { onEnded: () => (ended += 1) })

    const first = context.pages()[0] ?? (await context.newPage())
    const second = await context.newPage()
    expect(ended).toBe(0)

    await second.close()
    expect(ended).toBe(0)

    await first.close()
    expect(ended).toBe(1)

    // Closing the context afterwards must not report a second ending.
    await context.close()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(ended).toBe(1)
  }, 60_000)
})
