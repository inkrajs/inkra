import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const output = resolve(process.env.BROWSER_OUTPUT || '.local/page-coverage');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const results = [];
const pages = [
  ['heavy-fixture', (process.env.INKRA_BROWSER_URL || 'http://127.0.0.1:4182') + '/?kind=ChoiceGrid&size=100&bounded=1'],
  ...['getting-started', 'components/data-table', 'components/input'].map(route =>
    ['docs-production', (process.env.INKRA_DOCS_PRODUCTION_URL || 'http://127.0.0.1:4181') + '/docs/' + route]),
];
try {
  for (const [scope, url] of pages) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    const page = await context.newPage();
    const timer = setTimeout(() => context.close().catch(() => {}), 30000);
    const record = { scope, path: new URL(url).pathname, status: 'measured' };
    try {
      await page.coverage.startJSCoverage();
      await page.coverage.startCSSCoverage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      await page.evaluate(() => document.fonts.ready);
      if (scope === 'heavy-fixture') await page.waitForFunction(() => window.fixtureReady);
      record.bodyTextLength = await page.locator('body').innerText().then(s => s.length);
      if (record.bodyTextLength < 5) throw Error('Empty page is not valid coverage evidence');
      const summarize = entries => entries.map(entry => ({
        path: new URL(entry.url).pathname,
        sourceSha256: entry.text === undefined ? null : createHash('sha256').update(entry.text).digest('hex'),
        totalCodeUnits: entry.text?.length ?? null,
        usedCodeUnits: entry.ranges.reduce((n, range) => n + range.end - range.start, 0),
        ranges: entry.ranges,
      }));
      // Current Playwright exposes raw V8 function/block ranges for JS, not
      // the CSS-style disjoint ranges. Preserve them; do not sum overlapping
      // positive ranges into a fabricated source-byte coverage percentage.
      record.javascript = (await page.coverage.stopJSCoverage()).map(entry => ({
        path: new URL(entry.url).pathname,
        sourceSha256: entry.source === undefined ? null : createHash('sha256').update(entry.source).digest('hex'),
        sourceCodeUnits: entry.source?.length ?? null,
        functionCount: entry.functions.length,
        executedFunctionCount: entry.functions.filter(f => f.ranges[0]?.count > 0).length,
        functions: entry.functions,
      }));
      record.css = summarize(await page.coverage.stopCSSCoverage());
    } catch (error) {
      record.status = 'failed'; record.error = String(error);
    } finally { clearTimeout(timer); await context.close(); }
    results.push(record);
    console.log(scope, record.path, record.status);
    await writeFile(resolve(output, 'coverage-results.json'), JSON.stringify({
      serial: true, production: true, physicalDevice: false,
      method: 'Chromium raw V8 JS function/block ranges and matched CSS ranges on four visible production pages. JS function execution counts and CSS UTF-16 code-unit coverage have different denominators. Neither is transfer bytes or proof unused code is safe to delete. No timing comparisons while instrumented.',
      results,
    }, null, 2));
  }
} finally { await browser.close(); }
