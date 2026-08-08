# Authentication for local automation

LazyScout does not save passwords or tokens in the browser, project localStorage, Test Case JSON, CSV, or generated logs.

Set secrets in the server environment before running automation:

```powershell
$env:LAZYSCOUT_TEST_EMAIL = "tester@example.com"
$env:LAZYSCOUT_TEST_USERNAME = "tester"
$env:LAZYSCOUT_TEST_PASSWORD = "use-a-local-secret"
$env:LAZYSCOUT_API_TOKEN = "token-for-local-api-checks"
npm.cmd run dev:server
```

Use placeholders in editable Test Case steps when a secret is needed:

```text
{{TEST_EMAIL}}
{{TEST_USERNAME}}
{{TEST_PASSWORD}}
{{API_TOKEN}}
```

The runner resolves these values only inside the server process. Logs show the field name and never print the secret value. If a required secret is missing, the case fails with a configuration message instead of guessing a value.

For API checks, `LAZYSCOUT_API_TOKEN` is sent as `Authorization: Bearer <token>` when the observed API is marked `needs-auth`.

Cloudflare and human-verification challenges are detected and marked for manual review. LazyScout does not bypass them.
