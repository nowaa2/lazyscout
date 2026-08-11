import { useState } from 'react'
import { runLoadTest } from '../api/client'
import type { LoadTestResponse } from '../types'

export function LoadTest({ defaultUrl }: { defaultUrl: string }) {
  const [url, setUrl] = useState(defaultUrl)
  const [virtualUsers, setVirtualUsers] = useState<number | ''>(3)
  const [requestsPerUser, setRequestsPerUser] = useState<number | ''>(5)
  const [intervalMs, setIntervalMs] = useState<number | ''>(300)
  const [confirmed, setConfirmed] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<LoadTestResponse>()
  const [error, setError] = useState('')
  const requestBudget =
    Math.min(20, Math.max(1, Number(virtualUsers) || 1)) * Math.min(100, Math.max(1, Number(requestsPerUser) || 1))

  async function run() {
    if (running || !confirmed) return
    setRunning(true)
    setResult(undefined)
    setError('')
    try {
      setResult(
        await runLoadTest({
          url,
          virtualUsers: Number(virtualUsers) || 1,
          requestsPerUser: Number(requestsPerUser) || 1,
          intervalMs: Number(intervalMs) || 0,
          confirmed
        })
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="load-test-page">
      <header className="load-test-hero">
        <div className="load-test-hero-icon">⚡</div>
        <div>
          <p className="eyebrow">HTTP performance workspace</p>
          <h2>Load Test</h2>
          <p>Send controlled GET traffic, compare response times, and inspect every HTTP response.</p>
        </div>
        <span>GET only · Local runner</span>
      </header>
      <div className="load-test-layout">
        <section className="load-config-card">
          <div className="load-section-title">
            <div>
              <p className="eyebrow">Test configuration</p>
              <h3>Request settings</h3>
            </div>
            <b>{requestBudget} requests</b>
          </div>
          <div className="load-test-form">
            <label className="load-url">
              <span>Target URL</span>
              <input
                className="field"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com"
                disabled={running}
              />
            </label>
            <div className="load-input-grid">
              <label>
                <span>Virtual users</span>
                <input
                  className="field"
                  type="number"
                  min={1}
                  max={20}
                  value={virtualUsers}
                  onChange={(event) => setVirtualUsers(event.target.value === '' ? '' : Number(event.target.value))}
                  disabled={running}
                />
                <small>Maximum 20 concurrent users</small>
              </label>
              <label>
                <span>Requests / user</span>
                <input
                  className="field"
                  type="number"
                  min={1}
                  max={100}
                  value={requestsPerUser}
                  onChange={(event) => setRequestsPerUser(event.target.value === '' ? '' : Number(event.target.value))}
                  disabled={running}
                />
                <small>Maximum 100 per user</small>
              </label>
              <label>
                <span>Interval</span>
                <div className="load-input-unit">
                  <input
                    className="field"
                    type="number"
                    min={0}
                    max={10000}
                    value={intervalMs}
                    onChange={(event) => setIntervalMs(event.target.value === '' ? '' : Number(event.target.value))}
                    disabled={running}
                  />
                  <em>ms</em>
                </div>
                <small>Pause between each request</small>
              </label>
            </div>
            <label className="load-confirm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={running}
              />
              <span>
                <b>Authorized target</b>
                <small>I own this target or have permission to run a load test.</small>
              </span>
            </label>
            <button
              type="button"
              className="btn btn-primary load-run-button"
              disabled={running || !confirmed || !url.trim()}
              onClick={() => void run()}
            >
              {running ? (
                <>
                  <i /> Running {requestBudget} requests…
                </>
              ) : (
                <>▶ Start Load Test</>
              )}
            </button>
          </div>
        </section>
        <aside className="load-safety-card">
          <p className="eyebrow">Safe limits</p>
          <h3>Controlled traffic</h3>
          <ul>
            <li>
              <b>20</b>
              <span>Maximum virtual users</span>
            </li>
            <li>
              <b>2,000</b>
              <span>Maximum total requests</span>
            </li>
            <li>
              <b>15s</b>
              <span>Timeout per request</span>
            </li>
          </ul>
          <p>Only HTTP GET is sent. LazyScout does not submit forms, log in, or modify target data.</p>
        </aside>
      </div>
      {error && <p className="load-error">{error}</p>}
      {running && (
        <section className="load-running">
          <i />
          <div>
            <b>Load test is running</b>
            <span>Waiting for all virtual users to complete their request budget…</span>
          </div>
        </section>
      )}
      {result && (
        <section className="load-results">
          <div className="load-results-head">
            <div>
              <p className="eyebrow">Run report</p>
              <h3>HTTP Request Results</h3>
            </div>
            <span className={result.failed ? 'has-failures' : 'all-passed'}>
              {result.failed ? `${result.failed} failed` : 'All requests passed'}
            </span>
          </div>
          <div className="load-kpis">
            <Metric label="Total" value={String(result.total)} />
            <Metric label="Passed" value={String(result.passed)} tone="pass" />
            <Metric label="Failed" value={String(result.failed)} tone="fail" />
            <Metric label="Average" value={`${result.averageMs} ms`} />
            <Metric label="Min / Max" value={`${result.minMs} / ${result.maxMs} ms`} />
            <Metric label="Requests/sec" value={String(result.requestsPerSecond)} />
          </div>
          <div className="load-table-wrap">
            <table className="load-request-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Method</th>
                  <th>Request URL</th>
                  <th>HTTP</th>
                  <th>Time</th>
                  <th>Size</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {result.requests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.id}</td>
                    <td>
                      VU-{request.virtualUser}
                      <small>Run {request.iteration}</small>
                    </td>
                    <td>
                      <span className="load-method">{request.method}</span>
                    </td>
                    <td>
                      <span className="load-request-url" title={request.finalUrl ?? request.url}>
                        {request.finalUrl ?? request.url}
                      </span>
                      {request.error && <small className="load-request-error">{request.error}</small>}
                    </td>
                    <td>
                      {request.statusCode ? (
                        <>
                          <b>{request.statusCode}</b>
                          <small>{request.statusText}</small>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{request.durationMs} ms</td>
                    <td>{formatBytes(request.responseBytes)}</td>
                    <td>
                      <span className={`load-result-badge ${request.passed ? 'passed' : 'failed'}`}>
                        {request.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  )
}

function Metric({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={tone}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}
function formatBytes(bytes?: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}
