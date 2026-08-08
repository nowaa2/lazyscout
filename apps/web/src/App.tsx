import { useMemo, useState } from 'react'
import { AnalyzeForm } from './components/AnalyzeForm'
import { ErrorBanner } from './components/ErrorBanner'
import { ExploreSummary } from './components/ExploreSummary'
import { TestCaseDetail } from './components/TestCaseDetail'
import { TestCaseEditor } from './components/TestCaseEditor'
import { TestCaseTable } from './components/TestCaseTable'
import { TestCaseToolbar } from './components/TestCaseToolbar'
import { TestDataTable } from './components/TestDataTable'
import { TestDataToolbar } from './components/TestDataToolbar'
import { ApiError, downloadTestCasesCsv } from './api/client'
import { useAnalyze } from './hooks/useAnalyze'
import { useTestCases } from './hooks/useTestCases'
import { useTestData } from './hooks/useTestData'
import { filterTestCases, filterTestData, uniqueModules } from './lib/filterTestCases'
import { EMPTY_FILTERS, type ResultTab, type TestCase, type TestCaseFilters } from './types'

export default function App() {
  const { status, result, error, analyze } = useAnalyze()
  const {
    testCases,
    selectedIds,
    updateTestCase,
    deleteTestCase,
    deleteSelected,
    addTestCase,
    toggleSelected,
    setSelection
  } = useTestCases(result?.testCases)
  const { testData, updateRow, deleteRow, addRow } = useTestData(result?.testData)

  const [tab, setTab] = useState<ResultTab>('testcases')
  const [filters, setFilters] = useState<TestCaseFilters>(EMPTY_FILTERS)
  const [dataSearch, setDataSearch] = useState('')
  const [dataModule, setDataModule] = useState('all')
  const [activeId, setActiveId] = useState<string>()
  const [editing, setEditing] = useState<TestCase | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string>()

  const visibleCases = useMemo(() => filterTestCases(testCases, filters), [testCases, filters])
  const visibleData = useMemo(
    () => filterTestData(testData, dataSearch, dataModule),
    [testData, dataSearch, dataModule]
  )
  const caseModules = useMemo(() => uniqueModules(testCases), [testCases])
  const dataModules = useMemo(() => uniqueModules(testData), [testData])
  const active = testCases.find((item) => item.id === activeId)

  /** ปุ่ม Export ทั้งสองแท็บสร้างไฟล์เดียวกัน: test case + test data */
  async function handleExport() {
    const cases = selectedIds.length > 0 ? testCases.filter((item) => selectedIds.includes(item.id)) : visibleCases
    if (cases.length === 0 && visibleData.length === 0) {
      setExportError('ไม่มีข้อมูลสำหรับ export')
      return
    }

    setExporting(true)
    setExportError(undefined)
    try {
      await downloadTestCasesCsv(cases, visibleData)
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'export CSV ไม่สำเร็จ')
    } finally {
      setExporting(false)
    }
  }

  function handleAdd() {
    const created = addTestCase(result?.startUrl ?? '')
    setEditing(created)
    setActiveId(created.id)
  }

  return (
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">LazyScout</h1>
        <p className="text-sm text-slate-600">
          วิเคราะห์เว็บไซต์ด้วย Playwright แล้วสร้าง Draft Test Case และ Test Data ให้ Tester ตรวจและ export เป็น CSV
        </p>
      </header>

      <div className="space-y-4">
        <AnalyzeForm loading={status === 'loading'} onAnalyze={analyze} />

        {status === 'loading' && (
          <div className="card p-6 text-center text-sm text-slate-600">
            กำลังเปิดเว็บไซต์ด้วย Playwright และเก็บข้อมูลหน้าเว็บ... (อาจใช้เวลาหลายสิบวินาที)
          </div>
        )}

        {error && <ErrorBanner message={error.message} hint={error.hint} />}
        {exportError && <ErrorBanner message={exportError} />}

        {result && (
          <>
            <ExploreSummary result={result} />

            {/* จองที่ให้ panel รายละเอียดเฉพาะตอนดูตาราง test case และไม่ได้เปิดหน้าต่างแก้ไข */}
            <div
              className={`grid gap-4 ${
                active && !editing && tab === 'testcases' ? 'xl:grid-cols-[minmax(0,1fr)_420px]' : ''
              }`}
            >
              <div className="card">
                <div className="flex gap-1 border-b border-slate-200 px-4 pt-3">
                  <button
                    type="button"
                    onClick={() => setTab('testcases')}
                    className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium ${
                      tab === 'testcases'
                        ? 'border-slate-200 bg-white text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Test Cases ({testCases.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('testdata')}
                    className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium ${
                      tab === 'testdata'
                        ? 'border-slate-200 bg-white text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Test Data ({testData.length})
                  </button>
                </div>

                {tab === 'testcases' ? (
                  <>
                    <TestCaseToolbar
                      filters={filters}
                      modules={caseModules}
                      totalCount={testCases.length}
                      visibleCount={visibleCases.length}
                      selectedCount={selectedIds.length}
                      exporting={exporting}
                      onFiltersChange={setFilters}
                      onAdd={handleAdd}
                      onDeleteSelected={deleteSelected}
                      onExport={handleExport}
                    />
                    <TestCaseTable
                      testCases={visibleCases}
                      selectedIds={selectedIds}
                      activeId={activeId}
                      onToggleSelect={toggleSelected}
                      onToggleAll={setSelection}
                      onOpen={(testCase) => setActiveId(testCase.id)}
                      onEdit={setEditing}
                      onDelete={deleteTestCase}
                    />
                  </>
                ) : (
                  <>
                    <TestDataToolbar
                      search={dataSearch}
                      module={dataModule}
                      modules={dataModules}
                      totalCount={testData.length}
                      visibleCount={visibleData.length}
                      exporting={exporting}
                      onSearchChange={setDataSearch}
                      onModuleChange={setDataModule}
                      onAdd={() => addRow(result.startUrl)}
                      onExport={handleExport}
                    />
                    <TestDataTable rows={visibleData} onUpdate={updateRow} onDelete={deleteRow} />
                  </>
                )}
              </div>

              {active && !editing && tab === 'testcases' && (
                <TestCaseDetail
                  testCase={active}
                  onEdit={() => setEditing(active)}
                  onClose={() => setActiveId(undefined)}
                />
              )}
            </div>
          </>
        )}
      </div>

      {editing && (
        <TestCaseEditor
          testCase={editing}
          onCancel={() => setEditing(null)}
          onSave={(updated) => {
            updateTestCase(editing.id, updated)
            setActiveId(updated.id)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
