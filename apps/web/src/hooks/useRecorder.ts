import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecorderState } from '../types'
import { getRecorderState, startRecorder, stopRecorder } from '../api/client'

const POLL_INTERVAL_MS = 1000

const idle = (projectId: string): RecorderState => ({
  projectId,
  status: 'idle',
  startUrl: '',
  startedAt: '',
  steps: []
})

export function useRecorder(projectId?: string) {
  const [state, setState] = useState<RecorderState>(() => idle(projectId ?? ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const cancelled = useRef(false)

  useEffect(() => {
    setState(idle(projectId ?? ''))
    setError(undefined)
  }, [projectId])

  // Polling stops as soon as the browser window closes or Stop is pressed.
  useEffect(() => {
    if (!projectId || state.status !== 'recording') return
    cancelled.current = false
    const timer = setInterval(() => {
      void getRecorderState(projectId)
        .then((next) => {
          if (!cancelled.current) setState(next)
        })
        .catch(() => undefined)
    }, POLL_INTERVAL_MS)
    return () => {
      cancelled.current = true
      clearInterval(timer)
    }
  }, [projectId, state.status])

  const start = useCallback(
    async (url: string) => {
      if (!projectId) return
      setBusy(true)
      setError(undefined)
      try {
        setState(await startRecorder(projectId, url))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'The recorder could not be started.')
      } finally {
        setBusy(false)
      }
    },
    [projectId]
  )

  const stop = useCallback(async () => {
    if (!projectId) return
    setBusy(true)
    try {
      setState(await stopRecorder(projectId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The recorder could not be stopped.')
    } finally {
      setBusy(false)
    }
  }, [projectId])

  const reset = useCallback(() => {
    setState(idle(projectId ?? ''))
    setError(undefined)
  }, [projectId])

  return { state, busy, error, start, stop, reset }
}
