import type { TargetRef, TestStep } from '../types/testcase.js'

export function describeTarget(target: TargetRef): string {
  const name = target.name || target.label || target.text || target.placeholder
  if (name && target.role) return `${target.role} "${name}"`
  if (name) return `"${name}"`
  if (target.cssSelector) return `element (${target.cssSelector})`
  return 'element'
}

export function describeStep(step: TestStep): string {
  if (step.description) return step.description

  switch (step.type) {
    case 'navigate':
      return `Navigate to ${step.url}`
    case 'click':
      return `Click ${describeTarget(step.target)}`
    case 'fill':
      return `Enter "${step.value}" in ${describeTarget(step.target)}`
    case 'select':
      return `Select "${step.option}" from ${describeTarget(step.target)}`
    case 'check':
      return `${step.checked ? 'Check' : 'Uncheck'} ${describeTarget(step.target)}`
    case 'wait':
      return `Wait for ${step.mode}: ${step.value}`
    case 'assertVisible':
      return `Verify that ${describeTarget(step.target)} is visible`
    case 'assertText':
      return step.target
        ? `Verify that ${describeTarget(step.target)} shows "${step.text}"`
        : `Verify that the page shows "${step.text}"`
    case 'assertUrl':
      return `Verify that the URL contains "${step.urlContains}"`
    case 'assertInvalid':
      return `Verify that ${describeTarget(step.target)} is invalid and the form remains open`
    case 'assertValidation':
      return 'Wait for a visible validation or error message'
    case 'manual':
      return step.description
  }
}

export function describeSteps(steps: TestStep[]): string {
  return steps.map((step, index) => `${index + 1}. ${describeStep(step)}`).join('\n')
}
