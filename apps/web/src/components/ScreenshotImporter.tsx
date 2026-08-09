import { useState } from 'react'
import { createWorker } from 'tesseract.js'
import type { TestCase } from '../types'

type Props = {
  sourceUrl: string
  existingCases: TestCase[]
  onImport: (cases: TestCase[]) => void
  onClose: () => void
}

type ImportPattern = 'visual' | 'text' | 'manual'

const patterns: Array<{ id: ImportPattern; title: string; description: string }> = [
  { id: 'visual', title: 'Visual check', description: 'Compare text, colors and layout with the image' },
  { id: 'text', title: 'Text check', description: 'Create steps for text read from the image' },
  { id: 'manual', title: 'Manual checklist', description: 'Create a checklist for a Tester to review' }
]

export function ScreenshotImporter({ sourceUrl, existingCases, onImport, onClose }: Props) {
  const [imageUrl, setImageUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [screenName, setScreenName] = useState('Screenshot screen')
  const [pattern, setPattern] = useState<ImportPattern>('visual')
  const [ocrText, setOcrText] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  function chooseFile(file?: File) {
    if (!file || !file.type.startsWith('image/')) return
    setFileName(file.name)
    setImageUrl(URL.createObjectURL(file))
    setStatus('Ready to read the image.')
  }

  async function readImage() {
    if (!imageUrl || busy) return
    setBusy(true)
    setStatus('Reading Thai and English from the image…')
    const worker = await createWorker('tha+eng')
    try {
      const result = await worker.recognize(imageUrl)
      setOcrText(result.data.text.trim())
      setStatus('Reading complete. Review and edit the text before creating Test Cases.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'OCR failed.')
    } finally {
      await worker.terminate()
      setBusy(false)
    }
  }

  function importCases() {
    const lines = ocrText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 1)
      .slice(0, 12)
    const module = 'SCREENSHOT'
    const used = new Set(existingCases.map((item) => item.id))
    let sequence = 1
    const id = () => {
      let next = `TC-${module}-${String(sequence).padStart(3, '0')}`
      while (used.has(next)) next = `TC-${module}-${String(++sequence).padStart(3, '0')}`
      used.add(next)
      sequence++
      return next
    }
    const textSteps = lines.slice(0, 8).map((text) => ({
      type: 'assertText' as const,
      text,
      description: `Verify that "${text}" is visible on the page`
    }))
    const base = {
      module,
      preconditions: ['Open the page that matches the screenshot reference'],
      sourceUrl: sourceUrl || fileName,
      priority: 'medium' as const,
      automationStatus: 'needs-review' as const,
      type: 'validation' as const,
      notes: `Created from ${fileName || 'reference'} · Review before production use`
    }
    const imported: TestCase[] = []

    if (pattern === 'visual' || pattern === 'manual') {
      imported.push({
        ...base,
        id: id(),
        title: `${screenName} matches the screenshot reference`,
        steps: [
          { type: 'navigate', url: sourceUrl || 'about:blank', description: 'Open the page to inspect' },
          { type: 'manual', description: 'Compare layout, spacing, colors and element positions with the screenshot' }
        ],
        expectedResult: 'The page layout and visible elements match the screenshot reference.'
      })
    }
    if (pattern === 'visual' || pattern === 'text') {
      imported.push({
        ...base,
        id: id(),
        title: `${screenName} shows all important text`,
        steps: textSteps,
        expectedResult: 'Important on-screen text is complete and readable.'
      })
    }
    onImport(imported)
    onClose()
  }

  return (
    <div className="modern-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modern-modal screenshot-importer" role="dialog" aria-modal="true">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Create Test Cases from an image</p>
            <h2>Screenshot → Test Case</h2>
            <p>Follow three steps to create Draft Test Cases for review.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="screenshot-import-body">
          <div className="import-step">
            <span>1</span>
            <div>
              <b>Choose a Test Case pattern</b>
              <p>Pick the pattern that matches what you need to check.</p>
            </div>
          </div>
          <div className="pattern-grid">
            {patterns.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`pattern-card ${pattern === item.id ? 'is-selected' : ''}`}
                onClick={() => setPattern(item.id)}
              >
                <b>{item.title}</b>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
          <div className="import-step">
            <span>2</span>
            <div>
              <b>Upload a Screenshot</b>
              <p>PNG, JPG and WEBP are supported.</p>
            </div>
          </div>
          <label className="upload-dropzone">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <strong>{fileName || 'Click to choose an image'}</strong>
            <span>or drop a file here</span>
          </label>
          {imageUrl && (
            <div className="screenshot-preview">
              <img src={imageUrl} alt="Screenshot preview" />
              <button type="button" className="btn btn-secondary" onClick={readImage} disabled={busy}>
                {busy ? 'Reading…' : 'Read text from image'}
              </button>
            </div>
          )}
          <div className="import-step">
            <span>3</span>
            <div>
              <b>Review text and create cases</b>
              <p>You can edit OCR text before importing.</p>
            </div>
          </div>
          <label className="field-label">
            Screen name
            <input className="field mt-1" value={screenName} onChange={(event) => setScreenName(event.target.value)} />
          </label>
          <label className="field-label">
            Text detected
            <textarea
              className="field screenshot-ocr"
              value={ocrText}
              onChange={(event) => setOcrText(event.target.value)}
              placeholder="Read text from the image, or type it yourself"
            />
          </label>
          <p className="screenshot-status">{status}</p>
        </div>
        <footer className="modal-footer">
          <span className="mr-auto text-xs text-slate-500">
            Results are marked <b>needs-review</b>
          </span>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={importCases}
            disabled={!ocrText.trim() && pattern !== 'manual'}
          >
            Create Draft Test Cases
          </button>
        </footer>
      </section>
    </div>
  )
}
