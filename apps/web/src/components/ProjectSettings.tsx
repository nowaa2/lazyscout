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
import { useLanguage } from '../i18n'

export type ProjectSettingsTab = 'credentials' | 'session' | 'safety' | 'recorder'

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
  initialTab?: ProjectSettingsTab
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
  onChangeClickFilter,
  initialTab = 'credentials'
}: Props) {
  const { language } = useLanguage()
  const th = language === 'th'
  const [activeTab, setActiveTab] = useState<ProjectSettingsTab>(initialTab)
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
            <p className="eyebrow">{th ? 'ตั้งค่าโปรเจกต์' : 'Project settings'}</p>
            <h2 id="project-settings-title">
              {activeTab === 'credentials'
                ? th
                  ? 'ข้อมูลสำหรับทดสอบ'
                  : 'Test credentials'
                : activeTab === 'session'
                  ? th
                    ? 'Browser session'
                    : 'Browser session'
                  : activeTab === 'safety'
                    ? th
                      ? 'กฎความปลอดภัย'
                      : 'Safety rules'
                    : th
                      ? 'บันทึก Flow'
                      : 'Record a flow'}
            </h2>
            <p>
              {projectName ?? (th ? 'โปรเจกต์ปัจจุบัน' : 'Current project')} ·{' '}
              {th ? 'ตั้งค่าทีละหมวด' : 'Configure one task at a time'}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <nav className="settings-tabs" aria-label="Project settings sections">
          {(
            [
              [
                'credentials',
                th ? 'ข้อมูลทดสอบ' : 'Credentials',
                th ? 'ตัวแปรสำหรับ Login และ API' : 'Variables used by login and API steps'
              ],
              [
                'session',
                'Browser Session',
                th ? 'Google, SSO และ Cookie ที่บันทึกไว้' : 'Google, SSO, and saved cookies'
              ],
              [
                'safety',
                th ? 'ความปลอดภัย' : 'Safety',
                th ? 'ป้องกันการคลิกที่มีความเสี่ยง' : 'Block risky clicks and actions'
              ],
              [
                'recorder',
                'Recorder',
                th ? 'เปลี่ยนการกดของคุณเป็น Test Step' : 'Turn your browser actions into Test Steps'
              ]
            ] as Array<[ProjectSettingsTab, string, string]>
          ).map(([key, label, hint]) => (
            <button
              key={key}
              type="button"
              className={activeTab === key ? 'is-active' : ''}
              onClick={() => setActiveTab(key)}
            >
              <b>{label}</b>
              <small>{hint}</small>
            </button>
          ))}
        </nav>
        <div className="modal-body">
          {activeTab === 'credentials' && (
            <div className="settings-section">
              <div className="settings-notice">
                <b>{th ? 'เก็บในหน่วยความจำเท่านั้น' : 'Memory only'}</b>
                <span>
                  {th
                    ? 'ข้อมูลจะอยู่ในแท็บนี้เท่านั้น ถูกล้างเมื่อ Refresh และไม่ถูกเขียนลง Test Case หรือ Log'
                    : 'Values stay in this browser tab, are cleared on refresh and are never written to Test Cases or logs.'}
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
                Use <code>{'{{TEST_PASSWORD}}'}</code>, <code>{'{{TEST_EMAIL}}'}</code>,{' '}
                <code>{'{{TEST_USERNAME}}'}</code> or <code>{'{{API_TOKEN}}'}</code> in a Test Case. Values are passed
                to the runner only while it runs.
              </p>
              <div className="settings-notice settings-notice-stacked">
                <b>{th ? 'วิธีใช้ข้อมูลทดสอบกับ Guided Flow' : 'How to connect credentials to Guided Flow'}</b>
                <span>
                  {th ? 'ในขั้นตอน Fill ให้เว้น Value ว่าง แล้วใส่ ' : 'In a Fill step, leave Value empty and put '}
                  <code>TEST_USERNAME</code>, <code>TEST_PASSWORD</code>, {th ? 'หรือ' : 'or'} <code>TEST_EMAIL</code>{' '}
                  {th
                    ? 'ใน Value reference โดย LazyScout จะแทนค่าตอนรันเท่านั้น'
                    : 'in Value reference. LazyScout replaces the reference only during the run.'}
                </span>
              </div>
            </div>
          )}
          {activeTab === 'session' && projectId && targetUrl && (
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
          {activeTab === 'session' && (!projectId || !targetUrl) && (
            <div className="settings-empty-state">
              <b>{th ? 'Scout เว็บไซต์ก่อน' : 'Scout a website first'}</b>
              <span>
                {th
                  ? 'ต้องมี Target URL ก่อน LazyScout จึงจะสร้าง Browser Session ที่ใช้ซ้ำได้'
                  : 'A target URL is required before LazyScout can create a reusable browser session.'}
              </span>
            </div>
          )}
          {activeTab === 'safety' && <ClickFilterPanel filter={clickFilter} onChange={onChangeClickFilter} />}
          {activeTab === 'recorder' && projectId && targetUrl && onSaveRecording && (
            <RecorderPanel projectId={projectId} targetUrl={targetUrl} onSaveRecording={onSaveRecording} />
          )}
          {activeTab === 'recorder' && (!projectId || !targetUrl) && (
            <div className="settings-empty-state">
              <b>{th ? 'เพิ่ม Target URL ก่อน' : 'Add a target URL first'}</b>
              <span>
                {th
                  ? 'Scout เว็บไซต์หนึ่งครั้ง แล้วกลับมาบันทึก Login และ Business Flow ที่นี่'
                  : 'Scout a website once, then return here to record login and business flows.'}
              </span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {activeTab === 'credentials' && (
            <button
              type="button"
              className="btn btn-secondary mr-auto"
              onClick={() => {
                onClear()
                setDraft({})
              }}
            >
              {th ? 'ล้างข้อมูลทดสอบ' : 'Clear secrets'}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {th ? 'ปิด' : 'Close'}
          </button>
          {activeTab === 'credentials' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onSave(draft)
                onClose()
              }}
            >
              {th ? 'บันทึกข้อมูลทดสอบ' : 'Save credentials'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
