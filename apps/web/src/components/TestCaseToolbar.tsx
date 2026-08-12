import type { TestCaseFilters } from '../types'
import { useLanguage } from '../i18n'

type Props = {
  filters: TestCaseFilters
  modules: string[]
  totalCount: number
  visibleCount: number
  selectedCount: number
  exporting: boolean
  onFiltersChange: (filters: TestCaseFilters) => void
  onAdd: () => void
  onImportScreenshot: () => void
  onImport: () => void
  onRecord: () => void
  onDeleteSelected: () => void
  onExport: () => void
}

export function TestCaseToolbar({
  filters,
  modules,
  totalCount,
  visibleCount,
  selectedCount,
  exporting,
  onFiltersChange,
  onAdd,
  onImportScreenshot,
  onImport,
  onRecord,
  onDeleteSelected,
  onExport
}: Props) {
  const { language, t } = useLanguage()
  const th = language === 'th'
  const update = (patch: Partial<TestCaseFilters>) => onFiltersChange({ ...filters, ...patch })
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
      <div className="min-w-56 flex-1">
        <label className="field-label" htmlFor="search">
          {t('search')}
        </label>
        <input
          id="search"
          className="field"
          value={filters.search}
          onChange={(event) => update({ search: event.target.value })}
          placeholder="Search ID, title, expected result, steps, tags or requirements"
        />
      </div>
      <div className="w-48">
        <label className="field-label" htmlFor="filter-module">
          Folder / Module
        </label>
        <input
          id="filter-module"
          className="field"
          list="module-options"
          value={filters.module === 'all' ? '' : filters.module}
          onChange={(event) => update({ module: event.target.value || 'all' })}
          placeholder="Search or select folder"
        />
        <datalist id="module-options">
          {modules.map((module) => (
            <option key={module} value={module} />
          ))}
        </datalist>
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
          <option value="all">All</option>
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
          <option value="all">All</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-secondary" onClick={onAdd}>
          + {t('addCase')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onImport}>
          ⇧ {th ? 'นำเข้า' : 'Import'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onImportScreenshot}>
          ▣ {t('screenshot')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onRecord}>
          ● {th ? 'บันทึก Flow' : 'Record Flow'}
        </button>
        <button type="button" className="btn btn-danger" onClick={onDeleteSelected} disabled={selectedCount === 0}>
          {t('delete')} ({selectedCount})
        </button>
        <button type="button" className="btn btn-primary" onClick={onExport} disabled={exporting}>
          {exporting ? (th ? 'กำลัง Export…' : 'Exporting…') : t('export')}
        </button>
      </div>
      <p className="w-full text-xs text-slate-500">
        {th ? 'แสดง' : 'Showing'} {visibleCount} {th ? 'จาก' : 'of'} {totalCount} Test Cases
        {selectedCount > 0 && ` · ${selectedCount} ${th ? 'รายการที่เลือก' : 'selected'}`}
      </p>
    </div>
  )
}
