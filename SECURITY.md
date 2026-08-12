# Security Policy

LazyScout opens browsers, observes network requests, handles optional test credentials, captures screenshots and runs approved local test actions. Treat it as a security-sensitive developer tool even though it runs locally.

## Reporting a Vulnerability

Please report vulnerabilities privately through [GitHub Security Advisories](https://github.com/nowaa2/lazyscout/security/advisories/new).

Do not open a public issue containing exploit details, credentials, tokens, customer data or sensitive test evidence. No security email is currently published for this project.

Include the affected version, operating system, reproduction steps and impact. Use synthetic data in the report whenever possible.

## Supported Versions

Security fixes target the latest published npm version. Upgrade through Version Center or run:

```bash
npm install -g lazyscout@latest
```

## Security Philosophy

- Apply least privilege to browsers, credentials, files and network access.
- Keep browser execution and Test execution local where possible.
- Do not add endpoints that take a shell command, and do not evaluate caller-supplied JavaScript inside the server process.
- Pass fixed executables and argument arrays to child processes.
- Mask secrets in logs and error messages.
- Do not upload Test artifacts automatically.
- Use synthetic Test Data whenever possible.
- Keep the server bound to loopback, and treat that bind as the boundary that the automation runner itself does not provide.

## Sensitive Data

Never commit, publish or attach real:

- usernames, passwords, API keys, access/refresh tokens or authorization headers
- cookies, session cookies, browser profiles or Playwright `storageState`
- production accounts, customer data, employee data or other PII
- database connection strings or local Project databases
- screenshots, videos, traces, HAR files, network dumps or API responses containing sensitive data
- Bug evidence, local Project data, device-pairing tokens or CLI authentication tokens

`.env.example` contains synthetic placeholders only. Put real values in local environment variables and keep `.env` ignored.

Project Settings credentials are memory-only and cleared when the page refreshes. Projects, Test Cases, results, Bug Reports, reports, logs and explicit screenshots are stored under the local LazyScout workspace. The workspace is not encrypted and must not be treated as a secret vault. Browser `localStorage` is limited to lightweight UI preferences after migration.

## Browser Automation Safety

Browser automation can change real data when a test clicks or submits a state-changing action. Use LazyScout against DEV, UAT, sandbox or another authorized test environment before production.

Scouting:

- validates HTTP/HTTPS Target URLs
- stays on the same origin
- follows safe links rather than submitting forms
- applies page, depth and time limits
- marks destructive actions as blocked/manual
- discovers UI interaction hints without automatically opening every state

The automation runner **executes real Playwright test code and is not a sandbox.** It writes the generated or edited source to a temporary `.spec.ts` and spawns the real `@playwright/test` CLI. That source is unrestricted TypeScript and runs with the same operating-system privileges as the LazyScout process, including module and filesystem access. Review code in the editor before running it, exactly as you would review any test file.

The runner does:

- validate literal `page.goto()` URLs against the active URL policy (URLs built at runtime are not validated)
- substitute `{{VARIABLE}}` placeholders and fail the run when one is unconfigured
- match `.click()` lines against destructive labels and the Project click filter, as a text heuristic
- limit source size, steps, time per action and log lines
- redact configured secrets from logs and errors
- support cancellation by terminating the Playwright process tree

The API Check runner automatically permits only GET, HEAD and OPTIONS. Observed POST, PUT, PATCH and DELETE requests remain review-only.

The Load Test runner performs GET requests only, applies hard limits and requires explicit authorization confirmation in the UI.

## Local Runner and Child Processes

LazyScout does not accept an API payload such as `{ "command": "..." }`.

Child processes are limited to:

- opening the local LazyScout URL with the operating system's browser launcher
- running the npm CLI through the current Node executable for an exact version verified against npm Registry
- running the Playwright Test CLI through the current Node executable on a spec file generated for the run

Executables and argument arrays are fixed by the application; no caller-supplied string becomes a command or an argument. Version input must match a published LazyScout version.

The spec file is the exception, and it is the important one: its **contents** come from the request. `POST /api/automation/run` therefore executes caller-supplied code by design.

### Trust boundary

The packaged server binds to `127.0.0.1` and has **no authentication**. Anyone able to reach `POST /api/automation/run` can execute code as the user who started LazyScout. Accordingly:

- do not expose the LazyScout port through a tunnel, port forward or reverse proxy
- do not set `HOST` to a non-loopback address
- do not run LazyScout as a shared or multi-user service

`LAZYSCOUT_MODE=public` changes only the URL policy applied to Scout targets. It does not sandbox the runner or authenticate the API, and it is not sufficient to expose the server.

Reports that the local API executes code are expected behaviour for a loopback-bound local tool, not vulnerabilities. Reports that this behaviour is reachable from another origin, another host, or without loopback access are in scope — please report those.

## Log Redaction

The shared redaction utility masks configured secret values and common fields including:

- `password`, `passwd`
- `token`, `access_token`, `refresh_token`
- `api_key`, `client_secret`, `secret`
- `Authorization: Bearer ...`
- `Cookie`, session fields and sensitive URL query parameters

Do not assume redaction can recognize every business-specific secret. Review logs before exporting or sharing them.

## Screenshots, Traces, Videos and HAR Files

Artifacts may contain credentials, form values, user records, internal URLs, network responses or personal data. Default ignore rules cover common artifact directories:

```text
playwright-report/
test-results/
traces/
videos/
screenshots/
har/
workspace/
local-data/
user-data/
```

Delete artifacts when they are no longer needed. Redact evidence before adding it to a Bug Report or sharing an exported ZIP.

## URL and SSRF Boundaries

Local mode intentionally permits localhost and private networks because that is a core QA use case. Cloud metadata endpoints are blocked.

`PUBLIC_SAAS_POLICY` blocks loopback and private hostnames, but the current implementation does not resolve DNS or prevent DNS rebinding. It is preparation for a future online architecture, not production-grade hosted isolation. Do not expose the local server publicly or deploy it as a multi-user service without additional network isolation, DNS/IP validation, redirect validation, authentication, rate limits and sandboxing.

## Before Committing or Publishing

```bash
git status
git diff --cached
npm run check:secrets
npm run release:check
```

`.gitignore` does not remove a secret already committed to Git history. If a real secret was committed, revoke or rotate it immediately and clean the history before publishing the repository.
