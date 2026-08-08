import type { ApiErrorResponse } from '@lazyscout/core'
import { ExplorerError } from '@lazyscout/explorer'

/**
 * แปลง error ภายในเป็น response ที่ user อ่านเข้าใจ
 * ห้ามส่ง stack trace หรือข้อความดิบของ Playwright ออกไป
 */
export function toApiError(error: unknown): { status: number; body: ApiErrorResponse } {
  if (error instanceof ExplorerError) {
    const status = error.code === 'invalid-url' || error.code === 'blocked-url' ? 400 : 502
    return {
      status,
      body: { error: { code: error.code, message: error.message, hint: error.hint } }
    }
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'internal-error',
        message: 'เกิดข้อผิดพลาดภายในระบบระหว่างวิเคราะห์เว็บไซต์',
        hint: 'ลองใหม่อีกครั้ง หรือดู log ของเซิร์ฟเวอร์เพื่อหาสาเหตุ'
      }
    }
  }
}
