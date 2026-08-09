import type { FastifyInstance } from 'fastify'
import type { ApiCheckRunRequest } from '@lazyscout/core'
import { checkTargetUrl, redactSensitiveText } from '@lazyscout/core'
import { config } from '../config.js'

const SAFE_API_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function registerApiCheckRunRoute(app: FastifyInstance): void {
  app.post('/api/api-check/run', async (request, reply) => {
    const body = request.body as Partial<ApiCheckRunRequest>
    const check = body.apiCheck
    if (!check?.url)
      return reply.status(400).send({ error: { code: 'invalid-api-check', message: 'API Check was not found.' } })
    const target = checkTargetUrl(check.url, config.urlPolicy)
    if (!target.ok) return reply.status(400).send({ error: { code: target.code, message: target.message } })
    const method = check.method.toUpperCase()
    if (!SAFE_API_METHODS.has(method))
      return reply.status(400).send({
        error: {
          code: 'unsafe-api-method',
          message: `${method} API checks are observation-only. LazyScout runs only GET, HEAD and OPTIONS automatically.`
        }
      })
    const token = body.secrets?.apiToken ?? process.env.LAZYSCOUT_API_TOKEN
    if (check.status === 'needs-auth' && !token)
      return reply.send({
        status: 'needs-auth',
        durationMs: 0,
        message: 'This API requires a token. Set LAZYSCOUT_API_TOKEN before running it.'
      })
    const started = Date.now()
    try {
      const response = await fetch(target.url, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: AbortSignal.timeout(20_000)
      })
      const durationMs = Date.now() - started
      const passed = check.expectedStatus === undefined ? response.ok : response.status === check.expectedStatus
      return reply.send({
        status: passed ? 'passed' : 'failed',
        statusCode: response.status,
        durationMs,
        message: passed
          ? `API ${check.method} returned expected HTTP ${response.status}`
          : `API ${check.method} returned HTTP ${response.status}`
      })
    } catch (error) {
      return reply.send({
        status: 'failed',
        durationMs: Date.now() - started,
        message: redactSensitiveText(error instanceof Error ? error.message : String(error), token ? [token] : [])
      })
    }
  })
}
