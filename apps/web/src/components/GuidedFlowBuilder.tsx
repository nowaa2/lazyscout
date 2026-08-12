import { useEffect, useMemo, useState } from 'react'
import type { FlowStep, GuidedFlow, TargetRef, TestCase, ProjectSecrets } from '../types'
import { generateCypressFromFlow, generatePlaywrightFromFlow, flowToTestCase } from '@lazyscout/generators'
import { runGuidedFlow, stopGuidedFlow, type GuidedFlowRunResponse } from '../api/client'
import { RecorderPanel } from './RecorderPanel'

type Props = {
  flows: GuidedFlow[]
  baseUrl: string
  projectId?: string
  secrets?: ProjectSecrets
  onSave: (flows: GuidedFlow[]) => Promise<void>
  onGenerateTestCase: (testCase: TestCase) => void
}

const STEP_TYPES: FlowStep['type'][] = ['navigate', 'click', 'fill', 'select', 'check', 'wait', 'assert']
const GUIDED_FLOW_GUIDE_URL = 'https://lazyscout.lazyscout.workers.dev/guided-flow.html'

type FlowConfirmation = 'save' | 'delete'

export function GuidedFlowBuilder({ flows, baseUrl, projectId, secrets, onSave, onGenerateTestCase }: Props) {
  const [selectedId, setSelectedId] = useState<string>()
  const [draft, setDraft] = useState<GuidedFlow>()
  const [addType, setAddType] = useState<FlowStep['type']>('click')
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [runId, setRunId] = useState<string>()
  const [runResult, setRunResult] = useState<GuidedFlowRunResponse>()
  const [code, setCode] = useState<{ framework: 'playwright' | 'cypress'; source: string }>()
  const [confirmation, setConfirmation] = useState<FlowConfirmation>()

  useEffect(() => {
    if (!flows.length) return
    const next = flows.find((flow) => flow.id === selectedId) ?? flows[0]
    setSelectedId(next.id)
    setDraft(next)
  }, [flows])

  const selectedIndex = flows.findIndex((flow) => flow.id === draft?.id)
  const canRun = Boolean(draft?.baseUrl && draft.steps.length)

  function createFlow() {
    const now = new Date().toISOString()
    const flow: GuidedFlow = {
      id: crypto.randomUUID(),
      name: 'New Guided Flow',
      description: '',
      baseUrl: baseUrl || 'http://localhost:5173',
      steps: [{ id: crypto.randomUUID(), type: 'navigate', path: '/' }],
      createdAt: now,
      updatedAt: now
    }
    setSelectedId(flow.id)
    setDraft(flow)
    setRunResult(undefined)
  }

  function updateDraft(patch: Partial<GuidedFlow>) {
    setDraft((current) => (current ? { ...current, ...patch, updatedAt: new Date().toISOString() } : current))
  }

  function updateStep(index: number, step: FlowStep) {
    if (!draft) return
    const steps = draft.steps.map((current, position) => (position === index ? step : current))
    updateDraft({ steps })
  }

  function addStep() {
    if (!draft) return
    updateDraft({ steps: [...draft.steps, defaultStep(addType)] })
  }

  function removeStep(index: number) {
    if (!draft) return
    updateDraft({ steps: draft.steps.filter((_, position) => position !== index) })
  }

  function moveStep(index: number, direction: -1 | 1) {
    if (!draft) return
    const target = index + direction
    if (target < 0 || target >= draft.steps.length) return
    const steps = [...draft.steps]
    const [moved] = steps.splice(index, 1)
    steps.splice(target, 0, moved)
    updateDraft({ steps })
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    try {
      const next = selectedIndex < 0 ? [...flows, draft] : flows.map((flow) => (flow.id === draft.id ? draft : flow))
      await onSave(next)
    } finally {
      setSaving(false)
    }
  }

  async function duplicateFlow() {
    if (!draft) return
    const copy: GuidedFlow = {
      ...draft,
      id: crypto.randomUUID(),
      name: `${draft.name} Copy`,
      steps: draft.steps.map((step) => ({ ...step, id: crypto.randomUUID() })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    await onSave([...flows, copy])
    setSelectedId(copy.id)
    setDraft(copy)
  }

  async function deleteFlow() {
    if (!draft) return
    const next = flows.filter((flow) => flow.id !== draft.id)
    setSaving(true)
    try {
      await onSave(next)
      setSelectedId(next[0]?.id)
      setDraft(next[0])
    } finally {
      setSaving(false)
    }
  }

  async function confirmFlowAction() {
    if (!confirmation) return
    try {
      if (confirmation === 'save') await save()
      else await deleteFlow()
      setConfirmation(undefined)
    } catch {}
  }

  async function run() {
    if (!draft || !canRun || running) return
    setRunning(true)
    setRunResult(undefined)
    const nextRunId = crypto.randomUUID()
    setRunId(nextRunId)
    try {
      setRunResult(await runGuidedFlow(draft, projectId, secrets, nextRunId))
    } catch (error) {
      setRunResult({
        status: 'failed',
        framework: 'playwright',
        runId: nextRunId,
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'fail',
            message: error instanceof Error ? error.message : String(error)
          }
        ],
        stepStatuses: draft.steps.map((step) => ({ id: step.id, status: 'pending' }))
      })
    } finally {
      setRunning(false)
      setRunId(undefined)
    }
  }

  async function stop() {
    if (runId) await stopGuidedFlow(runId)
  }

  const stepStatus = useMemo(() => new Map(runResult?.stepStatuses.map((item) => [item.id, item.status])), [runResult])

  return (
    <div className="guided-flow-panel">
      <div className="guided-flow-intro">
        <div>
          <p className="eyebrow">Tester-defined execution</p>
          <h2>Guided Flow</h2>
          <p>Auto Scout finds the paths. Guided Scout follows yours.</p>
        </div>
        <div className="guided-flow-intro-actions">
          <a
            className="guided-flow-guide-link"
            href={GUIDED_FLOW_GUIDE_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Open the visual Guided Flow guide"
            title="Open visual Guided Flow guide"
          >
            <span aria-hidden="true">▤</span>
            Guided Flow Guide
          </a>
          <button type="button" className="btn btn-primary" onClick={createFlow}>
            + New Flow
          </button>
        </div>
      </div>
      <section className="hidden" aria-hidden="true">
        <div className="guided-flow-guide-grid">
          <div>
            <strong>Inputs without a label</strong>
            <p>
              Use CSS with a stable id or name. Example: <code>input#username</code>.
            </p>
          </div>
          <div>
            <strong>Buttons</strong>
            <p>Prefer Role + accessible name, or CSS when the button has a stable id.</p>
          </div>
          <div>
            <strong>Labels</strong>
            <p>Use Label when the input has a real HTML label. It is also useful for validation checks.</p>
          </div>
          <div>
            <strong>Login example</strong>
            <pre>
              {'Fill · CSS · #username · TEST_USERNAME\nFill · CSS · #password · TEST_PASSWORD\nClick · CSS · #submit'}
            </pre>
          </div>
        </div>
        <div className="guided-flow-guide-steps">
          <strong>First time using Guided Flow?</strong>
          <ol>
            <li>Open the target page in your browser and inspect the element you want to test.</li>
            <li>
              If it has an id, choose <b>CSS</b>. If it is a named button, choose <b>Role</b>.
            </li>
            <li>
              Enter only the selector value, for example <code>#username</code>, not the whole HTML tag.
            </li>
            <li>
              For usernames and passwords, leave Value empty and use <b>Value reference</b>.
            </li>
            <li>Save the Flow, run it, then use the CLI error to adjust only the failing step.</li>
          </ol>
        </div>
        <div className="guided-flow-guide-decision">
          <b>Not sure which locator to choose?</b>
          <span>
            id/name → CSS · button/link name → Role · real label → Label · data-testid → Test ID · no stable attribute →
            CSS parent + child
          </span>
        </div>
      </section>
      <div className="guided-flow-layout">
        <aside className="guided-flow-list">
          <div className="guided-flow-list-head">
            <b>Guided Flows</b>
            <span>{flows.length}</span>
          </div>
          {flows.map((flow) => (
            <button
              type="button"
              key={flow.id}
              className={flow.id === draft?.id ? 'is-active' : ''}
              onClick={() => {
                setSelectedId(flow.id)
                setDraft(flow)
                setRunResult(undefined)
              }}
            >
              <strong>{flow.name}</strong>
              <small>{flow.steps.length} steps</small>
            </button>
          ))}
          {!flows.length && <p className="guided-flow-empty">Create a flow to define a deterministic path.</p>}
        </aside>
        {draft ? (
          <main className="guided-flow-editor">
            <div className="guided-flow-fields">
              <label>
                Flow name
                <input
                  className="field"
                  value={draft.name}
                  onChange={(event) => updateDraft({ name: event.target.value })}
                />
              </label>
              <label>
                Base URL
                <input
                  className="field"
                  value={draft.baseUrl}
                  onChange={(event) => updateDraft({ baseUrl: event.target.value })}
                />
              </label>
              <label className="guided-flow-wide">
                Description
                <textarea
                  className="field"
                  rows={2}
                  value={draft.description ?? ''}
                  onChange={(event) => updateDraft({ description: event.target.value })}
                />
              </label>
            </div>
            <div className="guided-flow-section-head">
              <div>
                <p className="eyebrow">Flow Steps</p>
                <span>Execute only the steps defined here.</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary" onClick={duplicateFlow}>
                  Duplicate
                </button>
                <button type="button" className="btn btn-danger" onClick={() => setConfirmation('delete')}>
                  Delete
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmation('save')}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Flow'}
                </button>
              </div>
            </div>
            <div className="guided-flow-steps">
              {draft.steps.map((step, index) => (
                <FlowStepEditor
                  key={step.id}
                  index={index}
                  step={step}
                  status={stepStatus.get(step.id)}
                  projectId={projectId}
                  baseUrl={draft.baseUrl || baseUrl}
                  onChange={(next) => updateStep(index, next)}
                  onDelete={() => removeStep(index)}
                  onMove={moveStep}
                />
              ))}
            </div>
            <div className="guided-flow-add">
              <select
                className="field"
                value={addType}
                onChange={(event) => setAddType(event.target.value as FlowStep['type'])}
              >
                {STEP_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
              <button type="button" className="btn btn-secondary" onClick={addStep}>
                + Add Step
              </button>
            </div>
            <div className="guided-flow-actions">
              <button type="button" className="btn btn-primary" disabled={!canRun || running} onClick={run}>
                {running ? 'Running…' : 'Run Flow'}
              </button>
              {running && (
                <button type="button" className="btn btn-danger" onClick={stop}>
                  Stop
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!draft.steps.length}
                onClick={() => setCode({ framework: 'playwright', source: generatePlaywrightFromFlow(draft) })}
              >
                Generate Playwright
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!draft.steps.length}
                onClick={() => setCode({ framework: 'cypress', source: generateCypressFromFlow(draft) })}
              >
                Generate Cypress
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!draft.steps.length}
                onClick={() => onGenerateTestCase(flowToTestCase(draft))}
              >
                Generate Test Case
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled
                title="Record Flow is planned for a future release"
              >
                Record Flow · Planned
              </button>
            </div>
            {code && (
              <section className="guided-flow-code">
                <header>
                  <b>{code.framework === 'playwright' ? 'Playwright' : 'Cypress'} generated source</b>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setCode(undefined)}
                    aria-label="Close generated code"
                  >
                    ×
                  </button>
                </header>
                <pre>{code.source}</pre>
              </section>
            )}
            {runResult && (
              <section className="guided-flow-run">
                <header>
                  <b>Run result: {runResult.status}</b>
                </header>
                <div className="guided-flow-log">
                  {runResult.logs.map((log, index) => (
                    <code key={`${log.timestamp}-${index}`} className={`cli-${log.level}`}>
                      {log.message}
                    </code>
                  ))}
                </div>
              </section>
            )}
          </main>
        ) : (
          <div className="guided-flow-empty-state">
            <b>No Guided Flow selected</b>
            <span>Define a path and LazyScout will follow it only.</span>
            <button type="button" className="btn btn-primary" onClick={createFlow}>
              Create Guided Flow
            </button>
          </div>
        )}
      </div>
      {confirmation && draft && (
        <FlowConfirmationModal
          action={confirmation}
          flowName={draft.name}
          busy={saving}
          onCancel={() => setConfirmation(undefined)}
          onConfirm={confirmFlowAction}
        />
      )}
    </div>
  )
}

function FlowConfirmationModal({
  action,
  flowName,
  busy,
  onCancel,
  onConfirm
}: {
  action: FlowConfirmation
  flowName: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const deleting = action === 'delete'
  return (
    <div className="guided-flow-confirm-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="guided-flow-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-flow-confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className={'guided-flow-confirm-icon' + (deleting ? ' is-delete' : '')} aria-hidden="true">
          {deleting ? '×' : '✓'}
        </span>
        <p className="eyebrow">{deleting ? 'Remove Guided Flow' : 'Save Guided Flow'}</p>
        <h3 id="guided-flow-confirm-title">{deleting ? 'Delete this Flow?' : 'Save your changes?'}</h3>
        <p>
          {deleting
            ? '"' + flowName + '" will be removed from this local Project. This action cannot be undone.'
            : '"' + flowName + '" will be saved to this local Project and will be ready to run.'}
        </p>
        <footer>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={'btn ' + (deleting ? 'btn-danger' : 'btn-primary')}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Saving…' : deleting ? 'Delete Flow' : 'Save Flow'}
          </button>
        </footer>
      </section>
    </div>
  )
}

function defaultTarget(): TargetRef & { strategy: NonNullable<TargetRef['strategy']> } {
  return { strategy: 'role', role: 'button', name: 'Button' }
}

function defaultStep(type: FlowStep['type']): FlowStep {
  const id = crypto.randomUUID()
  if (type === 'navigate') return { id, type, path: '/' }
  if (type === 'click') return { id, type, target: defaultTarget() }
  if (type === 'fill') return { id, type, target: { ...defaultTarget(), role: 'textbox' }, value: '' }
  if (type === 'select') return { id, type, target: { ...defaultTarget(), role: 'combobox' }, option: '' }
  if (type === 'check') return { id, type, target: { ...defaultTarget(), role: 'checkbox' }, checked: true }
  if (type === 'wait') return { id, type, mode: 'timeout', value: '750' }
  return { id, type, assertion: { type: 'text', value: '' } }
}

function FlowStepEditor({
  index,
  step,
  status,
  onChange,
  onDelete,
  onMove,
  projectId,
  baseUrl
}: {
  index: number
  step: FlowStep
  status?: string
  onChange: (step: FlowStep) => void
  onDelete: () => void
  onMove: (index: number, direction: -1 | 1) => void
  projectId?: string
  baseUrl: string
}) {
  return (
    <article className={`guided-flow-step ${status ? `is-${status}` : ''}`}>
      <header>
        <span className="guided-flow-step-number">{index + 1}</span>
        <b>{step.type}</b>
        {status && <em>{status}</em>}
        <div className="guided-flow-step-actions">
          <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0}>
            ↑
          </button>
          <button type="button" onClick={() => onMove(index, 1)}>
            ↓
          </button>
          <button type="button" onClick={onDelete}>
            Delete
          </button>
        </div>
      </header>
      <StepFields step={step} onChange={onChange} projectId={projectId} baseUrl={baseUrl} />
    </article>
  )
}

function StepFields({
  step,
  onChange,
  projectId,
  baseUrl
}: {
  step: FlowStep
  onChange: (step: FlowStep) => void
  projectId?: string
  baseUrl: string
}) {
  if (step.type === 'navigate')
    return (
      <label>
        Path
        <input
          className="field"
          value={step.path}
          onChange={(event) => onChange({ ...step, path: event.target.value })}
        />
      </label>
    )
  if (step.type === 'click' || step.type === 'fill' || step.type === 'select' || step.type === 'check')
    return (
      <>
        <TargetFields
          target={step.target}
          projectId={projectId}
          baseUrl={baseUrl}
          onChange={(target) => onChange({ ...step, target } as FlowStep)}
        />
        {step.type === 'fill' && (
          <div className="guided-flow-inline-fields">
            <label>
              Value
              <input
                className="field"
                value={step.value ?? ''}
                onChange={(event) => onChange({ ...step, value: event.target.value, valueRef: undefined })}
              />
            </label>
            <label>
              Value reference
              <input
                className="field"
                placeholder="TEST_USERNAME"
                value={step.valueRef ?? ''}
                onChange={(event) =>
                  onChange({
                    ...step,
                    valueRef: event.target.value || undefined,
                    value: event.target.value ? undefined : step.value
                  })
                }
              />
              <small className="guided-flow-field-help">
                Use a Project Settings variable such as <code>TEST_USERNAME</code> or <code>TEST_PASSWORD</code>. Do not
                put real credentials in Value.
              </small>
            </label>
          </div>
        )}
        {step.type === 'select' && (
          <label>
            Option
            <input
              className="field"
              value={step.option}
              onChange={(event) => onChange({ ...step, option: event.target.value })}
            />
          </label>
        )}
        {step.type === 'check' && (
          <label className="guided-flow-check">
            <input
              type="checkbox"
              checked={step.checked}
              onChange={(event) => onChange({ ...step, checked: event.target.checked })}
            />{' '}
            Checked
          </label>
        )}
      </>
    )
  if (step.type === 'wait')
    return (
      <div className="guided-flow-inline-fields">
        <label>
          Wait type
          <select
            className="field"
            value={step.mode}
            onChange={(event) => onChange({ ...step, mode: event.target.value as typeof step.mode })}
          >
            <option value="timeout">Wait for timeout</option>
            <option value="url">Wait for URL</option>
            <option value="text">Wait for text</option>
            <option value="visible">Wait for element visible</option>
          </select>
        </label>
        <label>
          Value
          <input
            className="field"
            value={step.value}
            onChange={(event) => onChange({ ...step, value: event.target.value })}
          />
        </label>
        {step.mode === 'visible' && (
          <TargetFields
            target={step.target ?? defaultTarget()}
            projectId={projectId}
            baseUrl={baseUrl}
            onChange={(target) => onChange({ ...step, target })}
          />
        )}
      </div>
    )
  return (
    <div className="guided-flow-inline-fields">
      <label>
        Assertion
        <select
          className="field"
          value={step.assertion.type}
          onChange={(event) =>
            onChange({
              ...step,
              assertion:
                event.target.value === 'visible'
                  ? { type: 'visible', target: defaultTarget() }
                  : { type: event.target.value as 'text' | 'url', value: '' }
            })
          }
        >
          <option value="visible">Element visible</option>
          <option value="text">Text visible</option>
          <option value="url">URL contains</option>
        </select>
      </label>
      {step.assertion.type === 'visible' ? (
        <TargetFields
          target={step.assertion.target}
          projectId={projectId}
          baseUrl={baseUrl}
          onChange={(target) => onChange({ ...step, assertion: { type: 'visible', target } })}
        />
      ) : (
        <label>
          Expected value
          <input
            className="field"
            value={step.assertion.value}
            onChange={(event) =>
              onChange({
                ...step,
                assertion:
                  step.assertion.type === 'text'
                    ? { type: 'text', value: event.target.value }
                    : { type: 'url', value: event.target.value }
              })
            }
          />
        </label>
      )}
    </div>
  )
}

type GuidedTarget = TargetRef & { strategy: NonNullable<TargetRef['strategy']> }

function TargetFields({
  target,
  onChange,
  projectId,
  baseUrl
}: {
  target: GuidedTarget
  onChange: (target: GuidedTarget) => void
  projectId?: string
  baseUrl: string
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const value =
    target.strategy === 'role'
      ? (target.name ?? '')
      : target[target.strategy === 'testid' ? 'testId' : target.strategy === 'css' ? 'cssSelector' : target.strategy]
  return (
    <div className="guided-flow-target">
      <div className="guided-flow-picker-head">
        <span>Target element</span>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!projectId || !baseUrl}
          onClick={() => setPickerOpen((current) => !current)}
        >
          ◎ Pick from page
        </button>
      </div>
      {pickerOpen && projectId && baseUrl && (
        <div className="guided-flow-picker">
          <RecorderPanel
            projectId={projectId}
            targetUrl={baseUrl}
            onSaveRecording={() => undefined}
            onPickTarget={(picked) => {
              onChange({ ...defaultTarget(), ...picked } as GuidedTarget)
              setPickerOpen(false)
            }}
          />
        </div>
      )}
      <label>
        Locator
        <select
          className="field"
          value={target.strategy}
          onChange={(event) => onChange({ strategy: event.target.value as typeof target.strategy, value: '' })}
        >
          <option value="role">Role</option>
          <option value="label">Label</option>
          <option value="placeholder">Placeholder</option>
          <option value="text">Text</option>
          <option value="testid">Test ID</option>
          <option value="css">CSS</option>
        </select>
        <small className="guided-flow-field-help">{locatorHelp(target.strategy)}</small>
      </label>
      {target.strategy === 'role' && (
        <label>
          Role
          <input
            className="field"
            value={target.role ?? ''}
            onChange={(event) => onChange({ ...target, role: event.target.value })}
          />
        </label>
      )}
      <label>
        {target.strategy === 'role' ? 'Accessible name' : 'Value'}
        <input
          className="field"
          value={value ?? ''}
          placeholder={locatorPlaceholder(target.strategy)}
          onChange={(event) => onChange(targetValue(target, event.target.value))}
        />
        <small className="guided-flow-field-help">
          Example: <code>{locatorPlaceholder(target.strategy)}</code>
        </small>
      </label>
    </div>
  )
}

function locatorHelp(strategy: GuidedTarget['strategy']): string {
  if (strategy === 'css')
    return 'Best for inputs/buttons with a stable id, name, or data attribute. Enter quotes without backslashes.'
  if (strategy === 'role') return 'Best for buttons, links, checkboxes, and controls with a clear accessible name.'
  if (strategy === 'label') return 'Use only when the input has a real HTML label. Useful for validation checks.'
  if (strategy === 'placeholder') return 'Use when the input has a stable placeholder attribute.'
  if (strategy === 'testid') return 'Best when the application provides a stable data-testid attribute.'
  return 'Use for visible text assertions or text-based controls when no stronger locator exists.'
}

function locatorPlaceholder(strategy: GuidedTarget['strategy']): string {
  if (strategy === 'css') return '#username or input[name="email"]'
  if (strategy === 'role') return 'Submit'
  if (strategy === 'label') return 'Email'
  if (strategy === 'placeholder') return 'Search products'
  if (strategy === 'testid') return 'save-button'
  return 'Welcome back'
}

function targetValue(target: TargetRef & { strategy: NonNullable<TargetRef['strategy']> }, value: string) {
  if (target.strategy === 'role') return { ...target, name: value }
  if (target.strategy === 'testid') return { ...target, testId: value }
  if (target.strategy === 'css') return { ...target, cssSelector: value.replace(/\\(["'])/g, '$1') }
  return { ...target, [target.strategy]: value }
}
