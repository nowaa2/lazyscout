import type { GuidedFlow, FlowStep, TargetRef } from '@lazyscout/core'

export function generatePlaywrightFromFlow(flow: GuidedFlow): string {
  const lines = [
    `import { test, expect } from '@playwright/test'`,
    '',
    `test(${JSON.stringify(flow.name)}, async ({ page }) => {`
  ]
  for (const step of flow.steps) lines.push(`  ${playwrightFlowStep(flow, step)}`)
  lines.push('})', '')
  return lines.join('\n')
}

function playwrightFlowStep(flow: GuidedFlow, step: FlowStep): string {
  switch (step.type) {
    case 'navigate':
      return `await page.goto(${JSON.stringify(new URL(step.path, flow.baseUrl).toString())})`
    case 'click':
      return `await ${locator(step.target)}.click()`
    case 'fill':
      return `await ${locator(step.target)}.fill(${JSON.stringify(step.valueRef ? `{{${step.valueRef}}}` : (step.value ?? ''))})`
    case 'select':
      return `await ${locator(step.target)}.selectOption(${JSON.stringify(step.option)})`
    case 'check':
      return `await ${locator(step.target)}.${step.checked ? 'check' : 'uncheck'}()`
    case 'wait':
      if (step.mode === 'timeout')
        return `await page.waitForTimeout(${Math.min(5000, Math.max(0, Number(step.value) || 0))})`
      if (step.mode === 'url') return `await expect(page).toHaveURL(new RegExp(${JSON.stringify(step.value)}))`
      if (step.mode === 'text') return `await expect(page).toContainText(${JSON.stringify(step.value)})`
      return `await expect(${locator(step.target!)}).toBeVisible()`
    case 'assert':
      if (step.assertion.type === 'visible') return `await expect(${locator(step.assertion.target)}).toBeVisible()`
      if (step.assertion.type === 'text')
        return `await expect(page.getByText(${JSON.stringify(step.assertion.value)})).toBeVisible()`
      return `await expect(page).toHaveURL(new RegExp(${JSON.stringify(step.assertion.value)}))`
  }
}

function locator(target: TargetRef): string {
  if (target.strategy === 'role' || (target.role && target.name))
    return `page.getByRole(${JSON.stringify(target.role ?? 'generic')}, { name: ${JSON.stringify(target.name ?? target.value ?? '')}${target.exact ? ', exact: true' : ''} })`
  if (target.strategy === 'label' || target.label)
    return `page.getByLabel(${JSON.stringify(target.label ?? target.value ?? '')}, { exact: true })`
  if (target.strategy === 'placeholder' || target.placeholder)
    return `page.getByPlaceholder(${JSON.stringify(target.placeholder ?? target.value ?? '')})`
  if (target.strategy === 'testid' || target.testId)
    return `page.getByTestId(${JSON.stringify(target.testId ?? target.value ?? '')})`
  if (target.strategy === 'text' || target.text)
    return `page.getByText(${JSON.stringify(target.text ?? target.value ?? '')})`
  return `page.locator(${JSON.stringify(target.cssSelector ?? target.value ?? '')})`
}
