import { useEffect, useState } from 'react'
import type { ProjectSecrets } from '../types'

const STORAGE_KEY = 'lazyscout.project-secrets.v1'
type SecretStore = Record<string, ProjectSecrets>

function readStore(): SecretStore {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as SecretStore } catch { return {} }
}

export function useProjectSecrets(projectId?: string) {
  const [store, setStore] = useState<SecretStore>(() => typeof window === 'undefined' ? {} : readStore())
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)) }, [store])
  const secrets = projectId ? store[projectId] ?? {} : {}
  function saveSecrets(next: ProjectSecrets) { if (projectId) setStore((current) => ({ ...current, [projectId]: next })) }
  function clearSecrets() { if (projectId) setStore((current) => { const next = { ...current }; delete next[projectId]; return next }) }
  return { secrets, saveSecrets, clearSecrets, hasSecrets: Object.values(secrets).some(Boolean) }
}
