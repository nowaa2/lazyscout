import { redactSensitiveText, type ApiErrorResponse } from '@lazyscout/core'
import { ExplorerError } from '@lazyscout/explorer'

export function toApiError(error: unknown): { status: number; body: ApiErrorResponse } {
  if (error instanceof ExplorerError) {
    const status = error.code === 'invalid-url' || error.code === 'blocked-url' ? 400 : 502
    return {
      status,
      body: {
        error: {
          code: error.code,
          message: redactSensitiveText(error.message),
          hint: error.hint ? redactSensitiveText(error.hint) : undefined
        }
      }
    }
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'internal-error',
        message: 'An internal error occurred while analyzing the website.',
        hint: 'Try again, or review the server logs for more details.'
      }
    }
  }
}
