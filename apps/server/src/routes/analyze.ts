import type { FastifyInstance } from 'fastify'
import type { AnalyzeRequest, AnalyzeResponse } from '@lazyscout/core'
import { checkTargetUrl } from '@lazyscout/core'
import { ExplorerError, exploreWebsite } from '@lazyscout/explorer'
import { generateTestCases, generateTestData } from '@lazyscout/generators'
import { clamp, config } from '../config.js'
import { toApiError } from '../toApiError.js'

/** POST /api/analyze — สำรวจเว็บไซต์ แล้วสร้าง draft test case กลับไปให้ UI */
export function registerAnalyzeRoute(app: FastifyInstance): void {
  app.post('/api/analyze', async (request, reply) => {
    const body = (request.body ?? {}) as Partial<AnalyzeRequest>

    if (typeof body.url !== 'string' || !body.url.trim()) {
      return reply.status(400).send({
        error: { code: 'invalid-url', message: 'กรุณาระบุ URL ที่ต้องการวิเคราะห์' }
      })
    }

    // ตรวจ URL ก่อนเปิด browser เสมอ (จุดกันของ SSRF)
    const check = checkTargetUrl(body.url, config.urlPolicy)
    if (!check.ok) {
      return reply.status(400).send({ error: { code: check.code, message: check.message } })
    }

    try {
      const result = await exploreWebsite(
        check.url.toString(),
        {
          maxPages: clamp(body.maxPages, 1, config.limits.maxPages, config.limits.maxPages),
          maxDepth: clamp(body.maxDepth, 0, config.limits.maxDepth, config.limits.maxDepth)
        },
        config.urlPolicy
      )

      // เปิดหน้าแรกไม่ได้เลย = ถือว่าล้มเหลว ส่งสาเหตุจริงกลับไป
      if (result.pages.length === 0) {
        const firstIssue = result.issues[0]
        throw new ExplorerError(
          firstIssue?.code ?? 'navigation-failed',
          firstIssue?.message ?? 'เปิดเว็บไซต์ไม่สำเร็จ',
          'ตรวจสอบว่า URL ถูกต้องและเว็บไซต์กำลังทำงานอยู่'
        )
      }

      const response: AnalyzeResponse = {
        startUrl: result.startUrl,
        origin: result.origin,
        pages: result.pages,
        testCases: generateTestCases(result.pages),
        testData: generateTestData(result.pages),
        issues: result.issues,
        stats: result.stats
      }
      return reply.send(response)
    } catch (error) {
      request.log.error({ err: error }, 'analyze failed')
      const { status, body: errorBody } = toApiError(error)
      return reply.status(status).send(errorBody)
    }
  })
}
