import type { TargetRef, TestCase, TestStep } from '@lazyscout/core'

export function generatePlaywrightTest(testCase: TestCase): string {
  const lines = [
    `import { test, expect } from '@playwright/test'`,
    '',
    ...locatorResolverSource(),
    '',
    `test(${quote(testCase.title)}, async ({ page }) => {`
  ]
  for (const step of testCase.steps) lines.push(`  ${playwrightStep(step)}`)
  lines.push('})', '')
  return lines.join('\n')
}

function locatorResolverSource(): string[] {
  return [
    `async function resolveTarget(candidates, description) {`,
    `  const attempts = []`,
    `  for (const [kind, candidate] of candidates) {`,
    `    const count = await candidate.count()`,
    `    if (count !== 1) {`,
    `      attempts.push(kind + ': ' + count + ' matches')`,
    `      continue`,
    `    }`,
    `    if (!(await candidate.isVisible().catch(() => false))) {`,
    `      attempts.push(kind + ': not visible')`,
    `      continue`,
    `    }`,
    `    console.log('[Locator] ' + description + ' -> ' + kind)`,
    `    return candidate`,
    `  }`,
    `  throw new Error('Could not continue at "' + description + '" because the element was not found as one visible, unique target. The page may have changed or an earlier step may have opened a different page. Technical details: ' + attempts.join('; '))`,
    `}`
  ]
}

function locator(target: TargetRef): string {
  const semantic =
    target.role && target.name
      ? `page.getByRole(${quote(target.role)}, { name: ${quote(target.name)}, exact: true })`
      : target.label
        ? `page.getByLabel(${quote(target.label)}, { exact: true })`
        : target.testId
          ? `page.getByTestId(${quote(target.testId)})`
          : target.placeholder
            ? `page.getByPlaceholder(${quote(target.placeholder)})`
            : target.text
              ? `page.getByText(${quote(target.text)})`
              : `page.locator(${quoteCssSelector(normalizeCssSelector(target.cssSelector ?? ''))})`
  const context = target.contextTestId
    ? `page.getByTestId(${quote(target.contextTestId)})`
    : target.contextSelector
      ? `page.locator(${quote(target.contextSelector)})`
      : undefined
  const scopedSemantic = context
    ? target.contextText
      ? `${context}.filter({ hasText: ${quote(target.contextText)} }).${semantic.slice(5)}`
      : `${context}.${semantic.slice(5)}`
    : semantic
  const primary = target.nth === undefined ? scopedSemantic : `${scopedSemantic}.nth(${target.nth})`
  const css = target.cssSelector
    ? `page.locator(${quoteCssSelector(normalizeCssSelector(target.cssSelector))})`
    : undefined
  const candidates: Array<[string, string]> = []
  if (target.strategy === 'css' && css) candidates.push(['recorded CSS', css])
  candidates.push(['semantic locator', primary])
  if (css && !candidates.some(([, value]) => value === css)) candidates.push(['recorded CSS', css])
  const description = target.name ?? target.label ?? target.placeholder ?? target.text ?? target.cssSelector ?? 'target'
  return `resolveTarget([${candidates.map(([kind, value]) => `[${quote(kind)}, ${value}]`).join(', ')}], ${quote(description)})`
}
function playwrightStep(step: TestStep): string {
  switch (step.type) {
    case 'navigate':
      return `await page.goto(${quote(step.url)})`
    case 'click':
      return `await (await ${locator(step.target)}).click()`
    case 'fill':
      return `await (await ${locator(step.target)}).fill(${quote(runtimeValue(step))})`
    case 'select':
      return `await (await ${locator(step.target)}).selectOption(${quote(step.option)})`
    case 'check':
      return `await (await ${locator(step.target)}).${step.checked ? 'check' : 'uncheck'}()`
    case 'wait':
      if (step.mode === 'timeout')
        return `await page.waitForTimeout(${Math.min(5000, Math.max(0, Number(step.value) || 0))})`
      if (step.mode === 'url') return `await page.waitForURL(new RegExp(${quote(step.value)}))`
      if (step.mode === 'text') return `await expect(page).toContainText(${quote(step.value)})`
      return `await expect(await ${locator(step.target!)}).toBeVisible()`
    case 'assertVisible':
      return `await expect(await ${locator(step.target)}).toBeVisible()`
    case 'assertText':
      return step.target
        ? `await expect(await ${locator(step.target)}).toContainText(${quote(step.text)})`
        : `await expect(page).toContainText(${quote(step.text)})`
    case 'assertUrl':
      return `await expect(page).toHaveURL(new RegExp(${quote(step.urlContains)}))`
    case 'manual':
      return `// TODO: ${step.description}`
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

function normalizeCssSelector(value: string): string {
  return value.replace(/\\(["'])/g, '$1')
}

function quoteCssSelector(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}
