import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

assert.equal(createRequire(import.meta.url)('playwright/package.json').version, '1.64.1',
  'Update the pinned browser image with Playwright');
const browser = await chromium.launch({ headless: true });
try {
  console.log('Preinstalled Chromium ' + browser.version());
} finally {
  await browser.close();
}
