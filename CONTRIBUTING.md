# Contributing to LazyScout

Thank you for helping improve LazyScout.

## Workflow

1. Fork `nowaa2/lazyscout` on GitHub.
2. Create a focused branch from the default branch.
3. Install dependencies and Playwright Chromium.
4. Make the smallest change needed for the issue.
5. Format, test and build before opening a Pull Request.

```bash
git clone https://github.com/<your-account>/lazyscout.git
cd lazyscout
npm install
npx playwright install chromium
git switch -c fix/short-description
```

Run development servers in separate terminals:

```bash
npm run dev:server
```

```bash
npm run dev:web
```

## Validation

```bash
npm run format
npm run typecheck
npm test
npm run build
npm run check:secrets
```

Use `npm run release:check` when changing package or release behavior.

## Pull Requests

- Explain the problem and the behavior change.
- Keep unrelated refactors out of the Pull Request.
- Add or update tests for behavior changes where practical.
- Update user-facing documentation when commands, limits or safety behavior change.
- Do not weaken URL checks, destructive-action blocking, run limits or log redaction without a documented security review.
- Keep scratch and verification artifacts out of the Pull Request: throwaway probe scripts, Scout result dumps, exported CSVs, screenshots and Project folders. Stage files by path rather than with `git add -A`, and confirm `git status --untracked-files=all` is clean. AI agents working in this repository follow [CLAUDE.md](CLAUDE.md), which spells this out.
- Do not bind the server to a non-loopback address or add an endpoint reachable off-host. The automation runner executes unsandboxed test code, so the loopback bind is the security boundary.
- Confirm that generated and edited Test Cases remain drafts requiring Tester review.

## Sensitive Data

Do not include real credentials, tokens, browser sessions, customer Test Data, production URLs, screenshots, traces, HAR files, API dumps or other sensitive evidence in a Pull Request.

Use synthetic values such as `qa@example.com`, `Example User` and `replace_me`.

Before pushing:

```bash
git status
git diff --cached
npm run check:secrets
```

If a real secret was committed, rotate it immediately. Adding it to `.gitignore` does not remove it from Git history.
