import { useEffect, useState } from 'react'
import { deleteWorkspaceBug, getWorkspaceBugs, saveWorkspaceBug } from '../api/client'

export type BugAttachment = { name: string; type: string; dataUrl: string }
export type BugReport = {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in-progress' | 'resolved'
  testCaseId?: string
  actualResult: string
  expectedResult: string
  stepsToReproduce: string
  attachments: BugAttachment[]
  createdAt: string
}

export function useBugReports(projectId?: string) {
  const [reports, setReports] = useState<BugReport[]>([])

  useEffect(() => {
    setReports([])
    if (!projectId) return
    void (async () => {
      const stored = await getWorkspaceBugs<BugReport>(projectId)
      const legacyKey = `lazyscout.bug-reports.${projectId}`
      let legacy: BugReport[] = []
      try {
        legacy = JSON.parse(localStorage.getItem(legacyKey) ?? '[]') as BugReport[]
      } catch {}
      const missing = legacy.filter((report) => !stored.some((item) => item.id === report.id))
      for (const report of missing) await saveWorkspaceBug(projectId, report)
      if (legacy.length) localStorage.removeItem(legacyKey)
      setReports([...missing, ...stored])
    })().catch(() => setReports([]))
  }, [projectId])

  function save(report: BugReport) {
    setReports((current) =>
      current.some((item) => item.id === report.id)
        ? current.map((item) => (item.id === report.id ? report : item))
        : [report, ...current]
    )
    if (projectId) void saveWorkspaceBug(projectId, report)
  }

  function remove(id: string) {
    setReports((current) => current.filter((item) => item.id !== id))
    if (projectId) void deleteWorkspaceBug(projectId, id)
  }

  return { reports, save, remove }
}
