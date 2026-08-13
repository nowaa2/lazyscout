import type { TargetRef, TestCase, TestStep } from '@lazyscout/core'
import { buildLocatorCandidates, describeTarget } from '../locators/candidates.js'

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

const RESOLVE_TIMEOUT_MS = 5000
const RESOLVE_POLL_MS = 100

/**
 * Emitted into every generated spec. Polls the whole candidate list inside one
 * shared budget rather than waiting on each candidate in turn, so a client-side
 * app that has not rendered yet gets time to appear while a fallback locator is
 * still reached quickly.
 */
function locatorResolverSource(): string[] {
  return [
    `async function resolveTarget(page, candidates, description, timeout = ${RESOLVE_TIMEOUT_MS}) {`,
    `  const startedAt = Date.now()`,
    `  let attempts = []`,
    `  do {`,
    `    attempts = []`,
    `    for (const [kind, candidate] of candidates) {`,
    `      try {`,
    `        const count = await candidate.count()`,
    `        if (count !== 1) {`,
    `          attempts.push('- ' + kind + ': ' + count + ' matches')`,
    `          continue`,
    `        }`,
    `        if (!(await candidate.isVisible())) {`,
    `          attempts.push('- ' + kind + ': matched but not visible')`,
    `          continue`,
    `        }`,
    `        console.log('[Locator] ' + description + ' -> ' + kind + ' (' + (Date.now() - startedAt) + 'ms)')`,
    `        return candidate`,
    `      } catch (error) {`,
    `        attempts.push('- ' + kind + ': ' + (error instanceof Error ? error.message : String(error)))`,
    `      }`,
    `    }`,
    `    await page.waitForTimeout(${RESOLVE_POLL_MS})`,
    `  } while (Date.now() - startedAt < timeout)`,
    ``,
    `  const diagnostics = await page`,
    `    .evaluate(() => ({ readyState: document.readyState, title: document.title }))`,
    `    .catch(() => ({ readyState: 'unknown', title: 'unknown' }))`,
    `  throw new Error(`,
    `    'Could not resolve "' + description + '" after ' + (Date.now() - startedAt) + 'ms.\\n' +`,
    `      'URL: ' + page.url() + '\\n' +`,
    `      'Page title: ' + diagnostics.title + '\\n' +`,
    `      'document.readyState: ' + diagnostics.readyState + '\\n' +`,
    `      'Candidates:\\n' + attempts.join('\\n')`,
    `  )`,
    `}`
  ]
}

function locator(target: TargetRef): string {
  const candidates = buildLocatorCandidates(target)
  // An explicitly CSS-strategy target was pinned by the operator, so its
  // recorded selector leads and the ranked candidates follow as fallbacks.
  const ordered =
    target.strategy === 'css'
      ? [...candidates].sort(([left], [right]) => (left === 'recorded CSS' ? -1 : right === 'recorded CSS' ? 1 : 0))
      : candidates
  const list = ordered.map(([kind, value]) => `[${quote(kind)}, ${value}]`).join(', ')
  return `resolveTarget(page, [${list}], ${quote(describeTarget(target))})`
}
function playwrightStep(step: TestStep): string {
  switch (step.type) {
    case 'navigate':
      return `await page.goto(${quote(plainUrl(step.url))})`
    case 'click':
      return `await (await ${locator(step.target)}).click()`
    case 'fill':
      return `await (await ${locator(step.target)}).fill(${quote(step.value)})`
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
      // toContainText requires a Locator; expect(page) has no such matcher.
      return step.target
        ? `await expect(await ${locator(step.target)}).toContainText(${quote(step.text)})`
        : `await expect(page.locator('body')).toContainText(${quote(step.text)})`
    case 'assertUrl':
      return `await expect(page).toHaveURL(new RegExp(${quote(step.urlContains)}))`
    case 'assertInvalid':
      return `expect(await (await ${locator(step.target)}).evaluate((element) => element.matches(':invalid'))).toBe(true)`
    case 'assertValidation':
      return `await expect(page.locator('[role="alert"], [aria-invalid="true"], .error, .errors, .invalid-feedback, #error').filter({ visible: true }).first()).toBeVisible()`
    case 'manual':
      return `// TODO: ${step.description}`
  }
}
const quote = (value: string): string => JSON.stringify(value)

/**
 * Test Cases that arrive from an import, an OCR screenshot or a hand-edited
 * paste sometimes carry a Markdown autolink, `[https://x](https://x)`, whose
 * link text would be navigated to verbatim. Recover the target URL.
 */
export function plainUrl(value: string): string {
  const markdownLink = /^\s*\[([^\]]+)\]\(\s*([^)\s]+)\s*\)\s*$/.exec(value)
  return markdownLink ? markdownLink[2] : value.trim()
}
