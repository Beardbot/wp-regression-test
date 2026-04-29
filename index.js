require('dotenv').config();
const minimist = require('minimist');
const chalk = require('chalk');
const { runBaseline, runTests } = require('./src/orchestrator');

const args = minimist(process.argv.slice(2));
const mode = args.mode || args.m;
const siteKey = args.site || args.s || args._[0] || null;

const banner = `
╔══════════════════════════════════════════╗
║       WP Regression Tester              ║
╚══════════════════════════════════════════╝
`;

async function main() {
  console.log(chalk.cyan(banner));

  if (!mode || !['baseline', 'test'].includes(mode)) {
    console.log(chalk.yellow('Usage:'));
    console.log('  baseline              — capture baseline for all sites');
    console.log('  baseline <key>        — capture baseline for one site');
    console.log('  test                  — run regression tests for all sites');
    console.log('  test <key>            — run regression test for one site');
    console.log('');
    console.log(chalk.dim("  Didn't run npm link? Use: npm run baseline  /  npm run test -- <key>"));
    process.exit(0);
  }

  if (mode === 'baseline') {
    console.log(chalk.blue('Mode: capturing baseline screenshots\n'));
    await runBaseline(siteKey);
  } else if (mode === 'test') {
    console.log(chalk.blue('Mode: running regression tests\n'));
    await runTests(siteKey);
  }
}

main().catch(err => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});
