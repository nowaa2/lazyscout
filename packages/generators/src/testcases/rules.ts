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

  const testableFields = fields.filter((field) => !isToggleField(field)).slice(0, 12)
  if (!submit || testableFields.length === 0) return []

  return testableFields.map((field) => {
    const steps: TestStep[] = [navigateStep(ctx.page)]

    for (const other of fields) {
      if (other === field) continue
      steps.push(fillFieldStep(other))
    }

    if (field.required) {
      steps.push({ type: 'click', target: toTargetRef(submit) })
      steps.push({
        type: 'assertInvalid',
        target: toTargetRef(field),
        description: `Verify that "${labelOf(field)}" is invalid and the form is not submitted`
      })
    } else {
      steps.push({
        type: 'manual',
        description: `Verify whether "${labelOf(field)}" may be empty according to the product requirement`
      })
    }

    return build(ctx, {
      title: field.required ? `${labelOf(field)} is required` : `${labelOf(field)} handles empty input`,
      preconditions: precondition(ctx.page),
      steps,
      expectedResult: field.required
        ? 'A required-field validation is displayed and the form is not submitted.'
        : `${labelOf(field)} accepts or rejects empty input according to the product requirement.`,
      type: 'validation',
      priority: field.required ? 'high' : 'medium',
      automationStatus: field.required ? 'ready' : 'needs-review',
      tags: ['validation', field.required ? 'required' : 'empty-input'],
      notes: field.required
        ? 'Evidence: the field has the HTML "required" attribute. Playwright waits for the field to become invalid.'
        : 'No required attribute was detected. Confirm whether an empty value is allowed before automating submission.'
    })
  })
}

type ValidationScenario = {
  title: string
  value: string
  expectedResult: string
  notes: string
  automationStatus?: TestCase['automationStatus']
  manualCheck?: string
}

export function validationMatrixRule(ctx: RuleContext, form: FormInfo): GeneratedTestCase[] {
  const submit = form.submitButtons.find((button) => !button.disabled && !button.destructive)
  const fields = form.fields.filter(isUsable)
  if (!submit) return []

  const cases: GeneratedTestCase[] = []
  for (const field of fields.slice(0, 12)) {
    for (const scenario of validationScenarios(field).slice(0, 8)) {
      const steps: TestStep[] = [navigateStep(ctx.page)]
      for (const other of fields) {
        if (other === field) continue
        steps.push(fillFieldStep(other))
      }
      steps.push({ type: 'fill', target: toTargetRef(field), value: scenario.value })
      steps.push({ type: 'click', target: toTargetRef(submit) })
      if (scenario.manualCheck) {
        steps.push({ type: 'wait', mode: 'timeout', value: '750' })
        steps.push({ type: 'manual', description: scenario.manualCheck })
      } else {
        steps.push({ type: 'assertInvalid', target: toTargetRef(field) })
      }
      cases.push(
        build(ctx, {
          title: `${labelOf(field)} ${scenario.title}`,
          preconditions: precondition(ctx.page),
          steps,
          expectedResult: scenario.expectedResult,
          type: 'validation',
          priority: 'high',
          automationStatus: scenario.automationStatus ?? 'ready',
          tags: ['validation', 'generated-matrix'],
          notes: scenario.notes
        })
      )
    }
  }
  return cases
}

export function loginFailureRule(ctx: RuleContext, form: FormInfo): GeneratedTestCase[] {
  const submit = form.submitButtons.find((button) => !button.disabled && !button.destructive)
  const fields = form.fields.filter(isUsable)
  if (!submit || !isLoginForm(ctx.page, form, fields, submit)) return []

  const username = fields.find((field) => {
    const hint = `${field.name ?? ''} ${field.accessibleName} ${field.autocomplete ?? ''}`.toLowerCase()
    return /username|user name|email|อีเมล|ชื่อผู้ใช้/.test(hint) && field.inputType !== 'password'
  })
  const password = fields.find((field) => field.inputType === 'password')
  const scenarios = [
    username &&
      !username.required && {
        field: username,
        value: '',
        title: 'Reject empty username',
        expected: 'The application keeps the user signed out and displays a username validation error.'
      },
    password &&
      !password.required && {
        field: password,
        value: '',
        title: 'Reject empty password',
        expected: 'The application keeps the user signed out and displays a password validation error.'
      },
    username && {
      field: username,
      value: username.inputType === 'email' ? 'lazyscout.invalid@example.com' : 'lazyscout-invalid-user',
      title: 'Reject invalid username',
      expected: 'The application keeps the user signed out and displays an authentication error.'
    },
    password && {
      field: password,
      value: 'LazyScout-Wrong-Password-123!',
      title: 'Reject invalid password',
      expected: 'The application keeps the user signed out and displays an authentication error.'
    }
  ].filter(Boolean) as Array<{ field: UIElement; value: string; title: string; expected: string }>

  return scenarios.map((scenario) => {
    const steps: TestStep[] = [navigateStep(ctx.page)]
    for (const field of fields) {
      steps.push(
        field === scenario.field
          ? { type: 'fill', target: toTargetRef(field), value: scenario.value }
          : fillFieldStep(field)
      )
    }
    steps.push({ type: 'click', target: toTargetRef(submit) })
    steps.push({ type: 'assertValidation' })
    return build(ctx, {
      title: scenario.title,
      preconditions: [
        ...precondition(ctx.page),
        'Use a test environment where failed logins cannot lock a real account'
      ],
      steps,
      expectedResult: scenario.expected,
      type: 'negative',
      priority: 'high',
      automationStatus: 'needs-review',
      tags: ['login', 'negative', 'server-validation'],
      notes: 'Runs one failed login attempt only. Review the observed server message before marking this case ready.'
    })
  })
}

function validationScenarios(field: UIElement): ValidationScenario[] {
  if (field.kind === 'select' || isToggleField(field)) return []
  const label = labelOf(field)
  const scenarios: ValidationScenario[] = []
  if (field.inputType === 'email')
    scenarios.push({
      title: 'rejects an invalid email format',
      value: 'invalid-email',
      expectedResult: `${label} is marked invalid and the form is not submitted.`,
      notes: 'Generated from input type="email".'
    })
  if (field.inputType === 'url')
    scenarios.push({
      title: 'rejects an invalid URL format',
      value: 'not-a-url',
      expectedResult: `${label} is marked invalid and the form is not submitted.`,
      notes: 'Generated from input type="url".'
    })
  if (field.required && isTextLikeField(field))
    scenarios.push({
      title: 'handles whitespace-only input',
      value: '   ',
      expectedResult: `${label} rejects whitespace-only input when meaningful text is required.`,
      notes: 'HTML required accepts whitespace. Review this case against the product rule and the displayed message.',
      automationStatus: 'needs-review',
      manualCheck: `Verify whether ${label} rejects whitespace-only input and shows the correct validation message`
    })
  if (isUsernameField(field)) {
    scenarios.push(
      {
        title: 'handles characters from another writing system',
        value: 'ผู้ใช้ทดสอบ',
        expectedResult: `${label} accepts or rejects characters from another writing system according to the username policy.`,
        notes:
          'No username character policy is inferred unless the HTML exposes a pattern. Review the result against requirements.',
        automationStatus: 'needs-review',
        manualCheck: `Verify the username character policy and the validation message shown for ${label}`
      },
      {
        title: 'handles special characters',
        value: 'user!@#$',
        expectedResult: `${label} accepts or rejects special characters according to the username policy.`,
        notes: 'Generated as a business-rule review because HTML may not expose the server username policy.',
        automationStatus: 'needs-review',
        manualCheck: `Verify whether ${label} permits special characters and shows the correct validation message`
      }
    )
  }
  if (field.minLength && field.minLength > 0)
    scenarios.push({
      title: `rejects fewer than ${field.minLength} characters`,
      value: 'a'.repeat(Math.max(0, field.minLength - 1)),
      expectedResult: `${label} remains invalid below the minimum length of ${field.minLength}.`,
      notes: `Generated from minlength="${field.minLength}".`
    })
  if (field.pattern) {
    const mismatch = patternMismatch(field.pattern)
    if (mismatch)
      scenarios.push({
        title: 'rejects a value outside the required pattern',
        value: mismatch,
        expectedResult: `${label} remains invalid when its pattern is not satisfied.`,
        notes: `Generated from pattern="${field.pattern}".`
      })
  }
  if (field.inputType === 'number' && field.min !== undefined) {
    const min = Number(field.min)
    if (Number.isFinite(min))
      scenarios.push({
        title: `rejects a value below ${field.min}`,
        value: String(min - 1),
        expectedResult: `${label} remains invalid below the minimum value ${field.min}.`,
        notes: `Generated from min="${field.min}".`
      })
  }
  if (field.inputType === 'number' && field.max !== undefined) {
    const max = Number(field.max)
    if (Number.isFinite(max))
      scenarios.push({
        title: `rejects a value above ${field.max}`,
        value: String(max + 1),
        expectedResult: `${label} remains invalid above the maximum value ${field.max}.`,
        notes: `Generated from max="${field.max}".`
      })
  }
  if (field.maxLength && field.maxLength > 0)
    scenarios.push({
      title: `handles more than ${field.maxLength} characters`,
      value: 'A'.repeat(Math.min(field.maxLength + 1, 256)),
      expectedResult: `${label} prevents or rejects input above ${field.maxLength} characters.`,
      notes: `Generated from maxlength="${field.maxLength}". Browser behavior can truncate typed input, so review the result.`,
      automationStatus: 'needs-review',
      manualCheck: `Verify that ${label} does not accept more than ${field.maxLength} characters`
    })
  if (field.inputType === 'password') scenarios.push(...passwordPolicyScenarios(field))
  return uniqueScenarios(scenarios)
}

function passwordPolicyScenarios(field: UIElement): ValidationScenario[] {
  const pattern = field.pattern ?? ''
  const requirements: Array<[(pattern: string) => boolean, string, string]> = [
    [(value) => /\[A-Z\]|\\p\{Lu\}/.test(value), 'rejects a password without an uppercase letter', 'lowercase123!'],
    [(value) => /\[a-z\]|\\p\{Ll\}/.test(value), 'rejects a password without a lowercase letter', 'UPPERCASE123!'],
    [(value) => /\\d|\[0-9\]/.test(value), 'rejects a password without a number', 'NoNumbersHere!'],
    [
      (value) => /\\W|special|symbol|\[[^\]]*[!@#$%^&][^\]]*\]/i.test(value),
      'rejects a password without a special character',
      'NoSpecial123'
    ]
  ]
  const scenarios: ValidationScenario[] = []
  for (const [hasRequirement, title, value] of requirements) {
    if (!hasRequirement(pattern)) continue
    scenarios.push({
      title,
      value,
      expectedResult: `${labelOf(field)} remains invalid until the password policy is satisfied.`,
      notes: `Generated from the password pattern="${pattern}".`
    })
  }
  if (!field.minLength && !field.maxLength && !field.pattern)
    scenarios.push({
      title: 'policy requires specification review',
      value: 'password',
      expectedResult: 'Confirm whether uppercase, lowercase, number, special-character, and length rules are required.',
      notes: 'No minlength, maxlength, or pattern was found in the HTML. LazyScout does not invent a password policy.',
      automationStatus: 'needs-review',
      manualCheck: 'Review the password policy with the product requirement and verify the displayed validation message'
    })
  return scenarios
}

function isTextLikeField(field: UIElement): boolean {
  return !field.inputType || ['text', 'search', 'email', 'url', 'tel', 'password'].includes(field.inputType)
}

function isUsernameField(field: UIElement): boolean {
  const hint =
    `${field.name ?? ''} ${field.accessibleName ?? ''} ${field.placeholder ?? ''} ${field.autocomplete ?? ''}`.toLowerCase()
  return /username|user name|ชื่อผู้ใช้/.test(hint)
}

function patternMismatch(pattern: string): string | undefined {
  try {
    const expression = new RegExp(`^(?:${pattern})$`, 'u')
    return ['!', 'invalid', 'abc', '123', 'lowercase', 'UPPERCASE'].find((candidate) => !expression.test(candidate))
  } catch {
    return undefined
  }
}

function uniqueScenarios(scenarios: ValidationScenario[]): ValidationScenario[] {
  const seen = new Set<string>()
  return scenarios.filter((scenario) => {
    const key = `${scenario.title}|${scenario.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
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
