import { useState } from 'react'
import type { AnalyzeResponse, RunEvent } from '../types'

export function RunViewer({ result }: { result: AnalyzeResponse }) {
  const [tab, setTab] = useState<'events' | 'terminal'>('events')
  const [live, setLive] = useState(false)
  const [visibleEvents, setVisibleEvents] = useState<RunEvent[]>(result.runEvents)
  async function replayCli() {
    if (live) return
    setTab('terminal')
    setLive(true)
    setVisibleEvents([])
    for (const event of result.runEvents) {
      await new Promise((resolve) => window.setTimeout(resolve, 120))
      setVisibleEvents((current) => [...current, event])
    }
    setLive(false)
  }
  const cliEvents = live || visibleEvents.length < result.runEvents.length ? visibleEvents : result.runEvents
  return (
    <section className="scout-log-card">
      <div className="workspace-panel-head">
        <div>
          <p className="eyebrow">Playwright Scout Log</p>
          <h2>Scout Log</h2>
        </div>
        <span className="run-live">
          <i /> DONE
        </span>
      </div>
      <div className="scout-log-tabs">
        <button type="button" className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>
          ◉ Event Stream
        </button>
        <button type="button" className={tab === 'terminal' ? 'active' : ''} onClick={() => setTab('terminal')}>
          ›_ CLI Terminal
        </button>
      </div>
      <div className="run-summary">
        <div>
          <strong>{result.stats.durationMs}ms</strong>
          <span>duration</span>
        </div>
        <div>
          <strong>{result.stats.pagesVisited}</strong>
          <span>pages</span>
        </div>
        <div>
          <strong className={result.stats.urlsSkipped ? 'text-amber-600' : ''}>{result.stats.urlsSkipped}</strong>
          <span>skipped</span>
        </div>
      </div>
      {tab === 'terminal' ? (
        <div className="scout-cli-terminal">
          <div className="scout-cli-head">
            <span>
              <i /> Playwright CLI output
            </span>
            <div className="flex items-center gap-3">
              <b>{live ? 'RUNNING' : 'COMPLETED'}</b>
              <button type="button" className="cli-run-button" onClick={replayCli} disabled={live}>
                {live ? 'Running…' : '▶ Run again'}
              </button>
            </div>
          </div>
          <div className="scout-cli-body">
            <div>
              <em>$</em> npx playwright scout {result.startUrl}
            </div>
            {cliEvents.map((event, index) => (
              <div
                key={`cli-${event.timestamp}-${index}`}
                className={
                  event.result === 'failed'
                    ? 'cli-fail'
                    : event.result === 'warning' || event.result === 'blocked'
                      ? 'cli-warn'
                      : 'cli-pass'
                }
              >
                <em>›</em> {event.message}
              </div>
            ))}
            {live && <div className="cli-cursor">▌</div>}
          </div>
        </div>
      ) : (
        <div className="run-events">
          {result.runEvents.map((event, index) => (
            <div key={`${event.timestamp}-${index}`} className="run-event">
              <div className={`event-marker event-${event.result}`} />
              <div className="run-event-body">
                <div className="run-event-top">
                  <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                  <b>{event.eventType}</b>
                </div>
                <p>{event.message}</p>
                {event.currentUrl && <small>{new URL(event.currentUrl).pathname}</small>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="inspector-foot">
        <span className="status-dot status-pass" /> Scout completed · Playwright events captured
      </div>
    </section>
  )
}
