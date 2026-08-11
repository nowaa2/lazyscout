import { useEffect, useState } from 'react'
import type { ProjectSecrets, TestStep } from '../types'
import {
  clearWorkspaceAuthSession,
  getWorkspaceAuthSessionStatus,
  openWorkspaceAuthSession,
  type WorkspaceAuthSessionStatus
} from '../api/client'
import { RecorderPanel } from './RecorderPanel'
import { ClickFilterPanel } from './ClickFilterPanel'
import type { ClickFilter } from '../hooks/useClickFilter'

type Props = {
  projectName?: string
  projectId?: string
  targetUrl?: string
  secrets: ProjectSecrets
  onSave: (secrets: ProjectSecrets) => void
  onClear: () => void
  onClose: () => void
  onSaveRecording?: (steps: TestStep[], title: string, sourceUrl: string) => void
  clickFilter: ClickFilter
  onChangeClickFilter: (filter: ClickFilter) => void
}

export function ProjectSettings({
  projectName,
  projectId,
  targetUrl,
  secrets,
  onSave,
  onClear,
  onClose,
  onSaveRecording,
  clickFilter,
  onChangeClickFilter
}: Props) {
  const [draft, setDraft] = useState<ProjectSecrets>(secrets)
  const [authStatus, setAuthStatus] = useState<WorkspaceAuthSessionStatus>()
  const [authStatusLoading, setAuthStatusLoading] = useState(false)
  const [authOpening, setAuthOpening] = useState(false)
  const [authClearConfirm, setAuthClearConfirm] = useState(false)
  const update = (key: keyof ProjectSecrets, value: string) =>
    setDraft((current) => ({ ...current, [key]: value || undefined }))

  async function refreshAuthStatus() {
    if (!projectId) return
    setAuthStatusLoading(true)
    try {
      setAuthStatus(await getWorkspaceAuthSessionStatus(projectId))
    } catch {
      setAuthStatus(undefined)
    } finally {
      setAuthStatusLoading(false)
    }
  }

  useEffect(() => {
    void refreshAuthStatus()
  }, [projectId])
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="modal-card project-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-settings-title"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">Project settings</p>
            <h2 id="project-settings-title">Test credentials</h2>
            <p>{projectName ?? 'Current project'} · Used by Automation and Test API</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="settings-notice">
            <b>Memory only</b>
            <span>
              Values stay in this browser tab, are cleared on refresh and are never written to Test Cases or logs.
            </span>
          </div>
          <div className="settings-grid">
            <label>
              <span>Email</span>
              <input
                type="email"
                value={draft.email ?? ''}
                onChange={(event) => update('email', event.target.value)}
                placeholder="Test email"
                autoComplete="off"
              />
            </label>
            <label>
              <span>Username</span>
              <input
                value={draft.username ?? ''}
                onChange={(event) => update('username', event.target.value)}
                placeholder="Test username"
                autoComplete="off"
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={draft.password ?? ''}
                onChange={(event) => update('password', event.target.value)}
                placeholder="Test password"
                autoComplete="off"
              />
            </label>
            <label>
              <span>API Token</span>
              <input
                type="password"
                value={draft.apiToken ?? ''}
                onChange={(event) => update('apiToken', event.target.value)}
                placeholder="API token"
                autoComplete="off"
              />
            </label>
          </div>
          <p className="settings-help">
            Use <code>{'{{TEST_PASSWORD}}'}</code>, <code>{'{{TEST_EMAIL}}'}</code>, <code>{'{{TEST_USERNAME}}'}</code>{' '}
            or <code>{'{{API_TOKEN}}'}</code> in a Test Case. Values are passed to the runner only while it runs.
          </p>
          <div className="settings-notice settings-notice-stacked">
            <b>How to connect credentials to Guided Flow</b>
            <span>
              In a Fill step, leave Value empty and put <code>TEST_USERNAME</code>, <code>TEST_PASSWORD</code>, or{' '}
              <code>TEST_EMAIL</code> in Value reference. LazyScout replaces the reference only during the run.
            </span>
          </div>
          {projectId && targetUrl && (
            <div className="settings-notice settings-notice-stacked">
              <b>Google / SSO session</b>
              <span>
                Open a separate LazyScout browser, sign in manually, then close that browser. Future Automation runs use
                this Project profile.
              </span>
              <div className="auth-session-status" aria-live="polite">
                <span
                  className={`auth-session-dot ${authStatus?.cookieStoreDetected ? 'is-ready' : authStatus?.profileExists ? 'is-profile' : ''}`}
                />
                <div>
                  <b>
                    {authStatus?.cookieStoreDetected
                      ? 'Browser profile saved'
                      : authStatus?.profileExists
                        ? 'Browser profile created — login not verified'
                        : 'No saved browser profile yet'}
                  </b>
                  <small>
                    {authStatus?.lastModifiedAt
                      ? `Last changed ${new Date(authStatus.lastModifiedAt).toLocaleString()}`
                      : 'Open the login browser to create this Project profile.'}
                  </small>
                </div>
              </div>
              <div className="auth-session-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={authOpening}
                  onClick={async () => {
                    setAuthOpening(true)
                    try {
                      await openWorkspaceAuthSession(projectId, targetUrl)
                      await refreshAuthStatus()
                    } finally {
                      setAuthOpening(false)
                    }
                  }}
                >
                  {authOpening ? 'Opening browser…' : 'Open login browser'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={authStatusLoading}
                  onClick={() => void refreshAuthStatus()}
                >
                  {authStatusLoading ? 'Checking…' : 'Refresh session status'}
                </button>
                {!authClearConfirm ? (
                  <button type="button" className="btn btn-danger" onClick={() => setAuthClearConfirm(true)}>
                    Clear saved session
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={async () => {
                        await clearWorkspaceAuthSession(projectId)
                        setAuthClearConfirm(false)
                        await refreshAuthStatus()
                      }}
                    >
                      Confirm clear
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setAuthClearConfirm(false)}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
              <small className="auth-session-hint">
                Profile saved confirms that browser data exists. To verify Google / SSO is still valid, Scout the
                authenticated Start Path, such as <code>/dashboard</code>.
              </small>
            </div>
          )}
          <ClickFilterPanel filter={clickFilter} onChange={onChangeClickFilter} />
          {projectId && targetUrl && onSaveRecording && (
            <RecorderPanel projectId={projectId} targetUrl={targetUrl} onSaveRecording={onSaveRecording} />
          )}
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary mr-auto"
            onClick={() => {
              onClear()
              setDraft({})
            }}
          >
            Clear secrets
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            Save settings
          </button>
        </div>
      </section>
    </div>
  )
}
