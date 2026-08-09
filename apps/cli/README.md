# LazyScout

LazyScout is a local-first QA assistant that explores web applications, drafts test cases, and generates automation code for Playwright and Cypress.

> Stop rewriting QA work.

## Quick Start

Requires Node.js 20 or newer and Chrome, Edge or Playwright Chromium.

```bash
npx lazyscout@latest
```

LazyScout starts its UI on `http://localhost:4321` and opens it automatically.

If a supported browser is not installed:

```bash
npx playwright install chromium
```

## CLI scan

```bash
npx lazyscout@latest scan http://localhost:5173
npx lazyscout@latest scan https://example.com --max-pages 10 --csv report.csv --json raw.json
```

| Option            | Purpose                                                |
| ----------------- | ------------------------------------------------------ |
| `--csv <file>`    | CSV output path; defaults to `lazyscout-testcases.csv` |
| `--json <file>`   | Optional raw exploration output                        |
| `--max-pages <n>` | Maximum pages; defaults to 20                          |
| `--max-depth <n>` | Maximum same-origin link depth; defaults to 3          |
| `--port <n>`      | Local UI port; defaults to 4321                        |
| `--no-open`       | Start without opening the browser                      |

The current CLI command is `scan`; there is no `analyze` command.

## Available Features

- Playwright website and form exploration
- UI control, visible dialog and interaction discovery
- English/Thai Draft Test Cases and Test Data
- Test Case review, folders, tags and requirement links
- CSV/XLSX/JSON import and CSV export
- Screenshot OCR-assisted import
- Playwright and Cypress code generation
- Local Playwright execution with restricted statements, logs and screenshots
- Safe GET/HEAD/OPTIONS API checks
- Bug Reports with ZIP evidence export
- HTML/PDF Test Summary
- Confirmed local GET load test

Cypress is code generation only; the built-in local runner uses Playwright.

## Local-first Data

Browser automation runs on your machine. Projects, Test Cases, results, Bug Reports and screenshots are stored in the local browser. Credentials entered in Project Settings stay in memory for the current tab and are cleared on refresh. Environment variables are supported for local runner credentials.

Version Center contacts npm Registry to check available releases. LazyScout has no hosted account or Project database in the current version.

## Safety

Scouting is same-origin, follows links and blocks destructive labels. Edited automation is interpreted through a Playwright statement whitelist; it is not executed as arbitrary JavaScript or shell source.

> Never commit real test credentials, production data, browser authentication state, Playwright traces, screenshots, HAR files, or API dumps containing sensitive information.

> Use synthetic test data whenever possible.

> Review generated test cases and automation code before executing them against critical environments.

Generated Test Cases are drafts, not a replacement for QA judgment. Use DEV, UAT, sandbox or another authorized test environment before production.

## Documentation

- [GitHub repository](https://github.com/nowaa2/lazyscout)
- [Security policy](https://github.com/nowaa2/lazyscout/blob/main/SECURITY.md)
- [Thai README](https://github.com/nowaa2/lazyscout/blob/main/README_TH.md)
- [Issue tracker](https://github.com/nowaa2/lazyscout/issues)

## Author

Created by **nowzaa** — [GitHub profile](https://github.com/nowaa2)

## License

MIT
