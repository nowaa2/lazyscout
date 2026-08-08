import { useEffect, useState } from 'react'
import type { AnalyzeResponse } from '../types'

export type SavedProject = { id: string; name: string; targetUrl: string; createdAt: string; updatedAt: string; result: AnalyzeResponse }
const STORAGE_KEY = 'lazyscout.projects.v1'

function readProjects(): SavedProject[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as SavedProject[] } catch { return [] } }

export function useProjects() {
  const [projects, setProjects] = useState<SavedProject[]>(() => typeof window === 'undefined' ? [] : readProjects())
  const [activeProjectId, setActiveProjectId] = useState<string>()
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)) }, [projects])
  function saveProject(targetUrl: string, result: AnalyzeResponse, name?: string) {
    const now = new Date().toISOString()
    const id = `project-${btoa(targetUrl).replace(/[^a-z0-9]/gi, '').slice(0, 18).toLowerCase()}`
    setProjects((current) => { const existing = current.find((project) => project.id === id); const project = { id, name: name ?? existing?.name ?? new URL(targetUrl).hostname, targetUrl, createdAt: existing?.createdAt ?? now, updatedAt: now, result }; return existing ? current.map((item) => item.id === id ? project : item) : [project, ...current] })
    setActiveProjectId(id)
    return id
  }
  function createEmptyProject() { setActiveProjectId(undefined) }
  function deleteProject(id: string) { setProjects((current) => current.filter((project) => project.id !== id)); if (activeProjectId === id) setActiveProjectId(undefined) }
  function updateProjectResult(id: string, result: AnalyzeResponse) { setProjects((current) => current.map((project) => project.id === id ? { ...project, result, updatedAt: new Date().toISOString() } : project)) }
  return { projects, activeProjectId, setActiveProjectId, saveProject, createEmptyProject, deleteProject, updateProjectResult }
}
