/**
 * Type ที่ฝั่งเว็บใช้
 * - re-export type กลางจาก @lazyscout/core เพื่อให้ import จากที่เดียว
 * - บวก type ที่เป็นเรื่องของ UI ล้วน ๆ
 */
export type {
  AnalyzeRequest,
  AnalyzeResponse,
  ApiErrorResponse,
  AutomationStatus,
  ExploreIssue,
  ExploreStats,
  FormInfo,
  PageInfo,
  TargetRef,
  TestCase,
  TestCasePriority,
  TestCaseType,
  TestDataRow,
  TestStep,
  UIElement
} from '@lazyscout/core'

/** แท็บของตารางผลลัพธ์ */
export type ResultTab = 'testcases' | 'testdata'

/** เงื่อนไขการกรองตารางบนหน้าจอ */
export type TestCaseFilters = {
  search: string
  module: string
  type: string
  priority: string
}

export const EMPTY_FILTERS: TestCaseFilters = {
  search: '',
  module: 'all',
  type: 'all',
  priority: 'all'
}
