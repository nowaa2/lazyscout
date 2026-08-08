import { describeStep } from '@lazyscout/core'
import type { TestCase } from '../types'
import { AutomationBadge, PriorityBadge, TypeBadge } from './Badges'

type Props = {
  testCase: TestCase
  onEdit: () => void
  onClose: () => void
}

/** รายละเอียดของ test case ที่เลือก: Preconditions / Steps / Expected Result */
export function TestCaseDetail({ testCase, onEdit, onClose }: Props) {
  return (
    <div className="card sticky top-4">
      <div className="card-title flex items-center justify-between">
        <span className="font-mono">{testCase.id}</span>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary px-2 py-1" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="btn btn-secondary px-2 py-1" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{testCase.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <TypeBadge value={testCase.type} />
            <PriorityBadge value={testCase.priority} />
            <AutomationBadge value={testCase.automationStatus} />
            <span className="badge bg-slate-100 text-slate-600">{testCase.module}</span>
          </div>
        </div>

        <section>
          <h4 className="field-label">Preconditions</h4>
          {testCase.preconditions.length === 0 ? (
            <p className="text-sm text-slate-400">—</p>
          ) : (
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
              {testCase.preconditions.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="field-label">Steps</h4>
          {testCase.steps.length === 0 ? (
            <p className="text-sm text-slate-400">—</p>
          ) : (
            <ol className="space-y-1 text-sm text-slate-700">
              {testCase.steps.map((step, index) => (
                <li key={index} className="flex gap-2">
                  <span className="w-5 shrink-0 text-slate-400">{index + 1}.</span>
                  <span>
                    {describeStep(step)}
                    <span className="ml-2 font-mono text-xs text-slate-400">[{step.type}]</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <h4 className="field-label">Expected Result</h4>
          <p className="text-sm text-slate-700">{testCase.expectedResult || '—'}</p>
        </section>

        {testCase.notes && (
          <section>
            <h4 className="field-label">Notes จาก Generator</h4>
            <p className="text-sm text-slate-500">{testCase.notes}</p>
          </section>
        )}

        <section>
          <h4 className="field-label">Source URL</h4>
          <p className="text-xs break-all text-slate-500">{testCase.sourceUrl}</p>
        </section>
      </div>
    </div>
  )
}
