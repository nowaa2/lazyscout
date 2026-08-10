import { useEffect, useRef, useState } from 'react'
import type { AnalyzeResponse, TestCaseLanguage } from '../types'
import {
  deleteWorkspaceProject,
  getWorkspace,
  openWorkspaceFolder,
  saveWorkspaceProject,
  type WorkspaceProject
} from '../api/client'

export type SavedProject = WorkspaceProject
const LEGACY_STORAGE_KEY = 'lazyscout.projects.v1'

function emptyResult(): AnalyzeResponse {
  return {
    startUrl: '',
    origin: 'Manual test suite',
    pages: [],
    testCases: [],
    testData: [],
    issues: [],
    stats: { pagesVisited: 0, urlsSkipped: 0, durationMs: 0, limitReached: 'none' },
    actionGraph: {
      states: [],
      edges: [],
      visitedStateIds: [],
      visitedActionKeys: [],
      failedActionKeys: [],
      blockedActionKeys: []
    },
    runEvents: [],
    apiChecks: []
  }
}

function legacyProjects(): SavedProject[] {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) ?? '[]') as SavedProject[]
  } catch {
    return []
  }
}

function removeLegacyProject(projectId: string): void {
  const remaining = legacyProjects().filter((project) => project.id !== projectId)
  if (remaining.length) localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(remaining))
  else localStorage.removeItem(LEGACY_STORAGE_KEY)
}

export function useProjects() {
  const [projects, setProjects] = useState<SavedProject[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string>()
  const [workspaceRoot, setWorkspaceRoot] = useState('~/LazyScout')
  const [workspaceError, setWorkspaceError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const deletingProjectIds = useRef(new Set<string>())
  const pendingWrites = useRef(new Map<string, Promise<void>>())

  useEffect(() => {
    void (async () => {
      try {
        const workspace = await getWorkspace()
        setWorkspaceRoot(workspace.root)
        const legacy = legacyProjects()
        const missing = legacy.filter((project) => !workspace.projects.some((stored) => stored.id === project.id))
        for (const project of missing) await saveWorkspaceProject(project)
        if (legacy.length) localStorage.removeItem(LEGACY_STORAGE_KEY)
        setProjects([...missing, ...workspace.projects])
      } catch (error) {
        setProjects(legacyProjects())
        setWorkspaceError(error instanceof Error ? error.message : String(error))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function persist(project: SavedProject): Promise<void> {
    if (deletingProjectIds.current.has(project.id)) return Promise.resolve()

    const previous = pendingWrites.current.get(project.id) ?? Promise.resolve()
    const next = previous
      .catch(() => undefined)
      .then(() => saveWorkspaceProject(project))
      .catch((error) => {
        setWorkspaceError(error instanceof Error ? error.message : String(error))
      })

    pendingWrites.current.set(project.id, next)
    void next.finally(() => {
      if (pendingWrites.current.get(project.id) === next) pendingWrites.current.delete(project.id)
    })
    return next
  }

  function saveProject(
    targetUrl: string,
    result: AnalyzeResponse,
    name?: string,
    existingId?: string,
    testCaseLanguage?: TestCaseLanguage
  ) {
    const now = new Date().toISOString()
    const derivedId = `project-${encodeProjectId(targetUrl)}`
    const id = existingId ?? derivedId
    const existing = projects.find((project) => project.id === id)
    const project: SavedProject = {
      id,
      name: name ?? existing?.name ?? new URL(targetUrl).hostname,
      targetUrl,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      mode: existing?.mode,
      testCaseLanguage: testCaseLanguage ?? existing?.testCaseLanguage ?? 'en',
      result
    }
    deletingProjectIds.current.delete(id)
    setProjects((current) =>
      existing ? current.map((item) => (item.id === id ? project : item)) : [project, ...current]
    )
    persist(project)
    setActiveProjectId(id)
    return id
  }

  function createEmptyProject(name = 'Untitled Test Suite', mode: SavedProject['mode'] = 'empty') {
    const now = new Date().toISOString()
    const id = `project-${crypto.randomUUID()}`
    const project: SavedProject = {
      id,
      name: name.trim() || 'Untitled Test Suite',
      targetUrl: '',
      createdAt: now,
      updatedAt: now,
      mode,
      result: emptyResult()
    }
    deletingProjectIds.current.delete(id)
    setProjects((current) => [project, ...current])
    persist(project)
    setActiveProjectId(id)
    return id
  }

  async function deleteProject(id: string) {
    const removedIndex = projects.findIndex((project) => project.id === id)
    const removedProject = projects[removedIndex]
    if (!removedProject) return

    const remainingProjects = projects.filter((project) => project.id !== id)
    deletingProjectIds.current.add(id)
    setProjects(remainingProjects)
    if (activeProjectId === id) setActiveProjectId(remainingProjects[0]?.id)

    try {
      await (pendingWrites.current.get(id) ?? Promise.resolve())
      await deleteWorkspaceProject(id)
      removeLegacyProject(id)
    } catch (error) {
      deletingProjectIds.current.delete(id)
      setProjects((current) => {
        if (current.some((project) => project.id === id)) return current
        const insertAt = Math.min(removedIndex, current.length)
        return [...current.slice(0, insertAt), removedProject, ...current.slice(insertAt)]
      })
      if (activeProjectId === id) setActiveProjectId(id)
      setWorkspaceError(error instanceof Error ? error.message : String(error))
    }
  }

  function renameProject(id: string, name: string) {
    const nextName = name.trim()
    const existing = projects.find((project) => project.id === id)
    if (!nextName || !existing) return
    const project = { ...existing, name: nextName, updatedAt: new Date().toISOString() }
    setProjects((current) => current.map((item) => (item.id === id ? project : item)))
    persist(project)
  }

  function updateProjectResult(id: string, result: AnalyzeResponse) {
    const existing = projects.find((project) => project.id === id)
    if (!existing) return
    const project = { ...existing, result, updatedAt: new Date().toISOString() }
    setProjects((current) => current.map((item) => (item.id === id ? project : item)))
    persist(project)
  }

  function updateProjectTestCaseLanguage(id: string, testCaseLanguage: TestCaseLanguage) {
    const existing = projects.find((project) => project.id === id)
    if (!existing) return
    const project = { ...existing, testCaseLanguage, updatedAt: new Date().toISOString() }
    setProjects((current) => current.map((item) => (item.id === id ? project : item)))
    persist(project)
  }

  function openWorkspace() {
    void openWorkspaceFolder().catch((error) =>
      setWorkspaceError(error instanceof Error ? error.message : String(error))
    )
  }

  return {
    projects,
    activeProjectId,
    setActiveProjectId,
    saveProject,
    createEmptyProject,
    deleteProject,
    renameProject,
    updateProjectResult,
    updateProjectTestCaseLanguage,
    workspaceRoot,
    workspaceError,
    loading,
    openWorkspace
  }
}

function encodeProjectId(targetUrl: string): string {
  const bytes = new TextEncoder().encode(targetUrl)
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary)
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 32)
    .toLowerCase()
}
