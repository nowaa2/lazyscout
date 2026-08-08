import type { PageInfo, TestCase } from '@lazyscout/core'
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
  /** จำกัดจำนวน test case ต่อหนึ่งหน้า กัน draft ล้นจนรีวิวไม่ไหว */
  maxTestCasesPerPage: number
}

export const DEFAULT_GENERATE_OPTIONS: GenerateOptions = {
  maxTestCasesPerPage: 15
}

/**
 * Rule-Based Test Case Generator (ยังไม่ใช้ AI)
 * ผลลัพธ์คือ "Draft" ที่ Tester ต้องตรวจ — ไม่ได้การันตีว่าถูกต้อง 100%
 */
export function generateTestCases(
  pages: PageInfo[],
  options: Partial<GenerateOptions> = {}
): TestCase[] {
  const config = { ...DEFAULT_GENERATE_OPTIONS, ...options }

  // ใช้ตอนตัดสินว่า expected result ของลิงก์มีหลักฐานรองรับหรือไม่
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

    // ใส่ TC ID หลังตัดจำนวนแล้ว เพื่อให้เลขในแต่ละ module เรียงต่อเนื่องไม่ข้าม
    for (const generated of fromPage) {
      const sequence = (counters.get(module) ?? 0) + 1
      counters.set(module, sequence)
      testCases.push({ id: makeTestCaseId(module, sequence), ...generated })
    }
  }

  return testCases
}

function safeNormalize(url: string): string {
  try {
    return normalizeUrl(url)
  } catch {
    return url
  }
}
