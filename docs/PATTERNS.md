# UI Pattern Catalog

LazyScout is a deterministic UI pattern explorer. It does not use an LLM, machine learning, or any heuristic over an element's wording.

> **Do not infer behavior. Detect DOM patterns, execute safe deterministic actions, observe actual state transitions, and generate test cases only from known patterns or mark the case as manual review.**

Every Test Case is produced from one of two sources:

1. **An HTML or ARIA contract the page declares.** `required`, `minlength`, `pattern`, `role="tab"`, `aria-expanded`, `aria-controls`, `<option>` values. These are facts about the markup, so the expected result they justify is provable.
2. **A state transition the explorer actually observed.** URL change, DOM fingerprint change, a dialog appearing, a validation message appearing.

Anything else becomes a manual review case carrying the evidence that was found. An element named "Delete order" is not assumed to delete anything; an element named "Save" is not assumed to save.

## Pipeline

```text
Collect    scan every visible, enabled interactive element in each state
   ↓
Classify   map to a pattern from role / tag / type / ARIA attribute
   ↓
Execute    run only safe actions, restore state afterwards
   ↓
Observe    record before/after URL, fingerprint, dialogs, text, validation
   ↓
Generate   map pattern + observation to a Test Case
   ↓
Review     unknown, ambiguous or destructive becomes a manual case
   ↓
Report     coverage: tested, skipped, blocked, unknown, with a reason each
```

Classification happens once, in `mapToPageModel`, so the explorer and the generator always read the same `uiPattern` rather than each deriving one.

## Patterns with an executable expected result

These produce `automationStatus: "ready"` when the markup supplies what the assertion needs.

| Pattern                              | Detected from                          | Generated case                          | Assertion source                |
| ------------------------------------ | -------------------------------------- | --------------------------------------- | ------------------------------- |
| `text-input`                         | `input` type text/email/password/…     | fill, required, format, length, pattern | HTML validation attrs           |
| `number-input`                       | `type="number"`, `role="spinbutton"`   | fill, `min`/`max` boundaries            | `min` / `max` / `step`          |
| `date-input`                         | `type="date"` and relatives            | fill with a valid value                 | input type                      |
| `checkbox`                           | `type="checkbox"`, `role="checkbox"`   | check then uncheck                      | native `checked`                |
| `radio`                              | `type="radio"`, `role="radio"`         | select (never cleared)                  | native `checked`                |
| `switch`                             | `role="switch"`                        | toggle                                  | `aria-checked`                  |
| `select`                             | `<select>`                             | one case per real option, up to two     | collected `<option>`s           |
| `tab`                                | `role="tab"`                           | select tab, assert its panel            | `aria-controls`                 |
| `accordion`                          | `<summary>`, `aria-expanded`           | expand then collapse                    | `aria-controls`                 |
| `dialog-opener`                      | `aria-haspopup="dialog"`, `data-modal` | open, assert container visible          | `aria-controls` / `data-target` |
| `link` / `navigation` / `pagination` | `<a href>`, next/prev/number labels    | navigate, assert URL                    | observed navigation             |
| `submit`                             | `type="submit"`, button inside form    | submit valid data                       | observed transition             |

A pattern in this table still degrades to `needs-review` when its assertion source is missing — a tab with no `aria-controls` cannot say which panel should appear, so it does not claim one.

## Patterns that always require review

| Pattern       | Why it cannot be automated deterministically                        |
| ------------- | ------------------------------------------------------------------- |
| `combobox`    | Custom keyboard, filtering and selection behaviour is not in markup |
| `slider`      | Meaning of the value range and step needs a tester                  |
| `file-upload` | Needs a fixture file chosen by a tester                             |
| `menu`        | Contents are only known once opened; items vary by permission       |
| `table`       | Sort, filter and row semantics are application-specific             |
| `button`      | A plain button with no observed state change proves nothing         |
| `unknown`     | The element declares no catalogued role, type or ARIA relationship  |

These produce `type: "manual"`, `automationStatus: "needs-review"`, `expectedResult: "Behavior requires tester review"`, plus `evidence[]` and a `reviewReason`.

## Risk and blocked actions

`classifyRisk` runs before any pattern rule:

- `session-ending` — never executed, recorded as a manual case
- `destructive` — never executed, recorded as a manual case with a disposable-data precondition
- `needs-review` — an uncatalogued element
- `safe` — everything else

Destructive detection is driven by the **Project click filter**, which is empty by default. `SUGGESTED_BLOCK_KEYWORDS` is a starting list the UI offers, not an enforced policy. See [SAFETY.md](SAFETY.md).

## Modal exploration

When an action opens a dialog, the explorer:

1. finds the topmost open dialog and scopes collection to that container, so the page behind the modal is not counted as modal content
2. records the modal as its own state with `parentStateId` and `depth`
3. classifies and exercises the controls inside it
4. follows a dialog opened from inside a dialog, to `MAX_MODAL_DEPTH` (3)
5. dismisses with Escape and restores before the next action

States are deduplicated by fingerprint, so re-opening the same modal does not create a new state or a duplicate case.

## Coverage report

`AnalyzeResponse.coverage` reports every discovered element and why it was or was not exercised:

```json
{
  "elementsDiscovered": 41,
  "knownPatterns": 38,
  "tested": 22,
  "skipped": 9,
  "blocked": 2,
  "unknown": 3,
  "modalStates": 2,
  "casesGenerated": 57,
  "casesDeduplicated": 4,
  "byPattern": [{ "pattern": "text-input", "discovered": 9, "tested": 9 }],
  "entries": [{ "elementId": "…", "pattern": "unknown", "reason": "unknown-pattern", "name": "Sync now" }]
}
```

Reasons: `tested`, `skipped-limit`, `skipped-duplicate`, `blocked-destructive`, `blocked-session-ending`, `blocked-filter`, `unknown-pattern`, `not-visible`, `disabled`, `failed`.

`AnalyzeResponse.transitions` holds the before/after record for each executed action — URL, fingerprint, dialogs, added and removed text, validation messages, and a result of `changed` / `unchanged` / `failed` / `blocked` / `timeout`. An action recorded as `unchanged` is exactly the case the generator refuses to write an expected result for.

Both fields are optional, so a Project saved before this existed still loads.

## Limits

| Config                 | Default | Purpose                            |
| ---------------------- | ------- | ---------------------------------- |
| `maxPages`             | 20      | pages inspected                    |
| `maxDepth`             | 3       | link depth                         |
| `maxStates`            | 80      | UI states                          |
| `maxActionsPerState`   | 8       | actions tried per state            |
| `maxTotalActions`      | 200     | actions per run                    |
| `maxActionRetries`     | 2       | retries before recording a failure |
| `MAX_MODAL_DEPTH`      | 3       | nested dialogs                     |
| `maxTestCasesPerPage`  | 120     | cases kept per page                |
| `explorationTimeoutMs` | 300000  | whole run                          |

## Testing the catalog

`fixtures/demo-site/patterns.html` declares one instance of every pattern above, plus an element that declares nothing (`#sync-widget`) and a destructive control (`#delete-account`). It is the fixture behind `packages/explorer/tests/patternInventory.test.ts`, which drives a real browser and asserts the classification of each element.

```bash
node fixtures/serve.mjs      # then Scout http://localhost:5500/patterns
```
