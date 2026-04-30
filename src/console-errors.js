async function checkConsoleErrors(context, site, timeout = 30000) {
  const results = [];

  for (const pagePath of site.pages) {
    const url = site.url + pagePath;
    const errors = [];
    const warnings = [];

    const page = await context.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push({ type: 'console-error', text: msg.text() });
      } else if (msg.type() === 'warning') {
        warnings.push({ type: 'console-warning', text: msg.text() });
      }
    });

    page.on('pageerror', err => {
      errors.push({ type: 'page-error', text: err.message });
    });

    page.on('requestfailed', request => {
      // Only flag non-trivial failed requests (ignore analytics, fonts etc.)
      const url = request.url();
      const ignore = ['google-analytics', 'googletagmanager', 'hotjar', 'fonts.gstatic', 'gravatar', 'recaptcha', 'maps.google.com'];
      const urlLower = url.toLowerCase();
      const shouldIgnore = ignore.some(pattern => urlLower.includes(pattern));
      if (!shouldIgnore) {
        errors.push({ type: 'request-failed', text: `Failed to load: ${url}` });
      }
    });

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout });
    } catch (err) {
      errors.push({ type: 'load-error', text: err.message });
    } finally {
      await page.close();
    }

    results.push({
      page: pagePath,
      url,
      errors,
      warnings
    });
  }

  return results;
}

module.exports = { checkConsoleErrors };
