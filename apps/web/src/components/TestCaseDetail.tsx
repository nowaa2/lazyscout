import { describeStep } from '@lazyscout/core'
import type { TestCase } from '../types'
import { AutomationBadge, PriorityBadge, TypeBadge } from './Badges'

type Props = { testCase: TestCase; onEdit: () => void; onClose: () => void }

export function TestCaseDetail({ testCase, onEdit, onClose }: Props) {
  return (
    <div className="modern-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        className="modern-modal test-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-case-detail-title"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">Test Case detail</p>
            <h2 id="test-case-detail-title">{testCase.id}</h2>
            <p>{testCase.title}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="test-detail-body">
          <div className="test-detail-meta">
            <TypeBadge value={testCase.type} />
            <PriorityBadge value={testCase.priority} />
            <AutomationBadge value={testCase.automationStatus} />
            <span className="badge bg-slate-100 text-slate-600">{testCase.folder ?? testCase.module}</span>
          </div>
          {(testCase.tags?.length || testCase.requirements?.length) && (
            <section className="traceability-meta">
              {testCase.tags?.length ? (
                <div>
                  <h4 className="field-label">Tags</h4>
                  {testCase.tags.map((tag) => (
                    <span key={tag} className="tag-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              {testCase.requirements?.length ? (
                <div>
                  <h4 className="field-label">Requirements / Tickets</h4>
                  {testCase.requirements.map((requirement) => (
                    <span key={requirement} className="requirement-chip">
                      {requirement}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          )}
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
              <ol className="space-y-2 text-sm text-slate-700">
                {testCase.steps.map((step, index) => (
                  <li key={index} className="test-detail-step">
                    <span>{index + 1}</span>
                    <div>
                      {describeStep(step)}
                      <small>[{step.type}]</small>
                    </div>
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
              <h4 className="field-label">Notes from Generator</h4>
              <p className="text-sm text-slate-500">{testCase.notes}</p>
            </section>
          )}
          <section>
            <h4 className="field-label">Source URL</h4>
            <p className="break-all text-xs text-slate-500">{testCase.sourceUrl}</p>
          </section>
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary" onClick={onEdit}>
            Edit Test Case
          </button>
        </footer>
      </section>
    </div>
  )
}
