# Working in this repository

Notes for AI coding agents (Claude Code and similar). Human contributors: see [CONTRIBUTING.md](CONTRIBUTING.md).

## Test files are never committed

**No test file goes into Git.** `**/*.test.ts` and `**/*.spec.ts` are gitignored with no exceptions, by the owner's decision.

This does not mean "do not write tests". Write them exactly as you would otherwise — they run from the developer's disk and `npm test` picks them up. They are simply never staged, never pushed, and never restored by re-adding a negation to `.gitignore`.

What follows from it:

- Do not `git add -f` a test file, and do not add a `!` negation to bring one back.
- A fresh clone has no test suite, which is why `npm test` runs with `--passWithNoTests`. Leave that flag in place or `release:check` fails on a clean checkout.
- Verification still has to happen before you report work as done. Run `npm test` locally and report the real numbers.
- Behaviour a test would have protected must instead be described in `CHANGELOG.md`, so the reasoning survives even though the test does not travel with the repository.

## Scratch and verification artifacts must never be committed

Verifying a change here often means writing a throwaway script — a probe that calls `exploreWithScope` directly, a Fastify snippet that checks an event's timing, a JSON dump of a Scout result. **None of it belongs in the repository or in a commit.**

The rules, in priority order:

1. **Write scratch files outside the repo.** Put them in the agent scratchpad or the OS temp directory. A file that never enters the working tree can never be committed by accident.

2. **If a scratch file must live in the repo** — usually to resolve workspace imports such as `@lazyscout/explorer` — give it a name matching `scratch-*` or `*.scratch.*`. Those patterns are gitignored. Delete it in the same turn you created it; do not leave it for later.

3. **Never stage with a wildcard.** No `git add -A`, `git add .`, or `git commit -a`. Stage the specific files the task changed, by path. A wildcard is how a scratch file reaches a commit.

4. **Leave the tree clean.** Before reporting a task finished, run:

   ```bash
   git status --untracked-files=all
   ```

   Anything untracked that you created must be gone or deliberately gitignored. "I'll clean it up later" means it ships.

5. **Clean up what runs, too.** Stop background servers you started, and remove temp directories your runs left behind. The Playwright runner creates `.lazyscout-run-*` directories under `node_modules/@playwright/test/`, and a run that is killed mid-flight leaves its directory behind:

   ```bash
   find node_modules -maxdepth 4 -name ".lazyscout-run-*" -type d -exec rm -rf {} +
   ```

6. **Never commit a Scout result or run evidence.** Test Cases, CSV exports, screenshots, traces, HAR files and Project folders produced while exercising the app are QA evidence, not source. They may also contain real URLs and form values. `.gitignore` covers the common paths, but check anything you generated before staging.

Generated Playwright and Cypress specs are already ignored through `**/*.spec.ts` and `**/*.test.ts`; the project's own tests are re-included by explicit `!packages/*/tests/**` and `!apps/*/tests/**` rules. Do not weaken those negations to make a new test file visible — put the test in `packages/<pkg>/tests/` or `apps/<app>/tests/` where it belongs.

## Running the app to verify a change

Do not assume a port is free. The developer often has LazyScout already running on `4000`, and the dev server does **not** fall back to another port — it exits with `EADDRINUSE`. Check the server actually started before trusting what you measure against it, or you will be driving someone else's instance.

```bash
node fixtures/serve.mjs                    # demo site on :5500
PORT=4100 npm run dev:server               # API on a port of your own
npm run dev:web                            # Vite on :5173, proxies /api
```

Point `LAZYSCOUT_WORKSPACE` at a temporary directory so a verification run cannot touch the developer's real Projects under `~/LazyScout`:

```bash
LAZYSCOUT_WORKSPACE=/tmp/lazyscout-verify PORT=4100 npm run dev:server
```

`POST /api/analyze` writes nothing to the workspace; saving a Project does. Prefer read-only endpoints when verifying.

Stopping a background task may not kill the Node child holding the port. Confirm with `netstat -ano | grep :<port>` and kill the PID directly if needed.

## Before reporting a change complete

```bash
npm run format:check
npm run typecheck
npm test
git status --untracked-files=all
```

`npm run release:check` runs the full gate including `check:secrets`, the build and `npm pack --dry-run`.

## Documentation must match the code

This repository has repeatedly drifted: docs described a Playwright statement whitelist for months after the runner switched to executing real test code, and described an Explorer that never clicks buttons when it does. When you change runtime behaviour, update the docs that describe it in the same change — `README.md`, `README_TH.md`, `SECURITY.md`, `docs/SAFETY.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/user-guide.md` and the guide in `apps/site/public/index.html`.

Do not translate a claim you have not verified. If a document states a limit, a timeout or a safety guarantee, confirm it against the source before restating it.
