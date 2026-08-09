import { describe, expect, it } from 'vitest'
import type { TestCase } from '@lazyscout/core'
import { generatePlaywrightTest } from '@lazyscout/generators'

/** A login flow shaped exactly as the recorder emits it. */
const recordedLogin: TestCase = {
  id: 'TC-LOGIN-001',
  module: 'LOGIN',
  title: 'Recorded login',
  preconditions: [],
  expectedResult: 'The recorded flow completes without an error.',
  type: 'positive',
  priority: 'medium',
  automationStatus: 'needs-review',
  sourceUrl: 'http://localhost:5500/login',
  steps: [
    { type: 'navigate', url: 'http://localhost:5500/login' },
    { type: 'fill', target: { role: 'textbox', label: 'Email', cssSelector: '#email' }, value: 'qa@example.com' },
    {
      type: 'fill',
      target: { role: 'textbox', label: 'Password', cssSelector: '#password' },
      value: '{{TEST_PASSWORD}}'
    },
    { type: 'click', target: { role: 'button', name: 'Sign in', cssSelector: '#submit' } }
  ]
}

describe('generatePlaywrightTest for a recorded flow', () => {
  const code = generatePlaywrightTest(recordedLogin)

  it('replays the recorded steps in order', () => {
    expect(code).toContain(`await page.goto("http://localhost:5500/login")`)
    expect(code).toContain(`await page.getByRole("button", { name: "Sign in" }).click()`)
    expect(code.indexOf('getByLabel("Email")')).toBeLessThan(code.indexOf('getByRole("button"'))
  })

  it('keeps the password as a placeholder instead of a literal', () => {
    expect(code).toContain('{{TEST_PASSWORD}}')
    expect(code).not.toContain('hunter2')
  })

  it('leaves an unrecognised password field as a placeholder too', () => {
    const unlabelled: TestCase = {
      ...recordedLogin,
      steps: [{ type: 'fill', target: { cssSelector: '#pw' }, value: '{{TEST_PASSWORD}}' }]
    }
    expect(generatePlaywrightTest(unlabelled)).toContain('{{TEST_PASSWORD}}')
  })
})
