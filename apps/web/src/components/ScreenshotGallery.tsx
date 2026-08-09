import type { StoredScreenshot } from '../hooks/useScreenshots'

export function ScreenshotGallery({
  screenshots,
  onDelete
}: {
  screenshots: StoredScreenshot[]
  onDelete: (name: string) => void
}) {
  function download(screenshot: StoredScreenshot) {
    const link = document.createElement('a')
    link.href = screenshot.dataUrl
    link.download = screenshot.name
    link.click()
  }

  return (
    <section className="screenshot-gallery">
      <header className="screenshot-gallery-head">
        <div>
          <p className="eyebrow">Playwright evidence</p>
          <h3>Screenshots</h3>
          <p>Images captured automatically at the end of each Playwright run. They stay in this local project.</p>
        </div>
        <span>{screenshots.length}/50 saved</span>
      </header>
      {screenshots.length ? (
        <div className="screenshot-gallery-grid">
          {screenshots.map((screenshot) => (
            <figure key={screenshot.name}>
              <img src={screenshot.dataUrl} alt={`Screenshot for ${screenshot.testCaseId}`} />
              <figcaption>
                <div>
                  <b>{screenshot.testCaseId}</b>
                  <span>
                    {screenshot.status} · {new Date(screenshot.capturedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="btn btn-secondary px-2 py-1" onClick={() => download(screenshot)}>
                    Download
                  </button>
                  <button type="button" className="btn btn-danger px-2 py-1" onClick={() => onDelete(screenshot.name)}>
                    Delete
                  </button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="bug-empty">
          <b>No screenshots yet</b>
          <span>Run a Playwright Test Case and the final browser state will appear here.</span>
        </div>
      )}
    </section>
  )
}
