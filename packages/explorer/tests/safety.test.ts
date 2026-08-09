import { describe, expect, it } from 'vitest'
import { canFollowLink, isDestructiveLabel } from '../src/safety.js'

describe('safe exploration rules', () => {
  it('blocks destructive controls without relying on their selector', () => {
    expect(isDestructiveLabel('Delete account')).toBe(true)
    expect(isDestructiveLabel('ลบบัญชี')).toBe(true)
    expect(canFollowLink('https://example.test/remove', 'Remove profile')).toBe(false)
  })

  it('allows ordinary navigation links', () => {
    expect(canFollowLink('https://example.test/docs', 'Documentation')).toBe(true)
  })
})
