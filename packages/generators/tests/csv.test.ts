import { describe, expect, it } from 'vitest'
import type { TestCase, TestDataRow } from '@lazyscout/core'
import { UTF8_BOM, exportTestCasesToCsv } from '@lazyscout/generators'

const sample: TestCase = {
  id: 'TC-LOGIN-001',
  module: 'LOGIN',
  title: 'ตรวจสอบหน้า Login, ปุ่ม และ "ลิงก์"',
  preconditions: ['เปิดระบบที่ http://localhost:5173', 'มีบัญชีทดสอบ'],
  steps: [
    { type: 'navigate', url: 'http://localhost:5173/login' },
    { type: 'click', target: { role: 'button', name: 'Login' } }
  ],
  expectedResult: 'ระบบแสดงหน้า Dashboard, พร้อมชื่อผู้ใช้',
  type: 'positive',
  priority: 'high',
  automationStatus: 'ready',
  sourceUrl: 'http://localhost:5173/login'
}

describe('exportTestCasesToCsv', () => {
  const csv = exportTestCasesToCsv([sample])

  it('ขึ้นต้นด้วย UTF-8 BOM เพื่อให้ Excel อ่านภาษาไทยได้', () => {
    expect(csv.startsWith(UTF8_BOM)).toBe(true)
  })

  it('เรียง header ให้ตรงกับคอลัมน์ที่แสดงบนหน้า Test Case', () => {
    const header = csv.slice(UTF8_BOM.length).split('\r\n')[0]
    expect(header).toBe(
      '"TC_ID","Folder","Title","Type","Priority","Test_Steps","Expected_Result","Automation_Status","Preconditions","Notes","Tags","Module","Requirements","Source_URL"'
    )
  })

  it('ใช้ Module เป็น Folder เมื่อ Test Case ไม่มี Folder กำหนดไว้ และเก็บ canonical fields สำหรับ import กลับ', () => {
    const row = csv.slice(UTF8_BOM.length).split('\r\n')[1]
    expect(row).toContain('"LOGIN"')
    expect(row).toContain('"http://localhost:5173/login"')
  })

  it('escape double quote และเก็บ comma / newline ไว้ในเซลล์เดียว', () => {
    expect(csv).toContain('"ตรวจสอบหน้า Login, ปุ่ม และ ""ลิงก์"""')

    expect(csv).toContain('"1. Navigate to http://localhost:5173/login\n2. Click button ""Login"""')
  })

  it('ไม่ต่อท้ายส่วน test data ถ้าไม่ได้ส่งมา', () => {
    expect(csv).not.toContain('TEST DATA')
  })
})

describe('exportTestCasesToCsv + test data', () => {
  const dataRow: TestDataRow = {
    id: 'TD-LOGIN-001',
    module: 'LOGIN',
    sourceUrl: 'http://localhost:5173/login',
    field: 'อีเมล',
    inputType: 'email',
    required: true,
    validValue: 'qa.tester@example.com',
    invalidValue: 'invalid-email',
    note: 'ทดสอบรูปแบบอีเมล'
  }
  const csv = exportTestCasesToCsv([sample], [dataRow])

  it('ต่อท้าย test data ไว้ในไฟล์เดียวกัน โดยคั่นด้วยบรรทัดว่างและหัวข้อ', () => {
    const lines = csv.slice(UTF8_BOM.length).split('\r\n')
    const markerIndex = lines.indexOf('"TEST DATA"')

    expect(markerIndex).toBeGreaterThan(0)
    expect(lines[markerIndex - 1]).toBe('')
    expect(lines[markerIndex + 1]).toBe(
      '"TD_ID","Module","Field","Input_Type","Required","Valid_Value","Invalid_Value","Note","Source_URL"'
    )
    expect(lines[markerIndex + 2]).toBe(
      '"TD-LOGIN-001","LOGIN","อีเมล","email","yes","qa.tester@example.com","invalid-email","ทดสอบรูปแบบอีเมล","http://localhost:5173/login"'
    )
  })
})
