import { useState } from 'react'
import { runApiCheck } from '../api/client'
import type { ApiCheck, ProjectSecrets } from '../types'

export function ApiChecksTable({ checks, secrets }: { checks: ApiCheck[]; secrets?: ProjectSecrets }) {
  const [running, setRunning] = useState<string>()
  const [messages, setMessages] = useState<Record<string, string>>({})
  async function run(check: ApiCheck) {
    setRunning(check.id)
    try {
      const result = await runApiCheck(check, secrets)
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
                onClick={() => run(check)}
                disabled={running === check.id}
              >
                {running === check.id ? 'Checking…' : 'Run API'}
              </button>
              {messages[check.id] && <div className="api-result">{messages[check.id]}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
