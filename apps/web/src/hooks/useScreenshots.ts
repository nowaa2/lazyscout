import { useEffect, useState } from 'react'

export type StoredScreenshot = {
  name: string
  dataUrl: string
  capturedAt: string
  testCaseId: string
  status: 'passed' | 'failed'
}
const keyFor = (projectId?: string) => `lazyscout.screenshots.${projectId ?? 'temporary'}`
export function useScreenshots(projectId?: string) {
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(keyFor(projectId)) ?? '[]') as StoredScreenshot[]
    } catch {
      return []
    }
  }
  const [screenshots, setScreenshots] = useState<StoredScreenshot[]>(read)
  useEffect(() => {
    setScreenshots(read())
  }, [projectId])
  useEffect(() => {
    localStorage.setItem(keyFor(projectId), JSON.stringify(screenshots.slice(0, 50)))
  }, [projectId, screenshots])
  function add(screenshot: StoredScreenshot) {
    setScreenshots((current) => [screenshot, ...current.filter((item) => item.name !== screenshot.name)].slice(0, 50))
  }
  function remove(name: string) {
    setScreenshots((current) => current.filter((item) => item.name !== name))
  }
  return { screenshots, add, remove }
}
