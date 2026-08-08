import { useState } from 'react'
import { ApiError, analyzeWebsite } from '../api/client'
import type { AnalyzeResponse } from '../types'

type AnalyzeState = {
  status: 'idle' | 'loading' | 'success' | 'error'
  result: AnalyzeResponse | null
  error: ApiError | null
}

/** จัดการ state ของการเรียก POST /api/analyze */
export function useAnalyze() {
  const [state, setState] = useState<AnalyzeState>({ status: 'idle', result: null, error: null })

  async function analyze(url: string, maxPages: number, maxDepth: number) {
    setState({ status: 'loading', result: null, error: null })
    try {
      const result = await analyzeWebsite({ url, maxPages, maxDepth })
      setState({ status: 'success', result, error: null })
    } catch (error) {
      const apiError =
        error instanceof ApiError ? error : new ApiError('unknown', 'เกิดข้อผิดพลาดที่ไม่คาดคิด')
      setState({ status: 'error', result: null, error: apiError })
    }
  }

  return { ...state, analyze }
}
