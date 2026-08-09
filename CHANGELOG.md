# Changelog

All notable changes to LazyScout are documented in this file.

## [0.3.0] - Unreleased

### Added

- File-backed workspace created automatically at `~/LazyScout`
- Per-Project JSON, CSV, automation, screenshots, Bug Reports, reports and run logs
- `--workspace <path>` override and an Open Workspace Folder action
- Automatic migration of existing browser-local Projects, screenshots, Bug Reports and edited automation
- Recoverable Project deletion by moving the Project directory into `backups`

### Changed

- Browser `localStorage` is limited to lightweight UI preferences
- Playwright screenshots are captured only when edited code explicitly calls `page.screenshot()`

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
