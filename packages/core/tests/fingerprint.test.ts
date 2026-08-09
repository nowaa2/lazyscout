import { describe, expect, it } from 'vitest'
import { fingerprintState } from '../src/state/fingerprint.js'
import type { PageState } from '../src/types/page.js'

const base: Omit<PageState, 'id' | 'fingerprint'> = {
  url: 'http://localhost:5500/profile',
  title: 'Profile',
  name: 'Profile',
  type: 'page',
  discoveredAt: '2026-08-09T00:00:00.000Z',
  visibleDialogs: [],
  headings: ['Profile'],
  controls: [],
  interactions: [],
  stateContent: [],
  validationMessages: []
}

describe('fingerprintState', () => {
  it('is stable for the same state', () => {
    expect(fingerprintState(base)).toBe(fingerprintState({ ...base }))
  })

  it('distinguishes a modal state from the base page', () => {
    expect(fingerprintState(base)).not.toBe(fingerprintState({ ...base, visibleDialogs: ['Edit Profile'] }))
  })

  it('distinguishes visible validation feedback at the same URL', () => {
    expect(fingerprintState(base)).not.toBe(fingerprintState({ ...base, validationMessages: ['Email is required'] }))
  })
})
