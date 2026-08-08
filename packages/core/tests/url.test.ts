import { describe, expect, it } from 'vitest'
import {
  LOCAL_QA_POLICY,
  PUBLIC_SAAS_POLICY,
  checkTargetUrl,
  moduleNameFromUrl,
  normalizeUrl
} from '@lazyscout/core'

describe('checkTargetUrl', () => {
  it('อนุญาต localhost ในโหมด local QA', () => {
    const result = checkTargetUrl('http://localhost:5173', LOCAL_QA_POLICY)
    expect(result.ok).toBe(true)
  })

  it('เติม http:// ให้อัตโนมัติเมื่อ user พิมพ์แค่ host', () => {
    const result = checkTargetUrl('localhost:5173', LOCAL_QA_POLICY)
    expect(result.ok && result.url.origin).toBe('http://localhost:5173')
  })

  it('บล็อก localhost และ private IP ในโหมด public', () => {
    expect(checkTargetUrl('http://localhost:3000', PUBLIC_SAAS_POLICY).ok).toBe(false)
    expect(checkTargetUrl('http://192.168.1.10', PUBLIC_SAAS_POLICY).ok).toBe(false)
    expect(checkTargetUrl('http://10.0.0.1', PUBLIC_SAAS_POLICY).ok).toBe(false)
  })

  it('บล็อก cloud metadata endpoint เสมอ', () => {
    expect(checkTargetUrl('http://169.254.169.254/latest/meta-data', LOCAL_QA_POLICY).ok).toBe(false)
  })

  it('ปฏิเสธ protocol ที่ไม่รองรับและ URL ว่าง', () => {
    expect(checkTargetUrl('file:///etc/passwd', LOCAL_QA_POLICY).ok).toBe(false)
    expect(checkTargetUrl('   ', LOCAL_QA_POLICY).ok).toBe(false)
  })
})

describe('normalizeUrl', () => {
  it('ตัด hash และ trailing slash เพื่อกันหน้าซ้ำ', () => {
    expect(normalizeUrl('http://localhost:3000/login/#form')).toBe('http://localhost:3000/login')
    expect(normalizeUrl('http://localhost:3000/')).toBe('http://localhost:3000/')
  })

  it('เรียง query parameter ให้คงที่', () => {
    expect(normalizeUrl('http://x.dev/list?b=2&a=1')).toBe(normalizeUrl('http://x.dev/list?a=1&b=2'))
  })
})

describe('moduleNameFromUrl', () => {
  it('แปลง path เป็นชื่อ module', () => {
    expect(moduleNameFromUrl('http://x.dev/login')).toBe('LOGIN')
    expect(moduleNameFromUrl('http://x.dev/')).toBe('HOME')
    expect(moduleNameFromUrl('http://x.dev/users/list')).toBe('USERS-LIST')
  })
})
