import { useCallback, useEffect, useState } from 'react'
import { normalizeBlockedKeywords, SUGGESTED_BLOCK_KEYWORDS } from '@lazyscout/core'

export type ClickFilter = { enabled: boolean; keywords: string[] }

/** New Projects start conservatively; teams can tailor this list in Project settings. */
const DEFAULT_FILTER: ClickFilter = { enabled: true, keywords: SUGGESTED_BLOCK_KEYWORDS }

const storageKey = (projectId: string) => `lazyscout-click-filter:${projectId}`

function read(projectId: string): ClickFilter {
  try {
    const stored = localStorage.getItem(storageKey(projectId))
    if (!stored) return DEFAULT_FILTER
    const parsed = JSON.parse(stored) as Partial<ClickFilter>
    return { enabled: parsed.enabled === true, keywords: normalizeBlockedKeywords(parsed.keywords) }
  } catch {
    return DEFAULT_FILTER
  }
}

export function useClickFilter(projectId?: string) {
  const [filter, setFilter] = useState<ClickFilter>(DEFAULT_FILTER)

  useEffect(() => {
    setFilter(projectId ? read(projectId) : DEFAULT_FILTER)
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
