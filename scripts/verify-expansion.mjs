import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1302, height: 954 } });
const base = process.env.INKRA_URL || 'http://127.0.0.1:4180';
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const names = ['tabs', 'tooltip', 'accordion', 'badge', 'separator', 'skeleton', 'progress'];
async function press(key) {
  await page.keyboard.press(key);
  await page.waitForTimeout(80);
}
try {
  for (const width of [1302, 390, 320]) {
    await page.setViewportSize({ width, height: 954 });
    for (const name of names) {
      await page.goto(`${base}/components/${name}#preview`);
      const playground = page.locator('.component-playground');
      await playground.waitFor();
      const before = await playground.boundingBox();
      await playground.getByRole('tab', { name: '代码', exact: true }).click();
      const after = await playground.boundingBox();
      assert(Math.abs(before.height - after.height) < 1, `${name}: stable preview height ${width}`);
      assert(await playground.getByRole('group', { name: '属性', exact: true }).isVisible());
      await playground.getByRole('tab', { name: '预览', exact: true }).click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: overflow at ${width}`);
      const api = page.locator('.page-tabs').getByRole('tab', { name: 'API', exact: true });
      await api.click();
      assert(await page.locator('.component-api table').isVisible());
      assert.equal(new URL(page.url()).hash, '#api');
      await page.goBack();
      await playground.waitFor();
      await page.locator('.page-tabs').getByRole('tab', { name: '无障碍', exact: true }).click();
      assert((await page.locator('.component-api p').textContent()).length > 15);
      await page.locator('.page-tabs').getByRole('tab', { name: '示例', exact: true }).click();
      await page.waitForTimeout(180);
      if (['tabs', 'accordion', 'progress'].includes(name)) await page.screenshot({ path: `/tmp/inkra-${name}-${width}.png`, fullPage: true });
    }
    console.log(`PASS seven component docs at ${width}: panels, hash, stable workspace, no page overflow`);
  }

  await page.setViewportSize({ width: 1302, height: 954 });
  await page.goto(`${base}/components/tabs`);
  const tabs = page.locator('.preview-display .tabs-demo');
  const first = tabs.getByRole('tab', { name: '笔记', exact: true });
  const second = tabs.getByRole('tab', { name: '草稿', exact: true });
  await first.focus();
  await press('ArrowRight');
  assert.equal(await second.getAttribute('aria-selected'), 'true');
  await press('Home');
  assert.equal(await first.getAttribute('aria-selected'), 'true');
  await press('End');
  assert.equal(await second.getAttribute('aria-selected'), 'true');
  const saved = page.locator('.component-example .tabs-demo');
  await saved.getByRole('textbox').fill('Preserved text');
  await saved.getByRole('tab', { name: '草稿', exact: true }).click();
  assert.equal(await saved.getByRole('textbox').count(), 0);
  await saved.getByRole('tab', { name: '笔记', exact: true }).click();
  assert.equal(await saved.getByRole('textbox').inputValue(), 'Preserved text');

  await page.goto(`${base}/design-standard`);
  const standard = page.getByRole('tablist', { name: '设计规范分类' });
  await standard.getByRole('tab').nth(1).click();
  const animations = await standard.locator('.inkra-tabs__selection').evaluateAll(nodes => nodes.map(node => node.getAnimations().map(animation => animation.effect.getTiming().duration)));
  assert(animations.flat().includes(480), 'draw-in animation');
  assert(animations.flat().includes(320), 'erase-out animation');
  await page.screenshot({ path: '/tmp/inkra-tabs-drawing.png' });

  await page.evaluate(() => localStorage.setItem('inkra-docs-theme', 'dark'));
  for (const width of [1302, 390]) {
    await page.setViewportSize({ width, height: 954 });
    for (const name of names) {
      await page.goto(`${base}/components/${name}`);
      await page.locator('.component-playground').waitFor();
      await page.waitForTimeout(550);
      const pixels = await page.locator('.preview-display canvas').evaluateAll(canvases => canvases.reduce((sum, canvas) => {
        const context = canvas.getContext('2d');
        if (!context || !canvas.width || !canvas.height) return sum;
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let index = 3; index < data.length; index += 4) if (data[index]) sum++;
        return sum;
      }, 0));
      assert(pixels > 20, `${name}: nonblank pencil canvas in dark ${width}`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `/tmp/inkra-${name}-dark-${width}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1302, height: 954 });
  await page.goto(`${base}/components/badge`);
  const playground = page.locator('.component-playground');
  await playground.getByRole('tab', { name: '代码', exact: true }).click();
  await playground.getByRole('textbox').fill('A < B & "C"');
  assert((await playground.locator('code').textContent()).includes(JSON.stringify('A < B & "C"')));
  await page.goto(`${base}/components/tooltip`);
  await page.locator('.preview-display button').focus();
  await page.getByRole('tooltip').waitFor();
  const triggerInk = await page.locator('.preview-display button').evaluate(el => getComputedStyle(el).getPropertyValue('--inkra-ink'));
  const tipInk = await page.locator('.inkra-tooltip__content').evaluate(el => getComputedStyle(el).getPropertyValue('--inkra-ink'));
  assert.equal(tipInk.trim(), triggerInk.trim(), 'portal inherits dark theme');
  await page.screenshot({ path: '/tmp/inkra-tooltip-open-dark.png' });
  await page.keyboard.press('Escape');
  await page.evaluate(() => { localStorage.setItem('inkra-docs-locale', 'en'); localStorage.setItem('inkra-docs-theme', 'light'); });
  await page.goto(`${base}/components/accordion`);
  await page.getByRole('button', { name: 'What is Inkra?', exact: true }).first().waitFor();
  await page.evaluate(() => localStorage.setItem('inkra-docs-locale', 'zh-CN'));
  await page.goto(`${base}/design-standard`);
  console.log('PASS dark desktop/mobile pencil pixels, tooltip theme bridge, live code escaping and English content');

  // Mount isolated real exports to exercise contracts beyond the documentation controls.
  const rootPath = fileURLToPath(new URL('..', import.meta.url));
  await page.evaluate(async root => {
    const ReactModule = await import('/@id/react');
    const React = ReactModule.default ?? ReactModule;
    const dom = await import('/@id/react-dom/client');
    const { Tabs, Accordion, Tooltip, Button, Progress } = await import(`/@fs${root}/packages/inkra/src/index.ts`);
    const host = document.createElement('div');
    host.id = 'expansion-test';
    host.style.cssText = 'position:fixed;inset:80px 20px 20px 270px;z-index:100;background:var(--inkra-surface);padding:24px;overflow:auto';
    document.body.append(host);
    const h = React.createElement;
    const tabSet = (id, props) => h(Tabs.Root, { id, defaultValue: 'a', ...props },
      h(Tabs.List, { 'aria-label': id }, ...['a', 'b', 'c'].map(value => h(Tabs.Trigger, { value, key: value, disabled: value === 'b' }, value))),
      ...['a', 'b', 'c'].map(value => h(Tabs.Content, { value, key: value }, value)));
    (dom.createRoot ?? dom.default.createRoot)(host).render(h('div', null,
      tabSet('manual', { activationMode: 'manual' }), tabSet('vertical', { orientation: 'vertical' }), tabSet('rtl', { dir: 'rtl' }),
      h(Accordion.Root, { type: 'multiple', id: 'multiple' }, ...['a', 'b', 'c'].map(value => h(Accordion.Item, { value, key: value, disabled: value === 'b' },
        h(Accordion.Header, null, h(Accordion.Trigger, null, value)), h(Accordion.Content, null, `Content ${value}`)))),
      h(Tooltip.Provider, { delayDuration: 0 }, h(Tooltip.Root, null,
        h(Tooltip.Trigger, { asChild: true }, h(Button, { id: 'tip-trigger' }, 'Help')),
        h(Tooltip.Portal, null, h(Tooltip.Content, null, 'Extra details')))),
      h(Progress, { id: 'unknown-progress', value: null, label: 'Loading' }),
    ));
  }, rootPath);
  const fixture = page.locator('#expansion-test');
  await fixture.getByRole('tab', { name: 'a', exact: true }).first().waitFor();
  const manual = fixture.locator('#manual');
  await manual.getByRole('tab', { name: 'a', exact: true }).focus();
  await press('ArrowRight');
  assert.equal(await manual.getByRole('tab', { name: 'c', exact: true }).evaluate(el => el === document.activeElement), true);
  assert.equal(await manual.getByRole('tab', { name: 'a', exact: true }).getAttribute('aria-selected'), 'true');
  await press('Enter');
  assert.equal(await manual.getByRole('tab', { name: 'c', exact: true }).getAttribute('aria-selected'), 'true');
  for (const [id, key] of [['vertical', 'ArrowDown'], ['rtl', 'ArrowLeft']]) {
    const group = fixture.locator(`#${id}`);
    await group.getByRole('tab', { name: 'a', exact: true }).focus();
    await press(key);
    assert.equal(await group.getByRole('tab', { name: 'c', exact: true }).getAttribute('aria-selected'), 'true');
  }
  const accordion = fixture.locator('#multiple');
  await accordion.getByRole('button', { name: 'a', exact: true }).click();
  await press('ArrowDown');
  assert.equal(await accordion.getByRole('button', { name: 'c', exact: true }).evaluate(el => el === document.activeElement), true);
  await press('Space');
  assert.equal(await accordion.locator('[aria-expanded="true"]').count(), 2);
  await fixture.locator('#tip-trigger').focus();
  await page.getByRole('tooltip').waitFor();
  assert(await fixture.locator('#tip-trigger').getAttribute('aria-describedby'));
  await page.keyboard.press('Escape');
  await page.getByRole('tooltip').waitFor({ state: 'hidden' });
  assert.equal(await fixture.locator('#unknown-progress').getAttribute('aria-valuenow'), null);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await fixture.locator('#unknown-progress .inkra-progress__fill-clip').evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.equal(await fixture.locator('.inkra-tabs__selection').evaluateAll(nodes => nodes.flatMap(node => node.getAnimations()).length), 0);
  console.log('PASS Tabs auto/manual, disabled, Home/End, vertical, RTL, state preservation, drawing; Accordion multiple/keyboard; Tooltip focus/Escape; Progress reduced motion');
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
