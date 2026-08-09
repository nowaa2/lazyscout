import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { exploreWebsite } from '@lazyscout/explorer'
import { redactUrl } from '@lazyscout/core'
import { exportTestCasesToCsv, generateTestCases, generateTestData } from '@lazyscout/generators'

export type ScanOptions = {
  url: string
  csvPath?: string
  jsonPath?: string
  maxPages?: number
  maxDepth?: number
}

export async function runScan(options: ScanOptions): Promise<void> {
  console.log(`กำลังสำรวจ ${redactUrl(options.url)} ...`)

  const result = await exploreWebsite(options.url, {
    ...(options.maxPages !== undefined ? { maxPages: options.maxPages } : {}),
    ...(options.maxDepth !== undefined ? { maxDepth: options.maxDepth } : {})
  })

  const testCases = generateTestCases(result.pages)
  const testData = generateTestData(result.pages)

  for (const page of result.pages) {
    console.log(`  ✓ [depth ${page.depth}] ${page.title || '(no title)'} — ${page.finalUrl}`)
  }
  for (const issue of result.issues) {
    console.log(`  ! ${issue.url} — ${issue.message}`)
  }

  console.log(
    `\nสรุป: ${result.pages.length} หน้า · ${testCases.length} test case · ${testData.length} test data · ${(result.stats.durationMs / 1000).toFixed(1)} วินาที · ใช้ ${result.stats.browser}`
  )

  if (result.pages.length === 0) {
    console.error('เปิดเว็บไซต์ไม่สำเร็จ จึงไม่มีข้อมูลให้บันทึก')
    process.exitCode = 1
    return
  }

  const csvPath = resolve(options.csvPath ?? 'lazyscout-testcases.csv')
  await writeFile(csvPath, exportTestCasesToCsv(testCases, testData), 'utf8')
  console.log(`บันทึก CSV: ${csvPath}`)

  if (options.jsonPath) {
    const jsonPath = resolve(options.jsonPath)
    await writeFile(jsonPath, JSON.stringify({ ...result, testCases, testData }, null, 2), 'utf8')
    console.log(`บันทึก JSON: ${jsonPath}`)
  }
}
