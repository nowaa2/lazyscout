import type { FastifyInstance } from 'fastify'
import type { LoadTestRequest, LoadTestResponse } from '@lazyscout/core'

export function registerLoadTestRoute(app: FastifyInstance) {
  app.post('/api/load-test/run', async (request, reply) => {
    const body = request.body as Partial<LoadTestRequest>
    if (!body.confirmed)
      return reply.status(400).send({
        error: { code: 'confirmation-required', message: 'Confirm that you are authorized to load test this target.' }
      })
    let url: URL
    try {
      url = new URL(body.url ?? '')
    } catch {
      return reply.status(400).send({ error: { code: 'invalid-url', message: 'A valid HTTP URL is required.' } })
    }
    if (!['http:', 'https:'].includes(url.protocol))
      return reply
        .status(400)
        .send({ error: { code: 'invalid-url', message: 'Only HTTP and HTTPS URLs are supported.' } })
    const virtualUsers = Math.max(1, Math.min(Number(body.virtualUsers) || 1, 20))
    const requestsPerUser = Math.max(1, Math.min(Number(body.requestsPerUser) || 1, 100))
    const intervalMs = Math.max(0, Math.min(Number(body.intervalMs) || 0, 10_000))
    const timings: number[] = []
    const errors: string[] = []
    const requests: LoadTestResponse['requests'] = []
    let requestSequence = 0
    const started = Date.now()
    async function worker(virtualUser: number) {
      for (let count = 0; count < requestsPerUser; count++) {
        const id = ++requestSequence
        const requestStarted = Date.now()
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'follow' })
          const durationMs = Date.now() - requestStarted
          const responseBytes = Number(response.headers.get('content-length')) || undefined
          timings.push(durationMs)
          if (!response.ok) errors.push(`HTTP ${response.status} ${response.statusText}`.trim())
          requests.push({
            id,
            virtualUser,
            iteration: count + 1,
            method: 'GET',
            url: url.toString(),
            finalUrl: response.url,
            statusCode: response.status,
            statusText: response.statusText,
            durationMs,
            passed: response.ok,
            responseBytes
          })
        } catch (error) {
          const durationMs = Date.now() - requestStarted
          const message = error instanceof Error ? error.message : String(error)
          timings.push(durationMs)
          errors.push(message)
          requests.push({
            id,
            virtualUser,
            iteration: count + 1,
            method: 'GET',
            url: url.toString(),
            durationMs,
            passed: false,
            error: message
          })
        }
        if (intervalMs && count < requestsPerUser - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs))
      }
    }
    await Promise.all(Array.from({ length: virtualUsers }, (_, index) => worker(index + 1)))
    const total = timings.length
    const failed = errors.length
    const duration = Math.max(Date.now() - started, 1)
    const response: LoadTestResponse = {
      total,
      passed: total - failed,
      failed,
      averageMs: total ? Math.round(timings.reduce((sum, value) => sum + value, 0) / total) : 0,
      minMs: total ? Math.min(...timings) : 0,
      maxMs: total ? Math.max(...timings) : 0,
      requestsPerSecond: Number((total / (duration / 1000)).toFixed(2)),
      errors: [...new Set(errors)].slice(0, 10),
      requests: requests.sort((left, right) => left.id - right.id)
    }
    return reply.send(response)
  })
}
