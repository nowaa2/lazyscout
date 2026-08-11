import type { FormInfo, PageInfo, TargetRef, TestCase, TestStep, UIElement, UIInteraction } from '@lazyscout/core'
import { normalizeUrl } from '@lazyscout/core'
import { labelOf, sampleValueFor, toTargetRef } from './targets.js'

export const UNKNOWN_BEHAVIOUR =
  'Verify that the result is displayed according to application requirements (needs review by tester).'

export type RuleContext = {
  page: PageInfo
  module: string

  visitedTitles: Map<string, string>
}

export type GeneratedTestCase = Omit<TestCase, 'id'>

type DraftTestCase = Omit<TestCase, 'id' | 'module' | 'sourceUrl'>

function build(ctx: RuleContext, draft: DraftTestCase): GeneratedTestCase {
  return {
    module: ctx.module,
    sourceUrl: ctx.page.finalUrl,
    ...draft
  }
}

function pageLabel(page: PageInfo, module: string): string {
  return page.title?.trim() || page.headings[0] || module
}

function precondition(page: PageInfo): string[] {
  try {
    return [`The application is available at ${new URL(page.finalUrl).origin}`]
  } catch {
    return ['The application is available']
  }
}

function navigateStep(page: PageInfo): TestStep {
  return { type: 'navigate', url: page.finalUrl }
}

function isUsable(element: UIElement): boolean {
  return !element.disabled && Boolean(element.accessibleName || element.placeholder)
}

function isToggleField(element: UIElement): boolean {
  return element.inputType === 'checkbox' || element.inputType === 'radio'
}

function fillFieldStep(field: UIElement): TestStep {
  if (isToggleField(field)) {
    return { type: 'click', target: toTargetRef(field), description: `Select "${labelOf(field)}"` }
  }
  if (field.kind === 'select') {
    const option = field.options?.[1] ?? field.options?.[0] ?? ''
    return { type: 'select', target: toTargetRef(field), option }
  }
  return { type: 'fill', target: toTargetRef(field), value: automationValueFor(field) }
}

function automationValueFor(field: UIElement): string {
  const hint =
    `${field.inputType ?? ''} ${field.name ?? ''} ${field.accessibleName ?? ''} ${field.placeholder ?? ''}`.toLowerCase()
  if (field.inputType === 'password' || hint.includes('password') || hint.includes('รหัสผ่าน'))
    return '{{TEST_PASSWORD}}'
  if (field.inputType === 'email' || hint.includes('email') || hint.includes('อีเมล')) return '{{TEST_EMAIL}}'
  if (hint.includes('username') || hint.includes('user name') || hint.includes('ชื่อผู้ใช้')) return '{{TEST_USERNAME}}'
  return sampleValueFor(field)
}

export function pageStructureRule(ctx: RuleContext): GeneratedTestCase[] {
  const { page } = ctx
  const controls = [
    ...page.inputs.filter(isUsable),
    ...page.textareas.filter(isUsable),
    ...page.selects.filter(isUsable),
    ...page.buttons.filter(isUsable),
    ...page.links.filter(isUsable).slice(0, 3)
  ].slice(0, 8)

  if (controls.length === 0) return []

  const steps: TestStep[] = [navigateStep(page)]
  if (page.headings[0]) {
    steps.push({ type: 'assertText', text: page.headings[0] })
  }
  for (const control of controls) {
    steps.push({ type: 'assertVisible', target: toTargetRef(control) })
  }

  return [
    build(ctx, {
      title: `${pageLabel(page, ctx.module)} page displays required controls`,
      preconditions: precondition(page),
      steps,
      expectedResult: `All ${controls.length} controls detected on the page are visible.`,
      type: 'positive',
      priority: 'medium',
      automationStatus: 'ready',
      notes: 'Generated from elements detected on the page.'
    })
  ]
}

export function interactionRule(ctx: RuleContext): GeneratedTestCase[] {
  const interactions = ctx.page.state?.interactions ?? []
  return interactions.slice(0, 12).map((interaction) => {
    const target = interactionTarget(interaction)
    return build(ctx, {
      title: (interaction.name || interaction.kind) + ' interaction works',
      preconditions: precondition(ctx.page),
      steps: [
        navigateStep(ctx.page),
        { type: 'click', target, description: interactionAction(interaction) },
        { type: 'assertVisible', target }
      ],
      expectedResult: interaction.kind + ' "' + (interaction.name || 'control') + '" opens and is usable.',
      type: 'positive',
      priority: 'medium',
      automationStatus: 'needs-review',
      notes: 'Generated from the observed ' + interaction.kind + ' interaction.'
    })
  })
}

function interactionTarget(interaction: UIInteraction): TargetRef {
  return { role: interaction.role, name: interaction.name || undefined, cssSelector: interaction.cssSelector }
}

function interactionAction(interaction: UIInteraction): string {
  const labels: Record<UIInteraction['kind'], string> = {
    dialog: 'Open modal or dialog',
    tab: 'Select tab',
    accordion: 'Expand accordion',
    dropdown: 'Open dropdown',
    drawer: 'Open drawer',
    popover: 'Open popover'
  }
  return labels[interaction.kind]
}

export function requiredFieldRule(ctx: RuleContext, form: FormInfo): GeneratedTestCase[] {
  const submit = form.submitButtons.find((button) => !button.disabled)
  const fields = form.fields.filter(isUsable)

  const testableFields = fields.filter((field) => !isToggleField(field)).slice(0, 5)
  if (!submit || testableFields.length === 0) return []

  return testableFields.map((field) => {
    const steps: TestStep[] = [navigateStep(ctx.page)]

    for (const other of fields) {
      if (other === field) continue
      steps.push(fillFieldStep(other))
    }

    steps.push({
      type: 'manual',
      description: `Leave "${labelOf(field)}" empty`
    })
    steps.push({ type: 'click', target: toTargetRef(submit) })

    return build(ctx, {
      title: `${labelOf(field)} is required`,
      preconditions: precondition(ctx.page),
      steps,
      expectedResult: field.required
        ? 'Verify that a validation message is displayed for the empty required field, and the form is not submitted.'
        : UNKNOWN_BEHAVIOUR,
      type: 'validation',
      priority: field.required ? 'high' : 'medium',
      automationStatus: 'needs-review',
      notes: field.required
        ? 'Evidence: the field has the HTML "required" attribute.'
        : 'No "required" attribute found — confirm with the specification whether this field is mandatory.'
    })
  })
}

export function formSubmitRule(ctx: RuleContext, form: FormInfo): GeneratedTestCase[] {
  const submit = form.submitButtons.find((button) => !button.disabled && !button.destructive)
  const fields = form.fields.filter(isUsable)
  if (!submit || fields.length === 0) return []

  const steps: TestStep[] = [navigateStep(ctx.page)]
  for (const field of fields.slice(0, 8)) {
    steps.push(fillFieldStep(field))
  }
  steps.push({ type: 'click', target: toTargetRef(submit) })

  const formName = form.accessibleName || labelOf(submit)
  const loginForm = isLoginForm(ctx.page, form, fields, submit)
  const expectedPath = form.action ? pathFromAction(ctx.page.finalUrl, form.action) : undefined
  if (loginForm && expectedPath) steps.push({ type: 'assertUrl', urlContains: expectedPath })

  return [
    build(ctx, {
      title: loginForm ? `Login with valid credentials via ${formName}` : `Submit ${formName} with valid data`,
      preconditions: [...precondition(ctx.page), 'Valid test data is prepared'],
      steps,
      expectedResult:
        loginForm && expectedPath
          ? `The form is submitted and the browser navigates to ${expectedPath}.`
          : UNKNOWN_BEHAVIOUR,
      type: 'positive',
      priority: 'high',
      automationStatus: loginForm ? 'ready' : 'needs-data',
      notes: 'Sample values are placeholders — replace them with real test data before running.'
    })
  ]
}

function isLoginForm(page: PageInfo, form: FormInfo, fields: UIElement[], submit: UIElement): boolean {
  const text = [page.finalUrl, page.title, form.name, form.accessibleName, labelOf(submit), ...fields.map(labelOf)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return /login|log in|sign in|signin|password/.test(text) && fields.some((field) => field.inputType === 'password')
}

function pathFromAction(pageUrl: string, action: string): string | undefined {
  try {
    return new URL(action, pageUrl).pathname
  } catch {
    return undefined
  }
}

export function navigationRule(ctx: RuleContext): GeneratedTestCase[] {
  const { page } = ctx
  const seen = new Set<string>()
  const cases: GeneratedTestCase[] = []

  for (const link of page.links) {
    if (cases.length >= 6) break
    if (!link.href || link.disabled || !link.accessibleName) continue
    if (link.destructive) continue

    let target: URL
    try {
      target = new URL(link.href)
    } catch {
      continue
    }
    if (target.origin !== new URL(page.finalUrl).origin) continue
    if (target.pathname === new URL(page.finalUrl).pathname) continue
    if (seen.has(target.pathname)) continue
    seen.add(target.pathname)

    const visitedTitle = ctx.visitedTitles.get(normalizeUrl(target.toString()))

    cases.push(
      build(ctx, {
        title: `Navigate to ${link.accessibleName}`,
        preconditions: precondition(page),
        steps: [
          navigateStep(page),
          { type: 'click', target: toTargetRef(link) },
          { type: 'assertUrl', urlContains: target.pathname }
        ],
        expectedResult: visitedTitle
          ? `The browser navigates to ${target.pathname} and the page "${visitedTitle}" is displayed.`
          : `The browser navigates to ${target.pathname}.`,
        type: 'positive',
        priority: 'low',
        automationStatus: visitedTitle ? 'ready' : 'needs-review',
        notes: visitedTitle ? undefined : 'Explorer did not open this page — expected result needs review.'
      })
    )
  }

  return cases
}

export function destructiveActionRule(ctx: RuleContext): GeneratedTestCase[] {
  const { page } = ctx
  const dangerous = [...page.buttons, ...page.links]
    .filter((element) => element.destructive && element.accessibleName)
    .slice(0, 5)

  const seen = new Set<string>()
  const cases: GeneratedTestCase[] = []

  for (const element of dangerous) {
    if (seen.has(element.accessibleName)) continue
    seen.add(element.accessibleName)

    cases.push(
      build(ctx, {
        title: `Verify "${element.accessibleName}" action (manual)`,
        preconditions: [...precondition(page), 'Disposable test data is prepared'],
        steps: [
          navigateStep(page),
          {
            type: 'manual',
            description: `Manually trigger ${element.role} "${element.accessibleName}" in a safe test environment`
          }
        ],
        expectedResult: UNKNOWN_BEHAVIOUR,
        type: 'positive',
        priority: 'high',
        automationStatus: 'manual',
        notes: 'Detected as a potentially destructive action — Explorer did not click it.'
      })
    )
  }

  return cases
}
