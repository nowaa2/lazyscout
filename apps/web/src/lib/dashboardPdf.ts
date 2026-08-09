export type PdfSlice = { label: string; value: number; color: string }
export type DashboardPdfData = {
  origin: string
  generatedAt: string
  pages: number
  testCases: number
  passed: number
  failed: number
  pending: number
  needsReview: number
  linkedCases: number
  requirementCount: number
  status: PdfSlice[]
  priority: PdfSlice[]
  testType: PdfSlice[]
  readiness: PdfSlice[]
  modules: PdfSlice[]
  failedCases: Array<{ id: string; title: string; folder: string; logs: string[] }>
}

export function exportDashboardPdf(data: DashboardPdfData) {
  return openReport(data, true)
}
export function exportDashboardHtml(data: DashboardPdfData) {
  return openReport(data, false)
}

function openReport(data: DashboardPdfData, print: boolean) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>LazyScout Quality Report</title><style>${reportStyles}</style></head><body>${reportHtml(data)}</body></html>`
  const popup = window.open('', '_blank', 'width=1100,height=820')
  if (!popup) return html
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
  if (print)
    window.setTimeout(() => {
      popup.focus()
      popup.print()
    }, 350)
  return html
}

function reportHtml(data: DashboardPdfData) {
  const metrics = [
    ['Test Cases', data.testCases, `${data.pages} pages explored`],
    ['Pass', data.passed, 'Execution result'],
    ['Failed', data.failed, 'Execution result'],
    ['Requirements', data.requirementCount, `${data.linkedCases}/${data.testCases} cases linked`]
  ]
  const failures = data.failedCases.length
    ? `<section class="failures"><div class="head"><div><p>FOLLOW-UP</p><h2>Failed Test Cases & logs</h2></div><em>${data.failedCases.length} failed</em></div>${data.failedCases.map((item) => `<article><div><b>${escapeHtml(item.id)} · ${escapeHtml(item.title)}</b><small>${escapeHtml(item.folder || 'UNASSIGNED')}</small></div><pre>${item.logs.length ? escapeHtml(item.logs.join('\n')) : 'No run log was captured for this case.'}</pre></article>`).join('')}</section>`
    : ''
  return `<main><header><div><div class="brand">LS <span>LazyScout</span></div><p>QUALITY REPORT</p><h1>Quality overview</h1><small>${escapeHtml(data.origin)} · Generated ${escapeHtml(data.generatedAt)}</small></div><div class="report-state">${data.pending} pending execution</div></header><section class="metrics">${metrics.map(([label, value, hint]) => `<article><span>${label}</span><b>${value}</b><small>${hint}</small></article>`).join('')}</section><section class="grid"><article class="card"><div class="head"><div><p>COMPOSITION</p><h2>Execution status</h2></div><em>Donut chart</em></div>${donut(data.status, 'Test Cases')}</article><article class="card"><div class="head"><div><p>COMPARISON</p><h2>Priority</h2></div><em>Column chart</em></div>${columns(data.priority)}</article><article class="card"><div class="head"><div><p>COMPARISON</p><h2>Test type</h2></div><em>Bar chart</em></div>${bars(data.testType)}</article><article class="card"><div class="head"><div><p>COMPOSITION</p><h2>Automation readiness</h2></div><em>Donut chart</em></div>${donut(data.readiness, 'Cases')}</article><article class="card wide"><div class="head"><div><p>HIERARCHY</p><h2>Folder coverage</h2></div><em>Top 10</em></div>${bars(data.modules)}</article></section>${failures}<footer>LazyScout · Local QA workspace</footer></main>`
}

function donut(items: PdfSlice[], totalLabel: string) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  let offset = 0
  const segments = items
    .map((item) => {
      const start = total ? (offset / total) * 100 : 0
      offset += item.value
      const end = total ? (offset / total) * 100 : 0
      return `${item.color} ${start}% ${end}%`
    })
    .join(', ')
  return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${segments || '#e2e8f0 0 100%'})"><div><b>${total}</b><span>${totalLabel}</span></div></div><div class="legend">${items.map((item) => `<div><i style="background:${item.color}"></i><span title="${escapeHtml(item.label)}">${escapeHtml(shortLabel(item.label))}</span><b>${item.value}</b></div>`).join('')}</div></div>`
}
function columns(items: PdfSlice[]) {
  const max = Math.max(...items.map((item) => item.value), 1)
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1
  return `<div class="columns"><div class="axis"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div class="column-area" style="grid-template-columns:repeat(${Math.max(items.length, 1)},minmax(0,1fr))">${items.map((item) => `<div class="column"><div class="column-track"><i style="height:${(item.value / max) * 100}%;background:${item.color}"></i></div><b>${item.value} <small>${Math.round((item.value / total) * 100)}%</small></b><span>${escapeHtml(shortLabel(item.label))}</span></div>`).join('')}</div></div>`
}
function bars(items: PdfSlice[]) {
  const max = Math.max(...items.map((item) => item.value), 1)
  return `<div class="bars">${items.map((item) => `<div><span title="${escapeHtml(item.label)}">${escapeHtml(shortLabel(item.label))}</span><section><i style="width:${(item.value / max) * 100}%;background:${item.color}"></i></section><b>${item.value}</b></div>`).join('')}</div>`
}
function shortLabel(value: string) {
  return value.length > 10 ? `${value.slice(0, 10)}...` : value
}
function escapeHtml(value: unknown) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character
  )
}

const reportStyles = `@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#182238;font:12px Inter,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}main{max-width:1120px;margin:auto}header{display:flex;justify-content:space-between;align-items:start;padding-bottom:18px;border-bottom:1px solid #e2e8f0}.brand{font-size:18px;font-weight:800;color:#fff;background:#2563eb;border-radius:7px;display:inline-flex;gap:9px;align-items:center;padding:6px 9px}.brand span{color:#182238}header p{margin:15px 0 3px;font-size:9px;letter-spacing:1.4px;color:#64748b;font-weight:700}h1{margin:0;font-size:26px}header small{display:block;margin-top:6px;color:#64748b}.report-state{border-radius:999px;padding:7px 10px;background:#fffbeb;color:#b45309;font-weight:700}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.metrics article,.card,.failures{border:1px solid #e2e8f0;border-radius:10px;background:#fff}.metrics article{padding:13px}.metrics span,.metrics small{display:block;color:#64748b}.metrics b{display:block;margin:8px 0 2px;font-size:27px}.metrics small{font-size:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{padding:15px;min-height:230px}.card.wide{grid-column:1/3;min-height:180px}.head{display:flex;justify-content:space-between;align-items:start;border-bottom:1px solid #f1f5f9;padding-bottom:10px}.head p{margin:0;color:#64748b;font-size:9px;font-weight:700;letter-spacing:1px}.head h2{margin:4px 0 0;font-size:14px}.head em{font-style:normal;background:#f1f5f9;border-radius:999px;padding:4px 7px;color:#64748b;font-size:9px}.donut-wrap{height:165px;display:flex;align-items:center;justify-content:center;gap:30px}.donut{width:124px;height:124px;border-radius:50%;display:flex;align-items:center;justify-content:center}.donut>div{width:68px;height:68px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}.donut b{font-size:21px}.donut span{font-size:9px;color:#64748b}.legend{min-width:140px}.legend div{display:grid;grid-template-columns:9px 1fr auto;gap:7px;align-items:center;margin:8px 0}.legend i{width:8px;height:8px;border-radius:50%}.legend span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#475569}.columns{display:grid;grid-template-columns:34px 1fr;gap:5px;height:165px;margin-top:10px}.axis{display:flex;flex-direction:column;justify-content:space-between;padding-bottom:25px;text-align:right;font-size:8px;color:#94a3b8}.column-area{display:grid;gap:6px;align-items:end;border-bottom:1px solid #cbd5e1;background:repeating-linear-gradient(to bottom,transparent 0 calc(25% - 1px),#e2e8f0 calc(25% - 1px) 25%)}.column{min-width:0;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:end;gap:3px}.column-track{height:112px;width:100%;max-width:34px;background:#f1f5f9;display:flex;align-items:end;border-radius:4px 4px 0 0}.column-track i{width:100%;display:block;border-radius:4px 4px 0 0}.column b{font-size:10px;white-space:nowrap}.column small{font-size:8px;color:#94a3b8}.column>span{width:100%;font-size:8px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center}.bars{margin-top:18px}.bars>div{display:grid;grid-template-columns:85px 1fr 28px;gap:9px;align-items:center;margin:9px 0}.bars span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#475569}.bars section{height:9px;border-radius:99px;background:#f1f5f9;overflow:hidden}.bars i{display:block;height:100%;border-radius:99px}.bars b{text-align:right}.failures{margin-top:12px;padding:15px}.failures article{padding:10px 0;border-bottom:1px solid #f1f5f9}.failures article:last-child{border:0}.failures b,.failures small{display:block}.failures small{margin-top:3px;color:#64748b;font-size:10px}.failures pre{margin:8px 0 0;max-height:110px;overflow:auto;white-space:pre-wrap;border-radius:6px;background:#0b1120;padding:9px;color:#dbeafe;font:9px ui-monospace,monospace}footer{margin-top:18px;border-top:1px solid #e2e8f0;padding-top:10px;color:#94a3b8;font-size:10px}`
