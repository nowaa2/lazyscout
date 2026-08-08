/** สัญญาระหว่าง Frontend กับ Backend — ใช้ร่วมกันทั้งสองฝั่ง */
import type { ExploreIssue, ExploreStats, PageInfo } from './page.js'
import type { TestCase } from './testcase.js'
import type { TestDataRow } from './testdata.js'

export type AnalyzeRequest = {
  url: string
  maxPages?: number
  maxDepth?: number
}

export type AnalyzeResponse = {
  startUrl: string
  origin: string
  pages: PageInfo[]
  testCases: TestCase[]
  testData: TestDataRow[]
  issues: ExploreIssue[]
  stats: ExploreStats
}

export type ExportCsvRequest = {
  testCases: TestCase[]
  /** ต่อท้ายไว้ในไฟล์ CSV เดียวกัน */
  testData?: TestDataRow[]
}

/** error ที่ส่งให้ user อ่าน — ห้ามใส่ stack trace */
export type ApiErrorResponse = {
  error: {
    code: string
    message: string
    hint?: string
  }
}
