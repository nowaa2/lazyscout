import { useState } from 'react'
import type { ProjectSecrets, TestStep } from '../types'
import { openWorkspaceAuthSession } from '../api/client'
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
  const update = (key: keyof ProjectSecrets, value: string) =>
    setDraft((current) => ({ ...current, [key]: value || undefined }))
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
          {projectId && targetUrl && (
            <div className="settings-notice settings-notice-stacked">
              <b>Google / SSO session</b>
              <span>
                Open a separate LazyScout browser, sign in manually, then close that browser. Future Automation runs use
                its local session.
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void openWorkspaceAuthSession(projectId, targetUrl)}
              >
                Open login browser
              </button>
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
