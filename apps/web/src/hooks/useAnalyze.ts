import { useState } from 'react'
import { ApiError, analyzeWebsite } from '../api/client'
import type { AnalyzeResponse, TestCaseLanguage } from '../types'

type AnalyzeState = {
  status: 'idle' | 'loading' | 'success' | 'error'
  result: AnalyzeResponse | null
  error: ApiError | null
}

export function useAnalyze() {
  const [state, setState] = useState<AnalyzeState>({ status: 'idle', result: null, error: null })

  async function analyze(
    url: string,
    maxPages: number,
    maxDepth: number,
    language: TestCaseLanguage = 'en',
    includeApiChecks = false,
    waitAfterNavigationMs = 750,
    blockedKeywords: string[] = []
  ) {
    setState({ status: 'loading', result: null, error: null })
    try {
      const result = await analyzeWebsite({
        url,
        maxPages,
        maxDepth,
        language,
        includeApiChecks,
        waitAfterNavigationMs,
        blockedKeywords
      })
      setState({ status: 'success', result, error: null })
      return result
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError('unknown', 'An unexpected error occurred.')
      setState({ status: 'error', result: null, error: apiError })
      return null
    }
  }

  function reset() {
    setState({ status: 'idle', result: null, error: null })
  }

  return { ...state, analyze, reset }
}
