import type { TargetRef } from './testcase.js'

export type FlowStepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped'

export type NavigateFlowStep = { id: string; type: 'navigate'; path: string }

export type ClickFlowStep = {
  id: string
  type: 'click'
  target: TargetRef & { strategy: NonNullable<TargetRef['strategy']> }
}

export type FillFlowStep = {
  id: string
  type: 'fill'
  target: TargetRef & { strategy: NonNullable<TargetRef['strategy']> }
  value?: string
  valueRef?: string
}

export type SelectFlowStep = {
  id: string
  type: 'select'
  target: TargetRef & { strategy: NonNullable<TargetRef['strategy']> }
  option: string
}

export type CheckFlowStep = {
  id: string
  type: 'check'
  target: TargetRef & { strategy: NonNullable<TargetRef['strategy']> }
  checked: boolean
}

export type WaitFlowStep = {
  id: string
  type: 'wait'
  mode: 'timeout' | 'url' | 'visible' | 'text'
  value: string
  target?: TargetRef & { strategy: NonNullable<TargetRef['strategy']> }
}

export type AssertFlowStep = {
  id: string
  type: 'assert'
  assertion:
    | { type: 'visible'; target: TargetRef & { strategy: NonNullable<TargetRef['strategy']> } }
    | { type: 'text'; value: string }
    | { type: 'url'; value: string }
}

export type FlowStep =
  NavigateFlowStep | ClickFlowStep | FillFlowStep | SelectFlowStep | CheckFlowStep | WaitFlowStep | AssertFlowStep

export type GuidedFlow = {
  id: string
  name: string
  description?: string
  baseUrl: string
  steps: FlowStep[]
  createdAt?: string
  updatedAt?: string
}
