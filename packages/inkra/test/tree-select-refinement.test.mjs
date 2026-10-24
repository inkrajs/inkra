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
const { TreeSelect } = await import('../src/tree-select/index.tsx');
hooks.deregister();

const items = [
  { id: 'short', label: 'Short' },
  { id: 'long', label: 'A deliberately long tree selection label that must remain on one line and truncate' },
];

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

function sharedControl(html) {
  const controlIndex = html.indexOf('inkra-tree-select__control');
  const controlStart = html.lastIndexOf('<div', controlIndex);
  const controlOpenEnd = html.indexOf('>', controlIndex);
  const controlEnd = html.indexOf('</div>', controlIndex);
  const triggerIndex = html.indexOf('inkra-tree-select__trigger', controlIndex);
  const clearIndex = html.indexOf('inkra-tree-select__clear', controlIndex);
  assert.ok(controlIndex >= 0);
  assert.ok(triggerIndex > controlIndex && triggerIndex < controlEnd);
  assert.ok(clearIndex > triggerIndex && clearIndex < controlEnd);
  assertNoNestedButtons(html);
  return {
    markup: html.slice(controlStart, controlEnd),
    opening: html.slice(controlStart, controlOpenEnd + 1),
  };
}

test('TreeSelect uses one shared outline with sibling trigger and clear buttons', () => {
  const html = renderToStaticMarkup(createElement(TreeSelect, {
    'aria-label': 'Destination',
    clearLabel: 'Clear destination',
    defaultValue: 'long',
    items,
    size: 'sm',
  }));
  const control = sharedControl(html);
  assert.match(control.opening, /role="group"/);
  assert.match(control.opening, /aria-label="Destination"/);
  assert.match(control.opening, /data-size="sm"/);
  assert.match(control.markup, /inkra-tree-select__trigger[^>]*data-size="sm"/);
  assert.match(control.markup, /inkra-tree-select__clear[^>]*data-size="icon-sm"/);
  assert.doesNotMatch(control.markup, /inkra-tree-select__trigger[^>]*inkra-pencil-surface--outline/);
});

test('TreeSelect reserves an unavailable clear slot and exposes state without changing API', () => {
  const empty = sharedControl(renderToStaticMarkup(createElement(TreeSelect, {
    'aria-label': 'Empty destination',
    items,
  }))).markup;
  assert.match(empty, /inkra-tree-select__clear/);
  assert.match(empty, /aria-hidden="true"/);
  assert.match(empty, /disabled=""/);
  assert.match(empty, /tabindex="-1"/);

  const stateful = renderToStaticMarkup(createElement(TreeSelect, {
    'aria-label': 'Stateful destination',
    defaultValue: 'short',
    dir: 'rtl',
    invalid: true,
    items,
    readOnly: true,
    size: 'lg',
  }));
  const root = stateful.match(/<div[^>]*class="inkra-tree-select"[^>]*>/)?.[0] ?? '';
  assert.match(root, /dir="rtl"/);
  assert.match(root, /data-invalid="true"/);
  assert.match(root, /data-readonly="true"/);
  assert.match(root, /data-size="lg"/);
  const clear = stateful.match(/<button[^>]*class="[^"]*inkra-tree-select__clear[^"]*"[^>]*>/)?.[0] ?? '';
  assert.match(clear, /disabled=""/);
  assert.match(clear, /data-size="icon-lg"/);
});
