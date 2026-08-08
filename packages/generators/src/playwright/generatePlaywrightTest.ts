import type { TargetRef, TestCase, TestStep } from '@lazyscout/core'

export function generatePlaywrightTest(testCase: TestCase): string {
  const lines = [`import { test, expect } from '@playwright/test'`, '', `test('${quote(testCase.title)}', async ({ page }) => {`]
  for (const step of testCase.steps) lines.push(`  ${playwrightStep(step)}`)
  lines.push('})', '')
  return lines.join('\n')
}

function locator(target: TargetRef): string {
  if (target.role && target.name) return `page.getByRole(${quote(target.role)}, { name: ${quote(target.name)} })`
  if (target.label) return `page.getByLabel(${quote(target.label)})`
  if (target.placeholder) return `page.getByPlaceholder(${quote(target.placeholder)})`
  if (target.text) return `page.getByText(${quote(target.text)})`
  return `page.locator(${quote(target.cssSelector ?? '')})`
}
function playwrightStep(step: TestStep): string {
  switch (step.type) {
    case 'navigate': return `await page.goto(${quote(step.url)})`
    case 'click': return `await ${locator(step.target)}.click()`
    case 'fill': return `await ${locator(step.target)}.fill(${quote(runtimeValue(step))})`
    case 'select': return `await ${locator(step.target)}.selectOption(${quote(step.option)})`
    case 'assertVisible': return `await expect(${locator(step.target)}).toBeVisible()`
    case 'assertText': return step.target ? `await expect(${locator(step.target)}).toContainText(${quote(step.text)})` : `await expect(page).toContainText(${quote(step.text)})`
    case 'assertUrl': return `await expect(page).toHaveURL(new RegExp(${quote(step.urlContains)}))`
    case 'manual': return `// TODO: ${step.description}`
  }
}
function runtimeValue(step: Extract<TestStep, { type: 'fill' }>): string {
  const hint = `${step.target.name ?? ''} ${step.target.label ?? ''} ${step.target.placeholder ?? ''}`.toLowerCase()
  if (hint.includes('password') || hint.includes('รหัสผ่าน')) return '{{TEST_PASSWORD}}'
  if (hint.includes('email') || hint.includes('อีเมล')) return '{{TEST_EMAIL}}'
  if (hint.includes('username') || hint.includes('user name') || hint.includes('ชื่อผู้ใช้')) return '{{TEST_USERNAME}}'
  return step.value
}
const quote = (value: string): string => JSON.stringify(value)
