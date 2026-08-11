import { useMemo, useState } from 'react'
import type { AnalyzeResponse, FlowStep, GuidedFlow, PageState, ProjectSecrets, StateEdge, TestCase } from '../types'
import { GuidedFlowBuilder } from './GuidedFlowBuilder'

type View = 'site-map' | 'state-flow'

export function ExplorerModal({
  result,
  testCaseCount,
  flows,
  baseUrl,
  projectId,
  secrets,
  onSaveFlows,
  onGenerateTestCase,
  onAddToFlow,
  onClose,
  onOpenCases
}: {
  result: AnalyzeResponse
  testCaseCount: number
  flows: GuidedFlow[]
  baseUrl: string
  projectId?: string
  secrets?: ProjectSecrets
  onSaveFlows: (flows: GuidedFlow[]) => Promise<void>
  onGenerateTestCase: (testCase: TestCase) => void
  onAddToFlow: (step: FlowStep) => void
  onClose: () => void
  onOpenCases: () => void
}) {
  const [view, setView] = useState<View>('state-flow')
  const [explorerTab, setExplorerTab] = useState<'auto-scout' | 'guided-flow'>('auto-scout')
  const [selectedStateId, setSelectedStateId] = useState<string>()
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>()
  const [zoom, setZoom] = useState(1)
  const selectedState = result.actionGraph.states.find((state) => state.id === selectedStateId)
  const selectedEdge = result.actionGraph.edges.find((edge) => edge.id === selectedEdgeId)

  return (
    <div className="modern-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        className="modern-modal explorer-flow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="flow-title"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">Website explorer</span>
            <h2 id="flow-title">UI State Explorer</h2>
            <p>{result.origin}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close explorer">
            ×
          </button>
        </header>
        <div className="explorer-main-tabs" role="tablist" aria-label="Explorer mode">
          <button
            type="button"
            className={explorerTab === 'auto-scout' ? 'active' : ''}
            onClick={() => setExplorerTab('auto-scout')}
          >
            Auto Scout
          </button>
          <button
            type="button"
            className={explorerTab === 'guided-flow' ? 'active' : ''}
            onClick={() => setExplorerTab('guided-flow')}
          >
            Guided Flow
          </button>
        </div>
        {explorerTab === 'guided-flow' ? (
          <GuidedFlowBuilder
            flows={flows}
            baseUrl={baseUrl}
            projectId={projectId}
            secrets={secrets}
            onSave={onSaveFlows}
            onGenerateTestCase={onGenerateTestCase}
          />
        ) : (
          <>
            <div className="explorer-hero">
              <div className="explorer-number">
                <strong>{testCaseCount}</strong>
                <span>draft test cases</span>
              </div>
              <div className="explorer-number">
                <strong>{result.stats.pagesVisited}</strong>
                <span>pages discovered</span>
              </div>
              <div className="explorer-number">
                <strong>{result.actionGraph.states.length}</strong>
                <span>UI states observed</span>
              </div>
            </div>
            <div className="explorer-view-tabs" role="tablist" aria-label="Explorer view">
              <button type="button" className={view === 'site-map' ? 'active' : ''} onClick={() => setView('site-map')}>
                Site Map
              </button>
              <button
                type="button"
                className={view === 'state-flow' ? 'active' : ''}
                onClick={() => setView('state-flow')}
              >
                State Flow <span>{result.actionGraph.edges.length}</span>
              </button>
            </div>
            {view === 'site-map' ? (
              <SiteMap
                result={result}
                onSelect={(state) => {
                  setSelectedStateId(state.id)
                  setView('state-flow')
                }}
              />
            ) : (
              <div className="state-flow-layout">
                <FlowGraph
                  states={result.actionGraph.states}
                  edges={result.actionGraph.edges}
                  selectedStateId={selectedStateId}
                  selectedEdgeId={selectedEdgeId}
                  zoom={zoom}
                  onZoom={setZoom}
                  onState={(id) => {
                    setSelectedStateId(id)
                    setSelectedEdgeId(undefined)
                  }}
                  onEdge={(id) => {
                    setSelectedEdgeId(id)
                    setSelectedStateId(undefined)
                  }}
                />
                <FlowInspector
                  state={selectedState}
                  edge={selectedEdge}
                  states={result.actionGraph.states}
                  onAddToFlow={onAddToFlow}
                />
              </div>
            )}
          </>
        )}
        <footer className="modal-footer">
          <span className="flow-safety">{result.actionGraph.blockedActionKeys.length} unsafe actions blocked</span>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary" onClick={onOpenCases}>
            Review Test Cases
          </button>
        </footer>
      </section>
    </div>
  )
}

function SiteMap({ result, onSelect }: { result: AnalyzeResponse; onSelect: (state: PageState) => void }) {
  const groups = useMemo(() => {
    const byUrl = new Map<string, PageState[]>()
    for (const state of result.actionGraph.states) {
      const states = byUrl.get(state.url) ?? []
      states.push(state)
      byUrl.set(state.url, states)
    }
    return [...byUrl.entries()]
  }, [result.actionGraph.states])
  return (
    <div className="site-map-list">
      {groups.map(([url, states]) => (
        <section key={url}>
          <h3>{new URL(url).pathname || '/'}</h3>
          <small>{url}</small>
          {states.map((state) => (
            <button type="button" key={state.id} onClick={() => onSelect(state)}>
              <i className={`state-type-${state.type}`} /> <span>{state.name || state.title || 'Observed state'}</span>
              <em>{state.type}</em>
            </button>
          ))}
        </section>
      ))}
    </div>
  )
}

function FlowGraph({
  states,
  edges,
  selectedStateId,
  selectedEdgeId,
  zoom,
  onZoom,
  onState,
  onEdge
}: {
  states: PageState[]
  edges: StateEdge[]
  selectedStateId?: string
  selectedEdgeId?: string
  zoom: number
  onZoom: (value: number) => void
  onState: (id: string) => void
  onEdge: (id: string) => void
}) {
  const groups = [
    ...new Map(states.map((state) => [state.url, states.filter((item) => item.url === state.url)])).values()
  ]
  const pageColumns = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(groups.length))))
  const groupRows = Math.ceil(groups.length / pageColumns)
  const maxStatesPerGroup = Math.max(1, ...groups.map((group) => group.length))
  const groupHeight = maxStatesPerGroup * 130 + 90
  const positions = new Map<string, { x: number; y: number }>()
  groups.forEach((group, groupIndex) => {
    const groupColumn = groupIndex % pageColumns
    const groupRow = Math.floor(groupIndex / pageColumns)
    group.forEach((state, stateIndex) => {
      positions.set(state.id, {
        x: 150 + groupColumn * 300,
        y: 115 + groupRow * groupHeight + stateIndex * 130
      })
    })
  })
  const width = pageColumns * 300 + 80
  const height = Math.max(320, groupRows * groupHeight + 40)
  return (
    <div className="state-flow-canvas">
      <div className="flow-toolbar">
        <span>
          {states.length} states · {edges.length} transitions
        </span>
        <div>
          <button type="button" onClick={() => onZoom(Math.max(0.6, zoom - 0.15))}>
            −
          </button>
          <button type="button" onClick={() => onZoom(Math.min(1.4, zoom + 0.15))}>
            +
          </button>
          <button type="button" onClick={() => onZoom(1)}>
            Fit
          </button>
        </div>
      </div>
      <div className="flow-viewport">
        <svg
          width={width * zoom}
          height={height * zoom}
          viewBox={`0 0 ${width} ${height}`}
          aria-label="UI state flow graph"
        >
          <defs>
            <marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#94a3b8" />
            </marker>
          </defs>
          {groups.map((group, groupIndex) => {
            const groupColumn = groupIndex % pageColumns
            const groupRow = Math.floor(groupIndex / pageColumns)
            const x = 20 + groupColumn * 300
            const y = 35 + groupRow * groupHeight
            return (
              <g key={group[0].url} className="flow-page-group">
                <rect x={x} y={y} width="260" height={groupHeight - 20} rx="14" />
                <text x={x + 14} y={y + 22} className="flow-page-label">
                  {truncate(new URL(group[0].url).pathname || '/', 30)}
                </text>
              </g>
            )
          })}
          {edges.map((edge) => {
            const from = positions.get(edge.fromStateId)
            const to = edge.toStateId ? positions.get(edge.toStateId) : undefined
            if (!from || !to) return null
            const active = edge.id === selectedEdgeId
            return (
              <g key={edge.id} onClick={() => onEdge(edge.id)} className="flow-edge">
                <path
                  className={active ? 'selected' : ''}
                  d={`M ${from.x} ${from.y + 38} C ${from.x} ${from.y + 95}, ${to.x} ${to.y - 95}, ${to.x} ${to.y - 38}`}
                  markerEnd="url(#flow-arrow)"
                />
                <title>{edge.action.description}</title>
              </g>
            )
          })}
          {states.map((state) => {
            const point = positions.get(state.id)!
            const active = state.id === selectedStateId
            return (
              <g key={state.id} onClick={() => onState(state.id)} className="flow-node">
                <rect
                  className={active ? 'selected' : ''}
                  x={point.x - 112}
                  y={point.y - 38}
                  width="224"
                  height="76"
                  rx="12"
                />
                <text x={point.x - 94} y={point.y - 11} className="flow-node-type">
                  {state.type.toUpperCase()}
                </text>
                <text x={point.x - 94} y={point.y + 12} className="flow-node-name">
                  {truncate(state.name || state.title || state.url, 27)}
                </text>
                <text x={point.x - 94} y={point.y + 28} className="flow-node-url">
                  {truncate(new URL(state.url).pathname || '/', 31)}
                </text>
                <title>{state.name || state.title || state.url}</title>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function FlowInspector({
  state,
  edge,
  states,
  onAddToFlow
}: {
  state?: PageState
  edge?: StateEdge
  states: PageState[]
  onAddToFlow: (step: FlowStep) => void
}) {
  if (!state && !edge)
    return (
      <aside className="flow-inspector empty">
        <b>Select a state or transition</b>
        <span>Click a node to view observed UI. Click a line to inspect the action that created it.</span>
      </aside>
    )
  if (edge) {
    const from = states.find((item) => item.id === edge.fromStateId)
    const to = states.find((item) => item.id === edge.toStateId)
    return (
      <aside className="flow-inspector">
        <p className="eyebrow">Transition detail</p>
        <h3>{edge.action.description}</h3>
        <dl>
          <dt>Action type</dt>
          <dd>{edge.action.type}</dd>
          <dt>Status</dt>
          <dd>{edge.status}</dd>
          <dt>Safety</dt>
          <dd>{edge.action.safe ? 'Safe action' : edge.action.reason || 'Blocked'}</dd>
          <dt>From</dt>
          <dd>{from?.name || from?.url}</dd>
          <dt>To</dt>
          <dd>{to?.name || 'Not observed'}</dd>
          {edge.action.locator && (
            <>
              <dt>Locator</dt>
              <dd>
                {edge.action.locator.role}: {edge.action.locator.name}
              </dd>
            </>
          )}
          {edge.action.locator && (
            <button
              type="button"
              className="btn btn-secondary mt-3"
              onClick={() =>
                onAddToFlow({ id: crypto.randomUUID(), type: 'click', target: toFlowTarget(edge.action.locator!) })
              }
            >
              Add to Guided Flow
            </button>
          )}
        </dl>
      </aside>
    )
  }
  return (
    <aside className="flow-inspector">
      <p className="eyebrow">State detail</p>
      <h3>{state!.name || state!.title || 'Observed state'}</h3>
      <dl>
        <dt>Type</dt>
        <dd>{state!.type}</dd>
        <dt>URL</dt>
        <dd className="break-all">{state!.url}</dd>
        <dt>Fingerprint</dt>
        <dd className="font-mono">{state!.fingerprint.slice(0, 18)}…</dd>
        <dt>Discovered</dt>
        <dd>{state!.discoveredAt ? new Date(state!.discoveredAt).toLocaleString() : 'Previous scan'}</dd>
      </dl>
      <section>
        <b>Observed UI</b>
        <p>{state!.headings.slice(0, 3).join(' · ') || 'No headings recorded'}</p>
        <p>
          {state!.visibleDialogs.length
            ? `Dialog: ${state!.visibleDialogs.join(', ')}`
            : `${state!.controls.length} controls observed`}
        </p>
        {state!.validationMessages?.length ? <p>Validation: {state!.validationMessages.join(' · ')}</p> : null}
      </section>
    </aside>
  )
}

function toFlowTarget(locator: NonNullable<StateEdge['action']['locator']>) {
  if (locator.role) return { strategy: 'role' as const, role: locator.role, name: locator.name ?? '' }
  if (locator.label) return { strategy: 'label' as const, label: locator.label }
  if (locator.placeholder) return { strategy: 'placeholder' as const, placeholder: locator.placeholder }
  if (locator.testId) return { strategy: 'testid' as const, testId: locator.testId }
  return { strategy: 'text' as const, text: locator.name ?? '' }
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value
}
