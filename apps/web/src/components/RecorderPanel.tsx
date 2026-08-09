import { useState } from 'react'
import { describeStep } from '@lazyscout/core'
import type { TestStep } from '../types'
import { useRecorder } from '../hooks/useRecorder'
import { SECRET_PLACEHOLDER } from '../lib/recorderText'

type Props = {
  projectId: string
  targetUrl: string
  onSaveRecording: (steps: TestStep[], title: string, sourceUrl: string) => void
}

export function RecorderPanel({ projectId, targetUrl, onSaveRecording }: Props) {
  const { state, busy, error, start, stop, reset } = useRecorder(projectId)
  const [title, setTitle] = useState('Recorded login')

  const recording = state.status === 'recording'
  const steps = state.steps
  const finished = state.status === 'stopped' && steps.length > 0

  const save = () => {
    onSaveRecording(steps, title.trim() || 'Recorded flow', state.startUrl || targetUrl)
    reset()
  }

  return (
    <div className="settings-notice settings-notice-stacked recorder-panel">
      <b>Record a flow</b>
      <span>
        Opens a browser and turns your own clicks and typing into Test Steps. Passwords are never read: a password field
        is always recorded as <code>{SECRET_PLACEHOLDER}</code>.
      </span>

      {error && <p className="recorder-error">{error}</p>}

      {!recording && !finished && (
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void start(targetUrl)}>
          {busy ? 'Starting…' : 'Start recording'}
        </button>
      )}

      {recording && (
        <>
          <p className="recorder-status">
            <span className="recorder-dot" aria-hidden="true" />
            Recording in {state.browserLabel ?? 'the browser'} — {steps.length} step
            {steps.length === 1 ? '' : 's'}. Close the window or press Stop when you are done.
          </p>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void stop()}>
            {busy ? 'Stopping…' : 'Stop recording'}
          </button>
        </>
      )}

      {steps.length > 0 && (
        <ol className="recorder-steps">
          {steps.map((step, index) => (
            <li key={`${index}-${step.type}`}>
              <span className="recorder-step-index">{index + 1}</span>
              <span>{describeStep(step)}</span>
            </li>
          ))}
        </ol>
      )}

      {finished && (
        <>
          <label className="recorder-title">
            <span>Test Case title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Recorded login" />
          </label>
          <div className="recorder-actions">
            <button type="button" className="btn btn-primary" onClick={save}>
              Save as Test Case
            </button>
            <button type="button" className="btn btn-secondary" onClick={reset}>
              Discard
            </button>
          </div>
        </>
      )}

      {state.status === 'stopped' && steps.length === 0 && (
        <p className="recorder-status">No steps were recorded. Start again and interact with the page.</p>
      )}
    </div>
  )
}
