import { describe, expect, it } from 'vitest'
import type { TestCase } from '@lazyscout/core'
import { generatePlaywrightTest } from '@lazyscout/generators'
import { toTargetRef } from '../src/testcases/targets.js'

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
    expect(code).toContain(`page.getByRole("button", { name: "Sign in", exact: true })`)
    expect(code).toContain(`["recorded CSS", page.locator('#submit')]`)
    expect(code.indexOf('getByLabel("Email", { exact: true })')).toBeLessThan(code.indexOf('getByRole("button"'))
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

  it('scopes duplicate controls to their section and selects the matching nth item', () => {
    const duplicateButton: TestCase = {
      ...recordedLogin,
      steps: [
        {
          type: 'click',
          target: {
            role: 'button',
            name: 'Save',
            matchCount: 4,
            nth: 1,
            contextSelector: 'section',
            contextText: 'Billing details'
          }
        }
      ]
    }

    expect(generatePlaywrightTest(duplicateButton)).toContain(
      'page.locator("section").filter({ hasText: "Billing details" }).getByRole("button", { name: "Save", exact: true }).nth(1)'
    )
  })

  it('does not add nth when a unique container already separates the duplicate', () => {
    const target = toTargetRef({
      kind: 'button',
      role: 'button',
      accessibleName: 'Edit',
      tagName: 'button',
      required: false,
      disabled: false,
      cssSelector: '.actions > button',
      matchIndex: 3,
      matchCount: 4,
      scopeIndex: 0,
      scopeMatchCount: 1,
      contextText: 'John Doe',
      contextSelector: '.row'
    })

    expect(target.nth).toBeUndefined()
    expect(generatePlaywrightTest({ ...recordedLogin, steps: [{ type: 'click', target }] })).toContain(
      'page.locator(".row").filter({ hasText: "John Doe" }).getByRole("button", { name: "Edit", exact: true })'
    )
  })

  it('uses an exact accessible name so a short label does not match longer links', () => {
    const courses: TestCase = {
      ...recordedLogin,
      steps: [{ type: 'click', target: { role: 'link', name: 'Courses', cssSelector: 'nav > a' } }]
    }

    expect(generatePlaywrightTest(courses)).toContain('page.getByRole("link", { name: "Courses", exact: true })')
    expect(generatePlaywrightTest(courses)).toContain(`["recorded CSS", page.locator('nav > a')]`)
  })
})
