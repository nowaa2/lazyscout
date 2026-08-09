# Roadmap

## Available in 0.2

- Local Project workspaces and dashboard charts
- Playwright same-origin Website Explorer
- Page, form, control, visible dialog and interaction discovery
- Rule-based Draft Test Case and Test Data generation
- Test Case review, folders, tags and requirement links
- CSV/XLSX/JSON import and CSV export
- Screenshot OCR-assisted Test Case import
- Playwright and Cypress code generation
- Restricted local Playwright execution, logs, cancellation and screenshots
- Optional API observation and safe GET/HEAD/OPTIONS checks
- Bug Reports and ZIP evidence export
- HTML/PDF Test Summary export
- Confirmed GET load test
- npm Version Center

## Current Boundaries

- Cypress is generated but not executed by the local runner.
- Explorer records interaction hints but does not automatically click every tab, dialog, accordion or dropdown.
- Projects and evidence are stored in browser local storage and do not sync between devices.
- There is no hosted account, cloud Project database, queue or multi-user service.
- Generated output is rule-based and must be reviewed by a Tester.
- Public/online URL policy is not production-ready against DNS rebinding.

## Planned

### Approved UI-state exploration

Add explicit opt-in execution for safe tabs, accordions and dialogs. Actions must use structured roles/attributes, preserve same-origin policy and remain blocked when they appear destructive.

### Cypress local runner

Add Cypress execution only after defining the same cancellation, limits, logging, secret redaction and command-whitelist guarantees used by the Playwright runner.

### Reporting and large suites

Improve report layouts, accessibility and performance for large Test Case collections without changing the underlying Test Case model.

### Hosted architecture preparation

Before any online service, add authentication, authorization, job isolation, DNS/IP resolution, redirect validation, rate limits, network egress controls, encrypted storage and a documented retention policy.
