import { describeSteps } from '@lazyscout/core'
import type { TestCase, TestCaseFilters, TestDataRow } from '../types'

export function filterTestCases(testCases: TestCase[], filters: TestCaseFilters): TestCase[] {
  const keyword = filters.search.trim().toLowerCase()

  return testCases.filter((testCase) => {
    if (filters.module !== 'all' && !testCase.module.toLowerCase().includes(filters.module.toLowerCase())) return false
    if (filters.type !== 'all' && testCase.type !== filters.type) return false
    if (filters.priority !== 'all' && testCase.priority !== filters.priority) return false
    if (!keyword) return true

    const haystack = [
      testCase.id,
      testCase.module,
      testCase.title,
      testCase.expectedResult,
      testCase.sourceUrl,
      describeSteps(testCase.steps)
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(keyword)
  })
}

export function uniqueModules(items: { module: string }[]): string[] {
  return [...new Set(items.map((item) => item.module))].sort()
}

export function filterTestData(rows: TestDataRow[], search: string, module: string): TestDataRow[] {
  const keyword = search.trim().toLowerCase()

  return rows.filter((row) => {
    if (module !== 'all' && row.module !== module) return false
    if (!keyword) return true

    return [row.id, row.module, row.field, row.inputType, row.validValue, row.invalidValue, row.note ?? '']
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
}
