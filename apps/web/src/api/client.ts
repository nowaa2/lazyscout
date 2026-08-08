import type { AnalyzeRequest, AnalyzeResponse, ApiCheck, ApiCheckRunResponse, ApiErrorResponse, AutomationRunResponse, ProjectSecrets, TestCase, TestDataRow } from '../types'

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

  }
  return new ApiError('unknown', `The server returned status ${response.status}.`)
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
      'Could not reach the LazyScout API.',
      'Check that "npm run dev:server" is running.'
    )
  }

  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as AnalyzeResponse
}

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

export async function runAutomation(testCase: TestCase, framework: 'playwright' | 'cypress' = 'playwright', code?: string, secrets?: ProjectSecrets): Promise<AutomationRunResponse> {
  const response = await fetch('/api/automation/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ testCase, framework, code, secrets }) })
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as AutomationRunResponse
}
export async function runApiCheck(apiCheck: ApiCheck, secrets?: ProjectSecrets): Promise<ApiCheckRunResponse> { const response = await fetch('/api/api-check/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiCheck, secrets }) }); if (!response.ok) throw await toApiError(response); return (await response.json()) as ApiCheckRunResponse }
