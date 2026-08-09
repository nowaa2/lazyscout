import { useState } from 'react'
import type { SavedProject } from '../hooks/useProjects'
import { VersionCenter } from './VersionCenter'

type Props = {
  projects: SavedProject[]
  onScout: (name: string) => void
  onEmpty: (name: string) => void
  onOpenProject: (id: string) => void
  onClose: () => void
}

export function NewProjectModal({ projects, onScout, onEmpty, onOpenProject, onClose }: Props) {
  const [name, setName] = useState('')
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const projectName = name.trim() || 'Untitled Test Suite'
  return (
    <div className="modern-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modern-modal new-project-modal" role="dialog" aria-modal="true">
        <header className="modal-header">
          <div>
            <p className="eyebrow">New Project</p>
            <h2>Start a QA workspace</h2>
            <p>Choose whether to scout a website now or import an existing Test Case suite.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="new-project-modal-body">
          <VersionCenter />
          <label>
            <span>Project name</span>
            <input
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Example: Storefront regression"
              autoFocus
            />
          </label>
          <div className="new-project-choices">
            <button type="button" onClick={() => onScout(projectName)}>
              <span className="new-project-choice-icon scout">◉</span>
              <span>
                <b>Scout a website</b>
                <small>Enter a URL, then let Playwright discover pages and create a first Test Case suite.</small>
              </span>
              <em>→</em>
            </button>
            {projects.length ? (
              <div className="existing-project-choice">
                <span className="new-project-choice-icon empty">↗</span>
                <div>
                  <b>Open existing project</b>
                  <small>Continue a local workspace.</small>
                  <select className="field" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => onEmpty(projectName)}>
                <span className="new-project-choice-icon empty">⇧</span>
                <span>
                  <b>Empty project</b>
                  <small>
                    Create a blank suite for CSV, XLSX, or JSON import. You can add Test Cases manually too.
                  </small>
                </span>
                <em>→</em>
              </button>
            )}
          </div>
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {projects.length > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!projectId}
              onClick={() => projectId && onOpenProject(projectId)}
            >
              Open project
            </button>
          )}
        </footer>
      </section>
    </div>
  )
}
