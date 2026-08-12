import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type WheelEvent } from 'react'
import { describeStep, type RecorderInspection } from '@lazyscout/core'
import type { TargetRef, TestStep } from '../types'
import { useRecorder } from '../hooks/useRecorder'
import { SECRET_PLACEHOLDER } from '../lib/recorderText'
import { recorderFrameUrl } from '../api/client'

type Props = {
  projectId: string
  targetUrl: string
  onSaveRecording: (steps: TestStep[], title: string, sourceUrl: string) => void
  onPickTarget?: (target: TargetRef) => void
}

const DEFAULT_TITLE = 'Recorded login'
const FRAME_DELAY_MS = 160

export function RecorderPanel({ projectId, targetUrl, onSaveRecording, onPickTarget }: Props) {
  const { state, recording, busy, error, start, stop, reset, inspectMode, toggleInspectMode, interact } =
    useRecorder(projectId)
  const [title, setTitle] = useState(DEFAULT_TITLE)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [frameVersion, setFrameVersion] = useState(0)
  const [address, setAddress] = useState(targetUrl)
  const [addressFocused, setAddressFocused] = useState(false)
  const lastMoveAt = useRef(0)
  const frameTimer = useRef<number | undefined>(undefined)

  const steps = state.steps
  const finished = state.status === 'stopped' && steps.length > 0

  useEffect(() => {
    if (!addressFocused && state.currentUrl) setAddress(state.currentUrl)
  }, [addressFocused, state.currentUrl])

  useEffect(() => {
    if (!workspaceOpen || !recording) return
    setFrameVersion(Date.now())
    return () => {
      if (frameTimer.current !== undefined) window.clearTimeout(frameTimer.current)
    }
  }, [recording, workspaceOpen])

  const scheduleNextFrame = () => {
    if (frameTimer.current !== undefined) window.clearTimeout(frameTimer.current)
    frameTimer.current = window.setTimeout(() => setFrameVersion(Date.now()), FRAME_DELAY_MS)
  }

  const refreshAfter = async (interaction: Parameters<typeof interact>[0]) => {
    await interact(interaction)
    setFrameVersion(Date.now())
  }

  useEffect(() => {
    if (!workspaceOpen) return
    const body = document.body
    const root = document.documentElement
    const previousBodyOverflow = body.style.overflow
    const previousBodyPaddingRight = body.style.paddingRight
    const previousRootOverflow = root.style.overflow
    const scrollbarWidth = window.innerWidth - root.clientWidth
    body.style.overflow = 'hidden'
    root.style.overflow = 'hidden'
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`
    return () => {
      body.style.overflow = previousBodyOverflow
      body.style.paddingRight = previousBodyPaddingRight
      root.style.overflow = previousRootOverflow
    }
  }, [workspaceOpen])

  const pointFromEvent = (event: MouseEvent<HTMLImageElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * event.currentTarget.naturalWidth,
      y: ((event.clientY - bounds.top) / bounds.height) * event.currentTarget.naturalHeight
    }
  }

  const handleBrowserKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing || ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return
    event.preventDefault()
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      void refreshAfter({ type: 'text', text: event.key })
      return
    }
    const modifiers = [
      event.ctrlKey && 'Control',
      event.altKey && 'Alt',
      event.metaKey && 'Meta',
      event.shiftKey && 'Shift'
    ]
      .filter(Boolean)
      .join('+')
    void refreshAfter({ type: 'key', key: modifiers ? `${modifiers}+${event.key}` : event.key })
  }

  const handleBrowserWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    void refreshAfter({ type: 'scroll', deltaX: event.deltaX, deltaY: event.deltaY })
  }

  const navigateFromAddress = () => {
    const value = address.trim()
    if (!value || !recording) return
    let url = value
    try {
      url = new URL(value, state.currentUrl || targetUrl).toString()
    } catch {
      return
    }
    void refreshAfter({ type: 'navigate', url })
  }

  // The next recording is a new Test Case, so nothing from the saved one is kept.
  const clear = () => {
    reset()
    setTitle(DEFAULT_TITLE)
    setWorkspaceOpen(false)
  }

  const save = () => {
    onSaveRecording(steps, title.trim() || 'Recorded flow', state.startUrl || targetUrl)
    clear()
  }

  const pickTarget = async (inspection: RecorderInspection) => {
    if (!onPickTarget) return
    const target = targetFromInspection(inspection)
    await stop()
    reset()
    setWorkspaceOpen(false)
    onPickTarget(target)
  }

  return (
    <div className="settings-notice settings-notice-stacked recorder-panel">
      <b>Record a flow</b>
      <span>Start the Cypress-style workspace to record clicks, typing, and element locators.</span>

      {error && <p className="recorder-error">{error}</p>}

      {!recording && !finished && (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => {
            setWorkspaceOpen(true)
            void start(targetUrl)
          }}
        >
          {busy ? 'Starting…' : 'Start recording'}
        </button>
      )}

      {recording && !workspaceOpen && (
        <button type="button" className="btn btn-primary" onClick={() => setWorkspaceOpen(true)}>
          Open recorder workspace
        </button>
      )}

      {/* {recording && (
        <>
          <p className="recorder-status">
            <span className="recorder-dot" aria-hidden="true" />
            Recording in {state.browserLabel ?? 'the browser'} — {steps.length} step
            {steps.length === 1 ? '' : 's'}. Close the window or press Stop when you are done.
          </p>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void stop()}>
            {busy ? 'Stopping…' : 'Stop recording'}
          </button>
          <div className="recorder-inspect-actions">
            <button
              type="button"
              className={inspectMode ? 'btn btn-primary' : 'btn btn-secondary'}
              disabled={busy}
              onClick={() => void toggleInspectMode()}
            >
              {inspectMode ? 'Inspecting element' : 'Inspect element'}
            </button>
            {inspectMode && (
              <small className="recorder-inspect-hint">Hover an element, then click it to inspect its locator.</small>
            )}
          </div>
        </>
      )} */}

      {!workspaceOpen && recording && state.inspection && (
        <div className="recorder-inspection" aria-live="polite">
          <div className="recorder-inspection-heading">
            <b>Selected element</b>
            <code>&lt;{state.inspection.tagName}&gt;</code>
          </div>
          {state.inspection.accessibleName && <span>Accessible name: {state.inspection.accessibleName}</span>}
          {state.inspection.role && <span>Role: {state.inspection.role}</span>}
          {state.inspection.id && <span>ID: {state.inspection.id}</span>}
          {state.inspection.name && <span>Name: {state.inspection.name}</span>}
          <label>
            CSS selector
            <code>{state.inspection.cssSelector}</code>
          </label>
          <label>
            Playwright locator
            <code>{state.inspection.playwrightLocator}</code>
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void navigator.clipboard?.writeText(state.inspection?.playwrightLocator ?? '')}
          >
            Copy locator
          </button>
        </div>
      )}

      {!workspaceOpen && steps.length > 0 && (
        <ol className="recorder-steps">
          {steps.map((step, index) => (
            <li key={`${index}-${step.type}`}>
              <span className="recorder-step-index">{index + 1}</span>
              <span>{describeStep(step)}</span>
            </li>
          ))}
        </ol>
      )}

      {!workspaceOpen && finished && (
        <>
          <label className="recorder-title">
            <span>Test Case title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Recorded login" />
          </label>
          <div className="recorder-actions">
            <button type="button" className="btn btn-primary" onClick={save}>
              Save as Test Case
            </button>
            <button type="button" className="btn btn-secondary" onClick={clear}>
              Discard
            </button>
          </div>
        </>
      )}

      {state.status === 'stopped' && steps.length === 0 && (
        <p className="recorder-status">No steps were recorded. Start again and interact with the page.</p>
      )}

      {workspaceOpen && (
        <div className="modern-modal-backdrop recorder-workspace-backdrop" role="presentation">
          <section
            className="modern-modal recorder-workspace-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recorder-workspace-title"
          >
            <header className="modal-header">
              <div>
                <p className="eyebrow">Cypress-style recorder</p>
                <h2 id="recorder-workspace-title">Record and inspect</h2>
                <p>
                  Control the recorder from the left and preview the target page on the right. Your clicks and typing
                  become Test Steps. Passwords are never read and are saved as <code>{SECRET_PLACEHOLDER}</code>.
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label="Close recorder workspace"
                onClick={() => setWorkspaceOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="recorder-workspace-body">
              <aside className="recorder-workspace-sidebar">
                <span className="recorder-workspace-status">{recording ? '● Recording' : '○ Recorder idle'}</span>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={!recording || busy}
                  onClick={() => void stop()}
                >
                  {busy ? 'Stopping…' : 'Stop recording'}
                </button>
                <button
                  type="button"
                  className={inspectMode ? 'btn btn-primary' : 'btn btn-secondary'}
                  disabled={!recording || busy}
                  onClick={() => void toggleInspectMode()}
                >
                  {inspectMode ? 'Inspecting element' : 'Inspect element'}
                </button>
                <p className="recorder-workspace-help">
                  Hover to preview. Click an element to lock it while scrolling, click another element to switch, or
                  click empty space to unlock.
                </p>
                {state.inspection && (
                  <div className="recorder-workspace-selection">
                    <div className="recorder-inspection-lock-row">
                      <b>Selected element</b>
                      <span className={state.inspection.locked ? 'is-locked' : ''}>
                        {state.inspection.locked ? 'Locked' : 'Hover preview'}
                      </span>
                    </div>
                    <code>&lt;{state.inspection.tagName}&gt;</code>
                    {state.inspection.accessibleName && <span>{state.inspection.accessibleName}</span>}
                    <code>{state.inspection.playwrightLocator}</code>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void navigator.clipboard?.writeText(state.inspection?.playwrightLocator ?? '')}
                    >
                      Copy locator
                    </button>
                    {onPickTarget && state.inspection.locked && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => void pickTarget(state.inspection!)}
                      >
                        Use this element
                      </button>
                    )}
                  </div>
                )}
                {steps.length > 0 && (
                  <ol className="recorder-workspace-steps">
                    {steps.map((step, index) => (
                      <li key={`${index}-${step.type}`}>
                        <span>{index + 1}</span>
                        <p>{describeStep(step)}</p>
                      </li>
                    ))}
                  </ol>
                )}
                {finished && (
                  <div className="recorder-workspace-save">
                    <label>
                      Test Case title
                      <input value={title} onChange={(event) => setTitle(event.target.value)} />
                    </label>
                    <button type="button" className="btn btn-primary" onClick={save}>
                      Save as Test Case
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={clear}>
                      Discard
                    </button>
                  </div>
                )}
                <span className="recorder-workspace-count">Recorded steps: {steps.length}</span>
              </aside>
              <main className="recorder-workspace-preview">
                <div className="recorder-workspace-browser-bar">
                  <button
                    type="button"
                    aria-label="Back"
                    disabled={!recording}
                    onClick={() => void refreshAfter({ type: 'back' })}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label="Forward"
                    disabled={!recording}
                    onClick={() => void refreshAfter({ type: 'forward' })}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    aria-label="Reload"
                    disabled={!recording}
                    onClick={() => void refreshAfter({ type: 'reload' })}
                  >
                    ↻
                  </button>
                  <form
                    className="recorder-workspace-address-form"
                    onSubmit={(event) => {
                      event.preventDefault()
                      navigateFromAddress()
                    }}
                  >
                    <input
                      className="recorder-workspace-url"
                      value={address}
                      disabled={!recording}
                      aria-label="Browser address"
                      spellCheck={false}
                      onFocus={() => setAddressFocused(true)}
                      onBlur={() => setAddressFocused(false)}
                      onChange={(event) => setAddress(event.target.value)}
                    />
                    <button type="submit" className="recorder-address-go" disabled={!recording || !address.trim()}>
                      Go
                    </button>
                  </form>
                </div>
                <div
                  className="recorder-browser-viewport"
                  style={{ cursor: state.pointerCursor ?? 'default' }}
                  role="application"
                  tabIndex={0}
                  aria-label="Interactive Playwright browser"
                  onKeyDown={handleBrowserKey}
                  onCompositionEnd={(event) => void refreshAfter({ type: 'text', text: event.data })}
                  onPaste={(event) => {
                    event.preventDefault()
                    void refreshAfter({ type: 'text', text: event.clipboardData.getData('text') })
                  }}
                  onWheel={handleBrowserWheel}
                >
                  {recording ? (
                    <img
                      src={recorderFrameUrl(projectId, frameVersion)}
                      alt="Live Playwright browser"
                      draggable={false}
                      style={{ cursor: state.pointerCursor ?? 'default' }}
                      onLoad={scheduleNextFrame}
                      onError={scheduleNextFrame}
                      onClick={(event) => {
                        event.currentTarget.parentElement?.focus()
                        void refreshAfter({ type: 'click', ...pointFromEvent(event) })
                      }}
                      onMouseMove={(event) => {
                        if (Date.now() - lastMoveAt.current < 80) return
                        lastMoveAt.current = Date.now()
                        void interact({ type: 'move', ...pointFromEvent(event) })
                      }}
                    />
                  ) : (
                    <div className="recorder-browser-loading">
                      {finished
                        ? 'Recording stopped. Save the Test Case from the left panel.'
                        : 'Starting Playwright browser…'}
                    </div>
                  )}
                </div>
                <p>
                  Click the page, type normally, paste text, or scroll here. Actions are sent to Playwright directly.
                </p>
                <div className="hidden" aria-hidden="true">
                  <span className="recorder-live-browser-icon" aria-hidden="true">
                    ◉
                  </span>
                  <b>Live Playwright browser</b>
                  <p>
                    Interact with the browser window opened by LazyScout. This modal controls the same recording session
                    and prevents the target page from being opened a second time.
                  </p>
                  <span className="recorder-live-browser-note">
                    The page is intentionally not embedded in an iframe.
                  </span>
                </div>
              </main>
            </div>
            <footer className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setWorkspaceOpen(false)}>
                Close workspace
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}

function targetFromInspection(inspection: RecorderInspection): TargetRef {
  if (inspection.role && inspection.accessibleName) {
    return {
      strategy: 'role',
      role: inspection.role,
      name: inspection.accessibleName,
      cssSelector: inspection.cssSelector
    }
  }
  return { strategy: 'css', cssSelector: inspection.cssSelector }
}
