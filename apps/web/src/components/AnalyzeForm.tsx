import { useState, type FormEvent } from 'react'
import type { TestCaseLanguage } from '../types'

type Props = {
  loading: boolean
  initialUrl?: string
  onAnalyze: (
    url: string,
    maxPages: number,
    maxDepth: number,
    language: TestCaseLanguage,
    includeApiChecks: boolean,
    waitAfterNavigationMs: number
  ) => void
}

export function AnalyzeForm({ loading, initialUrl = '', onAnalyze }: Props) {
  const [url, setUrl] = useState(initialUrl)
  const [maxPages, setMaxPages] = useState(20)
  const [maxDepth, setMaxDepth] = useState(3)
  const [language, setLanguage] = useState<TestCaseLanguage>('en')
  const [includeApiChecks, setIncludeApiChecks] = useState(false)
  const [waitAfterNavigationMs, setWaitAfterNavigationMs] = useState(750)
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
    onAnalyze(url.trim(), maxPages, maxDepth, language, includeApiChecks, waitAfterNavigationMs)
  }

  return (
    <form onSubmit={handleSubmit} className={initialUrl ? 'project-scout-card' : 'new-project-card'}>
      {initialUrl && (
        <div className="project-target-heading">
          <span className="target-glow">◎</span>
          <div>
            <p className="eyebrow">Active project target</p>
            <h2>{targetHost}</h2>
            <span>{initialUrl}</span>
          </div>
          <span className="target-status">
            <i /> Saved project
          </span>
        </div>
      )}
      {!initialUrl && (
        <div className="new-project-hero">
          <span className="scout-orbit">✦</span>
          <div>
            <p className="eyebrow">local workspace</p>
            <h2>Scout a website</h2>
            <p>Enter a URL and let Playwright discover pages, controls, forms and UI states automatically.</p>
          </div>
        </div>
      )}
      <div className="scout-form-grid">
        <div className="scout-url-field">
          <label className="field-label" htmlFor="target-url">
            Target URL
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
            Max pages
          </label>
          <input
            id="max-pages"
            className="field"
            type="number"
            min={1}
            max={100}
            value={maxPages}
            onChange={(event) => setMaxPages(Number(event.target.value))}
            disabled={loading}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="max-depth">
            Max depth
          </label>
          <input
            id="max-depth"
            className="field"
            type="number"
            min={0}
            max={20}
            value={maxDepth}
            onChange={(event) => setMaxDepth(Number(event.target.value))}
            disabled={loading}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="test-language">
            Test Case Language
          </label>
          <select
            id="test-language"
            className="field"
            value={language}
            onChange={(event) => setLanguage(event.target.value as TestCaseLanguage)}
            disabled={loading}
          >
            <option value="en">English</option>
            <option value="th">ไทย</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary scout-submit" disabled={loading || !url.trim()}>
          {loading ? 'Scouting…' : 'Scout Site'}
        </button>
      </div>
      {!initialUrl && (
        <div className="scout-options-help">
          <span>
            <b>Max pages</b> Maximum number of pages to inspect
          </span>
          <span>
            <b>Max depth</b> Link depth to follow from the target page
          </span>
          <span>
            <b>Test Case Language</b> Language used for generated Test Case details
          </span>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Playwright stays within the same origin and avoids actions that can change or delete data.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
        <label className="m-0 flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeApiChecks}
            onChange={(event) => setIncludeApiChecks(event.target.checked)}
            className="h-4 w-4"
            disabled={loading}
          />{' '}
          Include API checks from XHR/fetch
        </label>
        <label className="m-0 flex items-center gap-2">
          Wait after navigation{' '}
          <input
            className="field w-24"
            type="number"
            min={0}
            max={5000}
            step={250}
            value={waitAfterNavigationMs}
            onChange={(event) => setWaitAfterNavigationMs(Number(event.target.value))}
            disabled={loading}
          />{' '}
          ms
        </label>
      </div>
    </form>
  )
}
