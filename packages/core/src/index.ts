// Types (type-only — ไม่มีโค้ดรันไทม์)
export type * from './types/page.js'
export type * from './types/testcase.js'
export type * from './types/testdata.js'
export type * from './types/api.js'
export type * from './types/url.js'

// URL validation & normalization
export { LOCAL_QA_POLICY, PUBLIC_SAAS_POLICY } from './url/policy.js'
export {
  checkTargetUrl,
  isPrivateHostname,
  isLoopbackHostname,
  isCloudMetadataHostname
} from './url/checkTargetUrl.js'
export { normalizeUrl, isSameOrigin, isCrawlableUrl, moduleNameFromUrl } from './url/normalizeUrl.js'

// Test case helpers
export { describeStep, describeSteps, describeTarget } from './testcase/describeStep.js'
export {
  makeTestCaseId,
  createEmptyTestCase,
  makeTestDataId,
  createEmptyTestDataRow
} from './testcase/createTestCase.js'
