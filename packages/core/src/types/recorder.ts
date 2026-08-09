import type { TestStep } from './testcase.js'

export type RecorderStatus = 'idle' | 'recording' | 'stopped'

export type RecorderState = {
  projectId: string
  status: RecorderStatus
  startUrl: string
  startedAt: string
  browserLabel?: string
  steps: TestStep[]
}
