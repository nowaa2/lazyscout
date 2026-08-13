import { describe, expect, it } from 'vitest'
import type { TargetRef, TestCase } from '@lazyscout/core'
import { buildLocatorCandidates, generatePlaywrightTest, plainUrl } from '../src/index.js'

/**
 * <input id="username" data-test="input:username" name="username" placeholder="ชื่อผู้ใช้">
 */
const username: TargetRef = {
  role: 'textbox',
  placeholder: 'ชื่อผู้ใช้',
  testId: 'input:username',
  testIdAttribute: 'data-test',
  elementId: 'username',
  attributeName: 'username',
  tagName: 'input',
  cssSelector: '#username'
}

const expressions = (target: TargetRef): string[] => buildLocatorCandidates(target).map(([, value]) => value)
const kinds = (target: TargetRef): string[] => buildLocatorCandidates(target).map(([kind]) => kind)

describe('locator candidates', () => {
  it('keeps the automation attribute the page actually uses', () => {
    expect(expressions(username)).toContain(`page.locator('[data-test="input:username"]')`)
    expect(expressions(username).join(' ')).not.toContain('data-testid')
    expect(expressions(username).join(' ')).not.toContain('getByTestId')
  })

  it('does not escape a colon inside an attribute value', () => {
    expect(expressions(username).join(' ')).not.toContain('input\\:username')
  })

  it('still uses getByTestId when the attribute is Playwright default', () => {
    expect(expressions({ testId: 'a', testIdAttribute: 'data-testid' })).toContain(`page.getByTestId("a")`)
    expect(expressions({ testId: 'a' })).toContain(`page.getByTestId("a")`)
  })

  it('offers every recorded way of addressing the element', () => {
    expect(expressions(username)).toEqual([
      `page.locator('[data-test="input:username"]')`,
      `page.locator('#username')`,
      `page.getByPlaceholder("ชื่อผู้ใช้")`,
      `page.locator('input[name="username"]')`
    ])
  })

  it('ranks explicit automation attributes above semantic and structural locators', () => {
    expect(kinds({ ...username, cssSelector: 'div > form > div:nth-child(2) > input' })).toEqual([
      'data-test',
      'id',
      'semantic locator',
      'name',
      'recorded CSS'
    ])
  })

  it('never uses a generated build attribute as a locator', () => {
    expect(expressions({ cssSelector: '[data-v-98c615fa]', elementId: 'x' })).toEqual([`page.locator('#x')`])
  })

  it('skips ids that look generated per render', () => {
    expect(expressions({ elementId: 'input-1734029384', attributeName: 'q', tagName: 'input' })).toEqual([
      `page.locator('input[name="q"]')`
    ])
  })

  it('emits no duplicate candidates', () => {
    const values = expressions({ strategy: 'css', cssSelector: 'input[name="username"]' })
    expect(values).toEqual([...new Set(values)])
  })

  it('always produces at least one candidate', () => {
    expect(buildLocatorCandidates({ cssSelector: 'div > span' })).toHaveLength(1)
  })
})

describe('generated Playwright source', () => {
  const build = (steps: TestCase['steps']): string =>
    generatePlaywrightTest({
      id: 'TC-1',
      module: 'M',
      title: 'Login',
      preconditions: [],
      steps,
      expectedResult: 'ok',
      type: 'positive',
      priority: 'high',
      automationStatus: 'ready'
    })

  it('passes page into the resolver so it can report diagnostics', () => {
    expect(build([{ type: 'click', target: username }])).toContain('resolveTarget(page, [')
  })

  it('polls every candidate inside one shared budget instead of failing once', () => {
    const source = build([{ type: 'click', target: username }])
    expect(source).toContain('while (Date.now() - startedAt < timeout)')
    expect(source).toContain('for (const [kind, candidate] of candidates)')
    // The loop must wrap the candidate sweep, not a single candidate.
    expect(source.indexOf('do {')).toBeLessThan(source.indexOf('for (const [kind, candidate]'))
  })

  it('reports url, elapsed time, readyState and each candidate when it gives up', () => {
    const source = build([{ type: 'click', target: username }])
    for (const detail of ['URL: ', 'document.readyState: ', 'Page title: ', 'Candidates:', 'after ']) {
      expect(source).toContain(detail)
    }
  })

  it('navigates to a raw URL when the step carries a Markdown autolink', () => {
    const source = build([{ type: 'navigate', url: '[https://e.com/l](https://e.com/l)' }])
    expect(source).toContain(`await page.goto("https://e.com/l")`)
    expect(source).not.toContain('](')
  })

  it('keeps template variables inside a quoted string', () => {
    const source = build([{ type: 'fill', target: username, value: '{{TEST_USERNAME}}' }])
    expect(source).toContain(`.fill("{{TEST_USERNAME}}")`)
  })

  it('serializes selectors and values as valid TypeScript literals', () => {
    const source = build([
      { type: 'fill', target: { strategy: 'css', cssSelector: 'input[name="a"]' }, value: 'say "hi" \\ done' }
    ])
    expect(source).toContain(`page.locator('input[name="a"]')`)
    expect(source).toContain(`.fill("say \\"hi\\" \\\\ done")`)
  })
})

describe('plainUrl', () => {
  it('unwraps a Markdown autolink and leaves a normal URL alone', () => {
    expect(plainUrl('[https://e.com/l](https://e.com/l)')).toBe('https://e.com/l')
    expect(plainUrl('[the login page](https://e.com/l)')).toBe('https://e.com/l')
    expect(plainUrl('https://e.com/l')).toBe('https://e.com/l')
    expect(plainUrl('  https://e.com/l  ')).toBe('https://e.com/l')
  })
})
