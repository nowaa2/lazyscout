import type { AnalyzeRequest, AnalyzeResponse, ApiErrorResponse, TestCase, TestDataRow } from '../types'

/** error ที่พร้อมแสดงให้ user (มีข้อความภาษาคนแล้ว) */
export class ApiError extends Error {
  readonly code: string
  readonly hint?: string

  constructor(code: string, message: string, hint?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.hint = hint
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorResponse
    if (body?.error?.message) {
      return new ApiError(body.error.code, body.error.message, body.error.hint)
    }
  } catch {
    // response ไม่ใช่ JSON — ใช้ข้อความกลางแทน
  }
  return new ApiError('unknown', `เซิร์ฟเวอร์ตอบกลับด้วยสถานะ ${response.status}`)
}

export async function analyzeWebsite(payload: AnalyzeRequest): Promise<AnalyzeResponse> {
  let response: Response
  try {
    response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch {
    throw new ApiError(
      'server-unreachable',
      'ติดต่อ LazyScout API ไม่ได้',
      'ตรวจสอบว่าได้รัน "npm run dev:server" แล้ว'
    )
  }

  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as AnalyzeResponse
}

/** ขอไฟล์ CSV จาก server แล้วสั่งดาวน์โหลดในเบราว์เซอร์ (test case + test data ในไฟล์เดียว) */
export async function downloadTestCasesCsv(testCases: TestCase[], testData: TestDataRow[] = []): Promise<void> {
  const response = await fetch('/api/export/csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testCases, testData })
  })

  if (!response.ok) throw await toApiError(response)

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `lazyscout-testcases-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
