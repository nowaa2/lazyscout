# Changelog

All notable changes to LazyScout are documented in this file.

## [0.3.6] - 2026-08-11

### Added

- Project-level Test Case language preference. Scout and Screenshot imports remember the selected language per project without changing existing Test Case content.
- Screenshot OCR line selection and draft preview before creating Test Cases from an image.
- CSV exports retain the canonical Module, Requirements and Source URL fields so suites can be imported again without losing traceability data.

### Changed

- Web, API and CLI Scout flows now use the same scoped explorer behavior for page, scope and site exploration.
- New Projects enable click safeguards with suggested destructive-action keywords by default.

### Security

- Session-ending controls such as Logout / Sign out / ออกจากระบบ are always blocked from automated clicks, including edited Playwright source.

## [0.3.3] - 2026-08-10

### Added

- Exploring an application behind a login: Scout now runs in the Project browser profile, so the session left by Open login browser is the session it explores with. It used to open a blank browser and be redirected back to the login page on every URL
- Menus that route through a click handler instead of an `<a href>` are followed. Scout clicks the controls on a page, and where a click lands somewhere new on the same site, that page joins the crawl — which is how the screens behind a login are reached at all
- `maxNavigationProbesPerPage` bounds how many controls are tried per page, default 6

### Changed

- The bot now clicks every control it finds. The built-in list of "destructive" words was blocking ordinary navigation — `publish`, `approve`, `archive`, `send`, `บันทึก` and `ยกเลิก` cut off most of an application behind a login
- A Project decides for itself what must never be clicked, through a Click filter in Project Settings. It is off by default, takes one word per line, and offers the old list as a starting point
- The filter applies to Explorer, generated Test Cases and Automation runs alike

### Fixed

- Recording a flow: after saving or discarding a recording, reopening Project Settings showed the finished recording again and offered to save it as a second Test Case. The server now forgets a session once it is dealt with
- Edited automation source rejected `page.getByRole('button', { name: 'Login' })`. Single-quoted strings — the form Playwright documents — matched nothing in the parser, so only the double-quoted code LazyScout generates itself would run
- `page.getByTestId("…")` was missing from the edited-source parser
- `.first()`, `.last()` and `.nth(n)` are accepted after a locator, so a selector that resolves to several elements can be narrowed
- An unsupported locator now explains which forms are accepted instead of only naming the expression it rejected

### Repository

- Regression tests for the locator resolver covering CSS, `data-testid`, role, single-quoted and malformed input, including a check that a malformed locator is never executed as code
- Locator tracing behind `LAZYSCOUT_DEBUG_LOCATOR=1`, redacted through the existing secret filter

## [0.3.2] - 2026-08-09

### Added

- Flow recorder: open a browser from Project Settings, and your own clicks and typing become Test Steps that save as a Test Case and replay through the existing Playwright runner
- Recording follows a popup window, so an SSO consent screen is captured
- A recorded flow ends with a URL assertion when the last action navigated, so a login test can fail when the credentials are rejected
- Open login browser: sign in once in a per-Project browser profile and reuse that session in later runs
- UI state exploration beyond page navigation: validation messages, dialogs, tabs and accordions are distinguished as separate states
- Continuous integration running the secret, format, typecheck, test, build and pack checks
- Unit tests for the recorder, its session lifecycle and its popup handling

### Fixed

- Clear secrets left the fields on screen and Save wrote the old values straight back
- Closing the recording browser left the session running and the interface polling
- Long Project names and URLs overflowed the sidebar instead of being shortened
- Buttons in Project Settings had no spacing, and Open login browser was stretched out of shape

### Security

- A password field is never read while recording; the step stores the {{TEST_PASSWORD}} placeholder
- The closing URL assertion keeps only the path, so a GET login form cannot write the typed password into a Test Case

### Repository

- The project's own unit tests were excluded by an ignore rule meant for generated test code, so a fresh clone had no tests and `npm test` still reported success

## [0.3.1] - 2026-08-09

### Added

- File-backed workspace created automatically at `~/LazyScout`
- Per-Project JSON, CSV, automation, screenshots, Bug Reports, reports and run logs
- `--workspace <path>` override and an Open Workspace Folder action
- Automatic migration of existing browser-local Projects, screenshots, Bug Reports and edited automation
- Recoverable Project deletion by moving the Project directory into `backups`

### Changed

- Browser `localStorage` is limited to lightweight UI preferences
- Playwright screenshots are captured only when edited code explicitly calls `page.screenshot()`
- Project deletion switches the interface immediately and safely waits for pending writes
- Server, CLI, API, URL validation, Explorer messages, and hardcoded English UI copy are in English
- Version Center shows the latest three published releases

## [0.2.0] - 2026-08-09

### Added

- Local Project workspaces with dashboard views and configurable charts
- Test Case folders, tags and requirement traceability
- CSV/XLSX/JSON Test Case import and screenshot OCR-assisted import
- Playwright and Cypress code generation with a Monaco-based editor
- Local Playwright Run Viewer, cancellation, logs and screenshots
- Optional API observation and safe API checks
- Bug Reports with image evidence and ZIP export
- HTML/PDF Test Summary export
- Confirmed GET load test with per-request results
- npm Version Center in the startup Project dialog
- English/Thai language selection

### Security

- Restricted edited Playwright execution to a statement whitelist
- Added shared log and URL redaction
- Made Project Settings credentials memory-only
- Restricted automatic API checks to GET, HEAD and OPTIONS
- Added artifact ignore rules and a lightweight repository secret check
- Updated static file serving and replaced the vulnerable `xlsx` package with a maintained XLSX reader

## [0.1.0]

### Added

- Playwright same-origin Website Explorer
- Normalized Page and Test Case models
- Rule-based Draft Test Case and Test Data generation
- Test Case review UI
- CSV export with UTF-8 support
- Local web UI and `scan` CLI command
