import { useEffect, useState } from 'react'
import type { AutomationScreenshot } from '../types'
import { deleteWorkspaceScreenshot, getWorkspaceScreenshots, saveWorkspaceScreenshot } from '../api/client'

export type StoredScreenshot = AutomationScreenshot

export function useScreenshots(projectId?: string) {
  const [screenshots, setScreenshots] = useState<StoredScreenshot[]>([])

  useEffect(() => {
    setScreenshots([])
    if (!projectId) return
    void (async () => {
      const stored = await getWorkspaceScreenshots(projectId)
      const legacyKey = `lazyscout.screenshots.${projectId}`
      let legacy: StoredScreenshot[] = []
      try {
        legacy = JSON.parse(localStorage.getItem(legacyKey) ?? '[]') as StoredScreenshot[]
      } catch {}
      const migrated: StoredScreenshot[] = []
      for (const screenshot of legacy)
        if (!stored.some((item) => item.name === screenshot.name))
          migrated.push(await saveWorkspaceScreenshot(projectId, screenshot))
      if (legacy.length) localStorage.removeItem(legacyKey)
      setScreenshots([...migrated, ...stored])
    })().catch(() => setScreenshots([]))
  }, [projectId])

  function add(screenshot: StoredScreenshot) {
    if (!projectId) return
    void saveWorkspaceScreenshot(projectId, screenshot).then((stored) =>
      setScreenshots((current) => [stored, ...current.filter((item) => item.name !== stored.name)].slice(0, 50))
    )
  }

  function remove(name: string) {
    setScreenshots((current) => current.filter((item) => item.name !== name))
    if (projectId) void deleteWorkspaceScreenshot(projectId, name)
  }

  return { screenshots, add, remove }
}
