import type { AnalyzeResponse } from '../types'

export function ExplorerModal({
  result,
  testCaseCount,
  onClose,
  onOpenCases
}: {
  result: AnalyzeResponse
  testCaseCount: number
  onClose: () => void
  onOpenCases: () => void
}) {
  return (
    <div className="modern-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modern-modal explorer-modal">
        <header className="modal-header">
          <div>
            <span className="eyebrow">Website explorer</span>
            <h2>Explore completed</h2>
            <p>{result.origin}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="explorer-hero">
          <div className="explorer-number">
            <strong>{testCaseCount}</strong>
            <span>draft test cases found</span>
          </div>
          <div className="explorer-number">
            <strong>{result.stats.pagesVisited}</strong>
            <span>pages discovered</span>
          </div>
          <div className="explorer-number">
            <strong>{result.actionGraph.states.length}</strong>
            <span>UI states</span>
          </div>
        </div>
        <div className="explorer-modal-grid">
          <div>
            <p className="field-label">State coverage</p>
            {result.actionGraph.states.slice(0, 8).map((state) => (
              <div className="explorer-state" key={state.id}>
                <span className="status-dot status-pass" />
                <span>{state.title || state.url}</span>
                <small>{state.visibleDialogs[0] || state.fingerprint}</small>
              </div>
            ))}
          </div>
          <div>
            <p className="field-label">Safety summary</p>
            <div className="safety-box">
              <b>{result.actionGraph.blockedActionKeys.length} blocked actions</b>
              <p>Destructive actions were discovered but not clicked.</p>
            </div>
            <div className="safety-box">
              <b>{result.stats.urlsSkipped} skipped URLs</b>
              <p>External, unsafe or duplicate URLs were not explored.</p>
            </div>
          </div>
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary" onClick={onOpenCases}>
            Review {testCaseCount} Test Cases →
          </button>
        </footer>
      </section>
    </div>
  )
}
