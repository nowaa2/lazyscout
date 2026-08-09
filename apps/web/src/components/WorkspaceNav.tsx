import { useLanguage } from '../i18n'

export type WorkspaceView = 'overview' | 'explorer' | 'testcases' | 'automation' | 'scoutlog' | 'loadtest'

export function WorkspaceNav({
  view,
  onChange,
  counts
}: {
  view: WorkspaceView
  onChange: (view: WorkspaceView) => void
  counts: { cases: number; states: number }
}) {
  const { t } = useLanguage()
  const items: Array<[WorkspaceView, string, string]> = [
    ['overview', t('overview'), '⌂'],
    ['testcases', `${t('testCases')} ${counts.cases}`, '✓'],
    ['automation', t('automation'), '↗'],
    ['scoutlog', t('scoutLog'), '◉'],
    ['explorer', t('explorer'), '⌘'],
    ['loadtest', 'Load Test', '⚡']
  ]
  return (
    <nav className="workspace-nav">
      {items.map(([key, label, icon]) => (
        <button key={key} type="button" className={view === key ? 'is-active' : ''} onClick={() => onChange(key)}>
          <span>{icon}</span>
          {label}
          {key === 'explorer' && <small>{counts.states}</small>}
        </button>
      ))}
    </nav>
  )
}
