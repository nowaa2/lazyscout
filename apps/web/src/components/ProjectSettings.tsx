import { useEffect, useState } from 'react'
import type { ProjectSecrets, TestStep } from '../types'
import {
  captureWorkspaceAuthSession,
  clearWorkspaceAuthSession,
  getWorkspaceAuthSessionStatus,
  openWorkspaceAuthSession,
  verifyWorkspaceAuthSession,
  type WorkspaceAuthSessionStatus
} from '../api/client'
import { RecorderPanel } from './RecorderPanel'
import { ClickFilterPanel } from './ClickFilterPanel'
import type { ClickFilter } from '../hooks/useClickFilter'
import { useLanguage } from '../i18n'

export type ProjectSettingsTab = 'credentials' | 'session' | 'safety' | 'recorder'

/** [English, Thai] headline for each session state. */
const authStateLabel: Record<string, [string, string]> = {
  'not-configured': ['No session saved', 'ยังไม่มี Session'],
  recorded: ['Session saved — not verified yet', 'บันทึกแล้ว — ยังไม่ได้ตรวจสอบ'],
  verifying: ['Checking…', 'กำลังตรวจสอบ…'],
  ready: ['Ready — a protected page opened', 'พร้อมใช้ — เปิดหน้าที่ต้องล็อกอินได้'],
  expired: ['Expired — sign in again', 'หมดอายุ — ต้องเข้าสู่ระบบใหม่'],
  invalid: ['Unusable — record the login again', 'ใช้ไม่ได้ — บันทึกการ Login ใหม่']
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

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
  const [authCapturing, setAuthCapturing] = useState(false)
  const [authVerifying, setAuthVerifying] = useState(false)
  const [authClearConfirm, setAuthClearConfirm] = useState(false)
  const [loginBrowserOpen, setLoginBrowserOpen] = useState(false)
  const [authError, setAuthError] = useState<string>()
  const [verifyPath, setVerifyPath] = useState('/')
  const [saved, setSaved] = useState(false)
  const update = (key: keyof ProjectSecrets, value: string) =>
    setDraft((current) => ({ ...current, [key]: value || undefined }))

  const authState = authStatus?.status ?? 'not-configured'
  const authBusy = authOpening || authCapturing || authVerifying
  const hasSnapshot = authState !== 'not-configured'
  const dirty = JSON.stringify(draft) !== JSON.stringify(secrets)

  const authDetail =
    authStatus?.detail ??
    (authStatus?.verifiedAt
      ? `${th ? 'ตรวจล่าสุด' : 'Last verified'} ${new Date(authStatus.verifiedAt).toLocaleString()}${
          authStatus.verifiedPath ? ` · ${authStatus.verifiedPath}` : ''
        }`
      : authStatus?.capturedAt
        ? `${th ? 'บันทึกเมื่อ' : 'Captured'} ${new Date(authStatus.capturedAt).toLocaleString()}`
        : th
          ? 'ยังไม่ได้บันทึก Session สำหรับโปรเจกต์นี้'
          : 'No session has been recorded for this Project yet.')

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
            // The description lives in the tooltip rather than a second line:
            // as a subtitle it made the tab strip taller than the content it
            // was labelling.
            <button
              key={key}
              type="button"
              title={hint}
              aria-label={`${label} — ${hint}`}
              className={activeTab === key ? 'is-active' : ''}
              onClick={() => setActiveTab(key)}
            >
              <b>{label}</b>
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
            <div className="settings-section">
              <div className="settings-notice settings-notice-stacked">
                <b>{th ? 'ขั้นตอน' : 'How it works'}</b>
                <span>
                  {th
                    ? '1. เปิด Login browser แล้วเข้าสู่ระบบเอง  2. กด Capture session  3. กด Verify กับหน้าที่ต้อง login'
                    : '1. Open the login browser and sign in.  2. Capture the session.  3. Verify it against a page that requires a login.'}
                </span>
              </div>

              <div className={`auth-state auth-state-${authState}`} aria-live="polite">
                <span className="auth-state-dot" />
                <div>
                  <b>{authStateLabel[authState][th ? 1 : 0]}</b>
                  <small>{authDetail}</small>
                </div>
                <span className="auth-state-badge">{authState}</span>
              </div>

              {authStatus?.browserModeMismatch && (
                <div className="settings-notice settings-notice-warn">
                  <b>{th ? 'โหมดเบราว์เซอร์ไม่ตรงกัน' : 'Browser mode differs'}</b>
                  <span>
                    {th
                      ? 'Session ถูกบันทึกคนละโหมดกับที่ใช้รัน บางเว็บจะปฏิเสธ session ที่มาจากเบราว์เซอร์คนละแบบ'
                      : 'This session was captured in a different browser mode from the one runs use. Some applications reject a session issued to another browser.'}
                  </span>
                </div>
              )}

              {authStatus?.lockedBy && (
                <div className="settings-notice settings-notice-warn">
                  <b>{th ? 'กำลังถูกใช้งาน' : 'In use'}</b>
                  <span>
                    {th
                      ? `Session นี้ถูกใช้โดย ${authStatus.lockedBy} อยู่ — รันพร้อมกันสองตัวจะทำให้ session หลุด`
                      : `Held by ${authStatus.lockedBy}. Running two at once on one session signs both out.`}
                  </span>
                </div>
              )}

              <div className="auth-session-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={authOpening || authBusy}
                  onClick={async () => {
                    setAuthOpening(true)
                    setAuthError(undefined)
                    try {
                      await openWorkspaceAuthSession(projectId, targetUrl)
                      setLoginBrowserOpen(true)
                      await refreshAuthStatus()
                    } catch (error) {
                      setAuthError(messageOf(error))
                    } finally {
                      setAuthOpening(false)
                    }
                  }}
                >
                  {authOpening ? (th ? 'กำลังเปิด…' : 'Opening…') : th ? 'เปิด Login browser' : 'Open login browser'}
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!loginBrowserOpen || authBusy}
                  title={
                    loginBrowserOpen
                      ? undefined
                      : th
                        ? 'เปิด Login browser และเข้าสู่ระบบก่อน'
                        : 'Open the login browser and sign in first'
                  }
                  onClick={async () => {
                    setAuthCapturing(true)
                    setAuthError(undefined)
                    try {
                      setAuthStatus(await captureWorkspaceAuthSession(projectId))
                      setLoginBrowserOpen(false)
                    } catch (error) {
                      setAuthError(messageOf(error))
                    } finally {
                      setAuthCapturing(false)
                    }
                  }}
                >
                  {authCapturing ? (th ? 'กำลังบันทึก…' : 'Capturing…') : th ? 'บันทึก Session' : 'Capture session'}
                </button>
              </div>

              <label className="auth-verify-row">
                <span>{th ? 'หน้าที่ต้องล็อกอิน' : 'Protected path'}</span>
                <div>
                  <input
                    value={verifyPath}
                    onChange={(event) => setVerifyPath(event.target.value)}
                    placeholder="/dashboard"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={authBusy || !hasSnapshot}
                    title={hasSnapshot ? undefined : th ? 'บันทึก Session ก่อน' : 'Capture a session first'}
                    onClick={async () => {
                      setAuthVerifying(true)
                      setAuthError(undefined)
                      try {
                        const url = new URL(verifyPath || '/', targetUrl).toString()
                        setAuthStatus(await verifyWorkspaceAuthSession(projectId, url))
                      } catch (error) {
                        setAuthError(messageOf(error))
                      } finally {
                        setAuthVerifying(false)
                      }
                    }}
                  >
                    {authVerifying ? (th ? 'กำลังตรวจ…' : 'Verifying…') : th ? 'ตรวจสอบ' : 'Verify'}
                  </button>
                </div>
              </label>

              {authError && <p className="auth-session-error">{authError}</p>}

              {hasSnapshot && (
                <dl className="auth-session-facts">
                  <div>
                    <dt>{th ? 'Cookie' : 'Cookies'}</dt>
                    <dd>
                      {authStatus?.cookieCount ?? 0}
                      {authStatus?.sessionCookieCount
                        ? ` (${authStatus.sessionCookieCount} ${th ? 'แบบ session' : 'session'})`
                        : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>{th ? 'Origin' : 'Origins'}</dt>
                    <dd>{authStatus?.originCount ?? 0}</dd>
                  </div>
                  <div>
                    <dt>sessionStorage</dt>
                    <dd>{authStatus?.sessionStorageOriginCount ?? 0}</dd>
                  </div>
                  <div>
                    <dt>IndexedDB</dt>
                    <dd>{authStatus?.indexedDb ? (th ? 'รวมด้วย' : 'included') : th ? 'ไม่รองรับ' : 'unsupported'}</dd>
                  </div>
                </dl>
              )}

              <div className="auth-session-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={authStatusLoading}
                  onClick={() => void refreshAuthStatus()}
                >
                  {authStatusLoading ? (th ? 'กำลังเช็ก…' : 'Checking…') : th ? 'รีเฟรชสถานะ' : 'Refresh status'}
                </button>
                {!authClearConfirm ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={authBusy}
                    onClick={() => setAuthClearConfirm(true)}
                  >
                    {th ? 'ล้าง Session' : 'Clear login session'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={async () => {
                        await clearWorkspaceAuthSession(projectId)
                        setAuthClearConfirm(false)
                        setLoginBrowserOpen(false)
                        await refreshAuthStatus()
                      }}
                    >
                      {th ? 'ยืนยันล้าง' : 'Confirm clear'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setAuthClearConfirm(false)}>
                      {th ? 'ยกเลิก' : 'Cancel'}
                    </button>
                  </>
                )}
              </div>

              <small className="auth-session-hint">
                {th
                  ? 'สถานะจะเป็น ready ก็ต่อเมื่อเปิดหน้าที่ต้องล็อกอินได้จริงเท่านั้น การมีโฟลเดอร์อยู่ไม่ได้แปลว่า login ยังใช้ได้ · เคสที่บันทึกการ Login ไว้ต้องล้าง Session ก่อนถึงจะ replay ได้'
                  : 'The status reaches ready only when a protected page actually opens — a saved folder never meant a working login. A recorded login Test Case needs the session cleared before it can replay.'}
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
        {/* One footer for every tab. Credentials can be saved from anywhere, so
            switching tabs never silently discards what was typed. */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary mr-auto"
            onClick={() => {
              onClear()
              setDraft({})
              setSaved(false)
            }}
          >
            {th ? 'ล้างข้อมูลทดสอบ' : 'Clear secrets'}
          </button>
          {saved && !dirty && (
            <span className="settings-saved" role="status">
              {th ? 'บันทึกแล้ว' : 'Saved'}
            </span>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {th ? 'ปิด' : 'Close'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!dirty}
            title={dirty ? undefined : th ? 'ยังไม่มีการแก้ไข' : 'Nothing has changed'}
            onClick={() => {
              onSave(draft)
              setSaved(true)
            }}
          >
            {th ? 'บันทึกข้อมูลทดสอบ' : 'Save credentials'}
          </button>
        </div>
      </section>
    </div>
  )
}
