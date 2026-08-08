import { describe, expect, it } from 'vitest'
import { fingerprintState } from '../src/state/fingerprint.js'
import type { PageState } from '../src/types/page.js'

const base: Omit<PageState, 'id' | 'fingerprint'> = {
  url: 'http://localhost:5500/profile',
  title: 'Profile',
  visibleDialogs: [],
  headings: ['Profile'],
  controls: [],
  interactions: [],
  stateContent: []
}

describe('fingerprintState', () => {
  it('is stable for the same state', () => {
    expect(fingerprintState(base)).toBe(fingerprintState({ ...base }))
  })

  it('distinguishes a modal state from the base page', () => {
    expect(fingerprintState(base)).not.toBe(
      fingerprintState({ ...base, visibleDialogs: ['Edit Profile'] })
    )
  })
})
