import type { FastifyInstance } from 'fastify'
import type { ApiCheckRunRequest } from '@lazyscout/core'
import { checkTargetUrl } from '@lazyscout/core'
import { config } from '../config.js'

export function registerApiCheckRunRoute(app: FastifyInstance): void {
  app.post('/api/api-check/run', async (request, reply) => {
    const body = request.body as Partial<ApiCheckRunRequest>
    const check = body.apiCheck
    if (!check?.url) return reply.status(400).send({ error: { code: 'invalid-api-check', message: 'ไม่พบ API Check' } })
    const target = checkTargetUrl(check.url, config.urlPolicy)
    if (!target.ok) return reply.status(400).send({ error: { code: target.code, message: target.message } })
    const token = body.secrets?.apiToken ?? process.env.LAZYSCOUT_API_TOKEN
    if (check.status === 'needs-auth' && !token) return reply.send({ status: 'needs-auth', durationMs: 0, message: 'API นี้ต้องใช้ token ตั้งค่า LAZYSCOUT_API_TOKEN ก่อนรัน' })
    const started = Date.now()
    try {
      const response = await fetch(target.url, { method: check.method, headers: token ? { Authorization: `Bearer ${token}` } : undefined, signal: AbortSignal.timeout(20_000) })
      const durationMs = Date.now() - started
      const passed = check.expectedStatus === undefined ? response.ok : response.status === check.expectedStatus
      return reply.send({ status: passed ? 'passed' : 'failed', statusCode: response.status, durationMs, message: passed ? `API ${check.method} returned expected HTTP ${response.status}` : `API ${check.method} returned HTTP ${response.status}` })
    } catch (error) { return reply.send({ status: 'failed', durationMs: Date.now() - started, message: error instanceof Error ? error.message : String(error) }) }
  })
}
