import type { TestDataRow } from '../types'

type Props = {
  rows: TestDataRow[]
  onUpdate: (originalId: string, row: TestDataRow) => void
  onDelete: (id: string) => void
}

export function TestDataTable({ rows, onUpdate, onDelete }: Props) {
  if (rows.length === 0) {
    return <p className="p-6 text-center text-sm text-slate-500">No Test Data matches the current filters.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="table-head w-32">TD ID</th>
            <th className="table-head w-28">Module</th>
            <th className="table-head w-44">Field</th>
            <th className="table-head w-28">Input Type</th>
            <th className="table-head w-20">Required</th>
            <th className="table-head">Valid Value</th>
            <th className="table-head">Invalid Value</th>
            <th className="table-head">Note</th>
            <th className="table-head w-20">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="table-cell font-mono text-xs">{row.id}</td>
              <td className="table-cell">{row.module}</td>
              <td className="table-cell">
                <input
                  className="field px-2 py-1"
                  value={row.field}
                  onChange={(event) => onUpdate(row.id, { ...row, field: event.target.value })}
                  aria-label={`Field for ${row.id}`}
                />
              </td>
              <td className="table-cell font-mono text-xs text-slate-500">{row.inputType}</td>
              <td className="table-cell text-center">
                <input
                  type="checkbox"
                  checked={row.required}
                  onChange={(event) => onUpdate(row.id, { ...row, required: event.target.checked })}
                  aria-label={`Required for ${row.id}`}
                />
              </td>
              <td className="table-cell">
                <input
                  className="field px-2 py-1"
                  value={row.validValue}
                  onChange={(event) => onUpdate(row.id, { ...row, validValue: event.target.value })}
                  aria-label={`Valid value for ${row.id}`}
                />
              </td>
              <td className="table-cell">
                <input
                  className="field px-2 py-1"
                  value={row.invalidValue}
                  onChange={(event) => onUpdate(row.id, { ...row, invalidValue: event.target.value })}
                  aria-label={`Invalid value for ${row.id}`}
                />
              </td>
              <td className="table-cell">
                <input
                  className="field px-2 py-1"
                  value={row.note ?? ''}
                  onChange={(event) => onUpdate(row.id, { ...row, note: event.target.value })}
                  aria-label={`Note for ${row.id}`}
                />
              </td>
              <td className="table-cell">
                <button type="button" className="btn btn-danger px-2 py-1" onClick={() => onDelete(row.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
