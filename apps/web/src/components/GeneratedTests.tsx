import { useEffect, useMemo, useRef, useState } from 'react'
import { generateCypressTest, generatePlaywrightTest } from '@lazyscout/generators'
import type { ProjectSecrets, TestCase } from '../types'
import { runAutomation, stopAutomation } from '../api/client'
import { CodeEditor } from './CodeEditor'

type Framework = 'playwright' | 'cypress'
type RunStatus = 'passed' | 'failed' | 'pending'
type RunResult = Awaited<ReturnType<typeof runAutomation>>
type ActiveRun = { runId: string; controller: AbortController }

export function GeneratedTests({
  testCases,
  projectId = 'active',
  secrets,
  onRunStatus,
  onRunResult
}: {
  testCases: TestCase[]
  projectId?: string
  secrets?: ProjectSecrets
  onRunStatus?: (id: string, status: RunStatus) => void
  onRunResult?: (id: string, result: Pick<RunResult, 'status' | 'logs' | 'screenshot'>) => void
}) {
  const [framework, setFramework] = useState<Framework>('playwright')
  const preferredCase =
    testCases.find((testCase) =>
      /submit|login|sign in|เข้าสู่ระบบ|ล็อกอิน/i.test(`${testCase.title} ${testCase.module}`)
    ) ?? testCases[0]
  const [selectedId, setSelectedId] = useState(preferredCase?.id ?? '')
  const [runEnabled, setRunEnabled] = useState<string[]>(() => testCases.map((testCase) => testCase.id))
  const [running, setRunning] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftCode, setDraftCode] = useState('')
  const [runStatus, setRunStatus] = useState<string>()
  const [runLogs, setRunLogs] = useState<RunResult['logs']>([])
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false)
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false)
  const [runFilter, setRunFilter] = useState('all')
  const activeRunRef = useRef<ActiveRun | undefined>(undefined)
  const stopRequestedRef = useRef(false)
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`lazyscout.automation.${projectId}`) ?? '{}') as Record<string, string>
    } catch {
      return {}
    }
  })
  const selected = testCases.find((testCase) => testCase.id === selectedId) ?? testCases[0]
  const runFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All folders and tags' },
      ...[...new Set(testCases.map((testCase) => testCase.folder ?? testCase.module))]
        .sort()
        .map((folder) => ({ value: `folder:${folder}`, label: `Folder: ${folder}` })),
      ...[...new Set(testCases.flatMap((testCase) => testCase.tags ?? []))]
        .sort()
        .map((tag) => ({ value: `tag:${tag}`, label: `Tag: ${tag}` }))
    ],
    [testCases]
  )
  const filteredCases = useMemo(
    () =>
      runFilter === 'all'
        ? testCases
        : testCases.filter((testCase) =>
            runFilter.startsWith('folder:')
              ? (testCase.folder ?? testCase.module) === runFilter.slice(7)
              : (testCase.tags ?? []).includes(runFilter.slice(4))
          ),
    [runFilter, testCases]
  )
  const selectedInFilter = filteredCases.filter((testCase) => runEnabled.includes(testCase.id)).length

  useEffect(() => {
    if (!testCases.some((testCase) => testCase.id === selectedId)) setSelectedId(preferredCase?.id ?? '')
  }, [preferredCase?.id, selectedId, testCases])
  useEffect(() => {
    setRunEnabled(testCases.map((testCase) => testCase.id))
  }, [testCases])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (running && (event.key === 'F5' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r'))) {
        event.preventDefault()
        setRefreshConfirmOpen(true)
      }
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!running) return
      const active = activeRunRef.current
      if (active)
        navigator.sendBeacon(
          '/api/automation/stop',
          new Blob([JSON.stringify({ runId: active.runId })], { type: 'application/json' })
        )
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [running])

  const generated = useMemo(
    () =>
      selected ? (framework === 'playwright' ? generatePlaywrightTest(selected) : generateCypressTest(selected)) : '',
    [framework, selected]
  )
  const overrideKey = selected ? `${framework}:${selected.id}` : ''
  const code = overrides[overrideKey] ?? generated
  function beginEdit() {
    setDraftCode(code)
    setEditing(true)
  }
  function saveEdit() {
    const next = { ...overrides, [overrideKey]: draftCode }
    setOverrides(next)
    localStorage.setItem(`lazyscout.automation.${projectId}`, JSON.stringify(next))
    setEditing(false)
  }
  function regenerate() {
    const next = { ...overrides }
    delete next[overrideKey]
    setOverrides(next)
    localStorage.setItem(`lazyscout.automation.${projectId}`, JSON.stringify(next))
    setEditing(false)
  }
  function codeFor(testCase: TestCase) {
    const key = `${framework}:${testCase.id}`
    return (
      overrides[key] ?? (framework === 'playwright' ? generatePlaywrightTest(testCase) : generateCypressTest(testCase))
    )
  }
  async function runOne(testCase: TestCase, source: string) {
    const runId = crypto.randomUUID()
    const controller = new AbortController()
    activeRunRef.current = { runId, controller }
    try {
      const result = await runAutomation(testCase, framework, source, secrets, runId, controller.signal)
      onRunStatus?.(
        testCase.id,
        result.status === 'passed' ? 'passed' : result.status === 'failed' ? 'failed' : 'pending'
      )
      onRunResult?.(testCase.id, result)
      return result
    } catch (error) {
      const stopped = stopRequestedRef.current || (error instanceof DOMException && error.name === 'AbortError')
      const result = {
        status: stopped ? ('stopped' as const) : ('failed' as const),
        framework,
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: stopped ? ('warn' as const) : ('fail' as const),
            message: stopped ? 'Run stopped by user.' : error instanceof Error ? error.message : String(error)
          }
        ]
      }
      onRunStatus?.(testCase.id, stopped ? 'pending' : 'failed')
      onRunResult?.(testCase.id, result)
      return result
    } finally {
      if (activeRunRef.current?.runId === runId) activeRunRef.current = undefined
    }
  }
  async function stopActiveRun() {
    stopRequestedRef.current = true
    const active = activeRunRef.current
    if (active) {
      active.controller.abort()
      void stopAutomation(active.runId).catch(() => undefined)
    }
    setStopConfirmOpen(false)
    setRefreshConfirmOpen(false)
    setRunLogs((current) => [
      ...current,
      {
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: 'Stop requested. Closing the active Playwright session…'
      }
    ])
  }
  async function runSelected() {
    if (!selected || running) return
    stopRequestedRef.current = false
    setRunning(true)
    setRunStatus(undefined)
    setRunLogs([])
    const result = await runOne(selected, code)
    setRunStatus(result.status)
    setRunLogs(result.logs)
    setRunning(false)
  }
  async function runAll() {
    if (running) return
    const queue = filteredCases.filter((testCase) => runEnabled.includes(testCase.id)).slice(0, 50)
    stopRequestedRef.current = false
    setRunning(true)
    setRunStatus('running')
    setRunLogs([
      { timestamp: new Date().toISOString(), level: 'info', message: `$ lazyscout test --all --project ${projectId}` },
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Selected cases: ${queue.length}/${filteredCases.length} in current filter · Run budget: 50 cases`
      }
    ])
    if (queue.length === 0) {
      setRunLogs((current) => [
        ...current,
        { timestamp: new Date().toISOString(), level: 'warn', message: 'No test cases selected. Nothing to run.' }
      ])
      setRunStatus('pending')
      setRunning(false)
      return
    }
    let failed = false
    for (const testCase of queue) {
      if (stopRequestedRef.current) break
      const result = await runOne(testCase, codeFor(testCase))
      if (result.status === 'failed') failed = true
      setRunLogs((current) => [...current, ...result.logs])
      if (result.status === 'stopped') break
    }
    setRunStatus(stopRequestedRef.current ? 'stopped' : failed ? 'failed' : 'passed')
    setRunning(false)
  }
  function copyCode() {
    void navigator.clipboard?.writeText(code)
  }
  function downloadCode() {
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selected?.id ?? 'lazyscout-test'}.${framework === 'playwright' ? 'spec.ts' : 'cy.ts'}`
    link.click()
    URL.revokeObjectURL(url)
  }
  function confirmRefresh() {
    void stopActiveRun()
    window.location.reload()
  }

  return (
    <section className="automation-page">
      <div className="automation-header">
        <div>
          <p className="eyebrow">Automation workspace</p>
          <h2>Generated Tests</h2>
          <p>Edit the generated file per Test Case, then run one case or selected cases.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="automation-run-filter"
            value={runFilter}
            disabled={running}
            onChange={(event) => setRunFilter(event.target.value)}
          >
            {runFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="automation-selected-count">
            {selectedInFilter}/{filteredCases.length} selected
          </span>
          {running ? (
            <button type="button" className="btn btn-danger" onClick={() => setStopConfirmOpen(true)}>
              ■ Stop run
            </button>
          ) : (
            <button type="button" className="btn btn-dark" onClick={runAll}>
              ▶ Run selected cases
            </button>
          )}
        </div>
      </div>
      <div className="automation-layout">
        <aside className="automation-case-list">
          <div className="automation-filter-head">
            <span className="field-label">
              Test files ({filteredCases.length}/{testCases.length})
            </span>
            <span>{runFilter === 'all' ? 'All' : 'Filtered'}</span>
          </div>
          {filteredCases.map((testCase) => (
            <button
              type="button"
              key={testCase.id}
              className={selected?.id === testCase.id ? 'selected' : ''}
              onClick={() => {
                setSelectedId(testCase.id)
                setEditing(false)
              }}
            >
              <input
                type="checkbox"
                checked={runEnabled.includes(testCase.id)}
                onChange={(event) => {
                  event.stopPropagation()
                  setRunEnabled((current) =>
                    event.target.checked ? [...current, testCase.id] : current.filter((id) => id !== testCase.id)
                  )
                }}
                onClick={(event) => event.stopPropagation()}
                aria-label={`Run ${testCase.id}`}
              />
              <span className="case-file-icon">
                {overrides[`playwright:${testCase.id}`] || overrides[`cypress:${testCase.id}`] ? '●' : '○'}
              </span>
              <span>
                <b>{testCase.id}</b>
                <small>{testCase.title}</small>
                {testCase.tags?.length ? (
                  <em className="automation-tag">{testCase.tags.slice(0, 2).join(' · ')}</em>
                ) : null}
              </span>
            </button>
          ))}
        </aside>
        <div className="automation-editor">
          <div className="automation-toolbar">
            <select
              className="field"
              value={framework}
              onChange={(event) => setFramework(event.target.value as Framework)}
              disabled={running}
            >
              <option value="playwright">Playwright</option>
              <option value="cypress">Cypress</option>
            </select>
            <span className="automation-source">{selected?.sourceUrl}</span>
            <div className="ml-auto flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={beginEdit} disabled={editing || running}>
                Edit code
              </button>
              <button type="button" className="btn btn-secondary" onClick={regenerate} disabled={running}>
                Regenerate
              </button>
              <button type="button" className="btn btn-secondary" onClick={copyCode}>
                Copy
              </button>
              <button type="button" className="btn btn-primary" onClick={downloadCode}>
                Save file
              </button>
              <button type="button" className="btn btn-dark" onClick={runSelected} disabled={running || !selected}>
                ▶ Run
              </button>
            </div>
          </div>
          {editing ? (
            <div className="code-edit-area">
              <CodeEditor value={draftCode} framework={framework} onChange={setDraftCode} />
              <div className="code-edit-actions">
                <span className="muted">VS Code style editor · Ctrl+Space for suggestions.</span>
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={saveEdit}>
                  Save code
                </button>
              </div>
            </div>
          ) : (
            <pre className="automation-code">{code || 'No Test Cases are available to generate.'}</pre>
          )}
          {runStatus && (
            <div className="terminal-panel">
              <div className="terminal-head">
                <span>
                  <i /> CLI output
                </span>
                <b
                  className={
                    runStatus === 'passed'
                      ? 'terminal-pass'
                      : runStatus === 'failed'
                        ? 'terminal-fail'
                        : 'terminal-warn'
                  }
                >
                  {runStatus.toUpperCase()}
                </b>
              </div>
              <div className="terminal-body">
                {runLogs.map((log, index) => (
                  <div key={`${log.timestamp}-${index}`} className={`terminal-line terminal-${log.level}`}>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    {log.message}
                    {log.durationMs !== undefined && <em>{log.durationMs}ms</em>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {stopConfirmOpen && (
        <ConfirmModal
          title="Stop the running tests?"
          message="The active Playwright session will be closed. Remaining selected Test Cases will not run."
          confirmLabel="Stop run"
          onCancel={() => setStopConfirmOpen(false)}
          onConfirm={() => void stopActiveRun()}
        />
      )}
      {refreshConfirmOpen && (
        <ConfirmModal
          title="Stop tests and refresh?"
          message="Refreshing now will stop the active Playwright session and cancel the remaining selected Test Cases."
          confirmLabel="Stop and refresh"
          onCancel={() => setRefreshConfirmOpen(false)}
          onConfirm={confirmRefresh}
        />
      )}
    </section>
  )
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm
}: {
  title: string
  message: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="modern-modal-backdrop">
      <section className="modern-modal run-confirm-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Running tests</p>
            <h2>{title}</h2>
            <p>{message}</p>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Keep running
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
