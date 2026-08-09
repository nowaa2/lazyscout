import { useEffect, useState } from 'react'
import type { AnalyzeResponse } from '../types'

export type SavedProject = {
  id: string
  name: string
  targetUrl: string
  createdAt: string
  updatedAt: string
  mode?: 'scout' | 'empty'
  result: AnalyzeResponse
}
const STORAGE_KEY = 'lazyscout.projects.v1'

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

function readProjects(): SavedProject[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as SavedProject[]
  } catch {
    return []
  }
}

export function useProjects() {
  const [projects, setProjects] = useState<SavedProject[]>(() => (typeof window === 'undefined' ? [] : readProjects()))
  const [activeProjectId, setActiveProjectId] = useState<string>()
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  }, [projects])
  function saveProject(targetUrl: string, result: AnalyzeResponse, name?: string, existingId?: string) {
    const now = new Date().toISOString()
    const derivedId = `project-${btoa(targetUrl)
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 18)
      .toLowerCase()}`
    const id = existingId ?? derivedId
    setProjects((current) => {
      const existing = current.find((project) => project.id === id)
      const project = {
        id,
        name: name ?? existing?.name ?? new URL(targetUrl).hostname,
        targetUrl,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        mode: existing?.mode,
        result
      }
      return existing ? current.map((item) => (item.id === id ? project : item)) : [project, ...current]
    })
    setActiveProjectId(id)
    return id
  }
  function createEmptyProject(name = 'Untitled Test Suite', mode: SavedProject['mode'] = 'empty') {
    const now = new Date().toISOString()
    const id = `project-${crypto.randomUUID()}`
    setProjects((current) => [
      {
        id,
        name: name.trim() || 'Untitled Test Suite',
        targetUrl: '',
        createdAt: now,
        updatedAt: now,
        mode,
        result: emptyResult()
      },
      ...current
    ])
    setActiveProjectId(id)
    return id
  }
  function deleteProject(id: string) {
    setProjects((current) => current.filter((project) => project.id !== id))
    if (activeProjectId === id) setActiveProjectId(undefined)
  }
  function renameProject(id: string, name: string) {
    const nextName = name.trim()
    if (!nextName) return
    setProjects((current) =>
      current.map((project) =>
        project.id === id ? { ...project, name: nextName, updatedAt: new Date().toISOString() } : project
      )
    )
  }
  function updateProjectResult(id: string, result: AnalyzeResponse) {
    setProjects((current) =>
      current.map((project) =>
        project.id === id ? { ...project, result, updatedAt: new Date().toISOString() } : project
      )
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
    updateProjectResult
  }
}
