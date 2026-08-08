import { useEffect, useState } from 'react'
import { createEmptyTestDataRow, makeTestDataId } from '@lazyscout/core'
import type { TestDataRow } from '../types'

/** เก็บตาราง Test Data ที่ผู้ใช้แก้ไขได้ (คู่ขนานกับ useTestCases) */
export function useTestData(generated: TestDataRow[] | undefined) {
  const [testData, setTestData] = useState<TestDataRow[]>([])

  useEffect(() => {
    setTestData(generated ?? [])
  }, [generated])

  function updateRow(originalId: string, updated: TestDataRow) {
    setTestData((current) => current.map((row) => (row.id === originalId ? updated : row)))
  }

  function deleteRow(id: string) {
    setTestData((current) => current.filter((row) => row.id !== id))
  }

  function addRow(sourceUrl: string) {
    const used = new Set(testData.map((row) => row.id))
    let sequence = testData.filter((row) => row.module === 'MANUAL').length + 1
    while (used.has(makeTestDataId('MANUAL', sequence))) sequence++

    setTestData((current) => [createEmptyTestDataRow('MANUAL', makeTestDataId('MANUAL', sequence), sourceUrl), ...current])
  }

  return { testData, updateRow, deleteRow, addRow }
}
