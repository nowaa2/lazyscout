import { useState, type FormEvent } from 'react'
import type { TestCaseLanguage } from '../types'
import type { ExplorationMode } from '@lazyscout/core'
import { useLanguage } from '../i18n'

type Props = {
  loading: boolean
  initialUrl?: string
  hasExistingData?: boolean
  initialLanguage?: TestCaseLanguage
  onLanguageChange?: (language: TestCaseLanguage) => void
  onAnalyze: (
    url: string,
    maxPages: number,
    maxDepth: number,
    language: TestCaseLanguage,
    includeApiChecks: boolean,
    waitAfterNavigationMs: number,
    startPath?: string,
    scopePath?: string,
    mode?: ExplorationMode,
    debug?: boolean
  ) => void
}

const TEST_CASE_LANGUAGE_STORAGE_KEY = 'lazyscout-test-case-language'

function savedTestCaseLanguage(): TestCaseLanguage {
  const savedLanguage = localStorage.getItem(TEST_CASE_LANGUAGE_STORAGE_KEY)
  return savedLanguage === 'th' || savedLanguage === 'en' ? savedLanguage : 'en'
}

function HelpTip({ text }: { text: string }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  return (
    <span className={`help-tip ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        aria-label={t('help')}
        aria-expanded={open}
        title={text}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        ?
      </button>
      <span className="help-tip-popover" role="tooltip">
        {text}
      </span>
    </span>
  )
}

export function AnalyzeForm({
  loading,
  initialUrl = '',
  hasExistingData = false,
  initialLanguage,
  onLanguageChange,
  onAnalyze
}: Props) {
  const { t } = useLanguage()
  const [url, setUrl] = useState(initialUrl)
  const [maxPages, setMaxPages] = useState<number | ''>(20)
  const [maxDepth, setMaxDepth] = useState<number | ''>(3)
  const [language, setLanguage] = useState<TestCaseLanguage>(initialLanguage ?? savedTestCaseLanguage)
  const [includeApiChecks, setIncludeApiChecks] = useState(false)
  const [waitAfterNavigationMs, setWaitAfterNavigationMs] = useState(750)
  const [startPath, setStartPath] = useState('')
  const [scopePath, setScopePath] = useState('')
  const [mode, setMode] = useState<ExplorationMode>('site')
  const [debug, setDebug] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const targetHost = (() => {
    try {
      return new URL(initialUrl).hostname
    } catch {
      return 'Current project'
    }
  })()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!url.trim() || loading) return
    if (hasExistingData) {
      setConfirmOpen(true)
      return
    }
    runAnalyze()
  }

  function runAnalyze() {
    const safeMaxPages = Math.min(100, Math.max(1, maxPages === '' ? 20 : maxPages))
    const safeMaxDepth = Math.min(10, Math.max(0, maxDepth === '' ? 3 : maxDepth))
    onAnalyze(
      url.trim(),
      safeMaxPages,
      safeMaxDepth,
      language,
      includeApiChecks,
      waitAfterNavigationMs,
      startPath.trim() || undefined,
      scopePath.trim() || undefined,
      mode,
      debug
    )
    setConfirmOpen(false)
  }

  return (
    <form onSubmit={handleSubmit} className={initialUrl ? 'project-scout-card' : 'new-project-card'}>
      {initialUrl && (
        <div className="project-target-heading">
          <span className="target-glow">◎</span>
          <div>
            <p className="eyebrow">{t('activeProjectTarget')}</p>
            <h2>{targetHost}</h2>
            <span>{initialUrl}</span>
          </div>
          <span className="target-status">
            <i /> {t('savedProject')}
          </span>
          <button
            type="button"
            className={`scout-collapse-btn ${collapsed ? 'is-collapsed' : ''}`}
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? t('expandScout') : t('collapseScout')}
            title={collapsed ? t('expandScout') : t('collapseScout')}
          >
            <span>⌃</span>
          </button>
        </div>
      )}
      {!initialUrl && (
        <div className="new-project-hero">
          <span className="scout-orbit">✦</span>
          <div>
            <p className="eyebrow">{t('localWorkspace')}</p>
            <h2>{t('scoutWebsite')}</h2>
            <p>{t('scoutDescription')}</p>
          </div>
          <button
            type="button"
            className={`scout-collapse-btn ${collapsed ? 'is-collapsed' : ''}`}
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? t('expandScout') : t('collapseScout')}
            title={collapsed ? t('expandScout') : t('collapseScout')}
          >
            <span>⌃</span>
          </button>
        </div>
      )}
      <div className={`scout-form-body ${collapsed ? 'is-collapsed' : ''}`}>
        <div className="scout-form-grid">
          <div className="scout-url-field">
            <label className="field-label" htmlFor="target-url">
              {t('targetUrl')}
              <HelpTip text={t('targetUrlHelp')} />
            </label>
            <input
              id="target-url"
              className="field"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              autoComplete="off"
              disabled={loading}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="max-pages">
              {t('maxPages')}
              <HelpTip text={t('maxPagesHelp')} />
            </label>
            <input
              id="max-pages"
              className="field"
              type="number"
              min={1}
              max={100}
              value={maxPages}
              onChange={(event) =>
                setMaxPages(event.target.value === '' ? '' : Math.min(100, Math.max(1, Number(event.target.value))))
              }
              disabled={loading}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="max-depth">
              {t('maxDepth')}
              <HelpTip text={t('maxDepthHelp')} />
            </label>
            <input
              id="max-depth"
              className="field"
              type="number"
              min={0}
              max={10}
              value={maxDepth}
              onChange={(event) =>
                setMaxDepth(event.target.value === '' ? '' : Math.min(10, Math.max(0, Number(event.target.value))))
              }
              disabled={loading}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="test-language">
              {t('language')}
              <HelpTip text={t('testLanguageHelp')} />
            </label>
            <select
              id="test-language"
              className="field"
              value={language}
              onChange={(event) => {
                const selectedLanguage = event.target.value as TestCaseLanguage
                setLanguage(selectedLanguage)
                localStorage.setItem(TEST_CASE_LANGUAGE_STORAGE_KEY, selectedLanguage)
                onLanguageChange?.(selectedLanguage)
              }}
              disabled={loading}
            >
              <option value="en">English</option>
              <option value="th">ไทย</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary scout-submit" disabled={loading || !url.trim()}>
            {loading ? t('scouting') : t('scoutSite')}
          </button>
        </div>
        {!initialUrl && (
          <div className="scout-options-help">
            <span>
              <b>{t('maxPages')}</b> {t('maxPagesDescription')}
            </span>
            <span>
              <b>{t('maxDepth')}</b> {t('maxDepthDescription')}
            </span>
            <span>
              <b>{t('language')}</b> {t('testLanguageDescription')}
            </span>
          </div>
        )}

        {/* Targeted Exploration */}
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-700 mb-2">
            {t('targetedExploration')} <HelpTip text={t('targetedExplorationHelp')} />
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label text-xs" htmlFor="start-path">
                {t('startPath')}
                <HelpTip text={t('startPathHelp')} />
                <span className="text-slate-400 font-normal ml-1">({t('optional')})</span>
              </label>
              <input
                id="start-path"
                className="field text-sm"
                value={startPath}
                onChange={(event) => setStartPath(event.target.value)}
                placeholder="/admin/users"
                autoComplete="off"
                disabled={loading}
              />
              <p className="text-xs text-slate-400 mt-1">{t('startPathHint')}</p>
            </div>
            <div>
              <label className="field-label text-xs" htmlFor="scope-path">
                {t('scopePath')}
                <HelpTip text={t('scopePathHelp')} />
                <span className="text-slate-400 font-normal ml-1">({t('optional')})</span>
              </label>
              <input
                id="scope-path"
                className="field text-sm"
                value={scopePath}
                onChange={(event) => setScopePath(event.target.value)}
                placeholder="/admin"
                autoComplete="off"
                disabled={loading}
              />
              <p className="text-xs text-slate-400 mt-1">{t('scopePathHint')}</p>
            </div>
          </div>
          <div className="mt-3">
            <label className="field-label text-xs">{t('explore')}</label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="explore-mode"
                  value="current-page"
                  checked={mode === 'current-page'}
                  onChange={() => setMode('current-page')}
                  disabled={loading}
                />
                {t('currentPageOnly')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="explore-mode"
                  value="scope"
                  checked={mode === 'scope'}
                  onChange={() => setMode('scope')}
                  disabled={loading}
                />
                {t('thisSection')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="explore-mode"
                  value="site"
                  checked={mode === 'site'}
                  onChange={() => setMode('site')}
                  disabled={loading}
                />
                {t('entireSite')}
              </label>
            </div>
          </div>
        </div>

        <details className="scout-guide">
          <summary>{t('targetedGuideTitle')}</summary>
          <div className="scout-guide-body">
            <img src="/lazyscout-icon-v2.png" alt="LazyScout" />
            <div>
              <p>
                <b>{t('targetUrl')}</b> {t('targetedGuideTargetUrl')}
              </p>
              <p>
                <b>{t('startPath')}</b> {t('targetedGuideStartPath')} <code>/admin/users</code>
              </p>
              <p>
                <b>{t('scopePath')}</b> {t('targetedGuideScopePath')} <code>/admin</code>{' '}
                {t('targetedGuideScopePathEnd')}
              </p>
              <p>
                <b>{t('currentPageOnly')}</b> {t('targetedGuideCurrentPage')} · <b>{t('thisSection')}</b>{' '}
                {t('targetedGuideThisSection')} · <b>{t('entireSite')}</b> {t('targetedGuideEntireSite')}
              </p>
              <p className="text-slate-500">{t('targetedGuideExample')}</p>
            </div>
          </div>
        </details>

        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <label className="m-0 flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeApiChecks}
              onChange={(event) => setIncludeApiChecks(event.target.checked)}
              className="h-4 w-4"
              disabled={loading}
            />{' '}
            {t('includeApiChecks')}
          </label>
          <label className="m-0 flex items-center gap-2">
            {t('waitAfterNavigation')}{' '}
            <input
              className="field w-24"
              type="number"
              min={0}
              max={5000}
              step={250}
              value={waitAfterNavigationMs}
              onChange={(event) => setWaitAfterNavigationMs(event.target.value === '' ? 0 : Number(event.target.value))}
              disabled={loading}
            />{' '}
            ms
          </label>
          <label className="m-0 flex items-center gap-2">
            <input
              type="checkbox"
              checked={debug}
              onChange={(event) => setDebug(event.target.checked)}
              className="h-4 w-4"
              disabled={loading}
            />{' '}
            {t('debugMode')}
          </label>
        </div>
      </div>
      {confirmOpen && (
        <div className="modern-modal-backdrop" role="presentation">
          <section
            className="modern-modal scout-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scout-confirm-title"
          >
            <header className="modal-header">
              <div>
                <p className="eyebrow">{t('scoutAgain')}</p>
                <h2 id="scout-confirm-title">{t('regenerateProject')}</h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => setConfirmOpen(false)} aria-label="Close">
                ×
              </button>
            </header>
            <div className="modal-body">
              <p>{t('regenerateWarning')}</p>
              <p className="text-sm text-slate-500">{t('regenerateHint')}</p>
            </div>
            <footer className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>
                {t('cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={runAnalyze}>
                {t('scoutSite')}
              </button>
            </footer>
          </section>
        </div>
      )}
    </form>
  )
}
