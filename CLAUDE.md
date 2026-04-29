# WP Regression Tester

Automated regression testing for WordPress sites after updates. Replaces manual incognito-window click-through testing.

## Purpose

Run before and after WordPress maintenance to detect visual regressions, broken links, JS errors, and functional failures. Generates an HTML report and optionally sends email notifications.

## Stack

- **Runtime**: Node.js
- **Browser automation**: Playwright (Chromium headless)
- **Visual diff**: pixelmatch + pngjs
- **Storage**: better-sqlite3 (`results/runs.db`)
- **Notifications**: nodemailer
- **Optional HTTP server**: Express (for hosted/webhook deployment)

## Structure

```
config/sites.example.json  — example site config (committed)
config/sites.json          — your real site config (gitignored, copied from sites.example.json)
.env                       — SMTP credentials and WP_REGRESSION_SECRET (gitignored)
.env.example               — template showing all required env vars (committed)
data/{site-key}/baselines/ — screenshots captured before updates
data/{site-key}/screenshots/ — screenshots from the last test run
data/{site-key}/diffs/     — pixel diff images
data/reports/              — generated HTML reports
data/runs.db               — SQLite run history
src/orchestrator.js       — main coordinator; calls all modules in sequence
src/visual-diff.js        — full-page screenshot capture and pixelmatch comparison
src/link-checker.js       — crawls pages, checks HTTP status of internal links
src/console-errors.js     — captures JS errors and failed requests via Playwright events
src/journey-runner.js     — loads and executes journey scripts by name
src/reporter.js           — generates HTML report from aggregated results
src/notifier.js           — sends email summary via nodemailer
src/db.js                 — saves/retrieves run results from SQLite
journeys/woocommerce.js   — WooCommerce smoke test (shop → product → cart → checkout)
index.js                  — CLI entry point
server.js                 — optional Express webhook server for hosted deployment
wp-plugin/                — WordPress plugin with settings page and trigger button
```

## Commands

`baseline` and `test` are globally registered CLI commands (via `bin` in `package.json`). Run `npm link` once after cloning to install them; without it, use the `npm run` equivalents shown in parentheses.

```bash
baseline                                # capture baseline for all sites       (npm run baseline)
baseline {key}                          # capture baseline for one site        (npm run baseline -- {key})
test                                    # run regression tests for all sites   (npm run test)
test {key}                              # run regression tests for one site    (npm run test -- {key})
npm run server                          # start webhook server (hosted mode)
```

`npm install` triggers a `postinstall` hook that runs `npx playwright install chromium` automatically — no manual browser install step is needed.

## Workflow

1. Before updates: `baseline {key}`
2. Perform WordPress updates
3. After updates: `test {key}`
4. Open HTML report in `results/reports/`

## Site config shape (`config/sites.json`)

```json
{
  "sites": [
    {
      "name": "Display name",
      "key": "unique-slug",
      "url": "https://example.com",
      "pages": ["/", "/shop", "/contact"],
      "journeys": ["woocommerce"],
      "auth": null
    }
  ],
  "settings": {
    "screenshotWidth": 1280,
    "screenshotHeight": 900,
    "diffThreshold": 0.02,
    "timeout": 30000,
    "notifications": {
      "email": { "enabled": false }
    }
  }
}
```

## Adding a journey

Create `journeys/{name}.js` exporting a `run(site, context)` async function. Return `{ passed, failedStep, steps }` where `steps` is an array of `{ name, status, error? }`. Add the journey name to the site's `journeys` array in `sites.json`.

## Deployment modes

- **Option 1 (local)**: CLI only. Run commands manually after updates. WordPress plugin displays the command as a reminder.
- **Option 2 (hosted)**: Run `npm run server`. Set `WP_REGRESSION_SECRET` in `.env`. WordPress plugin button POSTs to `/run` with `{ secret, site }` to trigger tests remotely.

## Key behaviours

- Visual diff resizes mismatched screenshots before comparing (handles page height changes)
- WooCommerce journey stops at payment confirmation — no order is submitted
- Console error checker ignores common third-party failures (analytics, fonts, Gravatar)
- Each test run is saved to SQLite for history tracking