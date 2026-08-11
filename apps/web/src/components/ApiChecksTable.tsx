import { useState } from 'react'
import { runApiCheck } from '../api/client'
import type { ApiCheck, ProjectSecrets } from '../types'

export function ApiChecksTable({ checks, secrets }: { checks: ApiCheck[]; secrets?: ProjectSecrets }) {
  const [running, setRunning] = useState<string>()
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState<ApiCheck>()
  async function run(check: ApiCheck, allowUnsafe = false) {
    setRunning(check.id)
    try {
      const result = await runApiCheck(check, secrets, allowUnsafe)
      setMessages((current) => ({ ...current, [check.id]: `${result.status.toUpperCase()} · ${result.message}` }))
    } catch (error) {
      setMessages((current) => ({ ...current, [check.id]: error instanceof Error ? error.message : String(error) }))
    } finally {
      setRunning(undefined)
    }
  }
  return (
    <div className="api-checks">
      <div className="api-checks-head">
        <div>
          <p className="eyebrow">Network validation</p>
          <h3>Test API</h3>
          <p>
            Requests observed from XHR/fetch during Explorer. Run uses server-side fetch and project token when
            configured.
          </p>
        </div>
        <span className="status-badge status-badge-pass">{checks.length} observed</span>
      </div>
      {checks.length === 0 ? (
        <div className="empty-state">
          Run Analyze with <b>Include API checks from XHR/fetch</b> enabled to collect the API requests used by the
          page.
        </div>
      ) : (
        <div className="api-table">
          {checks.map((check) => (
            <div className="api-row" key={check.id}>
              <span className="api-method">{check.method}</span>
              <div>
                <b>{check.id}</b>
                <p>{check.url}</p>
                <small>
                  {check.note ?? `Observed HTTP ${check.observedStatus ?? '—'} · ${check.durationMs ?? 0}ms`}
                </small>
              </div>
              <span
                className={`status-badge ${check.status === 'observed' ? 'status-badge-pass' : 'status-badge-warn'}`}
              >
                {check.status}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  ['GET', 'HEAD', 'OPTIONS'].includes(check.method.toUpperCase())
                    ? void run(check)
                    : setConfirming(check)
                }
                disabled={running === check.id}
              >
                {running === check.id ? 'Checking…' : 'Run API'}
              </button>
              {messages[check.id] && <div className="api-result">{messages[check.id]}</div>}
            </div>
          ))}
        </div>
      )}
      {confirming && (
        <div className="modern-modal-backdrop" role="presentation">
          <section className="modern-modal" role="dialog" aria-modal="true" aria-labelledby="unsafe-api-title">
            <header className="modal-header">
              <div>
                <p className="eyebrow">Protected API action</p>
                <h2 id="unsafe-api-title">Run {confirming.method.toUpperCase()} once?</h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => setConfirming(undefined)} aria-label="Close">
                ×
              </button>
            </header>
            <div className="modal-body">
              <p>This request can create, update, or delete data. LazyScout will send it only once for this run.</p>
              <code className="block break-all">{confirming.url}</code>
            </div>
            <footer className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(undefined)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setConfirming(undefined)
                  void run(confirming, true)
                }}
              >
                Run once
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
