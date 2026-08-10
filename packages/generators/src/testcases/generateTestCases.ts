import type { PageInfo, TestCase, TestCaseLanguage } from '@lazyscout/core'
import { makeTestCaseId, normalizeUrl } from '@lazyscout/core'
import { assignModules } from '../moduleNames.js'
import {
  destructiveActionRule,
  formSubmitRule,
  navigationRule,
  pageStructureRule,
  requiredFieldRule,
  type RuleContext
} from './rules.js'

export type GenerateOptions = {
  maxTestCasesPerPage: number
  language: TestCaseLanguage
}

export const DEFAULT_GENERATE_OPTIONS: GenerateOptions = {
  maxTestCasesPerPage: 15,
  language: 'en'
}

export function generateTestCases(pages: PageInfo[], options: Partial<GenerateOptions> = {}): TestCase[] {
  const config = { ...DEFAULT_GENERATE_OPTIONS, ...options }

  const visitedTitles = new Map<string, string>()
  for (const page of pages) {
    visitedTitles.set(safeNormalize(page.finalUrl), page.title)
    visitedTitles.set(safeNormalize(page.url), page.title)
  }

  const moduleByUrl = assignModules(pages)
  const counters = new Map<string, number>()
  const testCases: TestCase[] = []

  for (const page of pages) {
    const module = moduleByUrl.get(page.url) ?? 'PAGE'
    const context: RuleContext = { page, module, visitedTitles }

    const fromPage = [
      ...pageStructureRule(context),
      ...page.forms.flatMap((form) => requiredFieldRule(context, form)),
      ...page.forms.flatMap((form) => formSubmitRule(context, form)),
      ...navigationRule(context),
      ...destructiveActionRule(context)
    ].slice(0, config.maxTestCasesPerPage)

    for (const generated of fromPage) {
      const sequence = (counters.get(module) ?? 0) + 1
      counters.set(module, sequence)
      testCases.push({ id: makeTestCaseId(module, sequence), ...generated })
    }
  }

  return config.language === 'en' ? testCases : localizeThai(testCases)
}

export function localizeThai(testCases: TestCase[]): TestCase[] {
  return testCases.map((testCase) => ({
    ...testCase,
    title: translate(testCase.title),
    preconditions: testCase.preconditions.map(translate),
    steps: testCase.steps.map((step) =>
      step.type === 'manual'
        ? { ...step, description: translate(step.description) }
        : { ...step, description: translateStep(step) }
    ),
    expectedResult: translate(testCase.expectedResult),
    notes: testCase.notes ? translate(testCase.notes) : undefined
  }))
}

function translateStep(step: TestCase['steps'][number]): string {
  switch (step.type) {
    case 'navigate':
      return `ไปยังหน้า ${step.url}`
    case 'click':
      return `กด ${step.target.name ?? step.target.label ?? step.target.text ?? 'element'}`
    case 'fill':
      return `กรอกข้อมูลใน ${step.target.name ?? step.target.label ?? step.target.placeholder ?? 'ช่องข้อมูล'}`
    case 'select':
      return `เลือก ${step.option} จาก ${step.target.name ?? step.target.label ?? 'รายการ'}`
    case 'assertVisible':
      return `ตรวจสอบว่า ${step.target.name ?? step.target.label ?? 'element'} แสดงอยู่`
    case 'assertText':
      return step.target
        ? `ตรวจสอบว่า ${step.target.name ?? step.target.label ?? 'element'} แสดงข้อความ "${step.text}"`
        : `ตรวจสอบว่าหน้าเว็บแสดงข้อความ "${step.text}"`
    case 'assertUrl':
      return `ตรวจสอบว่า URL มีคำว่า "${step.urlContains}"`
    case 'manual':
      return step.description
  }
}

function translate(value: string): string {
  return value
    .replace(/^(.+) page displays required controls$/, '$1 แสดงองค์ประกอบที่จำเป็น')
    .replace(
      /^All (\d+) controls detected on the page are visible\.$/,
      'พบองค์ประกอบบนหน้าเว็บทั้งหมด $1 รายการและแสดงผลอยู่'
    )
    .replace(/^(.+) is required$/, '$1 เป็นข้อมูลที่จำเป็น')
    .replace(/^Submit (.+) with valid data$/, 'ส่ง $1 ด้วยข้อมูลที่ถูกต้อง')
    .replace(/^Navigate to (.+)$/, 'ไปยัง $1')
    .replace(/^The application is available at (.+)$/, 'ระบบพร้อมใช้งานที่ $1')
    .replace(/^The application is available$/, 'ระบบพร้อมใช้งาน')
    .replace(/^Valid test data is prepared$/, 'เตรียมข้อมูลทดสอบที่ถูกต้องแล้ว')
    .replace(/^Disposable test data is prepared$/, 'เตรียมข้อมูลทดสอบที่สามารถลบได้แล้ว')
    .replace(/^Leave "(.+)" empty$/, 'เว้นช่อง "$1" ว่างไว้')
    .replace(/^Select "(.+)"$/, 'เลือก "$1"')
    .replace(
      /^Verify that a validation message is displayed for the empty required field, and the form is not submitted\.$/,
      'ตรวจสอบว่ามีข้อความแจ้งเตือนสำหรับช่องที่จำเป็นซึ่งเว้นว่าง และฟอร์มไม่ถูกส่ง'
    )
    .replace(
      /^The browser navigates to (.+) and the page "(.+)" is displayed\.$/,
      'เบราว์เซอร์ไปยัง $1 และแสดงหน้า "$2"'
    )
    .replace(/^The browser navigates to (.+)\.$/, 'เบราว์เซอร์ไปยัง $1')
    .replace(/^Dialog "(.+)" is visible\.$/, 'กล่องโต้ตอบ "$1" แสดงอยู่')
    .replace(/^Validation message "(.+)" is visible\.$/, 'ข้อความแจ้งเตือน "$1" แสดงอยู่')
    .replace(/^Heading "(.+)" is visible\.$/, 'หัวข้อ "$1" แสดงอยู่')
    .replace(
      /^Observed state requires tester review before automation\.$/,
      'สถานะที่พบต้องให้ผู้ทดสอบตรวจสอบก่อนทำ Automation'
    )
    .replace(/^Verify "(.+)" action \(manual\)$/, 'ตรวจสอบ action "$1" ด้วยตนเอง')
    .replace(/^Open (.+)$/, 'เปิด $1')
    .replace(/^The page is reachable and rendered$/, 'หน้าเว็บสามารถเปิดและแสดงผลได้')
    .replace(
      /^Expected behavior is not known from static exploration; review manually\.$/,
      'ไม่ทราบพฤติกรรมจากการสำรวจแบบ static กรุณาตรวจสอบด้วยตนเอง'
    )
    .replace(
      /^Verify that the result is displayed according to application requirements \(needs review by tester\)\.$/,
      'ตรวจสอบว่าผลลัพธ์แสดงตามข้อกำหนดของระบบ (ต้องให้ผู้ทดสอบตรวจสอบ)'
    )
    .replace(/^Generated from elements detected on the page\.$/, 'สร้างจากองค์ประกอบที่ตรวจพบบนหน้าเว็บ')
    .replace(
      /^Evidence: the field has the HTML "required" attribute\.$/,
      'หลักฐาน: ช่องข้อมูลมีแอตทริบิวต์ HTML "required"'
    )
    .replace(
      /^No "required" attribute found — confirm with the specification whether this field is mandatory\.$/,
      'ไม่พบแอตทริบิวต์ "required" — โปรดยืนยันกับข้อกำหนดว่าช่องข้อมูลนี้บังคับกรอกหรือไม่'
    )
    .replace(
      /^Sample values are placeholders — replace them with real test data before running\.$/,
      'ค่าตัวอย่างเป็นเพียงข้อมูลแทนที่ — เปลี่ยนเป็นข้อมูลทดสอบจริงก่อนเริ่มทดสอบ'
    )
    .replace(
      /^Explorer did not open this page — expected result needs review\.$/,
      'Explorer ไม่ได้เปิดหน้านี้ — ผลลัพธ์ที่คาดหวังต้องได้รับการตรวจสอบ'
    )
    .replace(
      /^Detected as a potentially destructive action — Explorer did not click it\.$/,
      'ตรวจพบว่าอาจเป็นการกระทำที่ทำลายข้อมูล — Explorer จึงไม่ได้คลิก'
    )
    .replace(
      /^Manually trigger (.+) "(.+)" in a safe test environment$/,
      'สั่งใช้งาน $1 "$2" ด้วยตนเองในสภาพแวดล้อมทดสอบที่ปลอดภัย'
    )
}

function safeNormalize(url: string): string {
  try {
    return normalizeUrl(url)
  } catch {
    return url
  }
}
