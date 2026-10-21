import assert from 'node:assert/strict';
import process from 'node:process';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const origin = process.env.INKRA_EDITABLE_ORIGIN ?? 'http://127.0.0.1:4180';
const browser = await chromium.launch({ headless: true });
const log = message => process.stderr.write(`[editable] ${message}\n`);

async function canvasState(locator) {
  return locator.evaluate(element => {
    const hit = element.closest('.inkra-field-control-hit');
    const canvas = hit?.querySelector('.inkra-editable-text');
    const context = canvas?.getContext('2d');
    const pixels = context && canvas ? context.getImageData(0, 0, canvas.width, canvas.height).data : [];
    return {
      ready: hit?.hasAttribute('data-pencil-editable-ready') ?? false,
      composing: hit?.hasAttribute('data-composing') ?? false,
      caret: getComputedStyle(element).caretColor,
      color: getComputedStyle(element).color,
      outline: getComputedStyle(element).outlineStyle,
      canvasPixels: Array.from(pixels).some((value, index) => index % 4 === 3 && value > 0),
    };
  });
}

async function open(path, beforeNavigate) {
  const page = await browser.newPage({ viewport: { width: 1302, height: 954 } });
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await beforeNavigate?.(page);
  const url = `${origin}${path}`;
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200, `Expected HTTP 200 for ${url}`);
  return { page, errors, url };
}

async function requiredControl(page, errors, url, selector, label) {
  try {
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: 'visible', timeout: 10000 });
    return locator;
  } catch (error) {
    const summary = await page.evaluate(() => ({
      title: document.title,
      bodyText: document.body.innerText.slice(0, 1200),
      inputs: document.querySelectorAll('input').length,
      textareas: document.querySelectorAll('textarea').length,
      path: window.location.pathname,
    }));
    throw new Error(`${label} was not available at ${url}: ${error.message}\npageErrors=${JSON.stringify(errors)}\nsummary=${JSON.stringify(summary)}`);
  }
}

async function waitForEditable(page, selector) {
  try {
    await page.waitForFunction(controlSelector => {
      const control = document.querySelector(controlSelector);
      return control?.closest('.inkra-field-control-hit')?.hasAttribute('data-pencil-editable-ready');
    }, selector);
  } catch (error) {
    const diagnostics = await page.locator(selector).first().evaluate(element => {
      const hit = element.closest('.inkra-field-control-hit');
      const canvas = hit?.querySelector('.inkra-editable-text');
      return {
        controlRect: element.getBoundingClientRect().toJSON(),
        controlValue: element.value,
        hitAttributes: hit ? Array.from(hit.attributes).map(attribute => [attribute.name, attribute.value]) : [],
        canvasRect: canvas?.getBoundingClientRect().toJSON(),
        canvasWidth: canvas?.width,
        canvasHeight: canvas?.height,
        html: hit?.outerHTML,
      };
    });
    throw new Error(`${error.message}\n${JSON.stringify(diagnostics, null, 2)}`);
  }
}

const evidence = {};

try {
  {
    log('open input route');
    const { page, errors, url } = await open('/components/input');
    const input = await requiredControl(page, errors, url, '.component-demo-form .inkra-input', 'Inkra Input');
    log('wait input placeholder pencil');
    await waitForEditable(page, '.component-demo-form .inkra-input');
    const placeholderState = await canvasState(input);
    assert.equal(placeholderState.ready, true);
    assert.equal(placeholderState.canvasPixels, true);

    await input.focus();
    await input.fill('Editable pencil text');
    log('wait input value pencil');
    await waitForEditable(page, '.component-demo-form .inkra-input');
    const valueState = await canvasState(input);
    assert.equal(await input.inputValue(), 'Editable pencil text');
    assert.notEqual(valueState.caret, 'rgba(0, 0, 0, 0)');
    assert.equal(valueState.color, 'rgba(0, 0, 0, 0)');
    assert.equal(valueState.outline, 'none');
    assert.equal(valueState.canvasPixels, true);

    await input.evaluate(element => element.dispatchEvent(new CompositionEvent('compositionstart')));
    await input.evaluate(element => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(element, '组合');
      element.dispatchEvent(new InputEvent('input', { bubbles: true, data: '组合', inputType: 'insertCompositionText', isComposing: true }));
      setter?.call(element, '组合输入');
      element.dispatchEvent(new InputEvent('input', { bubbles: true, data: '输入', inputType: 'insertCompositionText', isComposing: true }));
    });
    await page.waitForTimeout(50);
    const composingState = await canvasState(input);
    assert.equal(composingState.composing, true);
    assert.notEqual(composingState.color, 'rgba(0, 0, 0, 0)');
    assert.equal(await input.inputValue(), '组合输入');
    await input.evaluate(element => element.dispatchEvent(new CompositionEvent('compositionend')));
    await waitForEditable(page, '.component-demo-form .inkra-input');

    const scrollState = await input.evaluate(element => {
      element.value = 'A long editable pencil value that must scroll horizontally without changing the native value';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.scrollLeft = element.scrollWidth;
      element.dispatchEvent(new Event('scroll'));
      return { scrollLeft: element.scrollLeft, value: element.value };
    });
    await page.waitForTimeout(100);
    assert.ok(scrollState.scrollLeft > 0);
    assert.match(scrollState.value, /scroll horizontally/);

    await input.fill('x'.repeat(257));
    await page.waitForTimeout(100);
    const longFallback = await canvasState(input);
    assert.equal(longFallback.ready, false);
    assert.notEqual(longFallback.color, 'rgba(0, 0, 0, 0)');

    await page.emulateMedia({ forcedColors: 'active' });
    const forcedColors = await canvasState(input);
    assert.notEqual(forcedColors.color, 'rgba(0, 0, 0, 0)');
    await page.emulateMedia({ forcedColors: 'none' });
    assert.deepEqual(errors, []);
    evidence.input = { placeholderState, valueState, composingState, scrollState, longFallback, forcedColors, errors };
    await page.close();
    log('input route passed');
  }

  {
    log('open textarea route');
    const { page, errors, url } = await open('/components/textarea');
    const textarea = await requiredControl(page, errors, url, '.component-demo-form .inkra-textarea', 'Inkra Textarea');
    await textarea.fill('Line one\nLine two\nLine three\nLine four\nLine five\nLine six');
    await waitForEditable(page, '.component-demo-form .inkra-textarea');
    const beforeScroll = await canvasState(textarea);
    const scrollState = await textarea.evaluate(element => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event('scroll'));
      return { scrollTop: element.scrollTop, value: element.value };
    });
    await page.waitForTimeout(100);
    const afterScroll = await canvasState(textarea);
    assert.equal(scrollState.value, 'Line one\nLine two\nLine three\nLine four\nLine five\nLine six');
    assert.equal(beforeScroll.canvasPixels, true);
    assert.equal(afterScroll.canvasPixels, true);
    assert.deepEqual(errors, []);
    evidence.textarea = { beforeScroll, afterScroll, scrollState, errors };
    await page.close();
    log('textarea route passed');
  }

  {
    log('open input route with editable canvas failure');
    const { page, errors, url } = await open('/components/input', async currentPage => {
      await currentPage.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function getContext(...args) {
          if (this.classList.contains('inkra-editable-text')) return null;
          return original.apply(this, args);
        };
      });
    });
    const input = await requiredControl(page, errors, url, '.component-demo-form .inkra-input', 'Fallback Inkra Input');
    await input.fill('Native fallback remains visible');
    await page.waitForTimeout(100);
    const fallbackState = await canvasState(input);
    assert.equal(fallbackState.ready, false);
    assert.notEqual(fallbackState.color, 'rgba(0, 0, 0, 0)');
    assert.equal(await input.inputValue(), 'Native fallback remains visible');
    assert.deepEqual(errors, []);
    evidence.canvasFailure = { fallbackState, errors };
    await page.close();
    log('canvas failure fallback passed');
  }

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
} finally {
  await browser.close();
}
