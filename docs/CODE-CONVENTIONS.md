# Code Conventions

## Documentation policy

LazyScout keeps product and architecture documentation in `docs/` rather than
embedding explanatory comments throughout source files. This keeps application
code focused on behaviour and makes documentation easier to find and maintain.

Use these documents as the source of truth:

| Topic | Document |
| --- | --- |
| System structure and package ownership | [ARCHITECTURE.md](ARCHITECTURE.md) |
| API contracts | [API.md](API.md) |
| Test Case model and generation rules | [TEST-CASE-MODEL.md](TEST-CASE-MODEL.md) |
| Authentication and local credentials | [AUTHENTICATION.md](AUTHENTICATION.md) |
| Explorer safety and URL policy | [SAFETY.md](SAFETY.md) |
| Release and distribution | [PUBLISHING.md](PUBLISHING.md) |
| Product direction | [ROADMAP.md](ROADMAP.md) |

## Source files

- Do not add explanatory line comments or block comments to application code.
- Prefer clear names, small functions, focused components, and explicit types.
- Add a Markdown document when behaviour, constraints, or a design decision
  needs explanation beyond what the code can communicate.
- Keep comments inside generated automation output only when they are part of
  that output's intended user-facing code.

## UI language

English is the primary UI language. Keep technical product terms such as
`Test Case`, `API`, `OCR`, `Playwright`, `CLI`, and `Scout Log` unchanged where
they are clearer than a translation. User-facing static copy must be added to
the UI language system when both English and Thai are supported.
