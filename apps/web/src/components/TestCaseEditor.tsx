import { useEffect, useState } from 'react'
import { describeStep } from '@lazyscout/core'
import type { AutomationStatus, TestCase, TestCasePriority, TestCaseType, TestStep } from '../types'

type Props = {
  testCase: TestCase
  onSave: (testCase: TestCase) => void
  onCancel: () => void
}

export function TestCaseEditor({ testCase, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<TestCase>({ ...testCase })
  const [preconditionsText, setPreconditionsText] = useState(testCase.preconditions.join('\n'))

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [onCancel])

  function patch(changes: Partial<TestCase>) {
    setDraft((current) => ({ ...current, ...changes }))
  }

  function updateStepDescription(index: number, description: string) {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, position) =>
        position === index ? ({ ...step, description } as TestStep) : step
      )
    }))
  }

  function removeStep(index: number) {
    setDraft((current) => ({
      ...current,
      steps: current.steps.filter((_, position) => position !== index)
    }))
  }

  function addManualStep() {
    setDraft((current) => ({
      ...current,
      steps: [...current.steps, { type: 'manual', description: 'New step' }]
    }))
  }

  function handleSave() {
    onSave({
      ...draft,
      preconditions: preconditionsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    })
  }

  return (

    <div
      className="modern-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div className="modern-modal flex max-h-[90vh] w-full max-w-3xl flex-col">
        <div className="card-title flex shrink-0 items-center justify-between">
          <span>Edit {draft.id}</span>
          <button
            type="button"
            className="btn btn-secondary px-2 py-1"
            onClick={onCancel}
            aria-label="Close editor"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="edit-module">
                Module
              </label>
              <input
                id="edit-module"
                className="field"
                value={draft.module}
                onChange={(event) => patch({ module: event.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="edit-id">
                TC ID
              </label>
              <input
                id="edit-id"
                className="field font-mono"
                value={draft.id}
                onChange={(event) => patch({ id: event.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="edit-title">
              Title
            </label>
            <input
              id="edit-title"
              className="field"
              value={draft.title}
              onChange={(event) => patch({ title: event.target.value })}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="field-label" htmlFor="edit-type">
                Type
              </label>
              <select
                id="edit-type"
                className="field"
                value={draft.type}
                onChange={(event) => patch({ type: event.target.value as TestCaseType })}
              >
                <option value="positive">positive</option>
                <option value="negative">negative</option>
                <option value="validation">validation</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="edit-priority">
                Priority
              </label>
              <select
                id="edit-priority"
                className="field"
                value={draft.priority}
                onChange={(event) => patch({ priority: event.target.value as TestCasePriority })}
              >
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="edit-automation">
                Automation Status
              </label>
              <select
                id="edit-automation"
                className="field"
                value={draft.automationStatus}
                onChange={(event) => patch({ automationStatus: event.target.value as AutomationStatus })}
              >
                <option value="ready">ready</option>
                <option value="needs-data">needs-data</option>
                <option value="needs-review">needs-review</option>
                <option value="manual">manual</option>
              </select>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="edit-preconditions">
              Preconditions (one per line)
            </label>
            <textarea
              id="edit-preconditions"
              className="field h-20"
              value={preconditionsText}
              onChange={(event) => setPreconditionsText(event.target.value)}
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="field-label mb-0">Steps</span>
              <button type="button" className="btn btn-secondary px-2 py-1" onClick={addManualStep}>
                + Add step
              </button>
            </div>
            <div className="space-y-2">
              {draft.steps.map((step, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-5 text-xs text-slate-400">{index + 1}.</span>
                  <input
                    className="field"
                    value={describeStep(step)}
                    onChange={(event) => updateStepDescription(index, event.target.value)}
                  />
                  <span className="w-24 shrink-0 font-mono text-xs text-slate-400">{step.type}</span>
                  <button
                    type="button"
                    className="btn btn-danger px-2 py-1"
                    onClick={() => removeStep(index)}
                  >
                    Delete
                  </button>
                </div>
              ))}
              {draft.steps.length === 0 && <p className="text-sm text-slate-400">No steps yet.</p>}
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="edit-expected">
              Expected Result
            </label>
            <textarea
              id="edit-expected"
              className="field h-20"
              value={draft.expectedResult}
              onChange={(event) => patch({ expectedResult: event.target.value })}
            />
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white p-4">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
