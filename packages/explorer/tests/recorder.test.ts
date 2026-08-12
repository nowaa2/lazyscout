import { describe, expect, it } from 'vitest'
import { buildStep, closingAssertion, SECRET_PLACEHOLDER, type RecorderEvent } from '../src/recorder/attachRecorder.js'

const url = 'http://localhost:5500/login'

describe('buildStep', () => {
  it('records a click as a click step', () => {
    const event: RecorderEvent = {
      kind: 'click',
      target: { role: 'button', name: 'Sign in', cssSelector: '#submit' },
      url
    }
    expect(buildStep(event)).toEqual({
      type: 'click',
      target: { role: 'button', name: 'Sign in', cssSelector: '#submit' }
    })
  })

  it('keeps duplicate-match metadata so generation can use the clicked CSS target', () => {
    const step = buildStep({
      kind: 'click',
      target: {
        role: 'link',
        name: 'การเงิน',
        cssSelector: 'nav.primary a:nth-of-type(2)',
        matchCount: 2
      },
      url
    })
    expect(step).toEqual({
      type: 'click',
      target: {
        role: 'link',
        name: 'การเงิน',
        cssSelector: 'nav.primary a:nth-of-type(2)',
        matchCount: 2
      }
    })
  })

  it('records typing as a fill step', () => {
    const event: RecorderEvent = {
      kind: 'fill',
      target: { role: 'textbox', label: 'Email', cssSelector: '#email' },
      value: 'qa@example.com',
      url
    }
    expect(buildStep(event)).toEqual({
      type: 'fill',
      target: { role: 'textbox', label: 'Email', cssSelector: '#email' },
      value: 'qa@example.com'
    })
  })

  it('never stores a secret value, even when one is sent by mistake', () => {
    const event: RecorderEvent = {
      kind: 'fill',
      target: { role: 'textbox', label: 'Password', cssSelector: '#password' },
      value: 'hunter2',
      secret: true,
      url
    }
    const step = buildStep(event)
    expect(step).toEqual({
      type: 'fill',
      target: { role: 'textbox', label: 'Password', cssSelector: '#password' },
      value: SECRET_PLACEHOLDER
    })
    expect(JSON.stringify(step)).not.toContain('hunter2')
  })

  it('records a select as a select step', () => {
    const event: RecorderEvent = {
      kind: 'select',
      target: { role: 'combobox', label: 'Country', cssSelector: '#country' },
      option: 'Thailand',
      url
    }
    expect(buildStep(event)).toEqual({
      type: 'select',
      target: { role: 'combobox', label: 'Country', cssSelector: '#country' },
      option: 'Thailand'
    })
  })

  it('never leaks a query string into the closing assertion', () => {
    // A GET login form puts the typed password straight into the URL.
    const leaky = 'http://localhost:5500/dashboard?email=qa%40example.com&password=123456789&remember=on'
    const step = closingAssertion('http://localhost:5500/login.html', leaky)
    expect(step).toEqual({ type: 'assertUrl', urlContains: '/dashboard' })
    expect(JSON.stringify(step)).not.toContain('123456789')
  })

  it('adds no closing assertion when the flow never navigated', () => {
    const url = 'http://localhost:5500/login.html'
    expect(closingAssertion(url, url)).toBeUndefined()
    expect(closingAssertion(url, '')).toBeUndefined()
    expect(closingAssertion(url, 'http://localhost:5500/')).toBeUndefined()
  })

  it('drops empty target fields so steps stay readable', () => {
    const step = buildStep({
      kind: 'click',
      target: { role: 'link', name: 'Home', text: undefined, label: undefined, placeholder: '', cssSelector: 'a' },
      url
    })
    expect(step).toEqual({ type: 'click', target: { role: 'link', name: 'Home', cssSelector: 'a' } })
  })
})
