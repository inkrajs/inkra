import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../apps/docs/package.json', import.meta.url));
const { build } = require('esbuild');
const { chromium } = require('playwright');
const bundle = await build({ entryPoints: [new URL('../test/fixtures/inventory-grid-runtime.tsx', import.meta.url).pathname], bundle: true, write: false, format: 'esm', jsx: 'automatic', platform: 'browser' });
const css = await readFile(new URL('../dist/styles.css', import.meta.url), 'utf8');
const tokens = await readFile(new URL('../dist/tokens.css', import.meta.url), 'utf8');
const font = await readFile(new URL('../dist/assets/ui-hand-yozai.woff2', import.meta.url));
const server = createServer((req, res) => {
  if (req.url?.endsWith('.woff2')) { res.setHeader('Content-Type', 'font/woff2'); res.end(font); return; }
  res.setHeader('Content-Type', req.url === '/app.js' ? 'text/javascript' : 'text/html');
  res.end(req.url === '/app.js' ? bundle.outputFiles[0].text : `<!doctype html><style>${tokens}\n${css}\nbody{margin:16px;background:var(--inkra-paper)}#state{display:none}#root{max-width:100%}</style><div id="root"></div><script type="module" src="/app.js"></script>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, hasTouch: true });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const state = async () => JSON.parse(await page.locator('#state').textContent());
  const item = id => page.locator(`[data-inventory-item="${id}"]`);
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const pick = async id => { await item(id).focus(); await page.keyboard.press('Space'); await page.locator('.inkra-inventory-grid__overlay').waitFor(); await frames(); };
  const drop = async () => { await page.keyboard.press('Enter'); await page.locator('.inkra-inventory-grid__overlay').waitFor({ state: 'detached' }); await frames(); };
  const reset = async () => { await page.locator('#reset').click(); await frames(); };
  const original = await state();
  await pick('dot'); await drop();
  assert.deepEqual(await state(), original);
  assert.equal(await page.locator('#changes').textContent(), '0', 'no-op does not emit a change');
  assert(!(await page.locator('.inkra-inventory-grid__announcement').textContent()).includes('Cannot'), 'no-op is not an invalid placement');
  assert.equal(await item('l').locator('.inkra-inventory-grid__cell').count(), 3);
  const hollow = await item('dot').boundingBox();
  assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x + 10, y + 10)?.closest('[data-inventory-item]')?.getAttribute('data-inventory-item'), hollow), 'dot', 'irregular holes do not intercept other items');
  await pick('dot'); await page.keyboard.press('ArrowRight'); await frames(); await drop();
  assert.deepEqual((await state())[0].items[1].position, { x: 2, y: 0 }, 'one key moves exactly one cell');
  await pick('dot'); await page.keyboard.press('ArrowDown'); await frames(); await page.keyboard.press('Escape'); await frames();
  assert.deepEqual((await state())[0].items[1].position, { x: 2, y: 0 }, 'Escape restores placement');
  await reset(); await pick('dot'); await page.keyboard.press('ArrowLeft'); await frames();
  assert.equal(await page.locator('.inkra-inventory-grid__preview').getAttribute('data-valid'), 'false');
  await drop(); assert.deepEqual(await state(), original, 'occupied cells reject drops');
  await reset(); await pick('bar'); await page.keyboard.press('r'); await frames(); await drop();
  assert.equal((await state())[0].items[2].rotation, 90, 'R rotates while dragging');
  await reset(); await pick('dot'); await page.keyboard.press('PageDown'); await frames(); await drop();
  assert.equal((await state())[1].items[0]?.id, 'dot', 'keyboard transfers across bags');
  assert.equal(await item('dot').evaluate(node => node === document.activeElement), true, 'focus follows the transferred item');
  await reset(); await page.locator('#reject').click(); await pick('dot'); await page.keyboard.press('ArrowRight'); await frames(); await drop();
  assert.deepEqual(await state(), original, 'controlled owner rejection restores original placement');
  assert.equal(await page.locator('#changes').textContent(), '1');
  await reset(); await page.locator('#rule').click(); await pick('dot'); await page.keyboard.press('PageDown'); await frames(); await drop();
  assert.deepEqual(await state(), original, 'custom rule prevents transfer');
  for (const flag of ['disabled', 'readonly']) {
    await reset(); await page.locator(`#${flag}`).click();
    assert.equal(await item('dot').getAttribute('tabindex'), '-1');
    assert.equal(await item('dot').getAttribute('aria-disabled'), 'true');
  }
  for (const flag of ['disabled', 'remove']) {
    await reset(); await pick('dot');
    await page.locator(`#${flag}`).evaluate(node => node.click());
    await page.locator('.inkra-inventory-grid__overlay').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.inkra-inventory-grid__preview').count(), 0, 'external updates cancel the drag engine');
  }
  await reset();
  const start = await item('dot').boundingBox();
  await page.mouse.move(start.x + 24, start.y + 24); await page.mouse.down();
  await page.mouse.move(start.x + 24 + 48, start.y + 24, { steps: 8 }); await frames(); await page.mouse.up(); await frames();
  assert.deepEqual((await state())[0].items[1].position, { x: 2, y: 0 }, 'mouse movement snaps to cells');
  await reset(); await page.setViewportSize({ width: 390, height: 900 }); await frames();
  const touchStart = await item('dot').boundingBox();
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchStart.x + 24, y: touchStart.y + 24, id: 1 }] });
  await page.waitForTimeout(220);
  for (let step = 1; step <= 8; step++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchStart.x + 24 + 48 * step / 8, y: touchStart.y + 24, id: 1 }] });
    await page.waitForTimeout(20);
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await frames(); await client.detach();
  assert.deepEqual((await state())[0].items[1].position, { x: 2, y: 0 }, 'touch hold-and-drag moves one cell');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no document overflow');
  await page.screenshot({ path: '/tmp/inkra-inventory-grid-390.png', fullPage: true });
  await page.setViewportSize({ width: 1000, height: 800 }); await page.screenshot({ path: '/tmp/inkra-inventory-grid-1000.png', fullPage: true });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await item('dot').focus(); assert.equal(await item('dot').getAttribute('role'), 'button');
  await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference' });
  for (const animated of [false, true]) {
    await reset();
    await page.locator('#inventory-host').evaluate((node, animated) => {
      node.style.transformOrigin = '0 0';
      node.style.transform = 'translate(70px, 35px) scale(.8)';
      if (animated) node.animate([
        { transform: 'translate(70px, 35px) scale(.8)' },
        { transform: 'translate(20px, 10px) scale(.95)' },
      ], { duration: 180, iterations: Infinity, direction: 'alternate' });
    }, animated);
    await frames();
    await pick('dot');
    const geometry = await page.locator('.inkra-inventory-grid__overlay').evaluate(node => {
      const box = node.getBoundingClientRect();
      const positioned = node.parentElement;
      const computed = getComputedStyle(node);
      return { x: box.x, y: box.y, width: box.width, height: box.height,
        left: Number.parseFloat(positioned.style.left), top: Number.parseFloat(positioned.style.top),
        expectedWidth: Number.parseFloat(positioned.style.width), expectedHeight: Number.parseFloat(positioned.style.height),
        theme: node.closest('[data-inkra-theme]')?.getAttribute('data-inkra-theme'),
        ink: computed.getPropertyValue('--inkra-ink').trim(), action: computed.getPropertyValue('--inkra-action').trim(),
        insideHost: Boolean(node.closest('#inventory-host')),
        animating: document.querySelector('#inventory-host').getAnimations().some(animation => animation.playState === 'running') };
    });
    assert(Math.abs(geometry.x - geometry.left) < 1 && Math.abs(geometry.y - geometry.top) < 1,
      `overlay stays in viewport coordinates (${animated ? 'animated' : 'fixed'} transform): ${JSON.stringify(geometry)}`);
    assert(Math.abs(geometry.width - geometry.expectedWidth) < 1 && Math.abs(geometry.height - geometry.expectedHeight) < 1,
      `overlay preserves the pickup's visual scale: ${JSON.stringify(geometry)}`);
    assert.equal(geometry.insideHost, false, 'overlay escapes the transformed containing block');
    assert.equal(geometry.theme, 'dark');
    assert.equal(geometry.ink, '#123456');
    assert.equal(geometry.action, '#456789');
    assert.equal(geometry.animating, animated);
    if (!animated) {
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('.inkra-inventory-grid__preview')?.style.left === '96px');
      await drop();
      assert.deepEqual((await state())[0].items[1].position, { x: 2, y: 0 }, 'scaled board still moves by one logical cell');
      await pick('dot');
      await page.locator('#inventory-host').evaluate(node => node.style.setProperty('--inkra-ink', '#654321'));
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.inkra-inventory-grid__overlay')).getPropertyValue('--inkra-ink').trim() === '#654321');
    }
    await page.keyboard.press('Escape');
    await page.locator('.inkra-inventory-grid__overlay').waitFor({ state: 'detached' });
    await page.locator('#inventory-host').evaluate(node => { for (const animation of node.getAnimations()) animation.cancel(); node.style.transform = ''; node.style.setProperty('--inkra-ink', '#123456'); });
  }
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.id = 'inventory-frame'; frame.style.cssText = 'width:700px;height:600px';
    document.body.append(frame);
    const owner = frame.contentDocument;
    owner.head.append(document.querySelector('style').cloneNode(true));
    const host = owner.createElement('div'); host.id = 'root'; owner.body.append(host);
    // Execute the parent realm's React code against the iframe document.
    // A global document.body portal would incorrectly escape into the parent.
    window.mountInventoryFixture(host);
  });
  const iframe = page.frameLocator('#inventory-frame');
  const iframeItem = iframe.locator('[data-inventory-item="dot"]');
  await iframeItem.waitFor();
  await iframeItem.focus(); await page.keyboard.press('Space');
  const iframeOverlay = iframe.locator('.inkra-inventory-grid__overlay');
  await iframeOverlay.waitFor();
  assert.equal(await page.locator('.inkra-inventory-grid__overlay').count(), 0, 'iframe drag does not portal into the parent document');
  assert.equal(await iframeOverlay.evaluate(node => node.closest('.inkra-portal-theme-bridge')?.parentElement === node.ownerDocument.body), true);
  assert.equal(await iframeOverlay.evaluate(node => getComputedStyle(node).getPropertyValue('--inkra-ink').trim()), '#123456');
  await page.keyboard.press('Escape'); await iframeOverlay.waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
  console.log('PASS InventoryGrid keyboard, rotate, transfer, cancel, collision, rules, controlled rejection, mouse, touch, narrow width, accessible fallbacks, transformed/animated ancestors, local theme and iframe portal');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
