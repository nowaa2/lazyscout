import { describe, expect, it } from 'vitest'
import type { PageInfo, UIElement } from '@lazyscout/core'
import { generatePlaywrightTest, generateTestCases } from '@lazyscout/generators'

function element(partial: Partial<UIElement> & Pick<UIElement, 'kind' | 'role' | 'accessibleName'>): UIElement {
  return {
    tagName: 'input',
    required: false,
    disabled: false,
    destructive: false,
    cssSelector: '#x',
    ...partial
  }
}

const email = element({
  kind: 'input',
  role: 'textbox',
  accessibleName: 'Email',
  inputType: 'email',
  required: true,
  cssSelector: '#email'
})
const password = element({
  kind: 'input',
  role: 'textbox',
  accessibleName: 'Password',
  inputType: 'password',
  required: true,
  minLength: 8,
  pattern: '(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$]).{8,}',
  cssSelector: '#password'
})
const loginButton = element({
  kind: 'button',
  role: 'button',
  accessibleName: 'Login',
  tagName: 'button',
  cssSelector: '#login'
})
const deleteButton = element({
  kind: 'button',
  role: 'button',
  accessibleName: 'Delete Account',
  tagName: 'button',
  destructive: true
})

const loginPage: PageInfo = {
  url: 'http://localhost:5173/login',
  finalUrl: 'http://localhost:5173/login',
  title: 'Login',
  depth: 0,
  headings: ['Login'],
  links: [
    element({
      kind: 'link',
      role: 'link',
      accessibleName: 'Register',
      tagName: 'a',
      href: 'http://localhost:5173/register'
    }),
    element({
      kind: 'link',
      role: 'link',
      accessibleName: 'Forgot Password',
      tagName: 'a',
      href: 'http://localhost:5173/forgot-password'
    })
  ],
  buttons: [loginButton, deleteButton],
  inputs: [email, password],
  textareas: [],
  selects: [],
  forms: [{ method: 'post', fields: [email, password], submitButtons: [loginButton] }]
}

describe('generateTestCases', () => {
  const testCases = generateTestCases([loginPage])

  it('generates an executable login flow with filled fields and a submit action', () => {
    const login = testCases.find((testCase) => testCase.title.includes('Login with valid credentials'))
    expect(login?.automationStatus).toBe('ready')
    expect(login?.steps).toEqual(
      expect.arrayContaining([
        {
          type: 'fill',
          target: { role: 'textbox', name: 'Email', tagName: 'input', cssSelector: '#email' },
          value: '{{TEST_EMAIL}}'
        },
        {
          type: 'fill',
          target: { role: 'textbox', name: 'Password', tagName: 'input', cssSelector: '#password' },
          value: '{{TEST_PASSWORD}}'
        },
        { type: 'click', target: { role: 'button', name: 'Login', tagName: 'button', cssSelector: '#login' } }
      ])
    )
  })

  it('ตั้งชื่อ module และ TC ID เรียงต่อเนื่องจาก URL', () => {
    expect(testCases[0]?.id).toBe('TC-LOGIN-001')
    expect(testCases.every((testCase) => testCase.module === 'LOGIN')).toBe(true)
  })

  it('สร้าง test case ตรวจ control บนหน้า, validation ของแต่ละ field และ navigation ของลิงก์', () => {
    const titles = testCases.map((testCase) => testCase.title)
    expect(titles[0]).toContain('displays required controls')
    expect(titles).toContain('Email is required')
    expect(titles).toContain('Password is required')
    expect(titles).toContain('Navigate to Register')
    expect(titles).toContain('Navigate to Forgot Password')
  })

  it('สร้าง required validation ที่ Playwright รันและรอ invalid state ได้', () => {
    const validation = testCases.find((testCase) => testCase.title === 'Email is required')
    expect(validation?.type).toBe('validation')
    expect(validation?.automationStatus).toBe('ready')
    expect(validation?.steps.at(-1)).toEqual({
      type: 'assertInvalid',
      target: { role: 'textbox', name: 'Email', tagName: 'input', cssSelector: '#email' },
      description: 'Verify that "Email" is invalid and the form is not submitted'
    })
  })

  it('สร้าง validation matrix จาก type, minlength และ password pattern', () => {
    const titles = testCases.map((testCase) => testCase.title)
    expect(titles).toContain('Email rejects an invalid email format')
    expect(titles).toContain('Password rejects fewer than 8 characters')
    expect(titles).toContain('Password rejects a password without an uppercase letter')
    expect(titles).toContain('Password rejects a password without a lowercase letter')
    expect(titles).toContain('Password rejects a password without a number')
    expect(titles).toContain('Password rejects a password without a special character')
  })

  it('ใช้ค่า invalid ของแต่ละเคสจริงใน Playwright โดยไม่ถูกแทนด้วย test variable', () => {
    const invalidEmail = testCases.find((testCase) => testCase.title === 'Email rejects an invalid email format')
    expect(invalidEmail).toBeDefined()
    const source = generatePlaywrightTest(invalidEmail!)
    expect(source).toContain('.fill("invalid-email")')
    expect(source).not.toContain('.fill("{{TEST_EMAIL}}")')
    expect(source).toContain("element.matches(':invalid')")
  })

  it('สร้างเคส Username สำหรับค่าว่าง ช่องว่าง ภาษาอื่น และอักขระพิเศษ', () => {
    const username = element({
      kind: 'input',
      role: 'textbox',
      accessibleName: 'Username',
      name: 'username',
      inputType: 'text',
      required: true,
      cssSelector: '#username'
    })
    const usernamePage: PageInfo = {
      ...loginPage,
      inputs: [username, password],
      forms: [{ method: 'post', fields: [username, password], submitButtons: [loginButton] }]
    }
    const generated = generateTestCases([usernamePage])
    const titles = generated.map((testCase) => testCase.title)

    expect(titles).toContain('Username is required')
    expect(titles).toContain('Username handles whitespace-only input')
    expect(titles).toContain('Username handles characters from another writing system')
    expect(titles).toContain('Username handles special characters')
    expect(
      generated.find((testCase) => testCase.title === 'Username handles special characters')?.automationStatus
    ).toBe('needs-review')
    expect(generated.find((testCase) => testCase.title === 'Username is required')?.tags).toContain('required')
  })

  it('ไม่เดาว่าช่อง optional เป็น required แต่สร้างเคสเว้นว่างให้ตรวจสอบ', () => {
    const optionalEmail = { ...email, required: false }
    const optionalPassword = { ...password, required: false }
    const optionalPage: PageInfo = {
      ...loginPage,
      inputs: [optionalEmail, optionalPassword],
      forms: [{ method: 'post', fields: [optionalEmail, optionalPassword], submitButtons: [loginButton] }]
    }
    const generated = generateTestCases([optionalPage])

    expect(generated.find((testCase) => testCase.title === 'Email handles empty input')?.automationStatus).toBe(
      'needs-review'
    )
    expect(generated.some((testCase) => testCase.title === 'Reject empty username')).toBe(true)
    expect(generated.some((testCase) => testCase.title === 'Reject empty password')).toBe(true)
  })

  it('สร้าง failed-login cases แบบยิงครั้งเดียวและรอ validation จริง', () => {
    const invalidUsername = testCases.find((testCase) => testCase.title === 'Reject invalid username')
    const invalidPassword = testCases.find((testCase) => testCase.title === 'Reject invalid password')
    expect(invalidUsername?.automationStatus).toBe('needs-review')
    expect(invalidPassword?.automationStatus).toBe('needs-review')
    expect(invalidUsername?.steps.at(-1)).toEqual({ type: 'assertValidation' })
    expect(invalidPassword?.steps.at(-1)).toEqual({ type: 'assertValidation' })
  })

  it('บันทึก destructive action เป็น manual ไม่ใช่ automation', () => {
    const destructive = testCases.find((testCase) => testCase.title.includes('Delete Account'))
    expect(destructive?.automationStatus).toBe('manual')
  })

  it('เก็บ step เป็น structured data ไม่ใช่ string อย่างเดียว', () => {
    const navigation = testCases.find((testCase) => testCase.title === 'Navigate to Register')
    expect(navigation?.steps[1]).toEqual({
      type: 'click',
      target: { role: 'link', name: 'Register', tagName: 'a', cssSelector: '#x' }
    })
  })

  it('สร้างข้อความ Test Case ภาษาไทยครบทั้ง title, precondition, step, expected result และ note', () => {
    const thaiCases = generateTestCases([loginPage], { language: 'th' })
    const required = thaiCases.find((testCase) => testCase.title === 'Email เป็นข้อมูลที่จำเป็น')
    const submit = thaiCases.find((testCase) => testCase.title.includes('เข้าสู่ระบบด้วยข้อมูลที่ถูกต้อง'))
    const destructive = thaiCases.find((testCase) => testCase.title.includes('Delete Account'))

    expect(required?.preconditions[0]).toBe('ระบบพร้อมใช้งานที่ http://localhost:5173')
    expect(required?.steps.some((step) => step.type === 'assertInvalid')).toBe(true)
    expect(required?.expectedResult).toContain('validation')
    expect(required?.notes).toContain('หลักฐาน')
    expect(thaiCases.some((testCase) => testCase.title === 'Email ไม่ยอมรับรูปแบบอีเมลที่ไม่ถูกต้อง')).toBe(true)
    expect(submit?.preconditions).toContain('เตรียมข้อมูลทดสอบที่ถูกต้องแล้ว')
    expect(destructive?.notes).toContain('การกระทำที่ทำลายข้อมูล')
  })
})
