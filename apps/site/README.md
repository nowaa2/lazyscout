# LazyScout public site

This folder contains the build-free LazyScout landing page and documentation starter.

## Cloudflare Workers configuration

Cloudflare's current Git workflow creates a Worker. The repository root contains `wrangler.jsonc`, which deploys only `apps/site/public` as static assets.

| Setting           | Value                 |
| ----------------- | --------------------- |
| Project name      | `lazyscout`           |
| Root directory    | `/`                   |
| Build command     | Leave empty           |
| Deploy command    | `npx wrangler deploy` |
| Production branch | `main`                |

The QA application, local project files, Playwright, and the API server are not deployed by this site.

## Local preview

Open `public/index.html` in a browser, or serve the `public` directory with any static-file server.
