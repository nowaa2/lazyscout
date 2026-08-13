# Safety & Security

## 1. What the Explorer does and does not do

Enforced in `packages/explorer/src/scopedExplorer.ts`, `safety.ts` and `packages/core/src/safety/blocklist.ts`.

The Explorer:

- follows same-origin `href` links, and **clicks a bounded set of discovered UI controls** — sidebar and navigation items, tabs, accordions and dialog triggers — in order to build the state graph
- **never fills or submits forms.** No `fill`, `type` or form submission is issued during exploration, so exploration cannot commit data through a form
- stays on the same origin and never leaves for an external domain
- skips non-page resources (`.pdf`, `.zip`, `.png`, …) and any protocol that is not `http:` or `https:`
- records every discovered interaction in the action graph, including the ones it chose not to execute

Controls flagged as destructive are **recorded rather than clicked** (`UIElement.destructive = true`) and become Test Cases with `automationStatus: "manual"`.

### Anything that looks like a login page stops exploration

`isAuthLost()` in `scopedExplorer.ts` treats the crawler as logged out whenever the current path contains `/login`, `/signin` or `/auth`:

```ts
return path.includes('/login') || path.includes('/signin') || path.includes('/auth')
```

It does not check whether a session ever existed. Any action that lands on such a path is rolled back and the target is never explored, **including on a site you were never signed in to**. Pages reachable only through a login link are therefore invisible to Scout.

Measured on the bundled 9-page demo site (`fixtures/demo-site`), an unauthenticated Scout reaches **2 pages**: `/` and `/register`. `/login` and everything behind it is rolled back with `Auth lost after action`, and `/products` fails its two retries. To reach the rest, use the authenticated workflow — **Project Settings → Open login browser**, sign in, then Scout again with **Start Path** set past the login page.

### Failed actions retry twice, then are recorded

An action that throws is retried up to `maxActionRetries` (2) and then recorded as a `failed` edge in the action graph. Exploration continues; a failed action does not end the run.

### What is actually blocked by default: nothing

This is the important caveat, and it is deliberate.

`UIElement.destructive` is computed by `isBlockedLabel(projectKeywords, …)` in `mapToPageModel.ts`, and **`projectKeywords` is empty for every Project until the operator configures a click filter.** An empty keyword list blocks nothing. A default Project therefore marks no control as destructive and the Explorer may click any discovered control.

The reasoning is recorded in `blocklist.ts`: a built-in blocklist used to cut off most of an application behind a login, and the crawler is meant to click what a tester would click. Blocking is opt-in per Project through **Project Settings → click filter**.

`SUGGESTED_BLOCK_KEYWORDS` is the list the UI offers as a starting point. It is a suggestion, not an enforced policy:

```
delete, remove, destroy, erase, drop, reset,
purchase, buy, checkout, pay, payment, transfer, withdraw, refund,
submit order, place order, confirm payment, confirm order,
deactivate, disable account, delete account, close account,
unsubscribe, cancel subscription, revoke access, reset database,
ลบ, ชำระเงิน, จ่าย, โอน, ซื้อ, สั่งซื้อ, ยืนยันการชำระ
```

> ⚠️ **Session-ending protection is currently inactive.** `isSessionEndingLabel()` and
> `isUnsafeAutoClick()` in `blocklist.ts` return `false` unconditionally — they were stubbed
> out in commit `c7fedf3` and `SESSION_ENDING_KEYWORDS` is now unused. As a result the
> Explorer may click Log out / Sign out, and the "click safety policy" branches in
> `automationRun.ts` and `guidedFlowRun.ts` are unreachable unless a Project click filter
> is configured. Add logout terms to the Project click filter if you need that protection.

## 2. Crawl limits

| Limit                       | Value                                                                                   | Enforced in                        |
| --------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------- |
| Max pages                   | 20                                                                                      | `config.limits` + `DEFAULT_LIMITS` |
| Max depth                   | 3                                                                                       | same                               |
| Max UI states               | 80                                                                                      | `analyze.ts` / `DEFAULT_LIMITS`    |
| Max actions per state       | 8                                                                                       | `DEFAULT_LIMITS`                   |
| Max total actions           | 200                                                                                     | `DEFAULT_LIMITS`                   |
| Action retries              | 2                                                                                       | `DEFAULT_LIMITS`                   |
| Per-action timeout          | 3 seconds                                                                               | `legacyOptions.actionTimeoutMs`    |
| Per-page navigation timeout | 25 seconds                                                                              | `legacyOptions.pageTimeoutMs`      |
| Whole-exploration timeout   | 300 seconds                                                                             | `explorationTimeoutMs`             |
| Loop prevention             | `Set` of normalized URLs + `Set` of state fingerprints, re-checked after every redirect |

`maxPages` and `maxDepth` accept a smaller value from the request and are clamped to these ceilings; they cannot be raised past them.

### Cancellation is coarse

The abort signal is checked once per queue item, at the top of the main loop in `scopedExplorer.ts`. A single queue item can run for tens of seconds (up to 8 actions, each with 2 retries and a 3-second action timeout), so a cancelled Scout stops at the **next state boundary**, not immediately. The browser is always closed in the `finally` block.

`endReason: "browser-crash"` is a catch-all: every exception escaping the main loop is reported under that name, whatever the real cause. Read `issues[]` for the actual error.

## 3. SSRF

> **Note:** since LazyScout is distributed as a CLI on npm, SSRF risk is largely moot —
> the browser runs on the user's own machine and the user types the URL themselves.
> There is no server of ours that can be tricked into reaching into someone's internal
> network. This section is retained for a possible future hosted version.

Users supply the URL, so all validation lives in **one place**: `packages/core/src/url/checkTargetUrl.ts`, which takes a `UrlPolicy`.

```ts
LOCAL_QA_POLICY // default: allows localhost + private IPs, the core purpose of a local QA tool
PUBLIC_SAAS_POLICY // hosted version: blocks localhost, private IPs and metadata endpoints
```

Switch policy through an environment variable without touching code:

```bash
LAZYSCOUT_MODE=public npm run dev:server
```

Blocked in every mode: protocols other than `http`/`https`, and cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`).

### Gaps to close before any online deployment

Validation currently inspects the **hostname only and does not resolve DNS**, so it does not stop DNS rebinding (a public domain that resolves to `127.0.0.1`). Before going online you must add:

1. DNS resolution with validation of every resolved IP
2. Re-validation after every redirect
3. Per-user rate limits, and a browser isolated in a machine or container with no access to internal networks

## 4. Automation runner

> **The runner executes real Playwright test code. It is not a sandbox.**

On Run, LazyScout writes the generated source — or the source edited in the Code Editor — to a temporary `.spec.ts` and spawns the real `@playwright/test` CLI as a child process. That file is ordinary TypeScript: the runner **does not restrict which statements it may contain**, and it executes with the same operating-system privileges as the LazyScout process.

This is deliberate. Running the genuine Playwright CLI is what makes generated code behave in LazyScout exactly as it will in your own test suite. It also means **the code in the editor is code you are about to execute** — review it the same way you would review any test file before running it.

Checks that do apply before a run:

- literal `page.goto('…')` URLs are validated against the active URL policy; a URL assembled from a variable at runtime is not checked
- `{{VARIABLE}}` placeholders are filled from Project Settings or environment variables, and an unconfigured variable fails the run
- lines calling `.click()` are matched against destructive labels and the Project click filter — a text heuristic over editor source, not a guarantee, and inert when no click filter is configured (see section 1)
- the Test Case is limited to 100 steps and the source to 200,000 characters

During a run:

- one worker, headless, 20 seconds per action, navigation and assertion
- at most 250 log lines; logs and errors pass through the shared redaction utility
- cancellation terminates the Playwright process tree
- Cypress is code generation only; the runner returns `unsupported`

### Trust boundary

The server packaged with the CLI binds to `127.0.0.1` and has **no authentication**. Anyone able to reach `POST /api/automation/run` can execute code as the user who started LazyScout. Accordingly:

- do not expose the LazyScout port through a tunnel, port forward or reverse proxy
- do not set `HOST` to a non-loopback address
- do not run LazyScout as a shared or multi-user service

`LAZYSCOUT_MODE=public` changes only the URL policy applied to Scout targets. It does not sandbox the runner and does not make the server safe to expose.

## 5. Saved authentication

A recorded sign-in is stored as a Playwright `storageState` at `projects/<id>/auth/storage-state.json`, written with owner-only permissions and covered by `.gitignore`. It contains real cookies, localStorage and — where the installed Playwright supports it — IndexedDB, so **treat the file as credential material**: it is enough to act as the signed-in user until the session expires.

- Only counts and timestamps are written to `auth/meta.json`, which is what the UI and the logs read. No cookie, token or header value is ever logged.
- The session is locked to one holder at a time. An application that rotates refresh tokens revokes the old one on every use, so two runs sharing a snapshot sign each other out; the second is refused instead.
- `Clear login session` removes both the snapshot and the browser profile.
- Delete the Project, or clear the session, when you are done with an environment. Nothing expires the file on its own.

## 6. API checks and Load Test

- API observations record method, redacted URL, status, duration and content type, and never capture request or response bodies
- API Checks run automatically for GET, HEAD and OPTIONS only
- POST, PUT, PATCH and DELETE are observation-only and must be verified by the Tester with an appropriate tool
- Load Test issues GET requests only, applies hard limits, and requires confirmation that the target may be tested

## 7. Credentials and artifacts

- Project Settings credentials stay in memory and are cleared on refresh
- Environment variables are the recommended way to supply credentials to the runner
- Projects, results, screenshots, Bug Reports, reports and logs live in the file-backed workspace, which is not an encrypted vault
- Screenshots, traces, videos, HAR files, API dumps and Bug evidence may contain sensitive data and must be redacted before sharing
- Common artifact directories are listed in `.gitignore`, but you must still review `git status` and `git diff --cached` before pushing
