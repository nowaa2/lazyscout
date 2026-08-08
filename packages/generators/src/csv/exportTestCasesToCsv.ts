import type { TestCase, TestDataRow } from '@lazyscout/core'
import { describeSteps } from '@lazyscout/core'

/** UTF-8 BOM — จำเป็นเพื่อให้ Excel บน Windows อ่านภาษาไทยไม่เพี้ยน */
export const UTF8_BOM = '﻿'

export const CSV_COLUMNS = [
  'TC_ID',
  'Module',
  'Title',
  'Preconditions',
  'Test_Steps',
  'Expected_Result',
  'Type',
  'Priority',
  'Automation_Status',
  'Source_URL'
] as const

export const TEST_DATA_CSV_COLUMNS = [
  'TD_ID',
  'Module',
  'Field',
  'Input_Type',
  'Required',
  'Valid_Value',
  'Invalid_Value',
  'Note',
  'Source_URL'
] as const

/**
 * ครอบค่าด้วย double quote เสมอ และ escape " เป็น ""
 * (RFC 4180) ทำให้ comma / newline / ภาษาไทย ปลอดภัยทั้งใน Excel และ Google Sheets
 */
export function escapeCsvValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function toRow(values: string[]): string {
  return values.map(escapeCsvValue).join(',')
}

function testCaseRow(testCase: TestCase): string {
  return toRow([
    testCase.id,
    testCase.module,
    testCase.title,
    testCase.preconditions.join('\n'),
    describeSteps(testCase.steps),
    testCase.expectedResult,
    testCase.type,
    testCase.priority,
    testCase.automationStatus,
    testCase.sourceUrl
  ])
}

function testDataRow(row: TestDataRow): string {
  return toRow([
    row.id,
    row.module,
    row.field,
    row.inputType,
    row.required ? 'yes' : 'no',
    row.validValue,
    row.invalidValue,
    row.note ?? '',
    row.sourceUrl
  ])
}

/**
 * แปลง TestCase[] (และ TestDataRow[] ถ้ามี) เป็นข้อความ CSV พร้อมใช้งาน
 *
 * Test Data ถูกต่อท้ายไว้ในไฟล์เดียวกัน โดยคั่นด้วยบรรทัดว่างและหัวข้อ "TEST DATA"
 * ใช้ CRLF ตามสเปก RFC 4180 เพื่อให้ newline ในเซลล์แสดงถูกต้องใน Excel
 */
export function exportTestCasesToCsv(testCases: TestCase[], testData: TestDataRow[] = []): string {
  const lines = [toRow([...CSV_COLUMNS]), ...testCases.map(testCaseRow)]

  if (testData.length > 0) {
    lines.push('', toRow(['TEST DATA']), toRow([...TEST_DATA_CSV_COLUMNS]), ...testData.map(testDataRow))
  }

  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}
