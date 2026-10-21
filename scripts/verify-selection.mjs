import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1302, height: 954 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = process.env.INKRA_URL || 'http://127.0.0.1:4180';

const visit = async name => {
  await page.goto(`${base}/components/${name}`);
  await page.locator('main h1').waitFor();
};

try {
  await visit('switch');
  const toggle = page.getByRole('switch', { name: '接收更新', exact: true });
  const row = toggle.locator('xpath=ancestor::label[contains(@class,"inkra-switch")]');
  const track = row.locator('.inkra-switch__track');
  const thumb = row.locator('.inkra-switch__thumb');
  const geometry = async () => ({
    checked: await toggle.isChecked(),
    track: await track.boundingBox(),
    thumb: await thumb.boundingBox(),
  });
  const paintedThumbBounds = async () => thumb.evaluate(canvas => {
    const context = canvas.getContext('2d');
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    let left = canvas.width;
    let top = canvas.height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        if (image.data[(y * canvas.width + x) * 4 + 3] === 0) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
    return { height: bottom - top + 1, width: right - left + 1 };
  });
  const on = await geometry();
  assert.equal(Math.round(on.track.width), 52);
  assert.equal(Math.round(on.track.height), 32);
  assert.equal(Math.round(on.thumb.width), 24);
  assert.equal(Math.round(on.thumb.height), 24);
  const pigment = await paintedThumbBounds();
  assert(pigment.width >= 18 && pigment.height >= 18, `Thumb pigment too small ${JSON.stringify(pigment)}`);
  assert(on.thumb.x >= on.track.x + 23 && on.thumb.x + on.thumb.width <= on.track.x + on.track.width - 3, `On geometry ${JSON.stringify(on)}`);
  await toggle.uncheck();
  await page.waitForTimeout(160);
  const off = await geometry();
  assert(off.thumb.x >= off.track.x + 3 && off.thumb.x <= off.track.x + 5, `Off geometry ${JSON.stringify(off)}`);
  assert(off.thumb.x + off.thumb.width <= off.track.x + off.track.width - 23, `Off overflow ${JSON.stringify(off)}`);

  await row.evaluate(node => { node.dir = 'rtl'; });
  await toggle.check();
  await page.waitForTimeout(160);
  const rtlOn = await geometry();
  assert(rtlOn.thumb.x >= rtlOn.track.x + 3 && rtlOn.thumb.x <= rtlOn.track.x + 5, `RTL on geometry ${JSON.stringify(rtlOn)}`);
  await page.screenshot({ path: '/tmp/inkra-phase2-switch.png' });
  const visibleThumbs = page.locator('.inkra-switch__thumb:visible');
  for (let index = 0; index < await visibleThumbs.count(); index += 1) {
    const painted = await visibleThumbs.nth(index).evaluate(canvas => {
      const context = canvas.getContext('2d');
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      let left = canvas.width;
      let top = canvas.height;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          if (image.data[(y * canvas.width + x) * 4 + 3] === 0) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
      return {
        cssHeight: canvas.getBoundingClientRect().height,
        cssWidth: canvas.getBoundingClientRect().width,
        height: bottom - top + 1,
        pixelHeight: canvas.height,
        pixelWidth: canvas.width,
        width: right - left + 1,
      };
    });
    const paintedCssWidth = painted.width / painted.pixelWidth * painted.cssWidth;
    const paintedCssHeight = painted.height / painted.pixelHeight * painted.cssHeight;
    assert(paintedCssWidth >= 18 && paintedCssHeight >= 18, `Visible switch ${index} pigment ${paintedCssWidth.toFixed(2)}x${paintedCssHeight.toFixed(2)}`);
  }
  console.log('PASS switch 52x32 track, 24px thumb, stable insets, LTR/RTL positions');

  for (const width of [1302, 390, 320]) {
    await page.setViewportSize({ width, height: 954 });
    await visit('radio-group');
    const integrated = page.locator('input[name="example-theme"]').first().locator('xpath=ancestor::fieldset[contains(@class,"inkra-radio-group")]');
    await integrated.waitFor();
    assert.equal(await integrated.getAttribute('data-variant'), 'segmented');
    assert.equal(await integrated.getAttribute('data-orientation'), 'horizontal');
    const items = integrated.locator('.inkra-radio-group__item');
    assert.equal(await items.count(), 3);
    const boxes = await items.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    assert(Math.max(...boxes.map(box => box.y)) - Math.min(...boxes.map(box => box.y)) < 1, `Segmented wrapped at ${width}: ${JSON.stringify(boxes)}`);
    for (let index = 1; index < boxes.length; index += 1) {
      assert(Math.abs(boxes[index].x - boxes[index - 1].right) < 1, `Disconnected segments at ${width}`);
    }
    assert.equal(await integrated.locator('.inkra-radio-group__frame').count(), 1);
    assert.equal(await integrated.locator('.inkra-pencil-surface--outline').count(), 1);
    const frame = await integrated.locator('.inkra-radio-group__frame').boundingBox();
    assert(frame.x <= boxes[0].x && frame.y < boxes[0].y);
    assert(frame.y + frame.height > boxes[0].bottom);
    const overflow = await integrated.locator('.inkra-radio-group__items').evaluate(node => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
    }));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow at ${width}`);
    assert(overflow.scrollWidth >= overflow.clientWidth);
    for (const label of await integrated.locator('.inkra-selection-control__label').all()) {
      const bounds = await label.evaluate(node => {
        const content = node.closest('.inkra-radio-segment__content').getBoundingClientRect();
        const source = (node.querySelector('.inkra-pencil-text__source') ?? node).getBoundingClientRect();
        return { content: content.toJSON(), source: source.toJSON() };
      });
      assert(bounds.source.left >= bounds.content.left - 1 && bounds.source.right <= bounds.content.right + 1, `Label overflow at ${width}: ${JSON.stringify(bounds)}`);
    }

    const radios = integrated.getByRole('radio');
    const first = radios.first();
    const second = radios.nth(1);
    if (width === 1302) {
      const firstSelection = items.nth(0).locator('.inkra-radio-segment__surface--selection');
      const secondSelection = items.nth(1).locator('.inkra-radio-segment__surface--selection');
      assert.equal(Number(await firstSelection.evaluate(node => getComputedStyle(node).opacity)), 1);
      assert.equal(Number(await secondSelection.evaluate(node => getComputedStyle(node).opacity)), 0);
      await second.check();
      await page.waitForTimeout(60);
      const middle = await Promise.all([
        firstSelection.evaluate(node => Number(getComputedStyle(node).opacity)),
        secondSelection.evaluate(node => Number(getComputedStyle(node).opacity)),
      ]);
      assert(middle.every(value => value > 0 && value < 1), `Missing selection crossfade ${middle}`);
      await page.waitForTimeout(180);
      assert.equal(Number(await firstSelection.evaluate(node => getComputedStyle(node).opacity)), 0);
      assert.equal(Number(await secondSelection.evaluate(node => getComputedStyle(node).opacity)), 1);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const reducedTransitions = await items.nth(1).locator('.inkra-radio-segment__surface').evaluateAll(nodes => nodes.map(node => ({
        duration: getComputedStyle(node).transitionDuration,
        property: getComputedStyle(node).transitionProperty,
      })));
      assert(reducedTransitions.every(transition => transition.property === 'none'), `Reduced motion transitions ${JSON.stringify(reducedTransitions)}`);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    } else {
      await first.focus();
      await page.keyboard.press('ArrowRight');
      assert(await second.isChecked());
    }
    assert.equal(await integrated.locator('.inkra-radio-group__item[data-checked="true"] .inkra-radio-group__segment').count(), 1);
    await integrated.screenshot({ path: `/tmp/inkra-phase2-radio-segmented-${width}.png` });
  }
  console.log('PASS integrated example-theme: single row at 1302/390/320, local overflow only, animated selection');

  await page.setViewportSize({ width: 1302, height: 954 });
  await visit('radio-group');
  await page.evaluate(async modulePath => {
    const reactModule = await import('/@id/react');
    const reactDomModule = await import('/@id/react-dom/client');
    const module = await import(modulePath);
    const React = reactModule.default ?? reactModule;
    const createRoot = reactDomModule.createRoot ?? reactDomModule.default?.createRoot;
    if (!createRoot) throw new Error('React createRoot is unavailable');
    const host = document.createElement('div');
    host.id = 'inkra-selection-fixture';
    document.body.append(host);
    const icon = name => React.createElement('span', { 'data-fixture-icon': name }, name.slice(0, 1));
    createRoot(host).render(React.createElement(
      'form',
      { id: 'inkra-selection-fixture-form' },
      React.createElement(
        module.RadioGroup,
        { defaultValue: 'graphite', label: 'Theme fixture', name: 'theme', orientation: 'horizontal', variant: 'segmented' },
        React.createElement(module.RadioGroupItem, { icon: icon('graphite'), label: 'Graphite', value: 'graphite' }),
        React.createElement(module.RadioGroupItem, { icon: icon('ocean'), label: 'Ocean', value: 'ocean' }),
        React.createElement(module.RadioGroupItem, { disabled: true, icon: icon('pine'), label: 'Pine', value: 'pine' }),
      ),
      React.createElement('button', { type: 'reset' }, 'Reset fixture'),
    ));
  }, '/@fs' + new URL('../packages/inkra/src/selection/RadioGroup.tsx', import.meta.url).pathname);
  const fixture = page.locator('#inkra-selection-fixture');
  const segmented = fixture.locator('.inkra-radio-group[data-variant="segmented"]');
  await segmented.waitFor();
  const radios = segmented.getByRole('radio');
  assert(await radios.count() >= 2);
  const first = radios.first();
  const second = radios.nth(1);
  assert(['horizontal', 'vertical'].includes(await segmented.getAttribute('data-orientation')));
  await first.focus();
  await page.keyboard.press('ArrowRight');
  assert(await second.isChecked());
  assert.equal(await page.locator('#inkra-selection-fixture-form').evaluate(form => new FormData(form).get('theme')), 'ocean');
  const selectedSegment = segmented.locator('.inkra-radio-group__item[data-checked="true"] .inkra-radio-group__segment');
  assert(await selectedSegment.count() === 1);
  assert.equal(await selectedSegment.locator('canvas.inkra-pencil-surface__ink').count(), 1);
  await page.waitForTimeout(220);
  assert.equal(Number(await selectedSegment.locator('.inkra-radio-segment__surface--selection').evaluate(node => getComputedStyle(node).opacity)), 1);
  const disabled = segmented.getByRole('radio', { name: 'Pine', exact: true });
  if (await disabled.count()) assert(await disabled.isDisabled());
  const aria = await first.evaluate(node => ({
    describedby: node.getAttribute('aria-describedby'),
    labelledby: node.getAttribute('aria-labelledby'),
    name: node.getAttribute('name'),
    type: node.type,
  }));
  assert.equal(aria.type, 'radio');
  assert(aria.name);
  assert(aria.labelledby);
  await fixture.getByRole('button', { name: 'Reset fixture', exact: true }).click();
  await page.waitForTimeout(0);
  assert(await first.isChecked());
  await segmented.evaluate(node => {
    node.dataset.orientation = 'vertical';
    node.querySelector('.inkra-radio-group__items').dataset.orientation = 'vertical';
  });
  const verticalBoxes = await segmented.locator('.inkra-radio-group__item').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
  for (let index = 1; index < verticalBoxes.length; index += 1) {
    assert(Math.abs(verticalBoxes[index].top - verticalBoxes[index - 1].bottom) < 1, 'Disconnected vertical segments');
    assert.equal(verticalBoxes[index].left, verticalBoxes[0].left);
  }
  await segmented.evaluate(node => {
    node.dataset.orientation = 'horizontal';
    node.querySelector('.inkra-radio-group__items').dataset.orientation = 'horizontal';
    node.dir = 'rtl';
    node.setAttribute('data-inkra-theme', 'dark');
  });
  await first.focus();
  await page.keyboard.press('ArrowLeft');
  assert(await second.isChecked(), 'RTL keyboard selection');
  await page.waitForTimeout(240);
  const frameCanvas = segmented.locator('.inkra-radio-group__frame > canvas');
  assert(await frameCanvas.evaluate(canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0)), 'Group frame is painted');
  await segmented.screenshot({ path: '/tmp/inkra-radio-group-dark-rtl.png' });
  await page.screenshot({ path: '/tmp/inkra-phase2-radio-segmented.png' });
  console.log('PASS segmented native radios, keyboard, form value/reset, disabled, pencil selection, accessible label');

  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
