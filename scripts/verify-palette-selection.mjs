import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1302, height: 954 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4180/design-standard');
  const washModule = new URL('../packages/inkra/src/internal/wash.ts', import.meta.url).pathname;
  const washChecks = await page.evaluate(async modulePath => {
    const { drawPencilWash } = await import(`/@fs${modulePath}`);
    const render = angle => {
      const canvas = document.createElement('canvas');
      canvas.width = 180;
      canvas.height = 56;
      const ctx = canvas.getContext('2d');
      drawPencilWash(ctx, { x: 0, y: 0, width: 180, height: 56 }, '#85958c', 12345, { angle, strength: 0.22, spacing: 1.8, roughness: 3.5, inset: 2, radius: 8 });
      return ctx.getImageData(0, 0, 180, 56).data;
    };
    const diagonal = render(-35);
    const repeated = render(-35);
    const horizontal = render(0);
    const difference = (dx, dy) => {
      let total = 0;
      for (let y = 12; y < 44; y++) for (let x = 15; x < 165; x++) {
        total += (diagonal[(y * 180 + x) * 4 + 3] - diagonal[((y + dy) * 180 + x + dx) * 4 + 3]) ** 2;
      }
      return total;
    };
    return {
      deterministic: diagonal.every((value, i) => value === repeated[i]),
      changed: diagonal.some((value, i) => value !== horizontal[i]),
      along: difference(6, -4), across: difference(6, 4),
      topEdgeClear: diagonal.slice(0, 180 * 4).every(value => value === 0),
    };
  }, washModule);
  assert(washChecks.deterministic && washChecks.changed && washChecks.topEdgeClear, JSON.stringify(washChecks));
  assert(washChecks.along < washChecks.across, JSON.stringify(washChecks));
  const sidebar = page.locator('.desktop-sidebar');
  await sidebar.getByRole('radio', { name: '浅色主题', exact: true }).check();
  const icons = await sidebar.locator('.theme-control canvas.docs-pencil-icon').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
  assert.deepEqual(icons, [28, 28, 28]);
  const samples = page.locator('.color-palette__selection');
  assert.equal(await samples.count(), 2);
  await samples.first().getByRole('radio', { name: '深色主题', exact: true }).check();
  for (const sample of await samples.all()) {
    assert(await sample.getByRole('radio', { name: '深色主题', exact: true }).isChecked());
  }
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await samples.first().getByRole('radio', { name: '深色主题', exact: true }).press('ArrowLeft');
  await page.waitForTimeout(300);
  for (const sample of await samples.all()) {
    assert(await sample.getByRole('radio', { name: '浅色主题', exact: true }).isChecked());
    const states = await sample.locator('.inkra-radio-segment__surface').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).opacity));
    assert.deepEqual(states, ['0', '1', '0']);
    const pixels = await sample.locator('[data-checked="true"] .inkra-radio-segment__surface canvas').evaluate(canvas => {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      return Array.from(data).filter((value, index) => index % 4 === 3 && value > 0).length;
    });
    assert(pixels > 100);
  }
  const pigment = () => page.locator('.color-palette__application').first().evaluate(node => getComputedStyle(node).getPropertyValue('--inkra-selection-pigment').trim());
  assert.equal(await pigment(), '#4d5e54');
  await page.getByRole('button', { name: '沧浪', exact: true }).click();
  assert.equal(await pigment(), '#4b96aa');
  await page.getByRole('button', { name: '玄墨', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/inkra-palette-selection.png' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 954 });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
    assert.equal(await page.locator('.color-palette__application:visible').count(), 1);
    await page.getByRole('button', { name: '打开文档目录', exact: true }).click();
    await page.locator('.mobile-drawer').getByRole('radio', { name: '深色主题', exact: true }).check();
    await page.getByRole('button', { name: '关闭文档目录', exact: true }).last().click();
    assert.equal(await page.locator('.color-palette__application:visible').getAttribute('data-preview-theme'), 'dark');
  }
  assert.deepEqual(errors, []);
  console.log('PASS: 28px theme icons, selection pixels and keyboard/synchronized states, palette tokens, mobile themes and overflow.');
} finally {
  await browser.close();
}
