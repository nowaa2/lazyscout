import type { FastifyInstance } from 'fastify'
import type { ExportCsvRequest } from '@lazyscout/core'
import { exportTestCasesToCsv } from '@lazyscout/generators'

export function registerExportCsvRoute(app: FastifyInstance): void {
  app.post('/api/export/csv', async (request, reply) => {
    const body = (request.body ?? {}) as Partial<ExportCsvRequest>

    if (!Array.isArray(body.testCases) || body.testCases.length === 0) {
      return reply.status(400).send({
        error: { code: 'empty-export', message: 'There are no Test Cases to export.' }
      })
    }

    const csv = exportTestCasesToCsv(body.testCases, Array.isArray(body.testData) ? body.testData : [])
    const filename = `lazyscout-testcases-${new Date().toISOString().slice(0, 10)}.csv`

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csv)
  })
}
