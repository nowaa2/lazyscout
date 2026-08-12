import { describe, expect, it } from 'vitest'
import { flowToTestCase, generateCypressFromFlow, generatePlaywrightFromFlow } from '@lazyscout/generators'
import type { GuidedFlow } from '@lazyscout/core'

const flow: GuidedFlow = {
  id: 'flow-create-user',
  name: 'Create User',
  baseUrl: 'https://example.com',
  steps: [
    { id: '1', type: 'navigate', path: '/users' },
    { id: '2', type: 'click', target: { strategy: 'role', role: 'button', name: 'Add User' } },
    { id: '3', type: 'fill', target: { strategy: 'label', label: 'Name' }, valueRef: 'TEST_NAME' },
    { id: '4', type: 'click', target: { strategy: 'role', role: 'button', name: 'Save' } },
    { id: '5', type: 'assert', assertion: { type: 'text', value: 'User created' } }
  ]
}

describe('Guided Flow generators', () => {
  it('preserves ordered FlowStep data when creating a Test Case', () => {
    const testCase = flowToTestCase(flow)
    expect(testCase.steps.map((step) => step.type)).toEqual(['navigate', 'click', 'fill', 'click', 'assertText'])
    expect(testCase.steps[2]).toMatchObject({ type: 'fill', value: '{{TEST_NAME}}' })
    expect(testCase.expectedResult).toContain('User created')
  })

  it('generates structured Playwright locators without evaluating code', () => {
    const source = generatePlaywrightFromFlow(flow)
    expect(source).toContain('page.getByRole("button", { name: "Add User" })')
    expect(source).toContain('page.getByLabel("Name", { exact: true }).fill("{{TEST_NAME}}")')
    expect(
      generatePlaywrightFromFlow({
        ...flow,
        steps: [{ id: 'password', type: 'fill', target: { strategy: 'label', label: 'Password' }, value: 'secret' }]
      })
    ).toContain('page.getByLabel("Password", { exact: true }).fill("secret")')
    expect(source).toContain('page.getByText("User created")')
    expect(source).not.toContain('eval(')
    expect(source).not.toContain('new Function')
  })

  it('generates a Cypress source from the same FlowStep model', () => {
    const source = generateCypressFromFlow(flow)
    expect(source).toContain('cy.visit("https://example.com/users")')
    expect(source).toContain('cy.contains("Add User").click()')
    expect(source).toContain('cy.contains("User created").should')
  })

  it('waits for URL navigation instead of asserting the current URL', () => {
    const source = generatePlaywrightFromFlow({
      ...flow,
      steps: [{ id: 'wait-url', type: 'wait', mode: 'url', value: '/dashboard' }]
    })
    expect(source).toContain('await page.waitForURL(new RegExp("/dashboard"))')
    expect(source).not.toContain('toHaveURL')
  })

  it('normalizes copied escaped quotes in CSS locators', () => {
    const source = generatePlaywrightFromFlow({
      ...flow,
      steps: [
        {
          id: 'username',
          type: 'fill',
          target: { strategy: 'css', cssSelector: 'input[name=\\"username\\"]' },
          value: 'demo'
        }
      ]
    })
    expect(source).toContain(`page.locator('input[name="username"]').fill("demo")`)
  })

  it('uses the stable CSS target when an accessible name is duplicated', () => {
    const source = generatePlaywrightFromFlow({
      ...flow,
      steps: [
        {
          id: 'finance',
          type: 'click',
          target: {
            role: 'link',
            name: 'การเงิน',
            cssSelector: 'nav.primary a:nth-of-type(2)',
            matchCount: 2
          }
        }
      ]
    })
    expect(source).toContain("page.locator('nav.primary a:nth-of-type(2)').click()")
    expect(source).not.toContain('getByRole')
  })
})
