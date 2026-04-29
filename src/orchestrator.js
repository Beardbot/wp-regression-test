const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { chromium } = require('playwright');

const configPath = path.join(__dirname, '..', 'config', 'sites.json');
if (!fs.existsSync(configPath)) {
  console.error(chalk.red('Error: config/sites.json not found.'));
  console.error('Copy config/sites.example.json to config/sites.json and add your sites.');
  process.exit(1);
}
const config = require(configPath);
const { captureScreenshots, compareScreenshots } = require('./visual-diff');
const { checkLinks } = require('./link-checker');
const { checkConsoleErrors } = require('./console-errors');
const { runJourney } = require('./journey-runner');
const { saveRun, getLastBaseline } = require('./db');
const { generateReport } = require('./reporter');
const { sendNotification } = require('./notifier');

function getSites(siteKey) {
  if (siteKey) {
    const site = config.sites.find(s => s.key === siteKey);
    if (!site) {
      console.error(chalk.red(`Site "${siteKey}" not found in config/sites.json`));
      process.exit(1);
    }
    return [site];
  }
  return config.sites;
}

async function runBaseline(siteKey) {
  const sites = getSites(siteKey);

  for (const site of sites) {
    console.log(chalk.bold(`\n→ Capturing baseline for: ${site.name}`));
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: {
        width: config.settings.screenshotWidth,
        height: config.settings.screenshotHeight
      }
    });

    try {
      const screenshots = await captureScreenshots(context, site, 'baseline');
      console.log(chalk.green(`  ✓ Captured ${screenshots.length} baseline screenshots`));
    } catch (err) {
      console.error(chalk.red(`  ✗ Baseline failed: ${err.message}`));
    } finally {
      await browser.close();
    }
  }

  console.log(chalk.green('\n✓ Baseline capture complete'));
}

async function runTests(siteKey) {
  const sites = getSites(siteKey);
  const allResults = [];

  for (const site of sites) {
    console.log(chalk.bold(`\n→ Testing: ${site.name}`));
    const siteResults = {
      site: site.name,
      key: site.key,
      url: site.url,
      timestamp: new Date().toISOString(),
      visual: [],
      links: [],
      console: [],
      journeys: [],
      passed: true
    };

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: {
        width: config.settings.screenshotWidth,
        height: config.settings.screenshotHeight
      }
    });

    try {
      // Visual diff
      console.log(chalk.blue('  Running visual diff...'));
      const newShots = await captureScreenshots(context, site, 'test');
      const visualResults = await compareScreenshots(site, newShots, config.settings.diffThreshold);
      siteResults.visual = visualResults;
      const visualFails = visualResults.filter(r => r.status === 'fail').length;
      console.log(visualFails > 0
        ? chalk.red(`  ✗ Visual diff: ${visualFails} page(s) flagged`)
        : chalk.green(`  ✓ Visual diff: all pages passed`)
      );

      // Link checker
      console.log(chalk.blue('  Checking links...'));
      const linkResults = await checkLinks(site, context);
      siteResults.links = linkResults;
      const linkFails = linkResults.filter(r => r.status !== 200).length;
      console.log(linkFails > 0
        ? chalk.red(`  ✗ Links: ${linkFails} broken link(s) found`)
        : chalk.green(`  ✓ Links: all OK`)
      );

      // Console errors
      console.log(chalk.blue('  Checking for console errors...'));
      const consoleResults = await checkConsoleErrors(context, site, config.settings.timeout);
      siteResults.console = consoleResults;
      const errorPages = consoleResults.filter(r => r.errors.length > 0).length;
      console.log(errorPages > 0
        ? chalk.red(`  ✗ Console errors found on ${errorPages} page(s)`)
        : chalk.green(`  ✓ Console: no errors`)
      );

      // Journeys
      if (site.journeys && site.journeys.length > 0) {
        for (const journeyName of site.journeys) {
          console.log(chalk.blue(`  Running journey: ${journeyName}...`));
          const journeyResult = await runJourney(journeyName, site, context);
          siteResults.journeys.push(journeyResult);
          console.log(journeyResult.passed
            ? chalk.green(`  ✓ Journey "${journeyName}" passed`)
            : chalk.red(`  ✗ Journey "${journeyName}" failed: ${journeyResult.failedStep}`)
          );
        }
      }

      // Overall pass/fail
      siteResults.passed = (
        visualFails === 0 &&
        linkFails === 0 &&
        errorPages === 0 &&
        siteResults.journeys.every(j => j.passed)
      );

    } catch (err) {
      console.error(chalk.red(`  ✗ Test run error: ${err.message}`));
      siteResults.passed = false;
      siteResults.error = err.message;
    } finally {
      await browser.close();
    }

    allResults.push(siteResults);
    saveRun(siteResults);
  }

  // Generate report
  const reportPath = await generateReport(allResults);
  console.log(chalk.green(`\n✓ Report generated: ${reportPath}`));

  // Notify if anything failed
  const failures = allResults.filter(r => !r.passed);
  if (failures.length > 0 && config.settings.notifications.email.enabled) {
    await sendNotification(allResults, reportPath);
  }

  const totalFailed = allResults.filter(r => !r.passed).length;
  const totalPassed = allResults.filter(r => r.passed).length;
  console.log(chalk.bold(`\nResults: ${chalk.green(totalPassed + ' passed')}  ${totalFailed > 0 ? chalk.red(totalFailed + ' failed') : ''}`));

  return allResults;
}

module.exports = { runBaseline, runTests };
