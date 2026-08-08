import { useEffect, useState } from 'react'
import { createEmptyTestCase, makeTestCaseId } from '@lazyscout/core'
import type { TestCase } from '../types'

/**
 * เก็บ test case ที่ผู้ใช้แก้ไขได้ (แหล่งความจริงของตาราง)
 * เมื่อ analyze ใหม่ รายการจะถูกแทนที่ด้วยผลลัพธ์ล่าสุด
 */
export function useTestCases(generated: TestCase[] | undefined) {
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    setTestCases(generated ?? [])
    setSelectedIds([])
  }, [generated])

  /** originalId แยกจาก updated.id เพราะผู้ใช้แก้ TC ID เองได้ */
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

  /** สร้าง test case เปล่าให้ Tester เขียนเอง โดยหา ID ที่ยังไม่ถูกใช้ */
  function addTestCase(sourceUrl: string): TestCase {
    const used = new Set(testCases.map((item) => item.id))
    let sequence = testCases.filter((item) => item.module === 'MANUAL').length + 1
    while (used.has(makeTestCaseId('MANUAL', sequence))) sequence++

    const created = createEmptyTestCase('MANUAL', makeTestCaseId('MANUAL', sequence), sourceUrl)
    setTestCases((current) => [created, ...current])
    return created
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )
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
    addTestCase,
    toggleSelected,
    setSelection
  }
}
