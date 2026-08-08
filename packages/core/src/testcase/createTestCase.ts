import type { TestCase } from '../types/testcase.js'
import type { TestDataRow } from '../types/testdata.js'

/** ตัวนับสำหรับสร้าง TC ID ที่ไม่ซ้ำภายใน module เดียวกัน เช่น TC-LOGIN-001 */
export function makeTestCaseId(module: string, sequence: number): string {
  return `TC-${module}-${String(sequence).padStart(3, '0')}`
}

/** ID ของ test data ใช้รูปแบบเดียวกับ test case แต่ขึ้นต้นด้วย TD */
export function makeTestDataId(module: string, sequence: number): string {
  return `TD-${module}-${String(sequence).padStart(3, '0')}`
}

/** แถวเปล่าสำหรับปุ่ม "Add Row" ในตาราง Test Data */
export function createEmptyTestDataRow(module = 'MANUAL', id = makeTestDataId('MANUAL', 1), sourceUrl = ''): TestDataRow {
  return {
    id,
    module,
    sourceUrl,
    field: '',
    inputType: 'text',
    required: false,
    validValue: '',
    invalidValue: ''
  }
}

/** โครงเปล่าสำหรับปุ่ม "Add Test Case" บน UI */
export function createEmptyTestCase(module = 'MANUAL', id = makeTestCaseId('MANUAL', 1), sourceUrl = ''): TestCase {
  return {
    id,
    module,
    title: 'New test case',
    preconditions: [],
    steps: [],
    expectedResult: '',
    type: 'positive',
    priority: 'medium',
    automationStatus: 'manual',
    sourceUrl
  }
}
