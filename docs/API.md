# API

Base URL in development: `http://127.0.0.1:4000` (Vite proxies `/api` to it automatically). The packaged CLI serves the API and the UI together on `http://localhost:4321`.

All routes bind to loopback and have **no authentication**. See [SAFETY.md](SAFETY.md#trust-boundary).

## POST /api/analyze

Explores a website and generates draft Test Cases. Runs synchronously — there is no queue.

**Request**

```json
{ "url": "http://localhost:5173", "maxPages": 20, "maxDepth": 3 }
```

| field      | default    | range                                                                    |
| ---------- | ---------- | ------------------------------------------------------------------------ |
| `url`      | (required) | http/https — `localhost:5173` is accepted and `http://` is added for you |
| `maxPages` | 20         | 1–20                                                                     |
| `maxDepth` | 3          | 0–3                                                                      |

**Response 200**

```json
{
  "startUrl": "http://localhost:5500/",
  "origin": "http://localhost:5500",
  "pages": [{ "url": "...", "title": "Login", "inputs": [], "buttons": [], "links": [], "forms": [] }],
  "testCases": [{ "id": "TC-LOGIN-001", "module": "LOGIN", "steps": [] }],
  "testData": [
    {
      "id": "TD-LOGIN-001",
      "module": "LOGIN",
      "field": "Email",
      "inputType": "email",
      "required": true,
      "validValue": "qa.tester@example.com",
      "invalidValue": "invalid-email"
    }
  ],
  "issues": [{ "url": "...", "code": "http-error", "message": "The server responded with HTTP 404" }],
  "stats": { "pagesVisited": 6, "urlsSkipped": 1, "durationMs": 3420, "limitReached": "none" }
}
```

`issues` lists pages that could not be opened. They **do not fail the whole job** — the remaining pages are still explored.

If the HTTP client disconnects mid-run, the exploration is aborted and the browser is closed.

## POST /api/export/csv

Takes the Test Cases (and Test Data, if present) that the Tester edited in the UI and returns a CSV file.

```json
{
  "testCases": [{ "id": "TC-LOGIN-001", "...": "" }],
  "testData": [{ "id": "TD-LOGIN-001", "...": "" }]
}
```

Responds with `text/csv; charset=utf-8` and a UTF-8 BOM. Every value is quoted. One file contains two sections:

```
"TC_ID","Folder","Title","Type","Priority","Test_Steps","Expected_Result",
"Automation_Status","Preconditions","Notes","Tags","Module","Requirements","Source_URL"
...test case rows...
                                          ← blank separator line
"TEST DATA"                               ← second section header
"TD_ID","Module","Field","Input_Type","Required","Valid_Value","Invalid_Value","Note","Source_URL"
...test data rows...
```

`Test_Steps` holds the numbered steps of one Test Case in a single cell, separated by newlines.

`testData` is optional. Omit it and you get the Test Case section only.

## GET /api/health

```json
{ "status": "ok", "version": "0.4.6", "workspaceRoot": "C:\\Users\\Example\\LazyScout" }
```

## GET /api/versions

Returns the running version and up to 20 recently published versions from the npm Registry, for the Version Center shown before a Project is opened.

```json
{
  "packageName": "lazyscout",
  "currentVersion": "0.4.6",
  "latestVersion": "0.4.6",
  "updateAvailable": false,
  "registryAvailable": true,
  "versions": [{ "version": "0.4.6", "tags": ["latest"] }]
}
```

## POST /api/versions/install

Installs the selected LazyScout version globally. It accepts only a version number that exists in the npm Registry; the package name and command arguments are fixed by the application and never taken from user input.

```json
{ "version": "0.4.6" }
```

After installing, close the current terminal and run `lazyscout` again — the running process still holds the previous version's code.

## POST /api/automation/run

Writes the generated Playwright source for the structured Test Steps, or the edited source supplied in `code`, to a temporary `.spec.ts` and runs it with the real `@playwright/test` CLI in a child process.

> ⚠️ Source sent to this endpoint is executed as ordinary TypeScript with the privileges of the
> LazyScout process. There is no statement whitelist and no sandbox — see
> [SAFETY.md](SAFETY.md#4-automation-runner).

Main limits:

- 100 steps
- 200,000 characters of source
- 20 seconds per action
- 250 log lines
- the Cypress runner responds `unsupported`; Cypress is code generation only

Pre-run checks: literal `page.goto()` URLs are validated against the URL policy, `{{VARIABLE}}` placeholders are substituted (an unconfigured variable fails the run), and `.click()` lines are matched against destructive labels and the Project click filter.

Passing `projectId` saves the run log to `projects/<project-id>/logs/`.

## POST /api/automation/stop

Takes `{ "runId": "..." }` and terminates the running Playwright process tree.

## POST /api/api-check/run

Replays observed API requests for GET, HEAD and OPTIONS only, after the URL policy check. POST, PUT, PATCH and DELETE are blocked as review-only.

## POST /api/load-test/run

A small GET load test. Requires `confirmed: true`. Limits: at most 20 virtual users, 100 requests per user, an interval up to 10 seconds, and a 15-second timeout per request. Only the URL protocol is checked here, not the full URL policy.

## File Workspace API

The CLI creates the workspace at `~/LazyScout` before opening the UI, or uses the path given by `--workspace <path>`.

- `GET /api/workspace` returns the workspace path and the Projects loaded from disk
- `POST /api/workspace/open` opens the workspace in the operating system's file manager
- `PUT /api/workspace/projects/:projectId` saves a Project together with its JSON and CSV files
- `DELETE /api/workspace/projects/:projectId` moves a Project to `backups/`
- `GET/POST/DELETE /api/workspace/projects/:projectId/screenshots` manages user-captured screenshots
- `GET/PUT/DELETE /api/workspace/projects/:projectId/bugs` manages Bug Reports
- `GET/PUT /api/workspace/projects/:projectId/automation` manages hand-edited automation code
- `POST /api/workspace/projects/:projectId/reports` saves an HTML report

Project names, file names and paths are validated, and every path must resolve inside the workspace.

## Error format

Every error uses the same shape and **never includes a stack trace**.

```json
{
  "error": {
    "code": "connection-refused",
    "message": "Could not connect ...",
    "hint": "Check that the URL is correct ..."
  }
}
```

| code                 | HTTP | raised when                                                     |
| -------------------- | ---- | --------------------------------------------------------------- |
| `invalid-url`        | 400  | the URL is malformed or missing                                 |
| `blocked-url`        | 400  | unsupported protocol, cloud metadata host, or blocked by policy |
| `connection-refused` | 502  | the website is not running                                      |
| `dns-error`          | 502  | the domain could not be resolved                                |
| `ssl-error`          | 502  | the SSL certificate is not valid                                |
| `timeout`            | 502  | the page did not load in time                                   |
| `page-crash`         | 502  | the page crashed the browser                                    |
| `browser-error`      | 502  | `npx playwright install chromium` has not been run              |
| `internal-error`     | 500  | any other unexpected error                                      |
