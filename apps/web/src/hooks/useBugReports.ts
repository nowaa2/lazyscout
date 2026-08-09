import { useEffect, useState } from 'react'

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

function storageKey(projectId?: string) {
  return `lazyscout.bug-reports.${projectId ?? 'temporary'}`
}
function readReports(projectId?: string): BugReport[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(projectId)) ?? '[]') as BugReport[]
  } catch {
    return []
  }
}

export function useBugReports(projectId?: string) {
  const [reports, setReports] = useState<BugReport[]>(() =>
    typeof window === 'undefined' ? [] : readReports(projectId)
  )
  useEffect(() => {
    setReports(readReports(projectId))
  }, [projectId])
  useEffect(() => {
    localStorage.setItem(storageKey(projectId), JSON.stringify(reports))
  }, [projectId, reports])
  function save(report: BugReport) {
    setReports((current) =>
      current.some((item) => item.id === report.id)
        ? current.map((item) => (item.id === report.id ? report : item))
        : [report, ...current]
    )
  }
  function remove(id: string) {
    setReports((current) => current.filter((item) => item.id !== id))
  }
  return { reports, save, remove }
}
