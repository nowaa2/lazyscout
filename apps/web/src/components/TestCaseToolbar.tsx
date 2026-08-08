import type { TestCaseFilters } from '../types'

type Props = {
  filters: TestCaseFilters
  modules: string[]
  totalCount: number
  visibleCount: number
  selectedCount: number
  exporting: boolean
  onFiltersChange: (filters: TestCaseFilters) => void
  onAdd: () => void
  onDeleteSelected: () => void
  onExport: () => void
}

/** แถบเครื่องมือของตาราง: ค้นหา, กรอง, เพิ่ม, ลบที่เลือก, export CSV */
export function TestCaseToolbar({
  filters,
  modules,
  totalCount,
  visibleCount,
  selectedCount,
  exporting,
  onFiltersChange,
  onAdd,
  onDeleteSelected,
  onExport
}: Props) {
  function update(patch: Partial<TestCaseFilters>) {
    onFiltersChange({ ...filters, ...patch })
  }

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
      <div className="min-w-56 flex-1">
        <label className="field-label" htmlFor="search">
          Search
        </label>
        <input
          id="search"
          className="field"
          value={filters.search}
          onChange={(event) => update({ search: event.target.value })}
          placeholder="ค้นหาจาก ID, title, expected result, steps"
        />
      </div>

      <div className="w-40">
        <label className="field-label" htmlFor="filter-module">
          Module
        </label>
        <select
          id="filter-module"
          className="field"
          value={filters.module}
          onChange={(event) => update({ module: event.target.value })}
        >
          <option value="all">ทั้งหมด</option>
          {modules.map((module) => (
            <option key={module} value={module}>
              {module}
            </option>
          ))}
        </select>
      </div>

      <div className="w-36">
        <label className="field-label" htmlFor="filter-type">
          Type
        </label>
        <select
          id="filter-type"
          className="field"
          value={filters.type}
          onChange={(event) => update({ type: event.target.value })}
        >
          <option value="all">ทั้งหมด</option>
          <option value="positive">positive</option>
          <option value="negative">negative</option>
          <option value="validation">validation</option>
        </select>
      </div>

      <div className="w-36">
        <label className="field-label" htmlFor="filter-priority">
          Priority
        </label>
        <select
          id="filter-priority"
          className="field"
          value={filters.priority}
          onChange={(event) => update({ priority: event.target.value })}
        >
          <option value="all">ทั้งหมด</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-secondary" onClick={onAdd}>
          + Add Test Case
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={onDeleteSelected}
          disabled={selectedCount === 0}
        >
          Delete ({selectedCount})
        </button>
        <button type="button" className="btn btn-primary" onClick={onExport} disabled={exporting}>
          {exporting ? 'กำลัง export...' : 'Export CSV'}
        </button>
      </div>

      <p className="w-full text-xs text-slate-500">
        แสดง {visibleCount} จาก {totalCount} test case
        {selectedCount > 0 && ` · เลือกไว้ ${selectedCount} รายการ (Export จะใช้เฉพาะที่เลือก)`}
      </p>
    </div>
  )
}
