import type { TestStep } from './testcase.js'

export type RecorderStatus = 'idle' | 'recording' | 'stopped'
export type RecorderPointerCursor = 'default' | 'pointer' | 'text' | 'not-allowed' | 'grab' | 'crosshair'

export type RecorderInspection = {
  locked?: boolean
  tagName: string
  role?: string
  accessibleName?: string
  text?: string
  id?: string
  name?: string
  cssSelector: string
  playwrightLocator: string
}

export type RecorderState = {
  projectId: string
  status: RecorderStatus
  startUrl: string
  startedAt: string
  browserLabel?: string
  currentUrl?: string
  pointerCursor?: RecorderPointerCursor
  steps: TestStep[]
  inspection?: RecorderInspection
}
