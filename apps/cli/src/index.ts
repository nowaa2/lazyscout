import { parseArgs } from 'node:util'
import { runScan } from './commands/scan.js'
import { runServe } from './commands/serve.js'
import { VERSION } from './version.js'

const HELP = `
LazyScout ${VERSION} — Analyze websites and generate draft test cases for software testers.

Usage
npx lazyscout
Open the LazyScout web interface. Recommended.

npx lazyscout scan <url>
Scan a website and save the results to files without opening the LazyScout interface.

Scan Options
--csv <file>        Save test cases and test data as CSV.
Default: lazyscout-testcases.csv

--json <file>       Save all raw scan results as JSON.

--max-pages <n>     Maximum number of pages to scan.
Default: 20

--max-depth <n>     Maximum crawl depth.
Default: 3

--start-path <path> Continue exploration from this path after login.
Example: /admin/users

--scope-path <path> Limit exploration to this section.
Example: /admin

--mode <mode>       Exploration mode: current-page, scope, site.
Default: site

--debug             Show detailed exploration logs.

Web Interface Options
--port <port>       Port used by the LazyScout web interface.
Default: 4321

--workspace <path>  Workspace used for projects and evidence.
Default: ~/LazyScout

--no-open           Do not open the browser automatically.

Examples
npx lazyscout

npx lazyscout --workspace D:\\QA\\LazyScout

npx lazyscout scan http://localhost:5173

npx lazyscout scan https://example.com --max-pages 10 --csv report.csv

npx lazyscout scan https://example.com --start-path /admin --scope-path /admin --mode scope --debug

Explorer Behavior
LazyScout only explores URLs within the same origin.
It follows links and tries a small, safe set of UI controls such as tabs and dialogs.
It never submits forms or fills credentials automatically.
`

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
      csv: { type: 'string' },
      json: { type: 'string' },
      'max-pages': { type: 'string' },
      'max-depth': { type: 'string' },
      port: { type: 'string' },
      workspace: { type: 'string' },

      'no-open': { type: 'boolean', default: false },
      'start-path': { type: 'string' },
      'scope-path': { type: 'string' },
      mode: { type: 'string' },
      debug: { type: 'boolean', default: false }
    }
  })

  if (values.version) {
    console.log(VERSION)
    return
  }

  const command = positionals[0]

  if (values.help || command === 'help') {
    console.log(HELP)
    return
  }

  switch (command) {
    case undefined:
    case 'serve':
      await runServe({
        port: values.port ? Number(values.port) : undefined,
        open: !values['no-open'],
        workspace: values.workspace
      })
      return

    case 'scan': {
      const url = positionals[1]
      if (!url) {
        console.error('A URL is required. Example: npx lazyscout scan http://localhost:5173')
        process.exitCode = 1
        return
      }
      const mode = values.mode as 'current-page' | 'scope' | 'site' | undefined
      if (mode && mode !== 'current-page' && mode !== 'scope' && mode !== 'site') {
        console.error(`Invalid mode "${mode}". Use: current-page, scope, or site`)
        process.exitCode = 1
        return
      }
      await runScan({
        url,
        csvPath: values.csv,
        jsonPath: values.json,
        maxPages: values['max-pages'] ? Number(values['max-pages']) : undefined,
        maxDepth: values['max-depth'] ? Number(values['max-depth']) : undefined,
        startPath: values['start-path'],
        scopePath: values['scope-path'],
        mode,
        debug: values.debug
      })
      return
    }

    default:
      console.error(`Unknown command "${command}". Run npx lazyscout --help for usage.`)
      process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  const hint = error && typeof error === 'object' && 'hint' in error ? String(error.hint) : undefined

  console.error(`\n✖ ${message}`)
  if (hint) console.error(`  ${hint}`)
  process.exitCode = 1
})
