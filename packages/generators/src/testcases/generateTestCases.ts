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

function localizeThai(testCases: TestCase[]): TestCase[] {
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
    .replace(/^(.+) page displays required controls$/, '$1 แสดง controls ที่จำเป็น')
    .replace(/^(.+) is required$/, '$1 เป็นข้อมูลที่จำเป็น')
    .replace(/^Submit (.+) with valid data$/, 'ส่ง $1 ด้วยข้อมูลที่ถูกต้อง')
    .replace(/^Navigate to (.+)$/, 'ไปยัง $1')
    .replace(/^Verify "(.+)" action \(manual\)$/, 'ตรวจสอบ action "$1" ด้วยตนเอง')
    .replace(/^Open (.+)$/, 'เปิด $1')
    .replace(/^The page is reachable and rendered$/, 'หน้าเว็บสามารถเปิดและแสดงผลได้')
    .replace(
      /^Expected behavior is not known from static exploration; review manually\.$/,
      'ไม่ทราบ behavior จากการสำรวจแบบ static กรุณาตรวจสอบด้วยตนเอง'
    )
}

function safeNormalize(url: string): string {
  try {
    return normalizeUrl(url)
  } catch {
    return url
  }
}
