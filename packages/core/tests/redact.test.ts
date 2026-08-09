import { describe, expect, it } from 'vitest'
import { redactSensitiveText, redactUrl } from '@lazyscout/core'

describe('redactSensitiveText', () => {
  it('masks common credential fields and bearer tokens', () => {
    expect(redactSensitiveText('password=super-secret token: abcdefghijk Authorization: Bearer token-value')).toBe(
      'password=*** token: *** Authorization: Bearer ***'
    )
  })

  it('masks configured secret values wherever they appear', () => {
    expect(redactSensitiveText('Failed while filling local-secret', ['local-secret'])).toBe('Failed while filling ***')
  })
})

describe('redactUrl', () => {
  it('masks credentials and sensitive query parameters', () => {
    expect(redactUrl('https://user:pass@example.com/callback?access_token=abc&view=full')).toBe(
      'https://***:***@example.com/callback?access_token=***&view=full'
    )
  })
})
