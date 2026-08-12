# Architecture

LazyScout is an npm-distributed local application built as an npm workspace monorepo. The published package is `apps/cli`; its build bundles the server and workspace packages and copies the compiled web UI into `dist/web`.

## Components

```text
apps/web          React UI, local Project state, editors and reports
    ↓ /api
apps/server       Fastify routes, limits and local runner orchestration
    ↓
packages/core     Shared types, URL policy, redaction and Test Case model
packages/explorer Playwright browser launch, crawl and DOM collection
packages/generators Draft Test Cases, Test Data, CSV, Playwright and Cypress code
    ↓
apps/cli          Published npm command and static UI server
```

## Main Data Flow

```text
Target URL
  ↓ POST /api/analyze
URL policy validation
  ↓
Playwright same-origin link crawl
  ↓
PageInfo[] + action graph + API observations
  ↓
Draft Test Cases + Test Data
  ↓
File-backed Project workspace under `~/LazyScout`
  ↓
Review / import / CSV / reports / generated automation
```

## Workspace Packages

### `packages/core`

- framework-independent Page, Test Case, Test Data and API types
- local/public URL policies
- URL normalization and validation
- state fingerprints
- shared sensitive text and URL redaction

### `packages/explorer`

- Playwright browser selection
- breadth-first same-origin link crawl
- page/depth/time limits
- DOM collection and accessible control metadata
- destructive-action classification
- visible state and interaction discovery
- XHR/fetch metadata observation without response-body capture

### `packages/generators`

- rule-based Draft Test Cases and Test Data
- UTF-8 CSV export
- Playwright code generation
- Cypress code generation

## Applications

### `apps/server`

Fastify exposes fixed routes for analysis, CSV export, Playwright execution, cancellation, API checks, GET load tests and npm version management. It does not expose an endpoint that takes a shell command, and it does not evaluate caller-supplied JavaScript inside the server process with `eval` or `new Function`.

Automation runs go through `playwrightCliRunner.ts`, which writes the generated or edited source to a temporary `.spec.ts` and spawns the real `@playwright/test` CLI. That spec is unrestricted TypeScript executed in a child process with the server's own privileges — the runner is a fidelity mechanism, not a sandbox. Pre-run checks are limited to literal `page.goto()` URL policy validation, `{{VARIABLE}}` substitution, a destructive-label heuristic over `.click()` lines, and size limits. See [SAFETY.md](SAFETY.md#4-automation-runner).

### `apps/web`

The React UI provides Projects, dashboards, Test Case/Test Data review, imports, code generation, logs, screenshots, Bug Reports, reports and Version Center.

Projects, Test Cases, CSV backups, screenshots, Bug Reports, reports, edited automation and run logs use the file-backed LazyScout workspace. The CLI creates the workspace before serving the UI. Project Settings credentials remain in React memory and are cleared by a refresh; browser `localStorage` is reserved for lightweight UI preferences and one-time migration.

### `apps/cli`

The published `lazyscout` command supports:

```text
lazyscout
lazyscout serve
lazyscout scan <url>
lazyscout --help
lazyscout --version
lazyscout --workspace <path>
```

`build.mjs` bundles server/workspace code with esbuild, injects the CLI package version and copies the Vite build.

## Security Boundaries

- The packaged server binds to `127.0.0.1`.
- Scout navigation is HTTP/HTTPS and same-origin.
- Local mode intentionally allows localhost/private networks.
- Cloud metadata hosts are blocked.
- Public mode blocks obvious private/loopback hostnames but still requires DNS-level hardening before hosted use.
- Automation logs pass through shared redaction.
- Automation code runs unsandboxed in a Playwright CLI child process; the loopback bind and the absence of any exposed port are the actual boundary, and the local API has no authentication.
- Automatic API checks allow GET, HEAD and OPTIONS only.
- npm installation accepts only exact published LazyScout versions and launches npm through Node with an argument array.

See [SECURITY.md](../SECURITY.md) and [SAFETY.md](SAFETY.md).
