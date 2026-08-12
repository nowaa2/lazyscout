# LazyScout

LazyScout is a local-first QA assistant that explores web applications, drafts test cases, and generates automation code for Playwright and Cypress.

> Stop rewriting QA work.

LazyScout is designed for:

- Software Testers who want a reviewable first draft instead of an empty spreadsheet
- QA Engineers exploring DEV, UAT, VPN, intranet or localhost environments
- Automation Testers generating Playwright or Cypress starter code
- Developers who need a fast, structured testing checklist

The main workflow is:

> Explore → Test Case → Run → Bug → Report → Automation

[คู่มือภาษาไทย](README_TH.md)

## Features

### Available

- File-backed local Project workspaces under `~/LazyScout`
- Playwright website exploration with same-origin navigation, page/depth limits and timeouts
- Page, form, control, visible dialog and UI interaction discovery
- Draft Test Case and Test Data generation in English or Thai
- Test Case review, editing, deletion, reordering, folders, tags and requirement links
- CSV, XLSX and JSON Test Case import
- CSV export for Test Cases and Test Data
- Screenshot OCR-assisted Test Case import
- Playwright and Cypress code generation from structured Test Steps
- Local Playwright execution with a restricted statement whitelist, cancellation and logs
- Explicit Playwright screenshots and a local Screenshot Gallery
- Optional XHR/fetch observation and safe API checks for GET, HEAD and OPTIONS
- Bug Reports with image evidence and ZIP export
- Dashboard charts with HTML and PDF summary export
- A small confirmed GET load test with per-request results
- npm Version Center in the startup Project dialog

### In Progress

- Broader localization coverage across every screen
- More complete report layout and large-suite performance tuning

### Planned

- Opt-in exploration that actively opens approved tabs, accordions and dialogs
- Local Cypress execution; Cypress is currently code generation only
- Additional automation statement support without allowing arbitrary JavaScript execution

## Quick Start

Requirements:

- Node.js 20 or newer
- Google Chrome, Microsoft Edge or Playwright Chromium

Run the latest published version:

```bash
npx lazyscout@latest
```

LazyScout starts a local server, opens `http://localhost:4321` and automatically tries the next available port if necessary.

Install the Playwright Chromium browser before your first Scout or automation run:

```bash
npx playwright install chromium
```

On Ubuntu or another Linux distribution, install the browser and its system dependencies:

```bash
npx playwright install --with-deps chromium
```

### CLI scan

The implemented command is `scan`:

```bash
npx lazyscout@latest scan http://localhost:5173
npx lazyscout@latest scan https://example.com --max-pages 10 --csv report.csv --json raw.json
```

```text
--csv <file>       CSV output path; defaults to lazyscout-testcases.csv
--json <file>      Optional raw exploration result
--max-pages <n>    Maximum pages to inspect; defaults to 20
--max-depth <n>    Maximum same-origin link depth; defaults to 3
--port <n>         UI server port; defaults to 4321
--workspace <path> Project workspace; defaults to ~/LazyScout
--no-open          Start the UI server without opening a browser
```

Raw JSON may contain internal URLs, page labels and observed API metadata. Review it before sharing or committing it.

## Development

```bash
git clone https://github.com/nowaa2/lazyscout.git
cd lazyscout
npm install
npx playwright install chromium
npm run build:packages
```

Run the API and UI in separate terminals:

```bash
npm run dev:server
```

```bash
npm run dev:web
```

The API runs at `http://127.0.0.1:4000`; Vite runs at `http://localhost:5173` and proxies `/api` to the local API.

Start the synthetic demo site in another terminal:

```bash
node fixtures/serve.mjs
```

Then Scout `http://localhost:5500`.

## How It Works

```text
Website
   ↓
LazyScout CLI + local web UI
   ↓
Playwright Explorer
   ↓
Page model + discovered UI state graph
   ↓
Draft Test Cases + Test Data
   ↓
Review / CSV / Reports / Playwright or Cypress code
```

Browser automation runs on the user's machine. LazyScout can therefore access localhost, DEV, UAT, VPN and internal websites when that machine can reach them.

Scouting follows safe same-origin links. It discovers tabs, dropdowns, accordions and dialogs from structured DOM information, but it does not automatically click every discovered interaction. Destructive labels and controls are marked as blocked or manual.

## Local-first

LazyScout has no account service or hosted Project database in the current version.

| Data or activity                              | Location                                         |
| --------------------------------------------- | ------------------------------------------------ |
| Browser execution and Playwright runs         | Local machine                                    |
| Projects, Test Cases, results and Bug Reports | `~/LazyScout/projects/<project-id>/`             |
| Explicit Playwright screenshots               | `~/LazyScout/projects/<project-id>/screenshots/` |
| Credentials entered in Project Settings       | Memory only; cleared when the page refreshes     |
| Environment-variable credentials              | Local server process                             |
| Version checks                                | npm Registry                                     |

The workspace is created automatically before the UI opens. Run `npx lazyscout --workspace <path>` to use another location. Click **Local workspace** in the sidebar to open the folder. Browser `localStorage` is used only for lightweight UI preferences.

```text
LazyScout/
├── projects/
│   └── <project-id>/
│       ├── project.json
│       ├── test-cases.json
│       ├── test-cases.csv
│       ├── test-data.csv
│       ├── automation/
│       ├── screenshots/
│       ├── bugs/
│       ├── reports/
│       └── logs/
├── backups/
└── settings.json
```

The workspace is not encrypted. Do not use production credentials or retain sensitive evidence longer than necessary.

## Usage Workflow

1. Open LazyScout and choose a published version if needed.
2. Open an existing Project or create a Scout/empty Project.
3. Enter the Target URL and run **Scout Site**.
4. Review discovered pages, controls, states, API observations and Scout Log.
5. Review, edit, reorder or delete generated Test Cases.
6. Add folders, tags and Jira/GitLab/requirement references where useful.
7. Import an existing CSV/XLSX/JSON suite or use screenshot OCR if needed.
8. Export Test Cases and Test Data as CSV.
9. Generate Playwright or Cypress code.
10. Run supported Playwright cases locally and review logs. Screenshots are captured only when edited code calls `page.screenshot()`.
11. Record failures as Bug Reports and export evidence only after reviewing it.
12. Export an HTML or PDF Test Summary for the team.

## Automation Safety

The local Playwright runner does not execute arbitrary shell commands or arbitrary JavaScript source. Edited code is interpreted as a restricted set of Playwright statements such as navigation, approved locators, click, fill, select and assertions. Unsupported statements fail closed.

The runner also:

- limits steps, source size, action time and log lines
- masks configured secrets and common sensitive fields in logs
- blocks destructive labels before clicking
- validates navigation URLs using the active local/public URL policy
- supports cancellation and closes the active browser
- runs Cypress code generation only; Cypress execution is not implemented

## Test Credentials

Environment variables are the preferred option:

```text
LAZYSCOUT_TEST_EMAIL
LAZYSCOUT_TEST_USERNAME
LAZYSCOUT_TEST_PASSWORD
LAZYSCOUT_API_TOKEN
```

Copy `.env.example` only as a local template. Never commit real values. The Project Settings UI can pass temporary credentials for the current tab, but it does not persist them.

Use placeholders in Test Steps or generated code:

```text
{{TEST_EMAIL}}
{{TEST_USERNAME}}
{{TEST_PASSWORD}}
{{API_TOKEN}}
```

## Security Warning

> Never commit real test credentials, production data, browser authentication state, Playwright traces, screenshots, HAR files, or API dumps containing sensitive information.

> Use synthetic test data whenever possible.

> Review generated test cases and automation code before executing them against critical environments.

Screenshots, videos, traces, HAR files, network metadata, form values and Bug evidence can expose personal or confidential information. Artifact directories are ignored by Git by default, but users must still review files before sharing them.

See [SECURITY.md](SECURITY.md) and [docs/SAFETY.md](docs/SAFETY.md).

## Demo

The repository includes a synthetic local demo website under `fixtures/demo-site`.

Real, reviewed product screenshots will be added under [`docs/images/`](docs/images/). No fabricated screenshots are included.

<!-- TODO: Add redacted screenshots for Website Explorer, Test Case review, Run Viewer, generated code and Bug Reports. -->

## Limitations

- Generated Test Cases are drafts and require Tester review.
- Expected Results are rule-based and cannot infer undocumented business requirements.
- Scouting follows links and records interaction hints; it does not fully exercise every UI state.
- The local runner executes Playwright only.
- API replay is restricted to GET, HEAD and OPTIONS; state-changing methods are observation-only.
- The load test is a small local GET runner, not a replacement for JMeter, k6 or a production load-testing platform.
- Projects are stored in a local file workspace and do not sync between devices.
- `PUBLIC_SAAS_POLICY` does not yet resolve DNS or defend against DNS rebinding and must not be treated as production-ready hosted isolation.

## Repository Checks

Before committing or publishing:

```bash
git status
git diff --cached
npm run check:secrets
npm run release:check
```

Verify that no `.env`, credentials, databases, browser profiles, screenshots, traces, HAR files, customer data or tokens are staged.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Authentication](docs/AUTHENTICATION.md)
- [Safety](docs/SAFETY.md)
- [Test Case model](docs/TEST-CASE-MODEL.md)
- [Publishing](docs/PUBLISHING.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## Author

Created by **nowzaa** — [GitHub profile](https://github.com/nowaa2)

## Disclaimer

LazyScout generates draft test cases and automation code to assist QA engineers.

Generated output should be reviewed before being used in production or critical testing environments. LazyScout must not be treated as a replacement for QA judgment. Destructive actions should not be executed unless explicitly configured, authorized and reviewed.

## License

[MIT](LICENSE)
