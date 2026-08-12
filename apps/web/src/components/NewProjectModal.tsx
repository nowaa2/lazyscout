import { useState } from 'react'
import type { SavedProject } from '../hooks/useProjects'
import { VersionCenter } from './VersionCenter'
import { useLanguage } from '../i18n'

type Props = {
  projects: SavedProject[]
  onScout: (name: string) => void
  onEmpty: (name: string) => void
  onSample: () => void
  onOpenProject: (id: string) => void
  onClose: () => void
}

export function NewProjectModal({ projects, onScout, onEmpty, onSample, onOpenProject, onClose }: Props) {
  const { language } = useLanguage()
  const th = language === 'th'
  const [name, setName] = useState('')
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const projectName = name.trim() || 'Untitled Test Suite'
  return (
    <div className="modern-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modern-modal new-project-modal" role="dialog" aria-modal="true">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{th ? 'โปรเจกต์ใหม่' : 'New Project'}</p>
            <h2>{th ? 'เริ่ม QA workspace' : 'Start a QA workspace'}</h2>
            <p>
              {th
                ? 'เลือก Scout เว็บไซต์ สร้างโปรเจกต์ตัวอย่าง หรือนำเข้า Test Case เดิม'
                : 'Choose whether to scout a website now or import an existing Test Case suite.'}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="new-project-modal-body">
          <VersionCenter compact />
          <label>
            <span>{th ? 'ชื่อโปรเจกต์' : 'Project name'}</span>
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
                <b>{th ? 'Scout เว็บไซต์' : 'Scout a website'}</b>
                <small>
                  {th
                    ? 'ใส่ URL แล้วให้ Playwright ค้นหาหน้าและสร้าง Test Case ชุดแรก'
                    : 'Enter a URL, then let Playwright discover pages and create a first Test Case suite.'}
                </small>
              </span>
              <em>→</em>
            </button>
            <button type="button" onClick={onSample}>
              <span className="new-project-choice-icon sample">✦</span>
              <span>
                <b>{th ? 'ลองโปรเจกต์ตัวอย่าง' : 'Try a sample project'}</b>
                <small>
                  {th
                    ? 'ทดลอง Login จริงบน Practice Test Automation พร้อม Test Case ที่รันได้ทันที'
                    : 'Run a ready-made login suite against Practice Test Automation immediately.'}
                </small>
              </span>
              <em>→</em>
            </button>
            {projects.length ? (
              <div className="existing-project-choice">
                <span className="new-project-choice-icon empty">↗</span>
                <div>
                  <b>{th ? 'เปิดโปรเจกต์เดิม' : 'Open existing project'}</b>
                  <small>{th ? 'ทำงานต่อจาก Local workspace' : 'Continue a local workspace.'}</small>
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
                  <b>{th ? 'โปรเจกต์เปล่า' : 'Empty project'}</b>
                  <small>
                    {th
                      ? 'สร้างชุดเปล่าสำหรับนำเข้า CSV, XLSX หรือ JSON และเพิ่ม Test Case เองได้'
                      : 'Create a blank suite for CSV, XLSX, or JSON import. You can add Test Cases manually too.'}
                  </small>
                </span>
                <em>→</em>
              </button>
            )}
          </div>
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {th ? 'ยกเลิก' : 'Cancel'}
          </button>
          {projects.length > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!projectId}
              onClick={() => projectId && onOpenProject(projectId)}
            >
              {th ? 'เปิดโปรเจกต์' : 'Open project'}
            </button>
          )}
        </footer>
      </section>
    </div>
  )
}
