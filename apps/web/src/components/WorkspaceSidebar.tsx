import type { AnalyzeResponse } from '../types'
import type { SavedProject } from '../hooks/useProjects'
import { useLanguage } from '../i18n'

type Props = {
  projects: SavedProject[]; activeProjectId?: string; result?: AnalyzeResponse | null
  collapsed: boolean; onToggleCollapsed: () => void
  onSelect: (id: string) => void; onNew: () => void; onDelete: (id: string) => void; onSettings: () => void
}

export function WorkspaceSidebar({ projects, activeProjectId, result, collapsed, onToggleCollapsed, onSelect, onNew, onDelete, onSettings }: Props) {
  const { language, toggleLanguage, t } = useLanguage()
  return <aside className={`workspace-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
    <div className="sidebar-brand"><span className="brand-mark">LS</span><b>LazyScout</b><button type="button" className="sidebar-collapse" onClick={onToggleCollapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? '›' : '‹'}</button></div>
    <button type="button" className="new-project-btn" onClick={onNew} title={t('newProject')}><span>＋</span><em>{t('newProject')}</em></button>
    <div className="sidebar-label"><span>{t('projects')}</span><b>{projects.length}</b></div>
    <div className="project-list">{projects.map((project) => <div key={project.id} className={`project-item ${project.id === activeProjectId ? 'active' : ''}`}>
      <button type="button" onClick={() => onSelect(project.id)} title={project.name}><span className="project-icon">◈</span><span className="project-copy"><b>{project.name}</b><small>{project.targetUrl}</small></span></button>
      <button type="button" className="project-more" title="Delete project" onClick={() => onDelete(project.id)}>⋯</button>
    </div>)}</div>
    {result && <><div className="sidebar-label"><span>{t('files')}</span><b>{result.pages.length}</b></div><div className="file-list">{result.pages.map((page) => <div key={page.finalUrl} className="file-item" title={page.finalUrl}><span>◫</span><span className="file-name">{new URL(page.finalUrl).pathname === '/' ? 'index' : new URL(page.finalUrl).pathname.slice(1)}</span><small>{page.state?.fingerprint.slice(-4)}</small></div>)}</div></>}
    {activeProjectId && <button type="button" className="sidebar-settings" onClick={onSettings} title={t('settings')}><span>⚙</span><em>{t('settings')}</em></button>}
    <div className="sidebar-bottom"><div className="workspace-language-row"><div className="workspace-copy"><span className="status-dot status-pass" /> <b>{t('localWorkspace')}</b><small>{t('storedHere')}</small></div><button type="button" className="language-circle" onClick={toggleLanguage} title={language === 'en' ? 'Switch to Thai' : 'Switch to English (US)'} aria-label="Switch language">{language === 'en' ? 'EN' : 'TH'}</button></div></div>
  </aside>
}
