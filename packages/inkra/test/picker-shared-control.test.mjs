import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const sourceRoot = new URL('../src/', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(sourceRoot) && specifier.startsWith('.') && specifier.endsWith('.js')) {
      const base = new URL(specifier.slice(0, -3), context.parentURL);
      for (const extension of ['.ts', '.tsx']) {
        const url = `${base.href}${extension}`;
        if (existsSync(fileURLToPath(url))) return { url, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(sourceRoot) && /\.tsx?$/.test(url)) {
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});
const { DatePicker } = await import('../src/date-picker/index.tsx');
const { TimePicker } = await import('../src/time-picker/index.tsx');
hooks.deregister();

function assertNoNestedButtons(html) {
  let depth = 0;
  let maximum = 0;
  for (const token of html.matchAll(/<\/?button\b/g)) {
    if (token[0].startsWith('</')) depth -= 1;
    else {
      depth += 1;
      maximum = Math.max(maximum, depth);
    }
  }
  assert.equal(depth, 0);
  assert.equal(maximum, 1);
}

function sharedControl(html, picker) {
  const controlClass = `inkra-${picker}__control`;
  const triggerClass = `inkra-${picker}__trigger`;
  const clearClass = `inkra-${picker}__clear`;
  const controlStart = html.indexOf(controlClass);
  const openingStart = html.lastIndexOf('<div', controlStart);
  const openingEnd = html.indexOf('>', controlStart);
  const controlEnd = html.indexOf('</div>', controlStart);
  const trigger = html.indexOf(triggerClass, controlStart);
  const clear = html.indexOf(clearClass, controlStart);
  assert.ok(controlStart >= 0);
  assert.ok(trigger > controlStart && trigger < controlEnd);
  assert.ok(clear > trigger && clear < controlEnd);
  assertNoNestedButtons(html);
  return {
    markup: html.slice(openingStart, controlEnd),
    opening: html.slice(openingStart, openingEnd + 1),
  };
}

test('DatePicker keeps trigger and logical-end clear action in one shared control', () => {
  const html = renderToStaticMarkup(createElement(DatePicker, {
    defaultValue: new Date(2026, 9, 22),
    dir: 'rtl',
    size: 'sm',
  }));
  const control = sharedControl(html, 'date-picker');
  assert.match(html, /inkra-date-picker[^>]*data-size="sm"[^>]*dir="rtl"/);
  assert.match(control.opening, /role="group"/);
  assert.match(control.opening, /aria-label="Choose date"/);
  assert.match(control.opening, /data-size="sm"/);
  assert.match(control.markup, /inkra-date-picker__trigger[^>]*data-size="sm"/);
  assert.match(control.markup, /inkra-date-picker__clear[^>]*data-size="icon-sm"/);
  assert.doesNotMatch(control.markup, /inkra-date-picker__trigger[^>]*inkra-pencil-surface--outline/);
});

test('TimePicker keeps clear state and large sizing inside the shared control', () => {
  const html = renderToStaticMarkup(createElement(TimePicker, {
    defaultValue: '09:30',
    dir: 'rtl',
    readOnly: true,
    size: 'lg',
  }));
  const control = sharedControl(html, 'time-picker');
  const clear = control.markup.match(/<button[^>]*class="[^"]*inkra-time-picker__clear[^"]*"[^>]*>/)?.[0] ?? '';
  assert.match(html, /inkra-time-picker[^>]*data-readonly="true"[^>]*data-size="lg"/);
  assert.match(control.opening, /role="group"/);
  assert.match(control.opening, /aria-label="Choose time"/);
  assert.match(control.opening, /data-size="lg"/);
  assert.match(control.markup, /inkra-time-picker__trigger[^>]*data-size="lg"/);
  assert.match(clear, /aria-hidden="true"/);
  assert.match(clear, /disabled=""/);
  assert.match(clear, /data-size="icon-lg"/);
});

test('empty picker clear actions remain reserved but unavailable', () => {
  const date = sharedControl(renderToStaticMarkup(createElement(DatePicker)), 'date-picker').markup;
  const time = sharedControl(renderToStaticMarkup(createElement(TimePicker)), 'time-picker').markup;
  for (const control of [date, time]) {
    assert.match(control, /aria-hidden="true"/);
    assert.match(control, /disabled=""/);
    assert.match(control, /tabindex="-1"/);
  }
});

test('picker styles separate visual sm/md/lg height from the touch target', () => {
  const date = readFileSync(new URL('../src/date-picker/styles.css', import.meta.url), 'utf8');
  const time = readFileSync(new URL('../src/time-picker/styles.css', import.meta.url), 'utf8');
  for (const [styles, name] of [[date, 'date'], [time, 'time']]) {
    assert.match(styles, new RegExp(`--inkra-${name}-picker-control-height:\\s*var\\(--inkra-control-md\\)`));
    assert.match(styles, /\[data-size="sm"\][\s\S]*var\(--inkra-control-sm\)/);
    assert.match(styles, /\[data-size="lg"\][\s\S]*var\(--inkra-control-lg\)/);
    assert.match(styles, /min-height:\s*var\(--inkra-touch-target\)/);
    assert.match(styles, /\.inkra-button-group\.inkra-(?:date|time)-picker__control/);
  }
});
