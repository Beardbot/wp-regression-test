# WP Regression Tester

Automated regression testing for WordPress sites after updates. Detects visual regressions, broken links, console errors, and functional issues.

---

## Prerequisites

Before cloning and running this project, make sure you have the following installed:

- **Node.js** (v18 or later) — [nodejs.org](https://nodejs.org)
- **npm** (comes with Node.js)
- **Git** — [git-scm.com](https://git-scm.com)

To check what you have, run:

```bash
node --version
npm --version
git --version
```

---

## Setup

### 1. Install dependencies

After cloning the repository, navigate into the project folder and install dependencies:

```bash
cd automated-regression-test
npm install
```

This will also automatically install the Playwright Chromium browser — no separate install step needed.

### 2. Configure your sites

Copy the example config to create your own local config file:

```bash
cp config/sites.example.json config/sites.json
```

> **Windows:** use `copy config\sites.example.json config\sites.json`

Then edit `config/sites.json` and replace the example entries with your WordPress sites:

```json
{
  "sites": [
    {
      "name": "My Client Site",
      "key": "my-client",
      "url": "https://myclientsite.com",
      "pages": ["/", "/shop", "/about", "/contact"],
      "journeys": ["woocommerce"]
    }
  ]
}
```

- `key` — a short unique slug used for folder names and CLI arguments
- `pages` — list of paths to test on every run
- `journeys` — optional functional test scripts (see Journeys section)

Your `sites.json` is gitignored and will never be committed — updates to the repo will not overwrite your configuration.

### 3. Set up environment variables

Copy `.env.example` to `.env` and fill in your values (SMTP credentials and webhook secret). This file is gitignored and should never be committed.

### 4. Register the CLI commands (recommended)

This project includes two terminal commands — `baseline` and `test` — that you can run directly from any directory instead of using `npm run`. To make them available, run this once after cloning:

```bash
npm link
```

`npm link` tells Node to install this project's commands globally on your machine, the same way a globally installed npm package works. You only need to do this once per machine. If you skip this step, replace `baseline` and `test` with `npm run baseline` and `npm run test -- ` throughout this guide.

> **Note:** On macOS and Linux, `npm link` may require `sudo` (`sudo npm link`). On Windows, run your terminal as Administrator if you get a permissions error.

---

## Usage

### Step 1 — Capture a baseline (before updates)

```bash
# All sites
baseline

# One specific site
baseline my-client
```

This takes full-page screenshots of every configured page and saves them to `baselines/`.

### Step 2 — Perform your WordPress updates as normal

### Step 3 — Run regression tests (after updates)

```bash
# All sites
test

# One specific site
test my-client
```

This captures new screenshots, diffs them against the baseline, checks links, captures console errors, and runs any configured journeys. An HTML report is saved to `results/reports/`.

> **Didn't run `npm link`?** Use `npm run baseline` and `npm run test -- my-client` instead.

---

## Journeys

Journeys are functional test scripts for specific site types.

### WooCommerce journey

Add `"woocommerce"` to the `journeys` array in `sites.json`. This journey:

1. Loads the `/shop` page and confirms products are present
2. Clicks the first product
3. Adds it to cart
4. Confirms the WooCommerce success notification appears
5. Visits the cart and confirms the product is present
6. Visits checkout and confirms payment options are present

> No order is submitted — the journey stops at payment confirmation.

If the site uses non-standard WooCommerce page URLs, override them with `journeyOptions` in `sites.json`:

```json
{
  "journeys": ["woocommerce"],
  "journeyOptions": {
    "woocommerce": {
      "shopPath": "/store",
      "cartPath": "/basket",
      "checkoutPath": "/pay"
    }
  }
}
```

All three paths are optional and default to `/shop`, `/cart`, and `/checkout`.

### Adding custom journeys

Create a new file in `journeys/`, e.g. `journeys/contact-form.js`:

```js
async function run(site, context) {
  const steps = [];
  const page = await context.newPage();
  let passed = true;
  let failedStep = null;

  // ... your test steps using Playwright

  await page.close();
  return { passed, failedStep, steps };
}

module.exports = { run };
```

Then add the journey name to your site config: `"journeys": ["contact-form"]`

---

## Visual diff threshold

The default threshold is 2% pixel change per page. Adjust in `config/sites.json`:

```json
"settings": {
  "diffThreshold": 0.02
}
```

---

## Email notifications

Copy `.env.example` to `.env` and fill in your SMTP credentials:

```
SMTP_HOST=smtp.yourmailprovider.com
SMTP_PORT=587
SMTP_USER=alerts@yourdomain.com
SMTP_PASS=your-smtp-password
SMTP_FROM=alerts@yourdomain.com
SMTP_TO=you@yourdomain.com
```

Then set `notifications.email.enabled` to `true` in `config/sites.json`.

The `.env` file is excluded from version control via `.gitignore` — never commit credentials.

---

## WordPress plugin

The plugin lives in `wp-plugin/wp-regression-tester.php`. Copy or symlink it to a site's `wp-content/plugins/` folder.

In **manual mode** (Option 1), the plugin displays the terminal command to run after updates.

In **webhook mode** (Option 2, hosted server), the plugin's "Run regression tests now" button POSTs to your hosted server and triggers the tests automatically.

---

## Hosted server (Option 2)

To run on a server instead of locally:

1. Copy the project to your server
2. Copy `.env.example` to `.env` and set `WP_REGRESSION_SECRET` (and SMTP values if using email)
3. Start the server: `npm run server`
4. Configure the WordPress plugin with your server URL and secret
5. The plugin button will now trigger tests automatically

---

## Project structure

```
automated-regression-test/
├── config/
│   ├── sites.example.json  ← example config (commit this)
│   └── sites.json          ← your site list (gitignored, never commit)
├── data/                   ← all runtime artifacts (gitignored)
│   ├── {site-key}/
│   │   ├── baselines/      ← screenshots captured before updates
│   │   ├── screenshots/    ← screenshots from the last test run
│   │   └── diffs/          ← pixel diff images
│   ├── reports/            ← HTML reports
│   └── runs.db             ← SQLite run history
├── journeys/
│   └── woocommerce.js      ← WooCommerce functional test
├── src/
│   ├── orchestrator.js     ← coordinates all test modules
│   ├── visual-diff.js      ← screenshot capture and comparison
│   ├── link-checker.js     ← HTTP status checking
│   ├── console-errors.js   ← JS/page error detection
│   ├── journey-runner.js   ← loads and runs journey scripts
│   ├── db.js               ← run history storage
│   ├── reporter.js         ← HTML report generation
│   └── notifier.js         ← email notifications
├── wp-plugin/
│   └── wp-regression-tester.php  ← WordPress trigger plugin
├── index.js                ← CLI entry point
├── server.js               ← optional HTTP server (Option 2)
├── .env.example            ← template for credentials (commit this)
├── .env                    ← your credentials (gitignored, never commit)
└── package.json
```
