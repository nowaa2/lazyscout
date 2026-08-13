export { generateTestCases, localizeThai, DEFAULT_GENERATE_OPTIONS } from './testcases/generateTestCases.js'
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

export { generatePlaywrightTest, plainUrl } from './playwright/generatePlaywrightTest.js'
export { buildLocatorCandidates, describeTarget } from './locators/candidates.js'
export type { LocatorCandidate } from './locators/candidates.js'
export { generateCypressTest } from './cypress/generateCypressTest.js'
export { flowToTestCase, flowStepToTestStep } from './guidedflow/flowToTestCase.js'
export { generatePlaywrightFromFlow } from './guidedflow/generatePlaywrightFromFlow.js'
export { generateCypressFromFlow } from './guidedflow/generateCypressFromFlow.js'
