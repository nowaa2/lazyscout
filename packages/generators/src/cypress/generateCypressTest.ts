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
      return `${locator(step.target)}.clear().type(${quote(step.value)})`
    case 'select':
      return `${locator(step.target)}.select(${quote(step.option)})`
    case 'check':
      return `${locator(step.target)}.${step.checked ? 'check' : 'uncheck'}()`
    case 'wait':
      if (step.mode === 'timeout') return `cy.wait(${Math.min(5000, Math.max(0, Number(step.value) || 0))})`
      if (step.mode === 'url') return `cy.url().should('include', ${quote(step.value)})`
      if (step.mode === 'text') return `cy.contains(${quote(step.value)}).should('be.visible')`
      return `${locator(step.target!)}.should('be.visible')`
    case 'assertVisible':
      return `${locator(step.target)}.should('be.visible')`
    case 'assertText':
      return step.target
        ? `${locator(step.target)}.should('contain.text', ${quote(step.text)})`
        : `cy.contains(${quote(step.text)}).should('be.visible')`
    case 'assertUrl':
      return `cy.url().should('include', ${quote(step.urlContains)})`
    case 'assertInvalid':
      return `${locator(step.target)}.should('be.invalid')`
    case 'assertValidation':
      return `cy.get('[role="alert"], [aria-invalid="true"], .error, .errors, .invalid-feedback, #error').filter(':visible').first().should('be.visible')`
    case 'manual':
      return `// TODO: ${step.description}`
  }
}
const quote = (value: string): string => JSON.stringify(value)
