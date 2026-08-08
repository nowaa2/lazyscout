export { generateTestCases, DEFAULT_GENERATE_OPTIONS } from './testcases/generateTestCases.js'
export type { GenerateOptions } from './testcases/generateTestCases.js'
export { UNKNOWN_BEHAVIOUR } from './testcases/rules.js'
export type { GeneratedTestCase, RuleContext } from './testcases/rules.js'
export { generateTestData } from './testdata/generateTestData.js'
export { assignModules } from './moduleNames.js'
export {
  exportTestCasesToCsv,
  escapeCsvValue,
  CSV_COLUMNS,
  TEST_DATA_CSV_COLUMNS,
  UTF8_BOM
} from './csv/exportTestCasesToCsv.js'

// จุดต่อขยายในอนาคต (ยังไม่ implement ใน V0.1):
// - ./playwright/  : TestCase[] -> .spec.ts
// - ./cypress/     : TestCase[] -> .cy.ts
