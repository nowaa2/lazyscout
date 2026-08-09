import { useState, type ChangeEvent } from 'react'
import JSZip from 'jszip'
import type { TestCase } from '../types'
import type { BugReport } from '../hooks/useBugReports'

type Props = {
  reports: BugReport[]
  testCases: TestCase[]
  onSave: (report: BugReport) => void
  onDelete: (id: string) => void
}
const newReport = (): BugReport => ({
  id: `BUG-${Date.now().toString().slice(-6)}`,
  title: '',
  severity: 'medium',
  status: 'open',
  actualResult: '',
  expectedResult: '',
  stepsToReproduce: '',
  attachments: [],
  createdAt: new Date().toISOString()
})

export function BugReports({ reports, testCases, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState<BugReport>()
  const [exporting, setExporting] = useState(false)
  async function exportZip() {
    setExporting(true)
    try {
      const zip = new JSZip()
      zip.file('bug-reports.csv', csvFor(reports))
      for (const report of reports)
        for (const attachment of report.attachments)
          zip.file(
            `attachments/${safeName(report.id)}/${safeName(attachment.name)}`,
            attachment.dataUrl.split(',')[1] ?? '',
            { base64: true }
          )
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `lazyscout-bug-reports-${new Date().toISOString().slice(0, 10)}.zip`
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }
  return (
    <section className="bug-reports">
      <div className="bug-reports-head">
        <div>
          <p className="eyebrow">Defect tracking</p>
          <h3>Bug Reports</h3>
          <p>Capture reproducible issues and keep screenshots with the local project.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!reports.length || exporting}
            onClick={() => void exportZip()}
          >
            {exporting ? 'Creating ZIP…' : 'Export ZIP + images'}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setEditing(newReport())}>
            + Add Bug Report
          </button>
        </div>
      </div>
      {reports.length ? (
        <div className="overflow-x-auto">
          <table className="bug-report-table">
            <thead>
              <tr>
                <th>Bug ID</th>
                <th>Title</th>
                <th>Test Case</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Evidence</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{report.id}</td>
                  <td>
                    <b>{report.title || 'Untitled bug'}</b>
                    <small>{new Date(report.createdAt).toLocaleDateString()}</small>
                  </td>
                  <td>{report.testCaseId || '—'}</td>
                  <td>
                    <span className={`bug-severity ${report.severity}`}>{report.severity}</span>
                  </td>
                  <td>
                    <span className="bug-status">{report.status}</span>
                  </td>
                  <td>
                    {report.attachments.length} screenshot{report.attachments.length === 1 ? '' : 's'}
                  </td>
                  <td>
                    <div className="flex justify-center gap-1">
                      <button type="button" className="btn btn-secondary px-2 py-1" onClick={() => setEditing(report)}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-danger px-2 py-1" onClick={() => onDelete(report.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bug-empty">
          <b>No Bug Reports yet</b>
          <span>
            When a Test Case fails, add the actual result, expected result, reproduction steps, and screenshots here.
          </span>
          <button type="button" className="btn btn-primary" onClick={() => setEditing(newReport())}>
            Create first Bug Report
          </button>
        </div>
      )}
      {editing && (
        <BugReportEditor
          report={editing}
          testCases={testCases}
          onClose={() => setEditing(undefined)}
          onSave={(report) => {
            onSave(report)
            setEditing(undefined)
          }}
        />
      )}
    </section>
  )
}

function BugReportEditor({
  report,
  testCases,
  onSave,
  onClose
}: {
  report: BugReport
  testCases: TestCase[]
  onSave: (report: BugReport) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(report)
  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])].filter((file) => file.type.startsWith('image/')).slice(0, 5)
    const attachments = await Promise.all(
      files.map(async (file) => ({ name: file.name, type: file.type, dataUrl: await fileToDataUrl(file) }))
    )
    setDraft((current) => ({ ...current, attachments: [...current.attachments, ...attachments] }))
  }
  return (
    <div className="modern-modal-backdrop">
      <section className="modern-modal bug-editor" role="dialog" aria-modal="true">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Bug Report</p>
            <h2>{draft.id}</h2>
            <p>Describe the defect so another person can reproduce it quickly.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="bug-editor-body">
          <div className="grid gap-3 md:grid-cols-[1fr_150px_150px]">
            <label>
              <span>Title</span>
              <input
                className="field"
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="What went wrong?"
              />
            </label>
            <label>
              <span>Severity</span>
              <select
                className="field"
                value={draft.severity}
                onChange={(event) => setDraft({ ...draft, severity: event.target.value as BugReport['severity'] })}
              >
                <option value="critical">critical</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select
                className="field"
                value={draft.status}
                onChange={(event) => setDraft({ ...draft, status: event.target.value as BugReport['status'] })}
              >
                <option value="open">open</option>
                <option value="in-progress">in-progress</option>
                <option value="resolved">resolved</option>
              </select>
            </label>
          </div>
          <label>
            <span>Related Test Case</span>
            <select
              className="field"
              value={draft.testCaseId ?? ''}
              onChange={(event) => setDraft({ ...draft, testCaseId: event.target.value || undefined })}
            >
              <option value="">Not linked</option>
              {testCases.map((testCase) => (
                <option key={testCase.id} value={testCase.id}>
                  {testCase.id} · {testCase.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Steps to reproduce</span>
            <textarea
              className="field"
              rows={4}
              value={draft.stepsToReproduce}
              onChange={(event) => setDraft({ ...draft, stepsToReproduce: event.target.value })}
              placeholder="1. Open…&#10;2. Click…&#10;3. Observe…"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span>Actual Result</span>
              <textarea
                className="field"
                rows={4}
                value={draft.actualResult}
                onChange={(event) => setDraft({ ...draft, actualResult: event.target.value })}
              />
            </label>
            <label>
              <span>Expected Result</span>
              <textarea
                className="field"
                rows={4}
                value={draft.expectedResult}
                onChange={(event) => setDraft({ ...draft, expectedResult: event.target.value })}
              />
            </label>
          </div>
          <label className="bug-upload">
            <span>Evidence screenshots</span>
            <input type="file" accept="image/*" multiple onChange={(event) => void addFiles(event)} />
            <em>Upload up to 5 images at a time. Images are included in ZIP export.</em>
          </label>
          {draft.attachments.length ? (
            <div className="bug-attachments">
              {draft.attachments.map((attachment, index) => (
                <figure key={`${attachment.name}-${index}`}>
                  <img src={attachment.dataUrl} alt={attachment.name} />
                  <figcaption>
                    {attachment.name}
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          attachments: current.attachments.filter((_, position) => position !== index)
                        }))
                      }
                    >
                      ×
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!draft.title.trim()}
            onClick={() => onSave(draft)}
          >
            Save Bug Report
          </button>
        </footer>
      </section>
    </div>
  )
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
function safeName(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, '_')
}
function csvFor(reports: BugReport[]) {
  const header = [
    'Bug_ID',
    'Title',
    'Test_Case',
    'Severity',
    'Status',
    'Steps_To_Reproduce',
    'Actual_Result',
    'Expected_Result',
    'Attachments'
  ]
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  return [
    header,
    ...reports.map((report) => [
      report.id,
      report.title,
      report.testCaseId ?? '',
      report.severity,
      report.status,
      report.stepsToReproduce,
      report.actualResult,
      report.expectedResult,
      report.attachments.map((item) => `attachments/${safeName(report.id)}/${safeName(item.name)}`).join('; ')
    ])
  ]
    .map((row) => row.map(quote).join(','))
    .join('\r\n')
}
