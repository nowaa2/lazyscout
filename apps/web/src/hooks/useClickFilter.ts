import { useCallback, useEffect, useState } from 'react'
import { normalizeBlockedKeywords } from '@lazyscout/core'

export type ClickFilter = { enabled: boolean; keywords: string[] }

/** Off by default: the bot clicks whatever it finds until a Project says otherwise. */
const OFF: ClickFilter = { enabled: false, keywords: [] }

const storageKey = (projectId: string) => `lazyscout-click-filter:${projectId}`

function read(projectId: string): ClickFilter {
  try {
    const stored = localStorage.getItem(storageKey(projectId))
    if (!stored) return OFF
    const parsed = JSON.parse(stored) as Partial<ClickFilter>
    return { enabled: parsed.enabled === true, keywords: normalizeBlockedKeywords(parsed.keywords) }
  } catch {
    return OFF
  }
}

export function useClickFilter(projectId?: string) {
  const [filter, setFilter] = useState<ClickFilter>(OFF)

  useEffect(() => {
    setFilter(projectId ? read(projectId) : OFF)
  }, [projectId])

  const save = useCallback(
    (next: ClickFilter) => {
      const cleaned = { enabled: next.enabled, keywords: normalizeBlockedKeywords(next.keywords) }
      setFilter(cleaned)
      if (projectId) localStorage.setItem(storageKey(projectId), JSON.stringify(cleaned))
    },
    [projectId]
  )

  // What the explorer and the runner actually enforce: a disabled filter sends nothing.
  const blockedKeywords = filter.enabled ? filter.keywords : []

  return { filter, blockedKeywords, save }
}
