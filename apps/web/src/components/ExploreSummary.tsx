import { useState } from 'react'
import type { AnalyzeResponse, PageInfo, UIElement } from '../types'

function ElementList({ title, elements }: { title: string; elements: UIElement[] }) {
  if (elements.length === 0) return null

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">
        {title} ({elements.length})
      </p>
      <ul className="mt-1 space-y-0.5">
        {elements.slice(0, 12).map((element, index) => (
          <li key={`${element.cssSelector}-${index}`} className="text-sm text-slate-700">
            • {element.accessibleName || element.placeholder || element.cssSelector}
            {element.inputType && <span className="ml-1 text-xs text-slate-400">[{element.inputType}]</span>}
            {element.required && <span className="ml-1 text-xs text-rose-500">required</span>}
            {element.destructive && (
              <span className="ml-1 text-xs font-semibold text-orange-600">ไม่คลิก (destructive)</span>
            )}
          </li>
        ))}
        {elements.length > 12 && <li className="text-xs text-slate-400">… และอีก {elements.length - 12} รายการ</li>}
      </ul>
    </div>
  )
}

function PageCard({ page }: { page: PageInfo }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-800">{page.title || '(no title)'}</span>
          <span className="block truncate text-xs text-slate-500">{page.finalUrl}</span>
        </span>
        <span className="ml-3 shrink-0 text-xs text-slate-500">
          depth {page.depth} · {page.inputs.length + page.textareas.length + page.selects.length} inputs ·{' '}
          {page.buttons.length} buttons · {page.links.length} links {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="grid gap-4 bg-slate-50 px-4 py-3 md:grid-cols-2 lg:grid-cols-4">
          <ElementList title="Inputs" elements={[...page.inputs, ...page.textareas, ...page.selects]} />
          <ElementList title="Buttons" elements={page.buttons} />
          <ElementList title="Links" elements={page.links} />
          <div>
            <p className="text-xs font-semibold text-slate-500">Headings ({page.headings.length})</p>
            <ul className="mt-1 space-y-0.5">
              {page.headings.slice(0, 8).map((heading, index) => (
                <li key={index} className="text-sm text-slate-700">
                  • {heading}
                </li>
              ))}
            </ul>
            {page.forms.length > 0 && <p className="mt-2 text-xs text-slate-500">Forms: {page.forms.length}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export function ExploreSummary({ result }: { result: AnalyzeResponse }) {
  return (
    <div className="card">
      <div className="card-title flex items-center justify-between">
        <span>ผลการสำรวจเว็บไซต์</span>
        <span className="text-xs font-normal text-slate-500">
          {result.stats.pagesVisited} หน้า · {(result.stats.durationMs / 1000).toFixed(1)} วินาที
          {result.stats.limitReached !== 'none' && ` · หยุดเพราะ ${result.stats.limitReached}`}
        </span>
      </div>

      {result.issues.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2">
          <p className="text-xs font-semibold text-amber-800">หน้าที่เปิดไม่สำเร็จ ({result.issues.length})</p>
          <ul className="mt-1 space-y-0.5">
            {result.issues.slice(0, 5).map((issue, index) => (
              <li key={index} className="truncate text-xs text-amber-700">
                {issue.url} — {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="max-h-96 overflow-y-auto">
        {result.pages.map((page) => (
          <PageCard key={page.url} page={page} />
        ))}
      </div>
    </div>
  )
}
