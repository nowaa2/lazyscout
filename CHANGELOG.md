# Changelog

All notable changes to LazyScout are documented in this file.

## [0.4.6] - 2026-08-13

### Fixed

**A saved login did not survive into a Scout or a Test run.** LazyScout relied on the Chromium profile directory alone and never used Playwright's `storageState` — a search of the whole repository found no use of it. A profile directory keeps cookies that carry a `Max-Age`, but session cookies live in memory and are gone the moment the browser closes, and that is exactly the kind of cookie most applications use to hold a refresh token. A run therefore started signed out and landed back on the sign-in page.

- The sign-in is now captured as a Playwright `storageState`: every cookie including the ones with no expiry, plus localStorage, plus IndexedDB where the installed Playwright supports the option. sessionStorage is captured and restored separately because `storageState` never includes it.
- Capture happens on an explicit request after the sign-in has settled, not when the URL changes. `waitForAuthSettle` polls for a stable cookie signature so an application that redirects, exchanges a code and only then sets its real cookie is not captured half signed-in. No fixed sleep is used.
- Scout, the Recorder and the Test runner all restore the snapshot, preferring it over the profile directory. This also removes the profile-directory lock that used to stop two LazyScout browsers from running for one Project.
- The snapshot lives at `projects/<id>/auth/storage-state.json` with owner-only permissions, and is covered by `.gitignore`. Only counts and timestamps are written to `auth/meta.json`; no cookie, token or header value is ever logged.

**`auth-session/status` reported a directory, not a login.** `profileExists` was true whenever the folder existed, which said nothing about whether the session still worked. Status is now `not-configured`, `recorded`, `verifying`, `ready`, `expired` or `invalid`, and `ready` is only reachable through `POST /auth-session/verify`, which opens a protected path with the snapshot restored and downgrades to `expired` when the application redirects to a sign-in page.

**Signing in and executing used different browsers.** The login window was headed while the Recorder, Scout and the runner were headless, so an application that ties a session to the browser it was issued to would reject the reused one. All four now share one mode from `config.headless`; set `LAZYSCOUT_HEADED=1` to run everything visibly. A snapshot captured in a different mode is reported through `browserModeMismatch` rather than failing silently. No fingerprint is spoofed.

**The login window opened invisibly.** Making every flow share one browser mode was applied too broadly: the sign-in window followed `config.headless`, which defaults to headless, so **Open login browser** appeared to do nothing and there was no way to type credentials. That window is now always visible, because a person has to use it. Consistency is still enforced, but by reporting `browserModeMismatch` on the snapshot rather than by hiding the window.

**An abandoned sign-in locked the Project with no way out.** The lock is taken when the sign-in window opens and released on capture, so a sign-in that was never completed — the window closed, or nothing visible appeared — held the Project for the full fifteen-minute stale timeout with nothing in the interface able to free it. Pressing **Open login browser** again now replaces a window this server already owns instead of refusing, closing the window releases the lock, and a **Cancel sign-in** button gives the hold back explicitly.

**Clearing the session failed with a raw EBUSY.** Confirming a clear while the sign-in window was still open tried to delete a profile directory that Chromium had files open in, so the request died with `500 EBUSY: resource busy or locked` and the Project was left half cleared. The window is closed first, the snapshot — the part that actually authenticates — is removed unconditionally, and the profile directory is best-effort with retries; when files really cannot be removed the response says so instead of failing.

**Capture reported success while still holding the lock.** The window was closed and the lock released in a `finally` that ran after the response had been sent, so pressing **Verify** immediately after **Capture** was rejected as busy by a lock that was about to disappear. Cleanup now completes before the reply.

**Capture became unavailable after closing the dialog.** Whether a sign-in window was open was tracked only in component state, so reopening Project Settings disabled **Capture session** even though the window was still waiting. The server reports it instead.

**Verify defaulted to `/`.** Almost no site protects its root, so the default path would have reported a working session that did not exist. The field now starts empty and Verify stays disabled until a path is entered.

**The test suite failed at random.** Several suites drive a real Chromium and a few of those also start the Playwright CLI, which starts another; fanned out across every core the machine ran more browsers than it could schedule and the timing-sensitive ones intermittently timed out. Worker count is capped at two and the timeouts raised, so a failure means the code is wrong rather than the machine being busy. A first attempt capped at four survived three standalone runs but still failed inside `release:check`, where the preceding steps leave the machine loaded; two consecutive `release:check` runs pass at two.

### Added

- **A Browser Session tab that drives the whole flow.** Open the login browser, **Capture session**, then **Verify** against a protected path. Capture stays disabled until a login browser has been opened and Verify until a session exists, so the order cannot be got wrong. The panel shows the real state with a coloured banner, when it was captured or last verified, and counts of cookies, session cookies, origins, sessionStorage origins and whether IndexedDB was included — counts only, never a value. It warns when a snapshot was captured in a different browser mode from the one runs use, and when the session is held by another Scout, recording or run.
- An auth-profile lock. An application that rotates refresh tokens revokes the old one on every use, so two runs sharing one snapshot sign each other out and a server that spots the reuse may revoke the whole token family. A Scout, recording or Test run now holds the Project's session exclusively and a second one is refused with an explanation. The lock is a file carrying a pid and a timestamp, so it holds across processes and a crashed holder cannot block the Project.
- `POST /api/workspace/projects/:id/auth-session/capture` and `.../auth-session/verify`. Clearing the session now removes both the snapshot and the browser profile.
- `[Auth]` progress logs through capture, restore, verification and ready, carrying no secret values.

### Changed

- **The settings tab strip is about half its former height.** Each tab was a two-line block with a subtitle, which made the strip taller than some of the sections it labelled. Tabs are now a single centred line at 34px each, and the description moved into the tooltip where it stays available to a screen reader through `aria-label`.
- **The settings dialog keeps one height on every tab.** It used to resize as sections changed — 755px on Credentials down to 474px on Browser Session — so the footer jumped under the cursor. Credentials is the tallest section and now sets the height for all of them at 752px; shorter sections leave space and taller ones scroll inside the same frame. The height belongs on the card rather than on the body, because the body is a flex child whose own sizing ignores `height`.
- **The Browser Session panel was rearranged.** The status banner sat wider than everything around it because each block carried its own margins; the panel is one padded column now. What the snapshot contains moved up beside the status it describes, where it had been pushed off the bottom edge. The walkthrough only shows before a session exists, warnings are a quiet strip rather than a third coloured box, and the housekeeping actions sit below a divider apart from the ones that drive the flow.
- **Save credentials and Clear secrets appear on every tab.** They used to exist only on Credentials, so typing a password and switching tabs silently discarded it. Save is disabled until something actually changes, shows a `Saved` confirmation, and no longer closes the dialog, so a credential can be saved and the session configured in one visit.
- **Test files are no longer tracked in Git.** `**/*.test.ts` and `**/*.spec.ts` are gitignored without exception, by the owner's decision, and the 21 previously committed test files have been untracked. They remain on the developer's disk and still run under `npm test`; a fresh clone simply has none, which is why `npm test` now passes with `--passWithNoTests` so `release:check` stays green on a clean checkout. The rule and its consequences are recorded in [CLAUDE.md](CLAUDE.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

### Known limitations

- Refresh-token rotation is not solved by a snapshot. When an application issues a new token on every request and revokes the previous one, any saved state is stale by definition; the lock prevents two runs from accelerating the failure but does not remove the cause. Signing in fresh per run, or obtaining a session through an API login and restoring that, remains the reliable approach.
- The capture, verify and clear endpoints have no buttons in the web UI yet.
- A recorded login Test Case still cannot be replayed while a session is saved, because the application skips the sign-in form. Clear the session first.
- A snapshot never expires on its own.

## [0.4.4] - 2026-08-13

### Fixed

Collapsed sidebar sections were effectively invisible to the crawler. Three separate causes, found by crawling a new fixture (`fixtures/demo-site/sidebar.html`) that mirrors how real applications build a sidebar: links wrapping several layers of `div`, sections that start collapsed and nest, labels repeated across sections, and an icon-only entry.

- **Sidebar discovery used its own text extraction.** `discoverNavigationRegions` read `textContent`, which glues block siblings together, so an entry rendered as an icon beside a label became `"•Overview"` and no role locator matched. It now applies the same accessible-name rules as the collector, and carries the recorded CSS selector as a fallback.
- **Links inside a collapsed section were offered as actions, failed, and were then blacklisted.** A hidden link cannot be clicked, and because a failed action is remembered globally it was skipped again in the state where the section had been expanded and the link was finally reachable. Hidden entries are no longer offered, and a navigation action's id is now scoped to its state so failing in one state cannot blacklist it in another.
- **In-page state was never restored.** `restoreState` accepted the entry flow but ignored it, so navigating away and returning collapsed every section. Every action after the first in an expanded state then targeted a control that was no longer on screen. The actions that opened a state are now replayed after a `goto` or `reload` restore, and when a queued state is picked up whose fingerprint no longer matches the live page. Replay is skipped entirely for flows that are pure navigation, so ordinary sites pay nothing for it.

Measured on the new fixture, with routes only reachable by expanding a section: **5 of 10 routes → 9 of 10**, and failed actions from 6 to 0 at equal budget.

### Known limitation

Routes behind a section nested inside another collapsed section are still missed. Restoring a two-level in-page state is not yet reliable, so those entries are discovered but their navigation is not executed.

## [0.4.3] - 2026-08-13

### Fixed

- **Links wrapping nested `div`s were never reached.** The collector built an element's accessible name from `textContent`, which glues block siblings together with no separator: `<a><div>Icon</div><div>Orders</div></a>` produced `"IconOrders"` where the browser computes `"Icon Orders"`. Every `getByRole(role, { name })` locator built from that name matched nothing, so the pattern common to sidebar and card menus — `li > a` wrapping nested `div`s — failed on every action. The collector and the recorder now build the name the way the accessible name algorithm does, inserting a space around each non-inline descendant, skipping hidden subtrees, and using an image's `alt` in place of its children. A test asserts the result against the name Chromium itself resolves, across nine markup shapes.
- **The crawler had no locator fallback.** `executeWithRetry` built one `getByRole` locator from the accessible name and gave up when it missed. Link and interaction candidates now also carry their recorded CSS selector, and the executor tries test id, then role with `exact`, then role without `exact`, then the recorded selector, using the first that resolves. The missing `exact` also meant a name that is a substring of another matched several elements and failed on strict mode.
- **`<details>` accordions could not be expanded.** The action targeted the `<details>` element, which does nothing on click; it now targets the `<summary>` that actually toggles it.

Measured against `fixtures/demo-site`: 2 pages → 7 pages, 23 → 67 Test Cases, 16 → 56 actions executed, and failed actions down from 4 to 1.

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
