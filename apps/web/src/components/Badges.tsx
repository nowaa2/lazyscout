import type { AutomationStatus, TestCasePriority, TestCaseType } from '../types'

const TYPE_STYLE: Record<TestCaseType, string> = {
  positive: 'bg-emerald-100 text-emerald-800',
  negative: 'bg-rose-100 text-rose-800',
  validation: 'bg-amber-100 text-amber-800',
  navigation: 'bg-sky-100 text-sky-800',
  interaction: 'bg-violet-100 text-violet-800',
  accessibility: 'bg-teal-100 text-teal-800',
  manual: 'bg-slate-200 text-slate-700'
}

const PRIORITY_STYLE: Record<TestCasePriority, string> = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-slate-100 text-slate-700'
}

const AUTOMATION_STYLE: Record<AutomationStatus, string> = {
  ready: 'bg-emerald-100 text-emerald-800',
  'needs-data': 'bg-amber-100 text-amber-800',
  'needs-review': 'bg-orange-100 text-orange-800',
  manual: 'bg-slate-200 text-slate-700'
}

export function TypeBadge({ value }: { value: TestCaseType }) {
  return <span className={`badge ${TYPE_STYLE[value]}`}>{value}</span>
}

export function PriorityBadge({ value }: { value: TestCasePriority }) {
  return <span className={`badge ${PRIORITY_STYLE[value]}`}>{value}</span>
}

export function AutomationBadge({ value }: { value: AutomationStatus }) {
  return <span className={`badge ${AUTOMATION_STYLE[value]}`}>{value}</span>
}
