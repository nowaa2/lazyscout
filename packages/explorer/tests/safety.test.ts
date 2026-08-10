import { describe, expect, it } from 'vitest'
import { canFollowLink, isBlockedLabel, normalizeBlockedKeywords } from '../src/safety.js'

describe('click filter rules', () => {
  it('blocks nothing when the Project has no filter', () => {
    expect(isBlockedLabel([], 'Delete account')).toBe(false)
    expect(canFollowLink('https://example.test/remove', 'Remove profile')).toBe(true)
  })

  it('blocks only the keywords the Project configured', () => {
    const keywords = ['delete', 'ลบ']
    expect(isBlockedLabel(keywords, 'Delete account')).toBe(true)
    expect(isBlockedLabel(keywords, 'ลบบัญชี')).toBe(true)
    expect(isBlockedLabel(keywords, 'Publish article')).toBe(false)
    expect(canFollowLink('https://example.test/docs', 'Documentation', keywords)).toBe(true)
    expect(canFollowLink('https://example.test/delete', 'Settings', keywords)).toBe(false)
  })

  it('matches regardless of the case the operator typed', () => {
    expect(isBlockedLabel(['DELETE'], 'Delete account')).toBe(true)
  })

  it('cleans operator input into a comparable list', () => {
    expect(normalizeBlockedKeywords([' Delete ', 'delete', '', 'ลบ', 42])).toEqual(['delete', 'ลบ'])
    expect(normalizeBlockedKeywords(undefined)).toEqual([])
  })
})
