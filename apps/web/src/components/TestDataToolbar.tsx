type Props = {
  search: string
  module: string
  modules: string[]
  totalCount: number
  visibleCount: number
  exporting: boolean
  onSearchChange: (value: string) => void
  onModuleChange: (value: string) => void
  onAdd: () => void
  onExport: () => void
}

export function TestDataToolbar({
  search,
  module,
  modules,
  totalCount,
  visibleCount,
  exporting,
  onSearchChange,
  onModuleChange,
  onAdd,
  onExport
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
      <div className="min-w-56 flex-1">
        <label className="field-label" htmlFor="data-search">
          Search
        </label>
        <input
          id="data-search"
          className="field"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search field, value or note"
        />
      </div>

      <div className="w-40">
        <label className="field-label" htmlFor="data-module">
          Module
        </label>
        <select
          id="data-module"
          className="field"
          value={module}
          onChange={(event) => onModuleChange(event.target.value)}
        >
          <option value="all">All</option>
          {modules.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-secondary" onClick={onAdd}>
          + Add Row
        </button>
        <button type="button" className="btn btn-primary" onClick={onExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      <p className="w-full text-xs text-slate-500">
        Showing {visibleCount} of {totalCount} rows · Generated values are examples only.
        Replace them with real test data before use · CSV export includes Test Cases and Test Data together.
      </p>
    </div>
  )
}
