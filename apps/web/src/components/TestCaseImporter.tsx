import { useState } from 'react'
import { readSheet } from 'read-excel-file/browser'
import type { TestCase, TestCasePriority, TestCaseType } from '../types'

type Props = {
  existingCases: TestCase[]
  sourceUrl: string
  onImport: (cases: TestCase[]) => void
  onClose: () => void
}
type RawRow = Record<string, unknown>

export function TestCaseImporter({ existingCases, sourceUrl, onImport, onClose }: Props) {
  const [fileName, setFileName] = useState('')
  const [drafts, setDrafts] = useState<TestCase[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function readFile(file?: File) {
    if (!file || busy) return
    setBusy(true)
    setError('')
    setFileName(file.name)
    try {
      const rows = await parseFile(file)
      const imported = normalizeRows(rows, existingCases, sourceUrl)
      if (!imported.length)
        throw new Error('No valid Test Cases were found. Check that the file contains TC_ID or Title.')
      setDrafts(imported)
    } catch (reason) {
      setDrafts([])
      setError(reason instanceof Error ? reason.message : 'Could not read the file.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modern-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modern-modal import-testcase-modal" role="dialog" aria-modal="true">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Import Test Cases</p>
            <h2>Bring an existing suite into LazyScout</h2>
            <p>CSV, XLSX and JSON are supported. Fields are mapped automatically.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="import-testcase-body">
          <label className="upload-dropzone">
            <input type="file" accept=".csv,.xlsx,.json" onChange={(event) => void readFile(event.target.files?.[0])} />
            <strong>{busy ? 'Reading file…' : fileName || 'Choose a CSV, XLSX or JSON file'}</strong>
            <span>Expected fields: TC_ID, Title, Module, Folder, Tags, Requirements, Steps and Expected Result</span>
          </label>
          {error && <p className="import-error">{error}</p>}
          {drafts.length > 0 && (
            <>
              <div className="import-summary">
                <b>{drafts.length} Test Cases ready to import</b>
                <span>Duplicate IDs are replaced with a new TC-IMPORT ID.</span>
              </div>
              <div className="import-preview">
                <table>
                  <thead>
                    <tr>
                      <th>TC ID</th>
                      <th>Folder</th>
                      <th>Title</th>
                      <th>Tags</th>
                      <th>Requirements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.slice(0, 10).map((testCase) => (
                      <tr key={testCase.id}>
                        <td>{testCase.id}</td>
                        <td>{testCase.folder ?? testCase.module}</td>
                        <td>{testCase.title}</td>
                        <td>{(testCase.tags ?? []).join(', ') || '—'}</td>
                        <td>{(testCase.requirements ?? []).join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {drafts.length > 10 && <p>Previewing 10 of {drafts.length} Test Cases.</p>}
              </div>
            </>
          )}
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!drafts.length}
            onClick={() => {
              onImport(drafts)
              onClose()
            }}
          >
            Import {drafts.length || ''} Test Cases
          </button>
        </footer>
      </section>
    </div>
  )
}

async function parseFile(file: File): Promise<RawRow[]> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'json') {
    const parsed = JSON.parse(await file.text()) as unknown
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { testCases?: unknown }).testCases)
        ? (parsed as { testCases: unknown[] }).testCases
        : []
    return rows.filter((row): row is RawRow => Boolean(row) && typeof row === 'object')
  }
  if (extension === 'csv') return rowsToObjects(parseCsv(await file.text()))
  if (extension === 'xlsx') return rowsToObjects(await readSheet(file))
  throw new Error('Supported formats are CSV, XLSX and JSON.')
}

function rowsToObjects(rows: unknown[][]): RawRow[] {
  const [headerRow, ...dataRows] = rows
  if (!headerRow) return []
  const headers = headerRow.map((value) => String(value ?? '').trim())
  return dataRows
    .filter((row) => row.some((value) => value !== null && value !== undefined && String(value).trim()))
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header || `Column_${index + 1}`, row[index] ?? '']))
    )
}

function parseCsv(source: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false
  const input = source.replace(/^\uFEFF/, '')

  for (let index = 0; index < input.length; index++) {
    const character = input[index]
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        value += '"'
        index++
      } else quoted = !quoted
    } else if (character === ',' && !quoted) {
      row.push(value)
      value = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index++
      row.push(value)
      if (row.some((cell) => cell.trim())) rows.push(row)
      row = []
      value = ''
    } else value += character
  }

  row.push(value)
  if (row.some((cell) => cell.trim())) rows.push(row)
  if (quoted) throw new Error('CSV contains an unclosed quoted value.')
  return rows
}

function normalizeRows(rows: RawRow[], existingCases: TestCase[], sourceUrl: string): TestCase[] {
  const usedIds = new Set(existingCases.map((testCase) => testCase.id))
  let sequence = 1
  const nextId = () => {
    let id = `TC-IMPORT-${String(sequence).padStart(3, '0')}`
    while (usedIds.has(id)) id = `TC-IMPORT-${String(++sequence).padStart(3, '0')}`
    usedIds.add(id)
    sequence++
    return id
  }
  return rows
    .map<TestCase | null>((row) => {
      const id = valueOf(row, 'TC_ID', 'ID', 'TEST_CASE_ID')
      const title = valueOf(row, 'TITLE', 'TEST_CASE', 'NAME')
      if (!title && !id) return null
      const safeId = !id || usedIds.has(id) ? nextId() : id
      usedIds.add(safeId)
      const module = valueOf(row, 'MODULE') || 'IMPORTED'
      const steps = listOf(row, 'TEST_STEPS', 'STEPS').map((description) => ({ type: 'manual' as const, description }))
      return {
        id: safeId,
        module,
        folder: valueOf(row, 'FOLDER') || module,
        tags: listOf(row, 'TAGS', 'TAG'),
        requirements: listOf(row, 'REQUIREMENTS', 'REQUIREMENT', 'TICKET', 'TICKETS'),
        title: title || safeId,
        preconditions: listOf(row, 'PRECONDITIONS', 'PRECONDITION'),
        steps: steps.length ? steps : [{ type: 'manual' as const, description: 'Review imported steps' }],
        expectedResult: valueOf(row, 'EXPECTED_RESULT', 'EXPECTED RESULT', 'EXPECTED') || 'Review expected result',
        type: typeOf(valueOf(row, 'TYPE')),
        priority: priorityOf(valueOf(row, 'PRIORITY')),
        automationStatus: automationOf(valueOf(row, 'AUTOMATION_STATUS', 'AUTOMATION')),
        sourceUrl: valueOf(row, 'SOURCE_URL', 'SOURCE URL', 'URL') || sourceUrl || 'Imported file',
        notes: 'Imported into LazyScout'
      } satisfies TestCase
    })
    .filter((testCase): testCase is TestCase => Boolean(testCase))
}

function normalizedKey(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}
function valueOf(row: RawRow, ...keys: string[]) {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizedKey(key), String(value ?? '').trim()])
  )
  for (const key of keys) {
    const value = normalized.get(normalizedKey(key))
    if (value) return value
  }
  return ''
}
function listOf(row: RawRow, ...keys: string[]) {
  return valueOf(row, ...keys)
    .split(/[\n,;|]/)
    .map((value) => value.replace(/^\s*\d+[.)-]?\s*/, '').trim())
    .filter(Boolean)
}
function typeOf(value: string): TestCaseType {
  return value.toLowerCase() === 'negative'
    ? 'negative'
    : value.toLowerCase() === 'validation'
      ? 'validation'
      : 'positive'
}
function priorityOf(value: string): TestCasePriority {
  return value.toLowerCase() === 'high' ? 'high' : value.toLowerCase() === 'low' ? 'low' : 'medium'
}
function automationOf(value: string): TestCase['automationStatus'] {
  return ['ready', 'needs-data', 'needs-review', 'manual'].includes(value)
    ? (value as TestCase['automationStatus'])
    : 'needs-review'
}
