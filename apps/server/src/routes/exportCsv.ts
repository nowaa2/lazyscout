import type { FastifyInstance } from 'fastify'
import type { ExportCsvRequest } from '@lazyscout/core'
import { exportTestCasesToCsv } from '@lazyscout/generators'

/**
 * POST /api/export/csv — รับ test case ที่ Tester แก้ไขแล้วจาก UI แล้วคืนไฟล์ CSV
 * (ต้องรับจาก UI ไม่ใช่สร้างใหม่ฝั่ง server เพราะผู้ใช้แก้ไขข้อมูลได้)
 */
export function registerExportCsvRoute(app: FastifyInstance): void {
  app.post('/api/export/csv', async (request, reply) => {
    const body = (request.body ?? {}) as Partial<ExportCsvRequest>

    if (!Array.isArray(body.testCases) || body.testCases.length === 0) {
      return reply.status(400).send({
        error: { code: 'empty-export', message: 'ไม่มี test case สำหรับ export' }
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
