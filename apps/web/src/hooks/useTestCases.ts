import { useEffect, useState } from 'react'
import { createEmptyTestCase, makeTestCaseId } from '@lazyscout/core'
import type { TestCase } from '../types'

export function useTestCases(generated: TestCase[] | undefined) {
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    setTestCases(generated ?? [])
    setSelectedIds([])
  }, [generated])

  function updateTestCase(originalId: string, updated: TestCase) {
    setTestCases((current) => current.map((item) => (item.id === originalId ? updated : item)))
    setSelectedIds((current) => current.map((id) => (id === originalId ? updated.id : id)))
  }

  function deleteTestCase(id: string) {
    setTestCases((current) => current.filter((item) => item.id !== id))
    setSelectedIds((current) => current.filter((selected) => selected !== id))
  }

  function deleteSelected() {
    setTestCases((current) => current.filter((item) => !selectedIds.includes(item.id)))
    setSelectedIds([])
  }

  function reorderTestCases(draggedId: string, targetId: string) {
    if (draggedId === targetId) return
    setTestCases((current) => {
      const from = current.findIndex((item) => item.id === draggedId)
      const to = current.findIndex((item) => item.id === targetId)
      if (from < 0 || to < 0) return current
      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  function createTestCaseDraft(sourceUrl: string): TestCase {
    const used = new Set(testCases.map((item) => item.id))
    let sequence = testCases.filter((item) => item.module === 'MANUAL').length + 1
    while (used.has(makeTestCaseId('MANUAL', sequence))) sequence++

    return createEmptyTestCase('MANUAL', makeTestCaseId('MANUAL', sequence), sourceUrl)
  }

  function addTestCase(created: TestCase) {
    setTestCases((current) => [created, ...current])
    return created
  }

  function addImportedTestCases(imported: TestCase[]) {
    setTestCases((current) => [...imported, ...current])
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  function setSelection(ids: string[]) {
    setSelectedIds(ids)
  }

  return {
    testCases,
    selectedIds,
    updateTestCase,
    deleteTestCase,
    deleteSelected,
    reorderTestCases,
    createTestCaseDraft,
    addTestCase,
    addImportedTestCases,
    toggleSelected,
    setSelection
  }
}
