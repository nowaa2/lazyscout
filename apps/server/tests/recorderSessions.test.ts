import { createServer, type Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium } from 'playwright-core'
import { RecorderSessions } from '../src/recorderSessions.js'

describe('in-app recorder browser', () => {
  let server: Server
  let targetUrl: string

  beforeAll(async () => {
    server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html' }).end(`<!doctype html>
        <input id="username" aria-label="Username" style="position:absolute;left:10px;top:10px;width:200px;height:30px">
        <button id="submit" style="position:absolute;left:10px;top:60px;width:200px;height:30px">Submit</button>
        <input id="password" type="password" aria-label="Password" style="position:absolute;left:10px;top:110px;width:200px;height:30px">`)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Fixture server did not start.')
    targetUrl = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  })

  it('streams a frame and records remote mouse and keyboard input', async () => {
    const sessions = new RecorderSessions(async () => {
      const browser = await chromium.launch({ headless: true })
      const context = await browser.newContext({ viewport: { width: 400, height: 240 } })
      return { context, label: 'Test Chromium', close: () => browser.close() }
    })

    await sessions.start('project-test', targetUrl)
    const frame = await sessions.frame('project-test')
    expect([...frame.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff])

    await sessions.interact('project-test', { type: 'move', x: 50, y: 25 })
    expect(sessions.state('project-test').pointerCursor).toBe('text')
    await sessions.interact('project-test', { type: 'move', x: 50, y: 75 })
    expect(sessions.state('project-test').pointerCursor).toBe('pointer')

    await sessions.interact('project-test', { type: 'click', x: 50, y: 25 })
    await sessions.interact('project-test', { type: 'text', text: 'alex' })
    await sessions.interact('project-test', { type: 'click', x: 50, y: 75 })
    await sessions.interact('project-test', { type: 'click', x: 50, y: 125 })
    await sessions.interact('project-test', { type: 'text', text: 'secret' })
    await sessions.interact('project-test', { type: 'text', text: '-changed' })
    await sessions.interact('project-test', { type: 'click', x: 50, y: 75 })

    const state = sessions.state('project-test')
    expect(state.steps.some((step) => step.type === 'fill' && step.value === 'alex')).toBe(true)
    expect(state.steps.some((step) => step.type === 'click' && step.target.name === 'Submit')).toBe(true)
    expect(state.steps.filter((step) => step.type === 'fill' && step.target.cssSelector === '#password')).toHaveLength(
      1
    )

    await sessions.interact('project-test', { type: 'navigate', url: `${targetUrl}/next` })
    expect(sessions.state('project-test').currentUrl).toBe(`${targetUrl}/next`)
    expect(sessions.state('project-test').steps.at(-1)).toEqual({ type: 'navigate', url: `${targetUrl}/next` })

    await sessions.interact('project-test', { type: 'reload' })
    const navigationSteps = sessions.state('project-test').steps.filter((step) => step.type === 'navigate')
    expect(navigationSteps).toHaveLength(3)
    expect(navigationSteps.at(-1)).toMatchObject({ type: 'navigate', url: `${targetUrl}/next` })

    await sessions.setInspectMode('project-test', true)
    await sessions.interact('project-test', { type: 'move', x: 50, y: 75 })
    expect(sessions.state('project-test').inspection?.accessibleName).toContain('Submit')
    expect(sessions.state('project-test').inspection?.locked).toBe(false)
    await sessions.interact('project-test', { type: 'click', x: 50, y: 75 })
    expect(sessions.state('project-test').inspection?.locked).toBe(true)
    await sessions.interact('project-test', { type: 'move', x: 300, y: 200 })
    expect(sessions.state('project-test').inspection?.accessibleName).toContain('Submit')
    await sessions.interact('project-test', { type: 'click', x: 300, y: 200 })
    expect(sessions.state('project-test').inspection).toBeUndefined()
    await sessions.closeAll()
  }, 60_000)
})
