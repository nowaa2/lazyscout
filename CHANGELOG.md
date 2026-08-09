# Changelog

All notable changes to LazyScout are documented in this file.

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
