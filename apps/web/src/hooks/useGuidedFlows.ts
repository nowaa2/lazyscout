import { useEffect, useState } from 'react'
import type { GuidedFlow } from '../types'
import { getGuidedFlows, saveGuidedFlows } from '../api/client'

export function useGuidedFlows(projectId?: string) {
  const [flows, setFlows] = useState<GuidedFlow[]>([])
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!projectId) {
      setFlows([])
      return
    }
    void getGuidedFlows(projectId)
      .then(setFlows)
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
  }, [projectId])

  async function update(next: GuidedFlow[]) {
    setFlows(next)
    try {
      await saveGuidedFlows(projectId!, next)
      setError(undefined)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  return { flows, update, error }
}
