import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { exploreWebsite, exploreWithScope } from '@lazyscout/explorer'
import { redactUrl } from '@lazyscout/core'
import type { ExplorationMode } from '@lazyscout/core'
import { exportTestCasesToCsv, generateTestCases, generateTestData } from '@lazyscout/generators'

export type ScanOptions = {
  url: string
  csvPath?: string
  jsonPath?: string
  maxPages?: number
  maxDepth?: number
  startPath?: string
  scopePath?: string
  mode?: ExplorationMode
  debug?: boolean
}

export async function runScan(options: ScanOptions): Promise<void> {
  console.log(`checking scan ${redactUrl(options.url)} ...`)

  // Use scoped explorer when startPath, scopePath, or mode is specified
  const useScoped = options.startPath || options.scopePath || options.mode || options.debug

  const result = useScoped
    ? await exploreWithScope(options.url, {
        startPath: options.startPath,
        scopePath: options.scopePath,
        mode: options.mode ?? 'site',
        debug: options.debug ?? false,
        limits: {
          maxPages: options.maxPages ?? 20,
          maxDepth: options.maxDepth ?? 3,
          maxStates: 80,
          maxActionsPerState: 8,
          maxTotalActions: 200,
          maxActionRetries: 2,
          explorationTimeoutMs: 300_000
        }
      })
    : await exploreWebsite(options.url, {
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

  // Print exploration summary if available
  const summary = result.stats.summary
  if (summary) {
    console.log(`\nExploration Summary:`)
    console.log(`  Pages discovered: ${summary.pagesDiscovered}`)
    console.log(`  UI states discovered: ${summary.statesDiscovered}`)
    console.log(`  Transitions: ${summary.transitions}`)
    console.log(
      `  Actions — Executed: ${summary.actionsExecuted} | Blocked: ${summary.actionsBlocked} | Failed: ${summary.actionsFailed} | Retried: ${summary.actionsRetried}`
    )
    console.log(`  URLs skipped by scope: ${summary.urlsSkippedByScope}`)
    console.log(`  End reason: ${summary.endReason}${summary.endReasonDetail ? ` — ${summary.endReasonDetail}` : ''}`)
  }

  console.log(
    `\nSummary: ${result.pages.length} pages · ${testCases.length} test cases · ${testData.length} test data · ${(result.stats.durationMs / 1000).toFixed(1)} seconds · Using ${result.stats.browser}`
  )

  // Print discovery logs if available
  if (result.stats.discoveryLogs && result.stats.discoveryLogs.length > 0) {
    console.log(`\nDiscovery Logs:`)
    for (const log of result.stats.discoveryLogs) {
      const prefix =
        log.level === 'blocked'
          ? '🚫'
          : log.level === 'skipped'
            ? '⏭️'
            : log.level === 'error'
              ? '❌'
              : log.level === 'retry'
                ? '🔄'
                : log.level === 'debug'
                  ? '🔍'
                  : '  '
      console.log(`${prefix} ${log.message}`)
    }
  }

  if (result.pages.length === 0) {
    console.error('Failed to open the website, no data to save')
    process.exitCode = 1
    return
  }

  const csvPath = resolve(options.csvPath ?? 'lazyscout-testcases.csv')
  await writeFile(csvPath, exportTestCasesToCsv(testCases, testData), 'utf8')
  console.log(`\nSaved CSV: ${csvPath}`)

  if (options.jsonPath) {
    const jsonPath = resolve(options.jsonPath)
    await writeFile(jsonPath, JSON.stringify({ ...result, testCases, testData }, null, 2), 'utf8')
    console.log(`Saved JSON: ${jsonPath}`)
  }
}
