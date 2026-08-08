import type { TestCase } from '../types/testcase.js'
import type { TestDataRow } from '../types/testdata.js'

export function makeTestCaseId(module: string, sequence: number): string {
  return `TC-${module}-${String(sequence).padStart(3, '0')}`
}

export function makeTestDataId(module: string, sequence: number): string {
  return `TD-${module}-${String(sequence).padStart(3, '0')}`
}

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
