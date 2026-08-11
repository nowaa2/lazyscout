import { describe, expect, it } from 'vitest'
import type { PageInfo, UIElement } from '@lazyscout/core'
import { generateTestCases } from '@lazyscout/generators'

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

const email = element({ kind: 'input', role: 'textbox', accessibleName: 'Email', inputType: 'email', required: true })
const password = element({
  kind: 'input',
  role: 'textbox',
  accessibleName: 'Password',
  inputType: 'password',
  required: true
})
const loginButton = element({ kind: 'button', role: 'button', accessibleName: 'Login', tagName: 'button' })
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
        { type: 'fill', target: { role: 'textbox', name: 'Email' }, value: '{{TEST_EMAIL}}' },
        { type: 'fill', target: { role: 'textbox', name: 'Password' }, value: '{{TEST_PASSWORD}}' },
        { type: 'click', target: { role: 'button', name: 'Login' } }
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

  it('ไม่เดา expected result ของ validation แต่ตั้ง automationStatus เป็น needs-review', () => {
    const validation = testCases.find((testCase) => testCase.title === 'Email is required')
    expect(validation?.type).toBe('validation')
    expect(validation?.automationStatus).toBe('needs-review')
  })

  it('บันทึก destructive action เป็น manual ไม่ใช่ automation', () => {
    const destructive = testCases.find((testCase) => testCase.title.includes('Delete Account'))
    expect(destructive?.automationStatus).toBe('manual')
  })

  it('เก็บ step เป็น structured data ไม่ใช่ string อย่างเดียว', () => {
    const navigation = testCases.find((testCase) => testCase.title === 'Navigate to Register')
    expect(navigation?.steps[1]).toEqual({ type: 'click', target: { role: 'link', name: 'Register' } })
  })

  it('สร้างข้อความ Test Case ภาษาไทยครบทั้ง title, precondition, step, expected result และ note', () => {
    const thaiCases = generateTestCases([loginPage], { language: 'th' })
    const required = thaiCases.find((testCase) => testCase.title === 'Email เป็นข้อมูลที่จำเป็น')
    const submit = thaiCases.find((testCase) => testCase.title.includes('เข้าสู่ระบบด้วยข้อมูลที่ถูกต้อง'))
    const destructive = thaiCases.find((testCase) => testCase.title.includes('Delete Account'))

    expect(required?.preconditions[0]).toBe('ระบบพร้อมใช้งานที่ http://localhost:5173')
    expect(required?.steps.some((step) => step.description === 'เว้นช่อง "Email" ว่างไว้')).toBe(true)
    expect(required?.expectedResult).toContain('ข้อความแจ้งเตือน')
    expect(required?.notes).toContain('หลักฐาน')
    expect(submit?.preconditions).toContain('เตรียมข้อมูลทดสอบที่ถูกต้องแล้ว')
    expect(destructive?.notes).toContain('การกระทำที่ทำลายข้อมูล')
  })
})
