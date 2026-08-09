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
Browser-local Project workspace
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

Fastify exposes fixed routes for analysis, CSV export, Playwright execution, cancellation, API checks, GET load tests and npm version management. It does not expose an arbitrary command endpoint.

Edited Playwright source is interpreted through a statement whitelist. The server does not evaluate it with `eval` or `new Function`.

### `apps/web`

The React UI provides Projects, dashboards, Test Case/Test Data review, imports, code generation, logs, screenshots, Bug Reports, reports and Version Center.

Projects, Test Cases, results, screenshots and Bug Reports use browser `localStorage`. Project Settings credentials remain in React memory and are cleared by a refresh.

### `apps/cli`

The published `lazyscout` command supports:

```text
lazyscout
lazyscout serve
lazyscout scan <url>
lazyscout --help
lazyscout --version
```

`build.mjs` bundles server/workspace code with esbuild, injects the CLI package version and copies the Vite build.

## Security Boundaries

- The packaged server binds to `127.0.0.1`.
- Scout navigation is HTTP/HTTPS and same-origin.
- Local mode intentionally allows localhost/private networks.
- Cloud metadata hosts are blocked.
- Public mode blocks obvious private/loopback hostnames but still requires DNS-level hardening before hosted use.
- Automation logs pass through shared redaction.
- Edited code uses supported Playwright statements only.
- Automatic API checks allow GET, HEAD and OPTIONS only.
- npm installation accepts only exact published LazyScout versions and launches npm through Node with an argument array.

See [SECURITY.md](../SECURITY.md) and [SAFETY.md](SAFETY.md).
