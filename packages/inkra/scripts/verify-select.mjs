import assert from 'node:assert/strict';
import process from 'node:process';

const playwrightRoot = process.env.INKRA_PLAYWRIGHT_ROOT ?? process.env.PLAYWRIGHT_MODULE ?? 'playwright';
const { chromium } = await import(playwrightRoot);

const origin = process.env.INKRA_SELECT_ORIGIN ?? 'http://127.0.0.1:4180';
const browser = await chromium.launch({ headless: true });

function colorDistance(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

async function textCanvasState(locator) {
  return locator.evaluate(element => {
    const canvas = element.querySelector('canvas');
    const context = canvas?.getContext('2d');
    const pixels = context && canvas
      ? context.getImageData(0, 0, canvas.width, canvas.height).data
      : [];
    let alphaTotal = 0;
    const weighted = [0, 0, 0];
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3] / 255;
      if (!alpha) continue;
      alphaTotal += alpha;
      weighted[0] += pixels[index] * alpha;
      weighted[1] += pixels[index + 1] * alpha;
      weighted[2] += pixels[index + 2] * alpha;
    }
    const css = getComputedStyle(element).color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
    return {
      average: alphaTotal ? weighted.map(value => Math.round(value / alphaTotal)) : [],
      css,
      hasPixels: alphaTotal > 0,
      ready: element.hasAttribute('data-pencil-ready'),
    };
  });
}

async function open(path) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = `${origin}${path}`;
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200, `Expected HTTP 200 for ${url}`);
  return { page, errors };
}

async function renderNestedFixture(page, mode) {
  await page.evaluate(async fixtureMode => {
    window.__inkraSelectFixtureRoot?.unmount();
    document.querySelector('#inkra-select-verify-host')?.remove();

    const [reactModule, reactDom, inkra] = await Promise.all([
      import('/@id/react'),
      import('/@id/react-dom/client'),
      import('/@id/inkra'),
    ]);
    const React = reactModule.default;
    const h = React.createElement;
    const host = document.createElement('div');
    host.id = 'inkra-select-verify-host';
    host.dir = 'rtl';
    host.dataset.inkraTheme = 'dark';
    host.style.setProperty('--inkra-test-token', 'nested-token');
    document.body.append(host);
    const reactDomClient = reactDom.default ?? reactDom;
    const root = reactDomClient.createRoot(host);
    window.__inkraSelectFixtureRoot = root;

    const options = className => h(
      inkra.Select.Portal,
      null,
      h(
        inkra.Select.Content,
        { className, position: 'popper', sideOffset: 8 },
        h(
          inkra.Select.Viewport,
          null,
          h(
            inkra.Select.Item,
            { value: 'a' },
            h(inkra.Select.ItemText, null, 'Alpha'),
            h(inkra.Select.ItemIndicator),
          ),
          h(
            inkra.Select.Item,
            { value: 'b' },
            h(inkra.Select.ItemText, null, 'Beta'),
            h(inkra.Select.ItemIndicator),
          ),
        ),
      ),
    );
    const select = className => h(
      inkra.Select.Root,
      { defaultValue: 'a', open: true },
      h(
        inkra.Select.Trigger,
        { className: `${className}-trigger` },
        h(inkra.Select.Value),
      ),
      options(className),
    );

    const fixture = fixtureMode === 'overlay'
      ? h(
          inkra.Overlay.Root,
          { open: true },
          h(inkra.Overlay.Trigger, { asChild: true }, h('button', { type: 'button' }, 'Open overlay')),
          h(
            inkra.Overlay.Portal,
            null,
            h(inkra.Overlay.Backdrop),
            h(
              inkra.Overlay.Content,
              { className: 'verify-overlay-content' },
              h(inkra.Overlay.Title, null, 'Overlay fixture'),
              h(inkra.Overlay.Description, null, 'Nested Select fixture'),
              select('verify-overlay-select'),
            ),
          ),
        )
      : h(
          inkra.Popover.Root,
          { open: true },
          h(inkra.Popover.Trigger, { asChild: true }, h('button', { type: 'button' }, 'Open popover')),
          h(
            inkra.Popover.Portal,
            null,
            h(
              inkra.Popover.Content,
              { className: 'verify-popover-content' },
              select('verify-popover-select'),
            ),
          ),
        );
    root.render(fixture);
  }, mode);

  const selectContent = page.locator(`.verify-${mode}-select`).first();
  await selectContent.waitFor({ state: 'visible' });
  const parentContent = page.locator(`.verify-${mode}-content`).first();
  const state = await selectContent.evaluate((element, parentSelector) => {
    const parent = document.querySelector(parentSelector);
    const style = getComputedStyle(element);
    const parentStyle = parent ? getComputedStyle(parent) : null;
    return {
      direction: style.direction,
      offset: style.getPropertyValue('--inkra-floating-layer-offset').trim(),
      parentOffset: parentStyle?.getPropertyValue('--inkra-floating-layer-offset').trim(),
      parentZIndex: parentStyle?.zIndex,
      token: style.getPropertyValue('--inkra-test-token').trim(),
      zIndex: style.zIndex,
    };
  }, `.verify-${mode}-content`);
  assert.equal(await parentContent.count(), 1);
  return state;
}

const evidence = {
  discovery: {
    binding: origin,
    bootstrap: `${origin}/llms.txt`,
    status: 'unavailable',
    note: 'Vite history fallback returned the application HTML instead of a Progressive Skill Discovery document.',
  },
};

try {
  const { page, errors } = await open('/components/select');
  const form = page.locator('.component-demo-form').first();
  await form.evaluate(element => {
    element.style.setProperty('--inkra-ink', 'rgb(18 52 86)');
    element.style.setProperty('--inkra-selection-foreground', 'rgb(220 40 150)');
  });

  const trigger = form.locator('.inkra-select__trigger').first();
  await page.keyboard.press('Tab');
  await trigger.evaluate(element => element.focus({ focusVisible: true }));
  await page.waitForFunction(() => document.querySelector('.component-demo-form .inkra-select__trigger')?.matches(':focus-visible'));
  await page.waitForFunction(() => {
    const ring = document.querySelector('.component-demo-form .inkra-select__focus-ring');
    const canvas = ring?.querySelector('canvas');
    const context = canvas?.getContext('2d');
    if (!ring || !canvas || !context || getComputedStyle(ring).opacity !== '1') return false;
    return Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data)
      .some((value, index) => index % 4 === 3 && value > 0);
  });
  const normalFocus = await trigger.evaluate(element => {
    const ring = element.querySelector('.inkra-select__focus-ring');
    return {
      focusVisible: element.matches(':focus-visible'),
      outlineStyle: getComputedStyle(element).outlineStyle,
      ringDisplay: ring ? getComputedStyle(ring).display : '',
      ringOpacity: ring ? getComputedStyle(ring).opacity : '',
    };
  });
  assert.equal(normalFocus.focusVisible, true);
  assert.equal(normalFocus.outlineStyle, 'none');
  assert.equal(normalFocus.ringOpacity, '1');

  await page.emulateMedia({ forcedColors: 'active' });
  const forcedFocus = await trigger.evaluate(element => {
    const ring = element.querySelector('.inkra-select__focus-ring');
    return {
      outlineStyle: getComputedStyle(element).outlineStyle,
      ringDisplay: ring ? getComputedStyle(ring).display : '',
    };
  });
  assert.equal(forcedFocus.outlineStyle, 'solid');
  assert.equal(forcedFocus.ringDisplay, 'none');
  await page.emulateMedia({ forcedColors: 'none' });

  await trigger.click();
  const items = page.locator('.inkra-select__item:not([data-disabled])');
  assert.ok(await items.count() >= 2, 'Expected at least two enabled Select items');
  const targetItem = items.nth(1);
  const targetText = targetItem.locator('.inkra-select__item-text-copy');
  await targetText.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const texts = document.querySelectorAll('.inkra-select__item:not([data-disabled]) .inkra-select__item-text-copy');
    return texts.length >= 2 && texts[1].hasAttribute('data-pencil-ready');
  });
  const before = await textCanvasState(targetText);
  await targetText.locator('canvas').evaluate(canvas => { canvas.dataset.verifyOldCanvas = 'true'; });
  await targetItem.hover();
  await page.waitForFunction(() => {
    const item = document.querySelectorAll('.inkra-select__item:not([data-disabled])')[1];
    const text = item?.querySelector('.inkra-select__item-text-copy');
    return item?.hasAttribute('data-highlighted')
      && text?.hasAttribute('data-pencil-ready')
      && !document.querySelector('canvas[data-verify-old-canvas="true"]');
  });
  const after = await textCanvasState(targetText);
  assert.equal(before.ready, true);
  assert.equal(before.hasPixels, true);
  assert.equal(after.ready, true);
  assert.equal(after.hasPixels, true);
  assert.ok(colorDistance(before.average, after.average) > 80, 'Expected highlighted item canvas ink to change');
  assert.ok(colorDistance(after.average, after.css) < 12, 'Expected highlighted canvas ink to match computed foreground');
  await targetItem.evaluate(element => element.focus({ focusVisible: true }));
  await page.waitForFunction(() => document.querySelector('.inkra-select__item:focus-visible'));
  const normalItemFocus = await targetItem.evaluate(element => ({
    focusVisible: element.matches(':focus-visible'),
    outlineStyle: getComputedStyle(element).outlineStyle,
  }));
  assert.equal(normalItemFocus.focusVisible, true);
  assert.equal(normalItemFocus.outlineStyle, 'none');
  await page.emulateMedia({ forcedColors: 'active' });
  const forcedItemFocus = await targetItem.evaluate(element => ({
    outlineStyle: getComputedStyle(element).outlineStyle,
  }));
  assert.equal(forcedItemFocus.outlineStyle, 'solid');
  await page.emulateMedia({ forcedColors: 'none' });
  assert.deepEqual(errors, []);
  evidence.focus = { normalFocus, forcedFocus };
  evidence.itemRepaint = { before, after, normalItemFocus, forcedItemFocus };

  evidence.overlay = await renderNestedFixture(page, 'overlay');
  assert.equal(evidence.overlay.offset, '20');
  assert.equal(evidence.overlay.parentOffset, '0');
  assert.equal(evidence.overlay.zIndex, '40');
  assert.equal(evidence.overlay.parentZIndex, '31');
  assert.equal(evidence.overlay.token, 'nested-token');
  assert.equal(evidence.overlay.direction, 'rtl');

  evidence.popover = await renderNestedFixture(page, 'popover');
  assert.equal(evidence.popover.offset, '20');
  assert.equal(evidence.popover.parentOffset, '0');
  assert.equal(evidence.popover.zIndex, '40');
  assert.equal(evidence.popover.parentZIndex, '20');
  assert.equal(evidence.popover.token, 'nested-token');
  assert.equal(evidence.popover.direction, 'rtl');
  assert.deepEqual(errors, []);

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  await page.close();
} finally {
  await browser.close();
}
