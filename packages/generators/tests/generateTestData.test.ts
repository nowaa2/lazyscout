import { describe, expect, it } from 'vitest'
import type { PageInfo, UIElement } from '@lazyscout/core'
import { generateTestData } from '@lazyscout/generators'

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

const page: PageInfo = {
  url: 'http://localhost:5173/register',
  finalUrl: 'http://localhost:5173/register',
  title: 'Register',
  depth: 0,
  headings: ['Create account'],
  links: [],
  buttons: [],
  inputs: [
    element({ kind: 'input', role: 'textbox', accessibleName: 'Email', inputType: 'email', required: true }),
    element({ kind: 'input', role: 'textbox', accessibleName: 'Password', inputType: 'password', required: true }),
    // ชื่อซ้ำกับช่องแรก — ต้องถูกตัดออก
    element({ kind: 'input', role: 'textbox', accessibleName: 'Email', inputType: 'email' })
  ],
  textareas: [element({ kind: 'textarea', role: 'textbox', accessibleName: 'Note', tagName: 'textarea' })],
  selects: [
    element({
      kind: 'select',
      role: 'combobox',
      accessibleName: 'Country',
      tagName: 'select',
      options: ['-- select --', 'Thailand', 'Japan']
    })
  ],
  forms: []
}

describe('generateTestData', () => {
  const rows = generateTestData([page])

  it('สร้าง 1 แถวต่อ 1 field และตัดชื่อซ้ำใน module เดียวกัน', () => {
    expect(rows.map((row) => row.field)).toEqual(['Email', 'Password', 'Note', 'Country'])
    expect(rows[0]?.id).toBe('TD-REGISTER-001')
    expect(rows.every((row) => row.module === 'REGISTER')).toBe(true)
  })

  it('เสนอค่า valid/invalid ตามชนิดของ input', () => {
    const email = rows.find((row) => row.field === 'Email')
    expect(email?.validValue).toBe('qa.tester@example.com')
    expect(email?.invalidValue).toBe('invalid-email')
    expect(email?.required).toBe(true)

    const password = rows.find((row) => row.field === 'Password')
    expect(password?.validValue).toBe('Passw0rd!23')
  })

  it('select ใช้ตัวเลือกจริงเป็นค่า valid และ "ไม่เลือก" เป็นค่า invalid', () => {
    const country = rows.find((row) => row.field === 'Country')
    expect(country?.inputType).toBe('select')
    expect(country?.validValue).toBe('-- select --')
    expect(country?.invalidValue).toBe('(no option selected)')
  })

  it('บอกใน note ว่าค่านี้ทดสอบอะไร และเตือนเมื่อไม่มี required attribute', () => {
    expect(rows.find((row) => row.field === 'Email')?.note).toContain('email format')
    expect(rows.find((row) => row.field === 'Note')?.note).toContain('not marked required')
  })
})
