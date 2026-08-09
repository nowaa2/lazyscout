import { useState } from 'react'
import type { AnalyzeResponse } from '../types'
import type { SavedProject } from '../hooks/useProjects'
import { useLanguage } from '../i18n'

type Props = {
  projects: SavedProject[]
  activeProjectId?: string
  result?: AnalyzeResponse | null
  collapsed: boolean
  onToggleCollapsed: () => void
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onSettings: () => void
  workspaceRoot: string
  onOpenWorkspace: () => void
}

export function WorkspaceSidebar({
  projects,
  activeProjectId,
  result,
  collapsed,
  onToggleCollapsed,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onSettings,
  workspaceRoot,
  onOpenWorkspace
}: Props) {
  const { language, toggleLanguage, t } = useLanguage()
  const [menuProjectId, setMenuProjectId] = useState<string>()
  const [renamingId, setRenamingId] = useState<string>()
  const [nameDraft, setNameDraft] = useState('')
  return (
    <aside className={`workspace-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="sidebar-brand">
        <span className="brand-mark">LS</span>
        <b>LazyScout</b>
        <button
          type="button"
          className="sidebar-collapse"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>
      <button type="button" className="new-project-btn" onClick={onNew} title={t('newProject')}>
        <span>＋</span>
        <em>{t('newProject')}</em>
      </button>
      <div className="sidebar-label">
        <span>{t('projects')}</span>
        <b>{projects.length}</b>
      </div>
      <div className="project-list">
        {projects.map((project) => (
          <div key={project.id} className={`project-item ${project.id === activeProjectId ? 'active' : ''}`}>
            {renamingId === project.id ? (
              <form
                className="project-rename"
                onSubmit={(event) => {
                  event.preventDefault()
                  onRename(project.id, nameDraft)
                  setRenamingId(undefined)
                }}
              >
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setRenamingId(undefined)
                  }}
                />
                <button type="submit">Save</button>
                <button type="button" onClick={() => setRenamingId(undefined)}>
                  ×
                </button>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSelect(project.id)}
                  title={project.targetUrl ? `${project.name}\n${project.targetUrl}` : project.name}
                >
                  <span className="project-icon">◈</span>
                  <span className="project-copy">
                    <b>{project.name}</b>
                    <small>{project.targetUrl || 'Manual suite'}</small>
                  </span>
                </button>
                <div className="project-actions">
                  <button
                    type="button"
                    className="project-more"
                    title="Project actions"
                    onClick={() => setMenuProjectId((current) => (current === project.id ? undefined : project.id))}
                  >
                    ⋯
                  </button>
                  {menuProjectId === project.id && (
                    <div className="project-action-menu">
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(project.id)
                          setNameDraft(project.name)
                          setMenuProjectId(undefined)
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          onDelete(project.id)
                          setMenuProjectId(undefined)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {result && (
        <>
          <div className="sidebar-label">
            <span>{t('files')}</span>
            <b>{result.pages.length}</b>
          </div>
          <div className="file-list">
            {result.pages.map((page) => (
              <div key={page.finalUrl} className="file-item" title={page.finalUrl}>
                <span>◫</span>
                <span className="file-name">
                  {new URL(page.finalUrl).pathname === '/' ? 'index' : new URL(page.finalUrl).pathname.slice(1)}
                </span>
                <small>{page.state?.fingerprint.slice(-4)}</small>
              </div>
            ))}
          </div>
        </>
      )}
      {activeProjectId && (
        <button type="button" className="sidebar-settings" onClick={onSettings} title={t('settings')}>
          <span>⚙</span>
          <em>{t('settings')}</em>
        </button>
      )}
      <div className="sidebar-bottom">
        <div className="workspace-language-row">
          <button type="button" className="workspace-copy" onClick={onOpenWorkspace} title={workspaceRoot}>
            <span className="status-dot status-pass" /> <b>{t('localWorkspace')}</b>
            <small>{workspaceRoot || t('storedHere')}</small>
          </button>
          <button
            type="button"
            className="language-circle"
            onClick={toggleLanguage}
            title={language === 'en' ? 'Switch to Thai' : 'Switch to English (US)'}
            aria-label="Switch language"
          >
            {language === 'en' ? 'EN' : 'TH'}
          </button>
        </div>
      </div>
    </aside>
  )
}
