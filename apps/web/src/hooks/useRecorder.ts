import { useCallback, useEffect, useState } from 'react'
import type { RecorderState } from '../types'
import { getRecorderState, startRecorder, stopRecorder } from '../api/client'

const POLL_INTERVAL_MS = 1000
/** Stop polling rather than hammering a server that is not answering. */
const MAX_CONSECUTIVE_FAILURES = 3

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
  const [dismissed, setDismissed] = useState(false)

  // Reopening the panel must find a recording that is still running, otherwise
  // Start would fail with recorder-busy and the browser would be orphaned.
  useEffect(() => {
    if (!projectId) return
    let active = true
    setState(idle(projectId))
    setError(undefined)
    setDismissed(false)
    void getRecorderState(projectId)
      .then((next) => {
        if (active && next.status !== 'idle') setState(next)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [projectId])

  const recording = state.status === 'recording' && !dismissed

  useEffect(() => {
    if (!projectId || !recording) return
    let active = true
    let inFlight = false
    let failures = 0

    const timer = setInterval(() => {
      // Never let a slow response stack requests on top of each other.
      if (inFlight) return
      inFlight = true
      void getRecorderState(projectId)
        .then((next) => {
          failures = 0
          if (active) setState(next)
        })
        .catch(() => {
          failures += 1
          if (failures >= MAX_CONSECUTIVE_FAILURES && active) {
            setError('Lost contact with the recorder. Stop and start it again.')
            setDismissed(true)
          }
        })
        .finally(() => {
          inFlight = false
        })
    }, POLL_INTERVAL_MS)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [projectId, recording])

  const start = useCallback(
    async (url: string) => {
      if (!projectId) return
      setBusy(true)
      setError(undefined)
      setDismissed(false)
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
    setDismissed(false)
  }, [projectId])

  return { state, recording, busy, error, start, stop, reset }
}
