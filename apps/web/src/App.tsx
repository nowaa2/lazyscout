import { useEffect, useMemo, useState } from 'react'
import { AnalyzeForm } from './components/AnalyzeForm'
import { ErrorBanner } from './components/ErrorBanner'
import { ExplorerTree } from './components/ExplorerTree'
import { TestCaseDetail } from './components/TestCaseDetail'
import { TestCaseEditor } from './components/TestCaseEditor'
import { TestCaseTable } from './components/TestCaseTable'
import { TestCaseToolbar } from './components/TestCaseToolbar'
import { TraceabilitySummary } from './components/TraceabilitySummary'
import { TestDataTable } from './components/TestDataTable'
import { TestDataToolbar } from './components/TestDataToolbar'
import { GeneratedTests } from './components/GeneratedTests'
import { RunViewer } from './components/RunViewer'
import { ApiChecksTable } from './components/ApiChecksTable'
import { WorkspaceNav, type WorkspaceView } from './components/WorkspaceNav'
import { WorkspaceSidebar } from './components/WorkspaceSidebar'
import { DashboardView } from './components/DashboardView'
import { ExplorerModal } from './components/ExplorerModal'
import { ProjectSettings } from './components/ProjectSettings'
import { ScreenshotImporter } from './components/ScreenshotImporter'
import { TestCaseImporter } from './components/TestCaseImporter'
import { NewProjectModal } from './components/NewProjectModal'
import { BugReports } from './components/BugReports'
import { ScreenshotGallery } from './components/ScreenshotGallery'
import { LoadTest } from './components/LoadTest'
import { ScoutNotice } from './components/ScoutNotice'
import { ApiError, downloadTestCasesCsv } from './api/client'
import { useAnalyze } from './hooks/useAnalyze'
import { useClickFilter } from './hooks/useClickFilter'
import { useTestCases } from './hooks/useTestCases'
import { useTestData } from './hooks/useTestData'
import { useProjects } from './hooks/useProjects'
import { useProjectSecrets } from './hooks/useProjectSecrets'
import { useBugReports, type BugReport } from './hooks/useBugReports'
import { useScreenshots } from './hooks/useScreenshots'
import { filterTestCases, filterTestData, uniqueModules } from './lib/filterTestCases'
import {
  EMPTY_FILTERS,
  type AutomationLog,
  type ResultTab,
  type TestCase,
  type TestCaseFilters,
  type TestStep
} from './types'

const LAST_PROJECT_STORAGE_KEY = 'lazyscout-active-project-id'
const SCOUT_PROGRESS_LOGS = ['Launching Playwright runner', 'Opening target URL', 'Collecting pages and controls']

export default function App() {
  const { status, result: analysisResult, error, analyze, reset } = useAnalyze()
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    saveProject,
    createEmptyProject,
    deleteProject,
    renameProject,
    updateProjectResult,
    updateProjectTestCaseLanguage,
    workspaceRoot,
    workspaceError,
    loading: projectsLoading,
    openWorkspace
  } = useProjects()
  const activeProject = projects.find((project) => project.id === activeProjectId)
  const { secrets, saveSecrets, clearSecrets } = useProjectSecrets(activeProjectId)
  const { filter: clickFilter, blockedKeywords, save: saveClickFilter } = useClickFilter(activeProjectId)
  const rawResult = activeProject?.result ?? analysisResult
  // Test Case content is saved exactly as generated or edited. The UI language must never rewrite it.
  const result = rawResult
  const {
    testCases,
    selectedIds,
    updateTestCase,
    deleteTestCase,
    deleteSelected,
    reorderTestCases,
    createTestCaseDraft,
    addImportedTestCases,
    addTestCase,
    toggleSelected,
    setSelection
  } = useTestCases(result?.testCases)
  const { testData, updateRow, deleteRow, addRow } = useTestData(result?.testData)
  const { reports: bugReports, save: saveBugReport, remove: deleteBugReport } = useBugReports(activeProjectId)
  const { screenshots, add: addScreenshot, remove: deleteScreenshot } = useScreenshots(activeProjectId)

  const [tab, setTab] = useState<ResultTab>('testcases')
  const [scoutLogIndex, setScoutLogIndex] = useState(0)
  const [showScoutCli, setShowScoutCli] = useState(false)
  const [filters, setFilters] = useState<TestCaseFilters>(EMPTY_FILTERS)
  const [dataSearch, setDataSearch] = useState('')
  const [dataModule, setDataModule] = useState('all')
  const [activeId, setActiveId] = useState<string>()
  const [detailId, setDetailId] = useState<string>()
  const [editing, setEditing] = useState<TestCase | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string>()
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('overview')
  const [explorerOpen, setExplorerOpen] = useState(false)
  const [executionStatuses, setExecutionStatuses] = useState<Record<string, 'passed' | 'failed' | 'pending'>>({})
  const [runResults, setRunResults] = useState<
    Record<string, { status: string; logs: AutomationLog[]; finishedAt: string }>
  >({})
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [screenshotOpen, setScreenshotOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [scoutNotice, setScoutNotice] = useState<{ message: string; detail: string }>()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('lazyscout-sidebar-collapsed') === 'true'
  )

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      localStorage.setItem('lazyscout-sidebar-collapsed', String(!current))
      return !current
    })
  }
  function transition(action: () => void) {
    if (navigating) return
    setNavigating(true)
    window.setTimeout(() => {
      action()
      setNavigating(false)
    }, 700)
  }

  const visibleCases = useMemo(() => filterTestCases(testCases, filters), [testCases, filters])
  const visibleData = useMemo(
    () => filterTestData(testData, dataSearch, dataModule),
    [testData, dataSearch, dataModule]
  )
  const caseModules = useMemo(() => uniqueModules(testCases), [testCases])
  const dataModules = useMemo(() => uniqueModules(testData), [testData])
  const active = testCases.find((item) => item.id === activeId)

  function updateTableCell(id: string, key: string, value: string) {
    const current = testCases.find((item) => item.id === id)
    if (!current) return
    const updated = { ...current } as TestCase & Record<string, unknown>
    if (key === 'preconditions' || key === 'tags')
      updated[key] = value
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
    else if (key === 'steps') {
      updated.steps = value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => {
          try {
            return JSON.parse(item)
          } catch {
            return { type: 'manual', description: item }
          }
        }) as TestCase['steps']
    } else updated[key] = value
    updateTestCase(id, updated)
  }
  useEffect(() => {
    if (activeProjectId && result && activeProject?.result === result)
      updateProjectResult(activeProjectId, { ...result, testCases, testData })
  }, [testCases, testData])

  useEffect(() => {
    if (projectsLoading) return

    if (projects.length === 0) {
      localStorage.removeItem(LAST_PROJECT_STORAGE_KEY)
      setNewProjectOpen(true)
      return
    }

    if (activeProjectId && projects.some((project) => project.id === activeProjectId)) return

    const storedProjectId = localStorage.getItem(LAST_PROJECT_STORAGE_KEY)
    const projectToOpen = projects.find((project) => project.id === storedProjectId) ?? projects[0]
    setActiveProjectId(projectToOpen.id)
  }, [activeProjectId, projects, projectsLoading, setActiveProjectId])

  useEffect(() => {
    if (!projectsLoading && activeProjectId) localStorage.setItem(LAST_PROJECT_STORAGE_KEY, activeProjectId)
  }, [activeProjectId, projectsLoading])

  useEffect(() => {
    if (status !== 'loading') return
    const previousBodyOverflow = document.body.style.overflow
    const previousRootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousRootOverflow
    }
  }, [status])

  useEffect(() => {
    if (status !== 'loading') {
      setScoutLogIndex(0)
      setShowScoutCli(false)
      return
    }
    const timer = window.setInterval(() => {
      setScoutLogIndex((current) => (current + 1) % SCOUT_PROGRESS_LOGS.length)
    }, 1800)
    return () => window.clearInterval(timer)
  }, [status])

  async function handleAnalyze(
    url: string,
    maxPages: number,
    maxDepth: number,
    language: Parameters<typeof analyze>[3],
    includeApiChecks: boolean,
    waitAfterNavigationMs: number,
    startPath?: string,
    scopePath?: string,
    mode?: Parameters<typeof analyze>[10],
    debug?: boolean
  ) {
    const analyzed = await analyze(
      url,
      maxPages,
      maxDepth,
      language,
      includeApiChecks,
      waitAfterNavigationMs,
      blockedKeywords,
      activeProjectId,
      startPath,
      scopePath,
      mode,
      debug
    )
    if (analyzed) {
      saveProject(url, analyzed, undefined, activeProjectId, language)
      const controls = analyzed.pages.reduce(
        (total, page) =>
          total +
          page.links.length +
          page.buttons.length +
          page.inputs.length +
          page.textareas.length +
          page.selects.length +
          (page.state?.interactions.length ?? 0),
        0
      )
      if (analyzed.testCases.length === 0 || controls === 0) {
        const issueCodes = analyzed.issues
          .map((issue) => issue.code)
          .filter((code, index, all) => all.indexOf(code) === index)
        setScoutNotice({
          message: 'Scout finished, but no usable Test Cases were created.',
          detail: `Visited ${analyzed.pages.length} page${analyzed.pages.length === 1 ? '' : 's'} and found ${controls} testable control${controls === 1 ? '' : 's'}.${issueCodes.length ? ` Explorer reported: ${issueCodes.join(', ')}.` : ' The site may show a bot challenge, render content after a delay, or expose no detectable controls. Check Scout Log for details.'}`
        })
      } else setScoutNotice(undefined)
    }
  }

  async function handleExport() {
    const cases = tab === 'testcases' ? visibleCases : []
    const rows = tab === 'testdata' ? visibleData : []
    if (cases.length === 0 && rows.length === 0) {
      setExportError('No data is available for export.')
      return
    }

    setExporting(true)
    setExportError(undefined)
    try {
      await downloadTestCasesCsv(cases, rows)
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'Could not export CSV.')
    } finally {
      setExporting(false)
    }
  }

  function importCasesForCurrentPage(imported: TestCase[]) {
    const currentUrl = active?.sourceUrl ?? result?.startUrl
    if (!currentUrl) {
      addImportedTestCases(imported)
      return
    }
    addImportedTestCases(imported.filter((testCase) => testCase.sourceUrl === currentUrl))
  }

  function handleAdd() {
    const created = createTestCaseDraft(result?.startUrl ?? '')
    setEditing(created)
    setActiveId(created.id)
  }

  function handleSaveRecording(steps: TestStep[], title: string, sourceUrl: string) {
    const created = addTestCase({
      ...createTestCaseDraft(sourceUrl),
      title,
      steps,
      expectedResult: 'The recorded flow completes without an error.',
      automationStatus: 'needs-review'
    })
    setSettingsOpen(false)
    setTab('testcases')
    setActiveId(created.id)
  }

  return (
    <div className="app-frame">
      <WorkspaceSidebar
        projects={projects}
        activeProjectId={activeProjectId}
        result={result}
        collapsed={status === 'loading' ? false : sidebarCollapsed}
        onToggleCollapsed={() => {
          if (status !== 'loading') toggleSidebar()
        }}
        onSelect={(id) =>
          transition(() => {
            setActiveProjectId(id)
            setExecutionStatuses({})
            setRunResults({})
            setWorkspaceView('overview')
            setActiveId(undefined)
          })
        }
        onNew={() => setNewProjectOpen(true)}
        onDelete={deleteProject}
        onRename={renameProject}
        onSettings={() => setSettingsOpen(true)}
        workspaceRoot={workspaceRoot}
        onOpenWorkspace={openWorkspace}
      />
      <div className="app-main">
        <header className="app-header">
          <div>
            <div className="brand-mark">
              <span>LS</span>
              <h1>LazyScout</h1>
              <a
                className="guide-link"
                href="https://lazyscout.lazyscout.workers.dev/"
                target="_blank"
                rel="noreferrer"
                aria-label="Open LazyScout Guide"
                title="Open LazyScout Guide"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path d="M3.5 3.25A2.25 2.25 0 0 1 5.75 1h3A2.25 2.25 0 0 1 11 3.25v13.5A2.75 2.75 0 0 0 8.25 14h-2.5a2.25 2.25 0 0 0-2.25 2.25v-13Zm13 0A2.25 2.25 0 0 0 14.25 1h-3A2.25 2.25 0 0 0 9 3.25v13.5A2.75 2.75 0 0 1 11.75 14h2.5a2.25 2.25 0 0 1 2.25 2.25v-13Z" />
                </svg>
                <span>Guide</span>
              </a>
            </div>
            <p>
              QA workspace <span>/</span> Website UI State Explorer
            </p>
          </div>
          {result && (
            <div className="header-status">
              <span className="status-dot status-pass" /> Explorer ready <span className="header-divider" />{' '}
              <span>{result.origin}</span>
            </div>
          )}
        </header>

        <div className="space-y-4">
          {activeProject && (activeProject.targetUrl || activeProject.mode === 'scout') && (
            <AnalyzeForm
              key={activeProjectId ?? 'new-project'}
              initialUrl={activeProject?.targetUrl}
              hasExistingData={Boolean(activeProject?.result?.testCases?.length)}
              initialLanguage={activeProject.testCaseLanguage}
              loading={status === 'loading'}
              onLanguageChange={(language) =>
                activeProjectId && updateProjectTestCaseLanguage(activeProjectId, language)
              }
              onAnalyze={handleAnalyze}
            />
          )}

          {status === 'loading' && (
            <div className="card p-6 text-center text-sm text-slate-600">
              Playwright is opening the website and collecting page data… This can take a few moments.
            </div>
          )}

          {error && <ErrorBanner message={error.message} hint={error.hint} />}
          {workspaceError && (
            <ErrorBanner message={workspaceError} hint="Check that the LazyScout workspace is writable." />
          )}
          {exportError && <ErrorBanner message={exportError} />}
          {scoutNotice && <ScoutNotice {...scoutNotice} onClose={() => setScoutNotice(undefined)} />}

          {result && (
            <>
              <WorkspaceNav
                view={workspaceView}
                onChange={(view) => (view === 'explorer' ? setExplorerOpen(true) : setWorkspaceView(view))}
                counts={{ cases: testCases.length, states: result.actionGraph.states.length }}
              />
              {workspaceView === 'scoutlog' ? (
                <RunViewer result={result} />
              ) : workspaceView === 'loadtest' ? (
                <LoadTest defaultUrl={activeProject?.targetUrl || result.startUrl} />
              ) : workspaceView === 'automation' ? (
                <GeneratedTests
                  testCases={testCases}
                  projectId={activeProjectId}
                  secrets={secrets}
                  blockedKeywords={blockedKeywords}
                  onRunStatus={(id, status) => setExecutionStatuses((current) => ({ ...current, [id]: status }))}
                  onRunResult={(id, result) => {
                    setRunResults((current) => ({
                      ...current,
                      [id]: { ...result, finishedAt: new Date().toISOString() }
                    }))
                    const captured = result.screenshots?.length
                      ? result.screenshots
                      : result.screenshot
                        ? [result.screenshot]
                        : []
                    captured.forEach(addScreenshot)
                    if (result.status === 'failed' && activeProjectId) {
                      const failedCase = testCases.find((testCase) => testCase.id === id)
                      const report: BugReport = {
                        id: `bug-${crypto.randomUUID()}`,
                        title: `Automation failed: ${failedCase?.title ?? id}`,
                        severity: 'high',
                        status: 'open',
                        testCaseId: id,
                        actualResult: 'The Playwright automation step failed. Open Automation Run Log for details.',
                        expectedResult: failedCase?.expectedResult ?? 'The Test Case should complete successfully.',
                        stepsToReproduce:
                          failedCase?.steps.map((step, index) => `${index + 1}. ${step.type}`).join('\n') ?? '',
                        attachments: captured.map((screenshot) => ({
                          name: screenshot.name,
                          type: 'image/png',
                          dataUrl: screenshot.dataUrl
                        })),
                        createdAt: new Date().toISOString()
                      }
                      saveBugReport(report)
                    }
                  }}
                />
              ) : workspaceView === 'overview' ? (
                <DashboardView
                  result={result}
                  testCases={testCases}
                  executionStatuses={executionStatuses}
                  runResults={runResults}
                  projectId={activeProjectId}
                />
              ) : (
                <div className="workspace-shell">
                  <ExplorerTree
                    result={result}
                    activeUrl={active?.sourceUrl}
                    onSelect={(url) => setActiveId(testCases.find((item) => item.sourceUrl === url)?.id)}
                  />
                  <main className="workspace-center">
                    <div className="workspace-center-head">
                      <div>
                        <p className="eyebrow">Current Workspace</p>
                        <h2>{tab === 'testcases' ? 'Test Case Review' : 'Test Data'}</h2>
                      </div>
                      <div className="center-chips">
                        <span className="status-badge status-badge-pass">
                          {testCases.filter((item) => item.automationStatus === 'ready').length} ready
                        </span>
                        <span className="status-badge status-badge-warn">
                          {testCases.filter((item) => item.automationStatus === 'needs-review').length} review
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-4">
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
                          <button
                            type="button"
                            onClick={() => setTab('apichecks')}
                            className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium ${tab === 'apichecks' ? 'border-slate-200 bg-white text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                          >
                            Test API ({result.apiChecks?.length ?? 0})
                          </button>
                          <button
                            type="button"
                            onClick={() => setTab('bugreports' as ResultTab)}
                            className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium ${tab === ('bugreports' as ResultTab) ? 'border-slate-200 bg-white text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                          >
                            Bug Reports ({bugReports.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setTab('screenshots')}
                            className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium ${tab === 'screenshots' ? 'border-slate-200 bg-white text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                          >
                            Screenshots ({screenshots.length})
                          </button>
                        </div>

                        {tab === 'screenshots' ? (
                          <ScreenshotGallery screenshots={screenshots} onDelete={deleteScreenshot} />
                        ) : tab === ('bugreports' as ResultTab) ? (
                          <BugReports
                            reports={bugReports}
                            testCases={testCases}
                            onSave={saveBugReport}
                            onDelete={deleteBugReport}
                          />
                        ) : tab === 'apichecks' ? (
                          <ApiChecksTable checks={result.apiChecks ?? []} secrets={secrets} />
                        ) : tab === 'testcases' ? (
                          <>
                            <TraceabilitySummary testCases={testCases} />
                            <TestCaseToolbar
                              filters={filters}
                              modules={caseModules}
                              totalCount={testCases.length}
                              visibleCount={visibleCases.length}
                              selectedCount={selectedIds.length}
                              exporting={exporting}
                              onFiltersChange={setFilters}
                              onAdd={handleAdd}
                              onImport={() => setImportOpen(true)}
                              onImportScreenshot={() => setScreenshotOpen(true)}
                              onDeleteSelected={deleteSelected}
                              onExport={handleExport}
                            />
                            <TestCaseTable
                              testCases={visibleCases}
                              selectedIds={selectedIds}
                              activeId={activeId}
                              onToggleSelect={toggleSelected}
                              onToggleAll={setSelection}
                              onOpen={(testCase) => {
                                setActiveId(testCase.id)
                                setDetailId(testCase.id)
                              }}
                              onEdit={setEditing}
                              onDelete={deleteTestCase}
                              onReorder={reorderTestCases}
                              onUpdateCell={updateTableCell}
                              executionStatuses={executionStatuses}
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
                    </div>
                  </main>
                </div>
              )}
            </>
          )}
        </div>

        {editing && (
          <TestCaseEditor
            testCase={editing}
            onCancel={() => setEditing(null)}
            onSave={(updated) => {
              if (testCases.some((item) => item.id === editing.id)) updateTestCase(editing.id, updated)
              else addTestCase(updated)
              setActiveId(updated.id)
              setEditing(null)
            }}
          />
        )}
        {explorerOpen && result && (
          <ExplorerModal
            result={result}
            testCaseCount={testCases.length}
            onClose={() => setExplorerOpen(false)}
            onOpenCases={() => {
              setExplorerOpen(false)
              setWorkspaceView('testcases')
            }}
          />
        )}
        {detailId && !editing && tab === 'testcases' && testCases.find((item) => item.id === detailId) && (
          <TestCaseDetail
            testCase={testCases.find((item) => item.id === detailId)!}
            onEdit={() => setEditing(testCases.find((item) => item.id === detailId)!)}
            onClose={() => setDetailId(undefined)}
          />
        )}
        {settingsOpen && activeProject && (
          <ProjectSettings
            projectName={activeProject.name}
            projectId={activeProject.id}
            targetUrl={activeProject.targetUrl}
            secrets={secrets}
            onSave={saveSecrets}
            onClear={clearSecrets}
            onClose={() => setSettingsOpen(false)}
            onSaveRecording={handleSaveRecording}
            clickFilter={clickFilter}
            onChangeClickFilter={saveClickFilter}
          />
        )}
        {screenshotOpen && (
          <ScreenshotImporter
            sourceUrl={result?.startUrl ?? activeProject?.targetUrl ?? ''}
            initialLanguage={activeProject?.testCaseLanguage}
            onLanguageChange={(language) => activeProjectId && updateProjectTestCaseLanguage(activeProjectId, language)}
            existingCases={testCases}
            onImport={importCasesForCurrentPage}
            onClose={() => setScreenshotOpen(false)}
          />
        )}
        {importOpen && (
          <TestCaseImporter
            sourceUrl={result?.startUrl ?? activeProject?.targetUrl ?? ''}
            existingCases={testCases}
            onImport={importCasesForCurrentPage}
            onClose={() => setImportOpen(false)}
          />
        )}
        {newProjectOpen && (
          <NewProjectModal
            projects={projects}
            onClose={() => setNewProjectOpen(false)}
            onScout={(name) =>
              transition(() => {
                createEmptyProject(name, 'scout')
                reset()
                setExecutionStatuses({})
                setRunResults({})
                setWorkspaceView('overview')
                setNewProjectOpen(false)
              })
            }
            onEmpty={(name) =>
              transition(() => {
                createEmptyProject(name, 'empty')
                reset()
                setExecutionStatuses({})
                setRunResults({})
                setWorkspaceView('testcases')
                setNewProjectOpen(false)
              })
            }
            onOpenProject={(id) =>
              transition(() => {
                setActiveProjectId(id)
                reset()
                setExecutionStatuses({})
                setRunResults({})
                setWorkspaceView('overview')
                setNewProjectOpen(false)
              })
            }
          />
        )}
        {status === 'loading' && (
          <div className="scout-lock" role="status" aria-live="polite">
            <div className="scout-lock-card">
              <div className="scout-progress-head">
                <div className="scout-progress-icon">✦</div>
                <div>
                  <b>Scouting website with Playwright</b>
                  <span>Collecting pages, controls and event logs.</span>
                </div>
              </div>
              <div className="scout-view-switch" role="tablist" aria-label="Scout progress view">
                <button
                  type="button"
                  className={!showScoutCli ? 'is-active' : ''}
                  onClick={() => setShowScoutCli(false)}
                >
                  Progress
                </button>
                <button type="button" className={showScoutCli ? 'is-active' : ''} onClick={() => setShowScoutCli(true)}>
                  CLI Log
                </button>
              </div>
              {!showScoutCli ? (
                <>
                  <span className="scout-progress-track">
                    <i />
                  </span>
                  <strong className="scout-progress-percent">Working…</strong>
                  <code className="scout-cli-line">$ {SCOUT_PROGRESS_LOGS[scoutLogIndex]}…</code>
                </>
              ) : (
                <div className="scout-cli-terminal" role="log" aria-live="polite">
                  {SCOUT_PROGRESS_LOGS.slice(0, scoutLogIndex + 1).map((message, index) => (
                    <code key={message}>
                      [{String(index + 1).padStart(2, '0')}] $ {message}…
                    </code>
                  ))}
                </div>
              )}
              <span>Please wait until Scout finishes.</span>
            </div>
          </div>
        )}
        {navigating && (
          <div className="navigation-loader">
            <div>
              <span>LS</span>
              <b>Opening workspace</b>
              <small>Preparing your local QA tools…</small>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
