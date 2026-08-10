import { useState } from 'react'
import type { AnalyzeResponse } from '../types'

type Props = { result: AnalyzeResponse; activeUrl?: string; onSelect: (url: string) => void }

export function ExplorerTree({ result, activeUrl, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const grouped = result.pages.reduce<Record<string, typeof result.pages>>((all, page) => {
    const key = new URL(page.finalUrl).pathname || '/'
    ;(all[key] ??= []).push(page)
    return all
  }, {})
  return (
    <aside className={`workspace-panel workspace-tree ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="workspace-panel-head">
        <button
          type="button"
          className="tree-panel-toggle"
          onClick={() => setCollapsed((current) => !current)}
          aria-label={collapsed ? 'ขยาย Explorer' : 'พับ Explorer'}
          title={collapsed ? 'ขยาย Explorer' : 'พับ Explorer'}
        >
          {collapsed ? '›' : '‹'}
        </button>
        <div className="tree-panel-heading">
          <p className="eyebrow">Explorer</p>
          <h2>State Tree</h2>
        </div>
        <span className="status-dot status-pass" title="scan complete" />
      </div>
      {!collapsed && (
        <div className="tree-meta">
          <span>{result.pages.length} pages</span>
          <span>{result.actionGraph.states.length} states</span>
        </div>
      )}
      {!collapsed && (
        <div className="tree-list">
          {Object.entries(grouped).map(([path, pages]) => (
            <div key={path} className="tree-branch">
              <div className="tree-path">
                <span className="tree-chevron">⌄</span>
                <span className="tree-folder">●</span>
                {path}
              </div>
              {pages.map((page) => (
                <button
                  key={page.state?.id ?? page.finalUrl}
                  type="button"
                  onClick={() => onSelect(page.finalUrl)}
                  className={`tree-node ${activeUrl === page.finalUrl ? 'is-active' : ''}`}
                >
                  <span className="tree-node-icon">{page.state?.visibleDialogs.length ? '◈' : '◇'}</span>
                  <span className="truncate">{page.state?.visibleDialogs[0] ?? (page.title || 'Untitled page')}</span>
                  <span className="tree-node-count">{page.buttons.length}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {!collapsed && (
        <div className="tree-footer">
          <span className="status-dot status-pass" /> Safe exploration only
          <br />
          <span className="status-dot status-warn" /> Destructive actions blocked
        </div>
      )}
    </aside>
  )
}
