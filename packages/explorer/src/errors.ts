import type { ExploreIssue, ExploreIssueCode } from '@lazyscout/core'

export function toExploreIssue(url: string, error: unknown): ExploreIssue {
  const raw = error instanceof Error ? error.message : String(error)
  const text = raw.toLowerCase()

  let code: ExploreIssueCode = 'navigation-failed'
  let message = 'เปิดหน้านี้ไม่สำเร็จ'

  if (text.includes('err_connection_refused') || text.includes('econnrefused')) {
    code = 'connection-refused'
    message = 'เชื่อมต่อไม่ได้ (connection refused) — ตรวจสอบว่าเว็บไซต์เปิดอยู่และพอร์ตถูกต้อง'
  } else if (text.includes('err_name_not_resolved') || text.includes('enotfound')) {
    code = 'dns-error'
    message = 'หาชื่อโดเมนนี้ไม่พบ (DNS) — ตรวจสอบตัวสะกดของ URL'
  } else if (text.includes('err_cert') || text.includes('ssl') || text.includes('err_bad_ssl')) {
    code = 'ssl-error'
    message = 'ใบรับรอง SSL ของเว็บไซต์มีปัญหา'
  } else if (text.includes('timeout') || text.includes('timed out')) {
    code = 'timeout'
    message = 'เปิดหน้าไม่ทันเวลาที่กำหนด (timeout)'
  } else if (text.includes('crash')) {
    code = 'page-crash'
    message = 'หน้าเว็บทำให้ browser หยุดทำงาน (page crash)'
  } else if (text.includes('err_connection_timed_out')) {
    code = 'timeout'
    message = 'เชื่อมต่อไม่สำเร็จภายในเวลาที่กำหนด'
  } else if (text.includes('err_aborted')) {
    code = 'navigation-failed'
    message = 'การเปิดหน้าถูกยกเลิกกลางทาง'
  } else if (text.includes('executable doesn') || text.includes('browsertype.launch')) {
    code = 'browser-error'
    message = 'เปิด browser ไม่ได้ — ให้รัน "npx playwright install chromium" ก่อน'
  }

  return { url, code, message }
}

export class ExplorerError extends Error {
  readonly code: ExploreIssueCode
  readonly hint?: string

  constructor(code: ExploreIssueCode, message: string, hint?: string) {
    super(message)
    this.name = 'ExplorerError'
    this.code = code
    this.hint = hint
  }
}
