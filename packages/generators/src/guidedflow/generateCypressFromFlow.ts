import type { GuidedFlow, FlowStep, TargetRef } from '@lazyscout/core'

export function generateCypressFromFlow(flow: GuidedFlow): string {
  const lines = [`describe(${JSON.stringify(flow.name)}, () => {`, `  it(${JSON.stringify(flow.name)}, () => {`]
  for (const step of flow.steps) lines.push(`    ${cypressFlowStep(flow, step)}`)
  lines.push('  })', '})', '')
  return lines.join('\n')
}

function cypressFlowStep(flow: GuidedFlow, step: FlowStep): string {
  switch (step.type) {
    case 'navigate':
      return `cy.visit(${JSON.stringify(new URL(step.path, flow.baseUrl).toString())})`
    case 'click':
      return `${locator(step.target)}.click()`
    case 'fill':
      return `${locator(step.target)}.clear().type(${JSON.stringify(step.valueRef ? `{{${step.valueRef}}}` : (step.value ?? ''))})`
    case 'select':
      return `${locator(step.target)}.select(${JSON.stringify(step.option)})`
    case 'check':
      return `${locator(step.target)}.${step.checked ? 'check' : 'uncheck'}()`
    case 'wait':
      if (step.mode === 'timeout') return `cy.wait(${Math.min(5000, Math.max(0, Number(step.value) || 0))})`
      if (step.mode === 'url') return `cy.url().should('include', ${JSON.stringify(step.value)})`
      if (step.mode === 'text') return `cy.contains(${JSON.stringify(step.value)}).should('be.visible')`
      return `${locator(step.target!)}.should('be.visible')`
    case 'assert':
      if (step.assertion.type === 'visible') return `${locator(step.assertion.target)}.should('be.visible')`
      if (step.assertion.type === 'text')
        return `cy.contains(${JSON.stringify(step.assertion.value)}).should('be.visible')`
      return `cy.url().should('include', ${JSON.stringify(step.assertion.value)})`
  }
}

function locator(target: TargetRef): string {
  if (target.strategy === 'role' || (target.role && target.name))
    return `cy.contains(${JSON.stringify(target.name ?? target.value ?? '')})`
  if (target.strategy === 'label' || target.label)
    return `cy.get('label').contains(${JSON.stringify(target.label ?? target.value ?? '')})`
  if (target.strategy === 'placeholder' || target.placeholder)
    return `cy.get(${JSON.stringify(`[placeholder="${target.placeholder ?? target.value ?? ''}"]`)})`
  if (target.strategy === 'testid' || target.testId)
    return `cy.get(${JSON.stringify(`[data-testid="${target.testId ?? target.value ?? ''}"]`)})`
  if (target.strategy === 'text' || target.text)
    return `cy.contains(${JSON.stringify(target.text ?? target.value ?? '')})`
  return `cy.get(${JSON.stringify(target.cssSelector ?? target.value ?? '')})`
}
