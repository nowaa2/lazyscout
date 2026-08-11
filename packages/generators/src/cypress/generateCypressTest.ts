import type { TargetRef, TestCase, TestStep } from '@lazyscout/core'

export function generateCypressTest(testCase: TestCase): string {
  const lines = [`describe(${quote(testCase.module)}, () => {`, `  it(${quote(testCase.title)}, () => {`]
  for (const step of testCase.steps) lines.push(`    ${cypressStep(step)}`)
  lines.push('  })', '})', '')
  return lines.join('\n')
}
function locator(target: TargetRef): string {
  const base =
    target.role && target.name
      ? `cy.contains(${quote(target.role)}, ${quote(target.name)})`
      : target.label
        ? `cy.get('label').contains(${quote(target.label)}).invoke('attr', 'for').then((id) => cy.get('#' + id))`
        : target.placeholder
          ? `cy.get(${quote(`[placeholder="${target.placeholder}"]`)})`
          : target.text
            ? `cy.contains(${quote(target.text)})`
            : `cy.get(${quote(target.cssSelector ?? '')})`
  return target.nth === undefined ? base : `${base}.eq(${target.nth})`
}
function cypressStep(step: TestStep): string {
  switch (step.type) {
    case 'navigate':
      return `cy.visit(${quote(step.url)})`
    case 'click':
      return `${locator(step.target)}.click()`
    case 'fill':
      return `${locator(step.target)}.clear().type(${quote(runtimeValue(step))})`
    case 'select':
      return `${locator(step.target)}.select(${quote(step.option)})`
    case 'assertVisible':
      return `${locator(step.target)}.should('be.visible')`
    case 'assertText':
      return step.target
        ? `${locator(step.target)}.should('contain.text', ${quote(step.text)})`
        : `cy.contains(${quote(step.text)}).should('be.visible')`
    case 'assertUrl':
      return `cy.url().should('include', ${quote(step.urlContains)})`
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
