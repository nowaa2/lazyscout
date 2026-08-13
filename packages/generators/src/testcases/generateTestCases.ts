import type { PageInfo, TestCase, TestCaseLanguage } from '@lazyscout/core'
import { makeTestCaseId, normalizeUrl } from '@lazyscout/core'
import { assignModules } from '../moduleNames.js'
import {
  destructiveActionRule,
  formSubmitRule,
  loginFailureRule,
  navigationRule,
  pageStructureRule,
  requiredFieldRule,
  validationMatrixRule,
  type GeneratedTestCase,
  type RuleContext
} from './rules.js'
import { elementPatternCases, interactionPatternCases } from './patternRules.js'

export type GenerateOptions = {
  maxTestCasesPerPage: number
  language: TestCaseLanguage
}

export const DEFAULT_GENERATE_OPTIONS: GenerateOptions = {
  maxTestCasesPerPage: 120,
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

    const fromPage = dedupe(
      [
        ...pageStructureRule(context),
        ...page.forms.flatMap((form) => requiredFieldRule(context, form)),
        ...page.forms.flatMap((form) => validationMatrixRule(context, form)),
        ...page.forms.flatMap((form) => loginFailureRule(context, form)),
        ...page.forms.flatMap((form) => formSubmitRule(context, form)),
        ...patternCases(context),
        ...navigationRule(context),
        ...destructiveActionRule(context)
      ],
      counters
    ).slice(0, config.maxTestCasesPerPage)

    for (const generated of fromPage) {
      const sequence = (counters.get(module) ?? 0) + 1
      counters.set(module, sequence)
      testCases.push({ id: makeTestCaseId(module, sequence), ...generated })
    }
  }

  return config.language === 'en' ? testCases : localizeThai(testCases)
}

/**
 * Pattern cases for every collected control, plus the state's interaction
 * hints. An interaction that points at a control already covered is dropped so
 * the same widget is not tested twice under two names.
 */
function patternCases(context: RuleContext): GeneratedTestCase[] {
  const ctx = { page: context.page, module: context.module }
  const controls = context.page.state?.controls ?? []
  const cases = controls.flatMap((control) => elementPatternCases(ctx, control))
  const covered = new Set(controls.map((control) => control.cssSelector))
  const fromInteractions = (context.page.state?.interactions ?? [])
    .filter((interaction) => !covered.has(interaction.cssSelector))
    .flatMap((interaction) => interactionPatternCases(ctx, interaction))
  return [...cases, ...fromInteractions]
}

/**
 * Drop cases that would test the same thing twice. Identity is the pattern plus
 * the normalized step sequence, so two rules reaching the same control through
 * different paths collapse into one case.
 */
function dedupe(cases: GeneratedTestCase[], counters: Map<string, number>): GeneratedTestCase[] {
  const seen = new Set<string>()
  const unique: GeneratedTestCase[] = []
  let dropped = 0
  for (const testCase of cases) {
    const key = `${testCase.pattern ?? testCase.type}|${testCase.title}|${JSON.stringify(testCase.steps)}`
    if (seen.has(key)) {
      dropped += 1
      continue
    }
    seen.add(key)
    unique.push(testCase)
  }
  counters.set('__deduplicated', (counters.get('__deduplicated') ?? 0) + dropped)
  return unique
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
    case 'check':
      return `${step.checked ? 'Check' : 'Uncheck'} ${step.target.name ?? step.target.label ?? 'element'}`
    case 'wait':
      return `รอ ${step.mode}: ${step.value}`
    case 'assertVisible':
      return `ตรวจสอบว่า ${step.target.name ?? step.target.label ?? 'element'} แสดงอยู่`
    case 'assertText':
      return step.target
        ? `ตรวจสอบว่า ${step.target.name ?? step.target.label ?? 'element'} แสดงข้อความ "${step.text}"`
        : `ตรวจสอบว่าหน้าเว็บแสดงข้อความ "${step.text}"`
    case 'assertUrl':
      return `ตรวจสอบว่า URL มีคำว่า "${step.urlContains}"`
    case 'assertInvalid':
      return `ตรวจสอบว่า ${step.target.name ?? step.target.label ?? 'ช่องข้อมูล'} ไม่ผ่าน validation และฟอร์มยังไม่ถูกส่ง`
    case 'assertValidation':
      return 'รอจนกว่าข้อความ validation หรือ error จะแสดงขึ้นมา'
    case 'manual':
      return step.description
  }
}

function translate(value: string): string {
  return value
    .replace(/^Login with valid credentials via (.+)$/, 'เข้าสู่ระบบด้วยข้อมูลที่ถูกต้องผ่าน $1')
    .replace(/^The form is submitted and the browser navigates to (.+?)[.]?$/, 'ฟอร์มถูกส่งและเบราว์เซอร์ไปยัง $1')
    .replace(/^(.+) interaction works$/, 'การทำงานของ $1 ทำงานได้ถูกต้อง')
    .replace(/^(.+) "(.+)" opens and is usable\.$/, '$1 "$2" เปิดและสามารถใช้งานได้')
    .replace(/^Generated from the observed (.+) interaction\.$/, 'สร้างจากการตรวจพบ interaction ประเภท $1')
    .replace(/^Login with valid credentials via (.+)$/, 'เข้าสู่ระบบด้วยข้อมูลที่ถูกต้องผ่าน $1')
    .replace(/^(.+) page displays required controls$/, '$1 แสดงองค์ประกอบที่จำเป็น')
    .replace(
      /^All (\d+) controls detected on the page are visible\.$/,
      'พบองค์ประกอบบนหน้าเว็บทั้งหมด $1 รายการและแสดงผลอยู่'
    )
    .replace(/^(.+) is required$/, '$1 เป็นข้อมูลที่จำเป็น')
    .replace(/^(.+) handles empty input$/, '$1 ตรวจสอบการเว้นว่าง')
    .replace(/^(.+) rejects an invalid email format$/, '$1 ไม่ยอมรับรูปแบบอีเมลที่ไม่ถูกต้อง')
    .replace(/^(.+) rejects an invalid URL format$/, '$1 ไม่ยอมรับรูปแบบ URL ที่ไม่ถูกต้อง')
    .replace(/^(.+) handles whitespace-only input$/, '$1 ตรวจสอบข้อมูลที่มีแต่ช่องว่าง')
    .replace(/^(.+) handles characters from another writing system$/, '$1 ตรวจสอบตัวอักษรจากภาษาอื่น')
    .replace(/^(.+) handles special characters$/, '$1 ตรวจสอบอักขระพิเศษ')
    .replace(/^(.+) rejects fewer than (\d+) characters$/, '$1 ไม่ยอมรับข้อมูลที่สั้นกว่า $2 ตัวอักษร')
    .replace(/^(.+) rejects a value outside the required pattern$/, '$1 ไม่ยอมรับข้อมูลที่ไม่ตรง Pattern')
    .replace(/^(.+) rejects a value below (.+)$/, '$1 ไม่ยอมรับค่าที่ต่ำกว่า $2')
    .replace(/^(.+) rejects a value above (.+)$/, '$1 ไม่ยอมรับค่าที่สูงกว่า $2')
    .replace(/^(.+) handles more than (\d+) characters$/, '$1 จัดการข้อมูลที่ยาวเกิน $2 ตัวอักษร')
    .replace(/^(.+) rejects a password without an uppercase letter$/, '$1 ไม่ยอมรับรหัสผ่านที่ไม่มีตัวพิมพ์ใหญ่')
    .replace(/^(.+) rejects a password without a lowercase letter$/, '$1 ไม่ยอมรับรหัสผ่านที่ไม่มีตัวพิมพ์เล็ก')
    .replace(/^(.+) rejects a password without a number$/, '$1 ไม่ยอมรับรหัสผ่านที่ไม่มีตัวเลข')
    .replace(/^(.+) rejects a password without a special character$/, '$1 ไม่ยอมรับรหัสผ่านที่ไม่มีอักขระพิเศษ')
    .replace(/^(.+) policy requires specification review$/, 'ตรวจสอบข้อกำหนดของ $1')
    .replace(/^Reject invalid username$/, 'ไม่ยอมรับ Username ที่ไม่ถูกต้อง')
    .replace(/^Reject invalid password$/, 'ไม่ยอมรับ Password ที่ไม่ถูกต้อง')
    .replace(/^Reject empty username$/, 'ไม่ยอมรับ Username ที่เว้นว่าง')
    .replace(/^Reject empty password$/, 'ไม่ยอมรับ Password ที่เว้นว่าง')
    .replace(/^Submit (.+) with valid data$/, 'ส่ง $1 ด้วยข้อมูลที่ถูกต้อง')
    .replace(/^Navigate to (.+)$/, 'ไปยัง $1')
    .replace(/^The application is available at (.+)$/, 'ระบบพร้อมใช้งานที่ $1')
    .replace(/^The application is available$/, 'ระบบพร้อมใช้งาน')
    .replace(/^Valid test data is prepared$/, 'เตรียมข้อมูลทดสอบที่ถูกต้องแล้ว')
    .replace(
      /^Use a test environment where failed logins cannot lock a real account$/,
      'ใช้ Test environment ที่การ Login ผิดจะไม่ล็อกบัญชีจริง'
    )
    .replace(/^Disposable test data is prepared$/, 'เตรียมข้อมูลทดสอบที่สามารถลบได้แล้ว')
    .replace(/^Leave "(.+)" empty$/, 'เว้นช่อง "$1" ว่างไว้')
    .replace(/^Select "(.+)"$/, 'เลือก "$1"')
    .replace(
      /^Verify whether "(.+)" may be empty according to the product requirement$/,
      'ตรวจสอบว่า "$1" สามารถเว้นว่างได้ตามข้อกำหนดของผลิตภัณฑ์หรือไม่'
    )
    .replace(
      /^Verify whether (.+) rejects whitespace-only input and shows the correct validation message$/,
      'ตรวจสอบว่า $1 ไม่ยอมรับข้อมูลที่มีแต่ช่องว่างและแสดงข้อความ Validation ที่ถูกต้อง'
    )
    .replace(
      /^Verify the username character policy and the validation message shown for (.+)$/,
      'ตรวจสอบนโยบายตัวอักษร Username และข้อความ Validation ที่แสดงสำหรับ $1'
    )
    .replace(
      /^Verify whether (.+) permits special characters and shows the correct validation message$/,
      'ตรวจสอบว่า $1 ยอมรับอักขระพิเศษหรือไม่และแสดงข้อความ Validation ที่ถูกต้อง'
    )
    .replace(
      /^Verify that a validation message is displayed for the empty required field, and the form is not submitted\.$/,
      'ตรวจสอบว่ามีข้อความแจ้งเตือนสำหรับช่องที่จำเป็นซึ่งเว้นว่าง และฟอร์มไม่ถูกส่ง'
    )
    .replace(
      /^A required-field validation is displayed and the form is not submitted\.$/,
      'ข้อความ validation ของช่องที่จำเป็นแสดงขึ้น และฟอร์มไม่ถูกส่ง'
    )
    .replace(
      /^(.+) accepts or rejects empty input according to the product requirement\.$/,
      '$1 ยอมรับหรือไม่ยอมรับการเว้นว่างตามข้อกำหนดของผลิตภัณฑ์'
    )
    .replace(/^(.+) is marked invalid and the form is not submitted\.$/, '$1 ถูกระบุว่าไม่ถูกต้อง และฟอร์มไม่ถูกส่ง')
    .replace(
      /^(.+) rejects whitespace-only input when meaningful text is required\.$/,
      '$1 ไม่ยอมรับข้อมูลที่มีแต่ช่องว่างเมื่อต้องใช้ข้อความที่มีความหมาย'
    )
    .replace(
      /^(.+) accepts or rejects characters from another writing system according to the username policy\.$/,
      '$1 ยอมรับหรือไม่ยอมรับตัวอักษรจากภาษาอื่นตามนโยบาย Username'
    )
    .replace(
      /^(.+) accepts or rejects special characters according to the username policy\.$/,
      '$1 ยอมรับหรือไม่ยอมรับอักขระพิเศษตามนโยบาย Username'
    )
    .replace(
      /^(.+) remains invalid below the minimum length of (\d+)\.$/,
      '$1 ยังไม่ถูกต้องเมื่อสั้นกว่าความยาวขั้นต่ำ $2'
    )
    .replace(/^(.+) remains invalid when its pattern is not satisfied\.$/, '$1 ยังไม่ถูกต้องเมื่อข้อมูลไม่ตรง Pattern')
    .replace(/^(.+) remains invalid below the minimum value (.+)\.$/, '$1 ยังไม่ถูกต้องเมื่อค่าต่ำกว่าค่าขั้นต่ำ $2')
    .replace(/^(.+) remains invalid above the maximum value (.+)\.$/, '$1 ยังไม่ถูกต้องเมื่อค่าสูงกว่าค่าสูงสุด $2')
    .replace(
      /^(.+) prevents or rejects input above (\d+) characters\.$/,
      '$1 ป้องกันหรือไม่ยอมรับข้อมูลที่ยาวเกิน $2 ตัวอักษร'
    )
    .replace(
      /^(.+) remains invalid until the password policy is satisfied\.$/,
      '$1 ยังไม่ถูกต้องจนกว่าจะผ่านนโยบายรหัสผ่าน'
    )
    .replace(
      /^The application keeps the user signed out and displays an authentication error\.$/,
      'ระบบยังไม่ให้ผู้ใช้เข้าสู่ระบบและแสดงข้อผิดพลาดการยืนยันตัวตน'
    )
    .replace(
      /^The application keeps the user signed out and displays a username validation error\.$/,
      'ระบบยังไม่ให้ผู้ใช้เข้าสู่ระบบและแสดงข้อผิดพลาดของ Username'
    )
    .replace(
      /^The application keeps the user signed out and displays a password validation error\.$/,
      'ระบบยังไม่ให้ผู้ใช้เข้าสู่ระบบและแสดงข้อผิดพลาดของ Password'
    )
    .replace(
      /^Confirm whether uppercase, lowercase, number, special-character, and length rules are required\.$/,
      'ยืนยันว่าระบบต้องบังคับตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก ตัวเลข อักขระพิเศษ และความยาวหรือไม่'
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
      /^Evidence: the field has the HTML "required" attribute\. Playwright waits for the field to become invalid\.$/,
      'หลักฐาน: ช่องข้อมูลมีแอตทริบิวต์ HTML "required" และ Playwright จะรอจนกว่าช่องจะแสดงสถานะไม่ถูกต้อง'
    )
    .replace(/^Generated from input type="(.+)"\.$/, 'สร้างจาก input type="$1"')
    .replace(
      /^HTML required accepts whitespace\. Review this case against the product rule and the displayed message\.$/,
      'HTML required ยอมรับช่องว่าง จึงต้องตรวจกับข้อกำหนดและข้อความที่แสดง'
    )
    .replace(
      /^No username character policy is inferred unless the HTML exposes a pattern\. Review the result against requirements\.$/,
      'จะไม่เดานโยบายตัวอักษรของ Username ถ้า HTML ไม่มี pattern กรุณาตรวจกับข้อกำหนด'
    )
    .replace(
      /^Generated as a business-rule review because HTML may not expose the server username policy\.$/,
      'สร้างเป็นเคสตรวจสอบ Business rule เพราะ HTML อาจไม่เปิดเผยนโยบาย Username ของ Server'
    )
    .replace(/^Generated from minlength="(.+)"\.$/, 'สร้างจาก minlength="$1"')
    .replace(/^Generated from min="(.+)"\.$/, 'สร้างจาก min="$1"')
    .replace(/^Generated from max="(.+)"\.$/, 'สร้างจาก max="$1"')
    .replace(/^Generated from pattern="(.+)"\.$/, 'สร้างจาก pattern="$1"')
    .replace(/^Generated from the password pattern="(.+)"\.$/, 'สร้างจาก Password pattern="$1"')
    .replace(
      /^Runs one failed login attempt only\. Review the observed server message before marking this case ready\.$/,
      'ยิง Login ผิดเพียงหนึ่งครั้ง และตรวจข้อความจาก Server ก่อนเปลี่ยนเคสเป็น Ready'
    )
    .replace(
      /^No minlength, maxlength, or pattern was found in the HTML\. LazyScout does not invent a password policy\.$/,
      'ไม่พบ minlength, maxlength หรือ pattern ใน HTML โดย LazyScout จะไม่เดานโยบายรหัสผ่านขึ้นเอง'
    )
    .replace(
      /^No required attribute was detected\. Confirm whether an empty value is allowed before automating submission\.$/,
      'ไม่พบแอตทริบิวต์ required กรุณายืนยันว่าอนุญาตให้เว้นว่างหรือไม่ก่อนทำ Automation ส่งฟอร์ม'
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
