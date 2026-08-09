import { useState } from 'react'
import type { ProjectSecrets } from '../types'

type SecretStore = Record<string, ProjectSecrets>

export function useProjectSecrets(projectId?: string) {
  const [store, setStore] = useState<SecretStore>({})
  const secrets = projectId ? (store[projectId] ?? {}) : {}
  function saveSecrets(next: ProjectSecrets) {
    if (projectId) setStore((current) => ({ ...current, [projectId]: next }))
  }
  function clearSecrets() {
    if (projectId)
      setStore((current) => {
        const next = { ...current }
        delete next[projectId]
        return next
      })
  }
  return { secrets, saveSecrets, clearSecrets, hasSecrets: Object.values(secrets).some(Boolean) }
}
