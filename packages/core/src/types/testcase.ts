/**
 * Core Test Case Model — Framework Independent
 * ห้าม import Playwright / Cypress / DOM ในไฟล์นี้
 * Generator ของแต่ละ framework จะอ่าน TestStep แล้วแปลงเป็นโค้ดของตัวเอง
 */

/**
 * วิธีอ้างถึง element หนึ่งชิ้นแบบไม่ผูก framework
 * ให้ความสำคัญกับ role + name (accessibility) ก่อน cssSelector เสมอ
 */
export type TargetRef = {
  role?: string
  name?: string
  text?: string
  placeholder?: string
  label?: string
  cssSelector?: string
}

export type NavigateStep = {
  type: 'navigate'
  url: string
  description?: string
}

export type ClickStep = {
  type: 'click'
  target: TargetRef
  description?: string
}

export type FillStep = {
  type: 'fill'
  target: TargetRef
  value: string
  description?: string
}

export type SelectStep = {
  type: 'select'
  target: TargetRef
  option: string
  description?: string
}

export type AssertVisibleStep = {
  type: 'assertVisible'
  target: TargetRef
  description?: string
}

export type AssertTextStep = {
  type: 'assertText'
  target?: TargetRef
  text: string
  description?: string
}

export type AssertUrlStep = {
  type: 'assertUrl'
  urlContains: string
  description?: string
}

/**
 * step ที่ยังไม่รู้ behavior จริงของระบบ
 * ใช้แทนการ "เดา" — generator ของ automation จะข้ามหรือใส่เป็น TODO
 */
export type ManualStep = {
  type: 'manual'
  description: string
}

export type TestStep =
  | NavigateStep
  | ClickStep
  | FillStep
  | SelectStep
  | AssertVisibleStep
  | AssertTextStep
  | AssertUrlStep
  | ManualStep

export type TestCaseType = 'positive' | 'negative' | 'validation'

export type TestCasePriority = 'low' | 'medium' | 'high'

/**
 * ready       = automate ได้ทันที
 * needs-data  = ต้องเตรียม test data ก่อน
 * needs-review= ระบบเดา behavior ไม่ได้ ต้องให้ Tester ตรวจก่อน
 * manual      = ไม่ควร automate (เช่น destructive action)
 */
export type AutomationStatus = 'ready' | 'needs-data' | 'needs-review' | 'manual'

export type TestCase = {
  id: string
  module: string
  title: string
  preconditions: string[]
  steps: TestStep[]
  expectedResult: string
  type: TestCaseType
  priority: TestCasePriority
  automationStatus: AutomationStatus
  /** หน้าเว็บที่ใช้เป็นหลักฐานในการสร้าง test case นี้ */
  sourceUrl: string
  /** หมายเหตุจาก generator ถึง Tester */
  notes?: string
}
