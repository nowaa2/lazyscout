import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { GuidedFlow } from '@lazyscout/core'
import { readGuidedFlows, saveGuidedFlows } from '../src/workspace.js'

const flow: GuidedFlow = {
  id: 'flow-login',
  name: 'Login smoke',
  baseUrl: 'https://example.com',
  steps: [{ id: 'step-1', type: 'navigate', path: '/login' }]
}

describe('Guided Flow persistence', () => {
  const directories: string[] = []

  afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
  })

  it('saves and reloads flows from the project workspace', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lazyscout-guided-flow-'))
    directories.push(directory)
    await saveGuidedFlows(directory, 'project-test', [flow])
    await expect(readGuidedFlows(directory, 'project-test')).resolves.toEqual([flow])
  })
})
