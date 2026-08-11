import type { GuidedFlow, FlowStep, TestCase, TestStep } from '@lazyscout/core'

export function flowToTestCase(flow: GuidedFlow): TestCase {
  const steps = flow.steps.map((step) => flowStepToTestStep(flow, step))
  const assertion = flow.steps.find((step) => step.type === 'assert')
  const expectedResult =
    assertion?.type === 'assert' && assertion.assertion.type === 'text'
      ? `The page shows "${assertion.assertion.value}".`
      : assertion?.type === 'assert' && assertion.assertion.type === 'url'
        ? `The URL contains "${assertion.assertion.value}".`
        : assertion?.type === 'assert'
          ? 'The expected element is visible.'
          : 'Needs Review'
  return {
    id: `TC-FLOW-${flow.id.slice(-8).toUpperCase()}`,
    module: 'FLOW',
    title: flow.name,
    preconditions: flow.description ? [flow.description] : [],
    steps,
    expectedResult,
    type: 'positive',
    priority: 'medium',
    automationStatus: steps.length ? 'ready' : 'needs-review',
    status: 'pending',
    sourceUrl: flow.baseUrl,
    notes: assertion ? undefined : 'Guided Flow has no assertion — expected result needs review.'
  }
}

export function flowStepToTestStep(flow: GuidedFlow, step: FlowStep): TestStep {
  switch (step.type) {
    case 'navigate':
      return { type: 'navigate', url: new URL(step.path, flow.baseUrl).toString() }
    case 'click':
      return { type: 'click', target: step.target }
    case 'fill':
      return {
        type: 'fill',
        target: step.target,
        value: step.valueRef ? `{{${step.valueRef}}}` : (step.value ?? '')
      }
    case 'select':
      return { type: 'select', target: step.target, option: step.option }
    case 'check':
      return { type: 'check', target: step.target, checked: step.checked }
    case 'wait':
      return { type: 'wait', mode: step.mode, value: step.value, target: step.target }
    case 'assert':
      if (step.assertion.type === 'visible') return { type: 'assertVisible', target: step.assertion.target }
      if (step.assertion.type === 'text') return { type: 'assertText', text: step.assertion.value }
      return { type: 'assertUrl', urlContains: step.assertion.value }
  }
}
