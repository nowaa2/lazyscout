import { useMemo, useState, type ReactNode } from 'react'
import type { AnalyzeResponse, AutomationLog, TestCase } from '../types'
import { exportDashboardHtml, exportDashboardPdf } from '../lib/dashboardPdf'
import { saveWorkspaceReport } from '../api/client'

type Panel = 'status' | 'priority' | 'type' | 'automation' | 'modules' | 'trend'
type ChartKind = 'bar' | 'column' | 'donut' | 'treemap' | 'line'
type Slice = { label: string; value: number; color: string }
type RunResults = Record<string, { status: string; logs: AutomationLog[]; finishedAt: string }>

export function DashboardView({
  result,
  testCases,
  executionStatuses = {},
  runResults = {},
  projectId
}: {
  result: AnalyzeResponse
  testCases: TestCase[]
  executionStatuses?: Record<string, 'passed' | 'failed' | 'pending'>
  runResults?: RunResults
  projectId?: string
}) {
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [visible, setVisible] = useState<Record<Panel, boolean>>({
    status: true,
    priority: true,
    type: true,
    automation: true,
    modules: true,
    trend: true
  })
  const [chartTypes, setChartTypes] = useState<Record<Panel, ChartKind>>({
    status: 'donut',
    priority: 'column',
    type: 'bar',
    automation: 'donut',
    modules: 'treemap',
    trend: 'line'
  })
  const execution = {
    passed: testCases.filter((item) => executionStatuses[item.id] === 'passed').length,
    failed: testCases.filter((item) => executionStatuses[item.id] === 'failed').length,
    pending: testCases.filter(
      (item) => executionStatuses[item.id] !== 'passed' && executionStatuses[item.id] !== 'failed'
    ).length
  }
  const priorities = countBy(testCases, (item) => item.priority)
  const types = countBy(testCases, (item) => item.type)
  const automation = countBy(testCases, (item) => item.automationStatus)
  const folders = countBy(testCases, (item) => (item.folder ?? item.module) || 'UNASSIGNED')
  const discoveryTrend = useMemo(() => makeDiscoveryTrend(result), [result])
  const statusSlices: Slice[] = [
    { label: 'Pass', value: execution.passed, color: '#10b981' },
    { label: 'Failed', value: execution.failed, color: '#ef4444' },
    { label: 'Pending', value: execution.pending, color: '#f59e0b' }
  ]
  const prioritySlices: Slice[] = [
    { label: 'High', value: priorities.high ?? 0, color: '#ef4444' },
    { label: 'Medium', value: priorities.medium ?? 0, color: '#f59e0b' },
    { label: 'Low', value: priorities.low ?? 0, color: '#3b82f6' }
  ]
  const typeSlices: Slice[] = [
    { label: 'Positive', value: types.positive ?? 0, color: '#10b981' },
    { label: 'Negative', value: types.negative ?? 0, color: '#ef4444' },
    { label: 'Validation', value: types.validation ?? 0, color: '#6366f1' }
  ]
  const readinessSlices: Slice[] = [
    { label: 'Ready', value: automation.ready ?? 0, color: '#3b82f6' },
    { label: 'Needs review', value: automation['needs-review'] ?? 0, color: '#f59e0b' },
    { label: 'Needs data', value: automation['needs-data'] ?? 0, color: '#8b5cf6' },
    { label: 'Manual', value: automation.manual ?? 0, color: '#64748b' }
  ]
  const folderSlices = Object.entries(folders).map(([label, value], index) => ({
    label,
    value,
    color: TREEMAP_COLORS[index % TREEMAP_COLORS.length]
  }))
  const linkedCases = testCases.filter((testCase) => (testCase.requirements?.length ?? 0) > 0).length
  const requirementCount = new Set(testCases.flatMap((testCase) => testCase.requirements ?? [])).size
  const reportData = {
    origin: result.origin,
    generatedAt: new Date().toLocaleString(),
    pages: result.pages.length,
    testCases: testCases.length,
    passed: execution.passed,
    failed: execution.failed,
    pending: execution.pending,
    needsReview: automation['needs-review'] ?? 0,
    linkedCases,
    requirementCount,
    status: statusSlices,
    priority: prioritySlices,
    testType: typeSlices,
    readiness: readinessSlices,
    modules: topTen(folderSlices),
    failedCases: testCases
      .filter((testCase) => executionStatuses[testCase.id] === 'failed')
      .map((testCase) => ({
        id: testCase.id,
        title: testCase.title,
        folder: testCase.folder ?? testCase.module,
        logs: (runResults[testCase.id]?.logs ?? [])
          .slice(-8)
          .map((log) => `${new Date(log.timestamp).toLocaleTimeString()} ${log.message}`)
      }))
  }
  const toggle = (key: Panel) => setVisible((current) => ({ ...current, [key]: !current[key] }))
  const setChartType = (panel: Panel, type: ChartKind) => setChartTypes((current) => ({ ...current, [panel]: type }))
  const saveReport = (print: boolean) => {
    const html = print ? exportDashboardPdf(reportData) : exportDashboardHtml(reportData)
    if (projectId)
      void saveWorkspaceReport(projectId, print ? 'quality-report-print.html' : 'quality-report.html', html)
  }

  return (
    <div className="dashboard-view">
      <div className="dashboard-title">
        <div>
          <p className="eyebrow">Project dashboard</p>
          <h2>Quality overview</h2>
          <p>
            Coverage and readiness for <b>{result.origin}</b>
          </p>
        </div>
        <div className="dashboard-actions">
          <span className="status-badge status-badge-warn">{execution.pending} pending execution</span>
          <button type="button" className="btn btn-secondary" onClick={() => setCustomizeOpen((current) => !current)}>
            Customize
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => saveReport(false)}>
            HTML report
          </button>
          <button type="button" className="btn btn-primary" onClick={() => saveReport(true)}>
            Export PDF
          </button>
        </div>
      </div>
      {customizeOpen && (
        <div className="dashboard-customize">
          <b>Dashboard layout</b>
          <span>Show or hide charts</span>
          {(['status', 'priority', 'type', 'automation', 'modules', 'trend'] as Panel[]).map((key) => (
            <label key={key}>
              <input type="checkbox" checked={visible[key]} onChange={() => toggle(key)} /> {panelLabel(key)}
            </label>
          ))}
        </div>
      )}
      <div className="dashboard-metrics">
        <Metric
          label="Test Cases"
          value={testCases.length}
          hint={`${result.pages.length} pages explored`}
          tone="blue"
        />
        <Metric label="Pass" value={execution.passed} hint="Execution result" tone="green" />
        <Metric label="Failed" value={execution.failed} hint="Execution result" tone="red" />
        <Metric
          label="Need Review"
          value={automation['needs-review'] ?? 0}
          hint="Tester decision needed"
          tone="amber"
        />
        <Metric
          label="Requirements"
          value={requirementCount}
          hint={`${linkedCases}/${testCases.length} cases linked`}
          tone="blue"
        />
      </div>
      <div className="dashboard-columns">
        {visible.status && (
          <ChartCard
            eyebrow="Composition"
            title="Execution status"
            panel="status"
            kind={chartTypes.status}
            onChange={setChartType}
          >
            {renderCategoryChart(chartTypes.status, statusSlices, 'Test Cases')}
          </ChartCard>
        )}
        {visible.priority && (
          <ChartCard
            eyebrow="Comparison"
            title="Priority"
            panel="priority"
            kind={chartTypes.priority}
            onChange={setChartType}
          >
            {renderCategoryChart(chartTypes.priority, prioritySlices, 'Cases')}
          </ChartCard>
        )}
      </div>
      <div className="dashboard-columns">
        {visible.type && (
          <ChartCard eyebrow="Comparison" title="Test type" panel="type" kind={chartTypes.type} onChange={setChartType}>
            {renderCategoryChart(chartTypes.type, typeSlices, 'Cases')}
          </ChartCard>
        )}
        {visible.automation && (
          <ChartCard
            eyebrow="Composition"
            title="Automation readiness"
            panel="automation"
            kind={chartTypes.automation}
            onChange={setChartType}
          >
            {renderCategoryChart(chartTypes.automation, readinessSlices, 'Cases')}
          </ChartCard>
        )}
      </div>
      <div className="dashboard-columns">
        {visible.modules && (
          <ChartCard
            eyebrow="Hierarchy"
            title="Folder coverage"
            panel="modules"
            kind={chartTypes.modules}
            onChange={setChartType}
          >
            {renderCategoryChart(chartTypes.modules, folderSlices, 'Cases')}
          </ChartCard>
        )}
        {visible.trend && (
          <ChartCard
            eyebrow="Trend"
            title="Scout discovery"
            panel="trend"
            kind={chartTypes.trend}
            onChange={setChartType}
          >
            {chartTypes.trend === 'line' ? (
              <LineChart points={discoveryTrend.slice(-MAX_GRAPH_ITEMS)} />
            ) : (
              <ColumnChart
                items={discoveryTrend
                  .slice(-MAX_GRAPH_ITEMS)
                  .map((value, index) => ({ label: `Step ${index + 1}`, value, color: '#4f46e5' }))}
              />
            )}
          </ChartCard>
        )}
      </div>
    </div>
  )
}

function ChartCard({
  eyebrow,
  title,
  panel,
  kind,
  onChange,
  children
}: {
  eyebrow: string
  title: string
  panel: Panel
  kind: ChartKind
  onChange: (panel: Panel, type: ChartKind) => void
  children: ReactNode
}) {
  return (
    <section className="dashboard-card">
      <div className="dashboard-card-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <label className="chart-selector">
          <span>Chart</span>
          <select value={kind} onChange={(event) => onChange(panel, event.target.value as ChartKind)}>
            {CHART_OPTIONS[panel].map((option) => (
              <option key={option} value={option}>
                {chartLabel(option)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {children}
    </section>
  )
}
function Metric({ label, value, hint, tone }: { label: string; value: number; hint: string; tone: string }) {
  return (
    <div className={`dashboard-metric tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  )
}
function countBy(items: TestCase[], key: (item: TestCase) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const value = key(item)
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}
function panelLabel(panel: Panel) {
  return {
    status: 'Execution status',
    priority: 'Priority comparison',
    type: 'Test type comparison',
    automation: 'Automation readiness',
    modules: 'Folder treemap',
    trend: 'Scout trend'
  }[panel]
}
function chartLabel(kind: ChartKind) {
  return { bar: 'Bar chart', column: 'Column chart', donut: 'Donut chart', treemap: 'Treemap', line: 'Line chart' }[
    kind
  ]
}
function renderCategoryChart(kind: ChartKind, items: Slice[], totalLabel: string) {
  const limited = topTen(items)
  if (kind === 'donut') return <DonutChart slices={limited} totalLabel={totalLabel} compact={limited.length > 3} />
  if (kind === 'column') return <ColumnChart items={limited} />
  if (kind === 'treemap') return <Treemap items={limited} />
  return <BarChart items={limited} />
}
function DonutChart({
  slices,
  totalLabel,
  compact = false
}: {
  slices: Slice[]
  totalLabel: string
  compact?: boolean
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  let offset = 0
  const gradient = slices
    .map((slice) => {
      const start = total ? (offset / total) * 100 : 0
      offset += slice.value
      const end = total ? (offset / total) * 100 : 0
      return `${slice.color} ${start}% ${end}%`
    })
    .join(', ')
  return (
    <div className={`donut-chart ${compact ? 'is-compact' : ''}`}>
      <div className="donut-ring" style={{ background: total ? `conic-gradient(${gradient})` : '#e2e8f0' }}>
        <div>
          <b>{total}</b>
          <span>{totalLabel}</span>
        </div>
      </div>
      <div className="donut-legend">
        {slices.map((slice) => (
          <div key={slice.label}>
            <i style={{ background: slice.color }} />
            <span title={slice.label}>{shortLabel(slice.label)}</span>
            <b>{slice.value}</b>
          </div>
        ))}
      </div>
    </div>
  )
}
function ColumnChart({ items }: { items: Slice[] }) {
  const max = Math.max(...items.map((item) => item.value), 1)
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1
  return (
    <div className="column-chart-wrap">
      <div className="column-axis" aria-hidden="true">
        <span>100%</span>
        <span>75%</span>
        <span>50%</span>
        <span>25%</span>
        <span>0%</span>
      </div>
      <div
        className="column-chart"
        style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
      >
        <div className="column-grid" aria-hidden="true" />
        {items.map((item) => (
          <div className="column-item" key={item.label} title={item.label}>
            <div className="column-track">
              <i style={{ height: `${(item.value / max) * 100}%`, background: item.color }} />
            </div>
            <div className="column-value">
              <b>{item.value}</b>
              <small>{Math.round((item.value / total) * 100)}%</small>
            </div>
            <span>{shortLabel(item.label)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
function BarChart({ items }: { items: Slice[] }) {
  const max = Math.max(...items.map((item) => item.value), 1)
  return (
    <div className="bar-chart">
      {items.map((item) => (
        <div className="bar-row" key={item.label}>
          <span title={item.label}>{shortLabel(item.label)}</span>
          <div>
            <i style={{ width: `${(item.value / max) * 100}%`, background: item.color }} />
          </div>
          <b>{item.value}</b>
        </div>
      ))}
    </div>
  )
}
function Treemap({ items }: { items: Slice[] }) {
  return (
    <div className="treemap">
      {items.length ? (
        items.map((item) => (
          <div
            key={item.label}
            style={{ flexGrow: item.value, background: item.color }}
            title={`${item.label}: ${item.value}`}
          >
            <b>{shortLabel(item.label)}</b>
            <span>{item.value} cases</span>
          </div>
        ))
      ) : (
        <p>No folders found.</p>
      )}
    </div>
  )
}
function LineChart({ points }: { points: number[] }) {
  const max = Math.max(...points, 1)
  const denominator = Math.max(points.length - 1, 1)
  const pointsValue = points
    .map((point, index) => `${(index / denominator) * 100},${100 - (point / max) * 82 - 9}`)
    .join(' ')
  return (
    <div className="line-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Cumulative Scout discovery trend">
        <line x1="0" y1="91" x2="100" y2="91" />
        <polyline points={pointsValue} />
      </svg>
      <div className="line-chart-meta">
        <span>Start</span>
        <b>{points[points.length - 1] ?? 0} discoveries</b>
        <span>Complete</span>
      </div>
    </div>
  )
}
function makeDiscoveryTrend(result: AnalyzeResponse) {
  let count = 0
  const values = [0]
  for (const event of result.runEvents)
    if (
      event.eventType === 'page-discovered' ||
      event.eventType === 'state-discovered' ||
      event.eventType === 'action-discovered'
    ) {
      count++
      values.push(count)
    }
  return values.length > 1 ? values : [0, result.pages.length]
}
const TREEMAP_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706', '#db2777', '#475569']
const CHART_OPTIONS: Record<Panel, ChartKind[]> = {
  status: ['donut', 'bar', 'column'],
  priority: ['column', 'bar', 'donut'],
  type: ['bar', 'column', 'donut'],
  automation: ['donut', 'bar', 'column'],
  modules: ['treemap', 'bar', 'column', 'donut'],
  trend: ['line', 'column']
}
const MAX_GRAPH_ITEMS = 10
function topTen(items: Slice[]) {
  return [...items].sort((a, b) => b.value - a.value).slice(0, MAX_GRAPH_ITEMS)
}
function shortLabel(label: string) {
  return label.length > 10 ? `${label.slice(0, 10)}...` : label
}
