# Changelog

All notable changes to LazyScout are documented in this file.

## [0.4.2] - 2026-08-13

LazyScout moves from a link crawler to a deterministic UI pattern explorer. No LLM, no machine learning, and no inference from an element's wording: a Test Case is written only from an HTML or ARIA contract the page declares, or from a state transition the explorer actually observed. Anything else becomes a manual review case carrying its evidence.

### Added

- **Deterministic pattern catalog** (`packages/core/src/patterns/catalog.ts`). Classifies 21 UI patterns — text, number and date inputs, checkbox, radio, switch, slider, select, combobox, file upload, link, navigation, pagination, button, submit, tab, accordion, menu, dialog opener, table — from role, tag, input type and ARIA attributes only. Each match records the attribute that decided it. An element that matches nothing is reported as `unknown`, which is a result rather than a failure.
- **Risk classification** ahead of every rule: `safe`, `needs-review`, `destructive`, `session-ending`. Destructive and session-ending controls are recorded as manual cases and never executed.
- **Pattern-specific Test Case rules** (`packages/generators/src/testcases/patternRules.ts`) replacing the single generic `interactionRule`. A tab asserts the panel named by its `aria-controls`; an accordion expands and collapses; a checkbox checks and unchecks against the native state; a select uses options collected from the page. When the assertion source is missing — a tab with no `aria-controls`, a select with no options — the rule degrades to `needs-review` instead of inventing an expectation.
- **Coverage report** on `AnalyzeResponse.coverage`: elements discovered, known patterns, tested, skipped, blocked, unknown, modal states, cases generated and deduplicated, plus a per-pattern breakdown and a reason for every element (`tested`, `skipped-limit`, `skipped-duplicate`, `blocked-destructive`, `blocked-session-ending`, `blocked-filter`, `unknown-pattern`, `not-visible`, `disabled`, `failed`).
- **Transition records** on `AnalyzeResponse.transitions`: URL, DOM fingerprint, visible dialogs, headings, added and removed text and validation messages before and after each executed action, with a result of `changed`, `unchanged`, `failed`, `blocked` or `timeout`. An `unchanged` action is precisely the case the generator refuses to write an expected result for.
- **Expanded element inventory.** The collector now gathers ARIA widgets and toggle-attribute controls that the native element groups missed, and records `aria-haspopup`, `aria-controls`, `aria-expanded`, `aria-selected`, `aria-checked`, `readonly`, `multiple`, `accept`, the owning container (form, dialog, table row, card, tab panel, menu) and the element's declared relationships.
- **Scoped modal exploration.** The explorer binds an opener to the container it declares, scopes collection to the topmost open dialog so the page behind it is not counted as modal content, records the modal as its own state with `parentStateId` and `depth`, and follows a dialog opened from inside a dialog up to `MAX_MODAL_DEPTH` (3).
- `fixtures/demo-site/patterns.html`, declaring one instance of every catalogued pattern plus an element that declares nothing and a destructive control, and [docs/PATTERNS.md](docs/PATTERNS.md) documenting which patterns are automatable and which always require review.
- 96 tests covering the catalog, every pattern rule, coverage accounting, and a browser-driven inventory run against the fixture.

### Changed

- `TestCaseType` accepts `navigation`, `interaction`, `accessibility` and `manual` alongside the existing values.
- `TestCase` carries optional `stateId`, `parentStateId`, `pattern`, `evidence[]` and `reviewReason`, so a case can be traced to the markup that justified it.
- Test Cases are deduplicated by pattern and step sequence before the per-page limit is applied.
- Pattern classification happens once, in `mapToPageModel`, so the explorer and the generator read the same result rather than each deriving one.

### Fixed

- The pattern matcher no longer treats the collector's internal bucket as a declaration by the page. A `<div onclick>` collected alongside buttons is classified `unknown`, not `button`.

### Compatibility

- Every new field is optional and `normalizeResult` tolerates their absence, so Projects saved before this release load unchanged. `AnalyzeResponse` and `TestCase` keep their existing shape.

### Release

- CLI, bundled web application, Node server and internal workspaces are aligned at version 0.4.2.

## [0.4.1] - 2026-08-13

### Added

- Validation matrix Test Case generation. Rules now derive negative and boundary cases from the HTML the Explorer collects: invalid email and URL formats, whitespace-only input, other writing systems, special characters, `minlength`, `maxlength`, `pattern`, `min`/`max`, and password composition rules. Cases whose behaviour the HTML cannot prove are generated as `needs-review` with a note rather than guessed at.
- Login failure Test Cases for recognised login forms — empty and invalid username, empty and invalid password — each generated as `needs-review` with a precondition warning against running them where a real account could be locked.
- Two Test Step types, `assertInvalid` and `assertValidation`, so a generated case can assert native constraint validation or wait for a server-rendered validation message instead of falling back to a manual step.
- The DOM collector now records `minlength`, `maxlength`, `min`, `max`, `step`, `pattern` and `autocomplete`, which is what the new rules read.

### Fixed

- **Scout stopped after the first page.** `analyze.ts` wired its abort signal to `request.raw`'s `close` event, which Node emits as soon as the JSON request body has been read — about 1 ms into the run — so every Scout aborted itself almost immediately. The listener now uses `reply.raw`, which closes when the response finishes or when the client actually disconnects. Introduced in `f3df742` and present in 0.3.7 through 0.3.11. Measured against `fixtures/demo-site`: 1 page → 2 pages, 5 → 27 Test Cases, 0 → 5 Test Data rows, 0 → 16 actions executed, and `endReason` from `browser-crash` to `queue-exhausted`.
- **Every page-structure Test Case failed to run.** The Playwright generator emitted `expect(page).toContainText(...)` for an `assertText` step with no target, but `toContainText` requires a Locator, so the run died with a multi-hundred-line object dump that filled the log budget. It now emits `expect(page.locator('body')).toContainText(...)`. One case per scouted page was affected, each marked `ready`. The Cypress generator already handled this case correctly.

### Security documentation

- Corrected the documented automation-runner security model. Since the switch to the real Playwright Test CLI, the runner writes the generated or edited source to a temporary `.spec.ts` and executes it unsandboxed with the privileges of the LazyScout process. README, README_TH, SECURITY, ARCHITECTURE, SAFETY, API, ROADMAP, CONTRIBUTING and the CLI README previously described a Playwright statement whitelist that fails closed on unsupported statements, which the runner no longer implements.
- Documented the actual trust boundary: the server binds to `127.0.0.1` and has no authentication, so reaching `POST /api/automation/run` is equivalent to code execution as the user running LazyScout. `LAZYSCOUT_MODE=public` changes only the Scout URL policy and does not sandbox the runner.
- Corrected the documented Explorer behaviour in SAFETY.md. It stated that the Explorer follows `href` links only and never clicks buttons; `scopedExplorer.ts` does click discovered navigation items, tabs, accordions and dialog triggers to build the state graph. It still never fills or submits forms.
- Documented that no destructive-action blocking is active by default. `UIElement.destructive` derives from the per-Project click filter, which is empty until an operator configures it, and `SUGGESTED_BLOCK_KEYWORDS` is a suggestion list rather than an enforced policy.
- Flagged that `isSessionEndingLabel()` and `isUnsafeAutoClick()` return `false` unconditionally after commit `c7fedf3`, leaving logout/sign-out protection and the click-safety branches in `automationRun.ts` and `guidedFlowRun.ts` inactive.
- Corrected the crawl-limit table: the whole-exploration timeout is 300 s (documented as 120 s) and the per-page navigation timeout is 25 s (documented as 20 s). Added the state, action, retry and per-action limits that were missing.
- No runtime behaviour changed in this entry; these corrections describe how the code already behaves.

- Documented behaviour verified by running the app against `fixtures/demo-site` rather than by reading the code: login-looking URLs (`/login`, `/signin`, `/auth`) end a branch through `isAuthLost()` even when no session existed, failed actions retry twice and are skipped, cancellation is honoured only between queue items, and `browser-crash` is a catch-all `endReason` for any error inside the crawl.
- Corrected the Test Case CSV header in `docs/API.md`. The real export has 14 quoted columns (`TC_ID, Folder, Title, Type, Priority, Test_Steps, Expected_Result, Automation_Status, Preconditions, Notes, Tags, Module, Requirements, Source_URL`); the documented header listed 10 in a different order.
- Rewrote `docs/user-guide.md` and the `#docs` guide on the marketing site around the observed workflow, including why an unauthenticated Scout of the 9-page demo site reaches only 2 pages.
- Corrected the site guide's safety list, which claimed destructive UI actions are blocked unless explicitly allowed. The opposite is true: they are allowed until a Project click filter is configured.

### Documentation language

- Converted `docs/SAFETY.md` and `docs/API.md` to English, matching the rest of `docs/`. `README_TH.md` remains the Thai translation. `docs/PUBLISHING.md` and `docs/TEST-CASE-MODEL.md` are still mixed-language.

### Repository

- Added `CLAUDE.md` with rules for AI coding agents working in this repository: keep scratch and verification artifacts out of the working tree, never stage with a wildcard, leave `git status --untracked-files=all` clean, and clean up background servers and `.lazyscout-run-*` temp directories. `.gitignore` now backs this with `scratch-*`, `*.scratch.*`, `*-tmp.mjs`, `*-probe.mjs`, `probe*.mjs` and `.lazyscout-run-*` patterns.

### Release

- CLI, bundled web application, Node server and internal workspaces are aligned at version 0.4.1.

## [0.3.7] - 2026-08-11

### Added

- A compact Guide link beside the LazyScout header brand that opens the hosted product documentation.
- A GitBook-style public guide covering Projects, Scout, authenticated sessions, Test Cases, Automation, API checks, Bug Reports, screenshots, Load Test, exports and local workspace files.
- Execution status in the Test Case table and Bug Report drafts for failed Playwright runs.

### Changed

- Scout confirmation, progress, API protection and terminal output layouts were refined for long-running local workflows.
- Public documentation screenshots are release-safe assets while Project screenshots and generated test artifacts remain ignored.

### Release

- CLI, bundled web application, Node server and internal workspaces are aligned at version 0.3.7.
- Demo fixtures remain outside the npm package and Cloudflare static-site deployment.

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
