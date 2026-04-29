/**
 * WooCommerce journey
 * Tests: shop page loads → product page → add to cart → cart → checkout
 * Stops before submitting payment — checks payment options are present only.
 */

async function run(site, context) {
  const opts = (site.journeyOptions && site.journeyOptions.woocommerce) || {};
  const shopPath = opts.shopPath || '/shop';
  const cartPath = opts.cartPath || '/cart';
  const checkoutPath = opts.checkoutPath || '/checkout';
  const productOffset = opts.productOffset || 0;

  const steps = [];
  const page = await context.newPage();
  let passed = true;
  let failedStep = null;

  async function step(name, fn) {
    if (!passed) return;
    try {
      await fn();
      steps.push({ name, status: 'pass' });
    } catch (err) {
      steps.push({ name, status: 'fail', error: err.message });
      passed = false;
      failedStep = `${name}: ${err.message}`;
    }
  }

  try {
    await step('Shop page loads', async () => {
      const response = await page.goto(site.url + shopPath, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      if (!response || response.status() >= 400) {
        throw new Error(`Shop page returned status ${response?.status()}`);
      }
      // Confirm WooCommerce products are present
      const products = await page.locator('.products .product, ul.products li.product').count();
      if (products === 0) {
        throw new Error('No products found on shop page');
      }
    });

    await step('Product page loads', async () => {
      await page.locator('.products .product, ul.products li.product').nth(productOffset).locator('a').first().click();
      await page.waitForLoadState('domcontentloaded');
      await page.locator('.single_add_to_cart_button').waitFor({ timeout: 10000 });
    });

    await step('Select variations (if any)', async () => {
      const variationForm = page.locator('.variations_form');
      if (await variationForm.count() === 0) return;

      const selects = variationForm.locator('table.variations select');
      const selectCount = await selects.count();

      for (let i = 0; i < selectCount; i++) {
        const select = selects.nth(i);
        const values = await select.locator('option').evaluateAll(
          options => options.filter(o => o.value !== '').map(o => o.value)
        );
        if (values.length === 0) throw new Error('Variation select has no available options');
        await select.selectOption(values[0]);
      }

      await page.locator('.single_add_to_cart_button:not(.disabled)').waitFor({ timeout: 10000 });
    });

    await step('Add to cart', async () => {
      await page.locator('.single_add_to_cart_button').click();
      // Wait for the WooCommerce success notification
      await page.locator('.woocommerce-message, .added_to_cart').waitFor({ timeout: 10000 });
    });

    await step('Cart notification displayed', async () => {
      const notice = await page.locator('.woocommerce-message, .added_to_cart').first();
      const text = await notice.textContent();
      if (!text || text.trim().length === 0) {
        throw new Error('Cart notification was empty');
      }
    });

    await step('Cart page — product present', async () => {
      await page.goto(site.url + cartPath, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.locator('.woocommerce-cart-form .cart tr.cart_item, .wc-block-cart-items__row').first().waitFor({ timeout: 10000 });
    });

    await step('Checkout page loads', async () => {
      await page.goto(site.url + checkoutPath, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.locator('form.checkout, form[name="checkout"], .wp-block-woocommerce-checkout')
        .first().waitFor({ timeout: 10000 });
    });

    await step('Payment options present', async () => {
      const classic = await page.locator('input[name="payment_method"]').count();
      const block = await page.locator('.wc-block-components-payment-method-label').count();
      if (classic === 0 && block === 0) {
        throw new Error('No payment methods found on checkout page');
      }
    });

  } finally {
    await page.close();
  }

  return { passed, failedStep, steps };
}

module.exports = { run };
