# LazyScout User Guide

> Local-first QA workspace for scouting websites, generating Test Cases, and running Playwright automation.

![LazyScout Overview](../apps/site/public/screenshots/overview.png)

## Quick navigation

- [Start here](#start-here)
- [Create a Project](#create-a-project)
- [Scout a website](#scout-a-website)
- [Login and continue after authentication](#login-and-continue-after-authentication)
- [Review Test Cases](#review-test-cases)
- [Run Automation](#run-automation)
- [Test API](#test-api)
- [Bug Reports](#bug-reports)
- [Troubleshooting](#troubleshooting)

## Start here

Run the local workspace:

```powershell
npm.cmd run dev:server
npm.cmd run dev:web
```

Open `http://localhost:5173`.

LazyScout stores projects and evidence locally. Use a separate Project for each website or environment.

## Create a Project

Choose **New project**, enter the Target URL, and select the Test Case Language. A new Project starts empty; Scout it before Project Settings becomes available.

## Scout a website

1. Enter the Target URL.
2. Choose Max pages and Max depth.
3. Choose English or ไทย for generated Test Case content.
4. Optionally enable **Include API checks from XHR/fetch**.
5. Press **Scout Site**.

If the Project already contains data, LazyScout shows a confirmation modal before replacing the discovered result.

## Login and continue after authentication

1. Scout the website once.
2. Open **Project Settings**.
3. Press **Open login browser**.
4. Sign in manually and close the browser.
5. Scout the same Project again.
6. Set **Start Path** to the page after login, such as `/dashboard`.

LazyScout reuses the Project browser profile, including cookies and local storage. Keep the host consistent: `localhost` and `127.0.0.1` are different browser origins.

## Review Test Cases

Use the Test Cases table to review ID, folder, title, type, priority, steps, expected result, automation readiness, and execution status. Generated cases are drafts: review credentials, destructive actions, and expected behavior before running.

## Run Automation

Open **Automation**, select a Test Case, and press **Run**. The CLI output shows the Playwright run log and final status. Use **Run selected cases** to run only checked cases.

## Test API

Enable API collection during Scout to see observed XHR/fetch requests. Safe methods can be checked directly. POST, PUT, PATCH, and DELETE requests require an explicit one-time confirmation.

## Bug Reports

When an automation run fails, LazyScout creates a Bug Report draft linked to the Test Case. Review actual result, expected result, reproduction steps, severity, and screenshots before sharing it with the team.

## Troubleshooting

### The page stays on Login

Use the same URL host for Login and Scout, close the login browser before scouting, and make sure the Project Profile is not locked by another LazyScout browser.

### Port 4000 is already in use

Stop the old Node server, then run `npm.cmd run dev:server` again.

### Scout finds no useful controls

Check Scout Log for Cloudflare, authentication, delayed rendering, or a page that exposes no accessible controls.
