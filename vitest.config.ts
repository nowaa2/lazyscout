import { cpus } from 'node:os'
import { defineConfig } from 'vitest/config'

/**
 * Several suites drive a real Chromium, and a few of those also run the
 * Playwright CLI, which starts another one. Left to fan out across every core,
 * the machine ends up with more browsers than it can schedule and the
 * timing-sensitive ones — a recorder frame arriving, a CLI run finishing —
 * intermittently time out. Capping the worker count keeps the suite honest:
 * a failure then means the code is wrong, not that the box was busy.
 */
const maxWorkers = Math.max(2, Math.min(4, cpus().length))

export default defineConfig({
  test: {
    include: ['packages/*/tests/**/*.test.ts', 'apps/*/tests/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    poolOptions: { forks: { maxForks: maxWorkers, minForks: 1 } },
    // A browser launch on a loaded machine can exceed the 5s default.
    testTimeout: 60_000,
    hookTimeout: 120_000
  }
})
