import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../src/pagination/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/pagination/styles.css', import.meta.url), 'utf8');
const modelSource = readFileSync(new URL('../src/pagination/model.ts', import.meta.url), 'utf8');
const compiledModel = ts.transpileModule(modelSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const model = await import(`data:text/javascript;base64,${Buffer.from(compiledModel).toString('base64')}`);

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
      return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
      }).outputText };
    }
    return nextLoad(url, context);
  },
});
const { Pagination } = await import('../src/pagination/index.tsx');
hooks.deregister();

test('Pagination keeps huge page windows bounded and ordered at safe integer limits', () => {
  const entries = model.getPaginationEntries(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1, 999, 999);
  const pages = entries.filter(value => typeof value === 'number');
  assert(entries.length <= 16);
  assert.deepEqual(pages, [...pages].sort((a, b) => a - b));
  assert.equal(new Set(pages).size, pages.length);
  assert(pages.every(page => Number.isSafeInteger(page) && page >= 1 && page <= Number.MAX_SAFE_INTEGER));
  assert(pages.includes(Number.MAX_SAFE_INTEGER - 1));
});

test('Pagination SSR clamps shrinking totals without inventing a controlled callback or invalid target', () => {
  const requested = [];
  const html = renderToStaticMarkup(h(Pagination, {
    totalPages: 3,
    page: 99,
    onPageChange: page => requested.push(page),
    showFirstLast: true,
  }));
  assert.match(html, /aria-current="page"[^>]*aria-label="Page 3"/);
  assert.match(html, /aria-label="Next page"[^>]*disabled=""/);
  assert.match(html, /aria-label="Last page"[^>]*disabled=""/);
  assert.deepEqual(requested, [], 'rendering/clamping does not emit a user callback');
  assert.match(source, /if \(disabled \|\| !total \|\| target === current\) return/);
  assert.match(source, /onPageChange\?\.\(target\)/);
  assert.doesNotMatch(source, /lastRequested|pendingPage|requestRef/);
});

test('Pagination preserves native page semantics around long custom content and empty/disabled states', () => {
  const html = renderToStaticMarkup(h(Pagination, {
    totalPages: 5,
    page: 3,
    showFirstLast: true,
    renderPage: (page, state) => h('span', { 'data-current-copy': state.isCurrent || undefined }, `Extremely long custom page label ${page}`),
  }));
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  assert.match(html, /aria-label="Page 3"/);
  assert.match(html, /data-current-copy="true"/);
  assert.equal((html.match(/<button/g) ?? []).length, 9);
  const empty = renderToStaticMarkup(h(Pagination, { totalPages: 0, simple: true, disabled: true, showFirstLast: true }));
  assert.match(empty, /data-empty="true"/);
  assert.match(empty, /0 \/ 0/);
  assert.equal((empty.match(/disabled=""/g) ?? []).length, 4);
});

test('Pagination constrains custom page and summary content while preserving local horizontal scroll', () => {
  assert.match(styles, /\.inkra-pagination \{ min-inline-size: 0; max-inline-size: 100%; color:/);
  assert.doesNotMatch(styles, /container-type|container-name|\bcqi\b|inline-size: fit-content/);
  assert.match(source, /className="inkra-pagination__page-item"/);
  assert.match(styles, /overflow-x: auto/);
  assert.match(styles, /scroll-padding-inline: 8px/);
  assert.match(styles, /\.inkra-pagination__page-item \{[^}]*max-inline-size: max\(var\(--inkra-touch-target\), 50%\)/);
  assert.match(styles, /\.inkra-pagination__page\.inkra-button \{[^}]*max-inline-size: 100%/);
  assert.match(styles, /scroll-margin-inline: 8px/);
  assert.match(styles, /\.inkra-pagination__page \.inkra-button__surface \{[^}]*height: auto;[^}]*min-height: var\(--inkra-button-visual-height\)/);
  assert.match(styles, /\.inkra-pagination__page > \.inkra-button__focus-ring \{[^}]*inset-block: 0;[^}]*transform: none/);
  assert.match(styles, /\.inkra-pagination__summary \{[^}]*box-sizing: border-box;[^}]*max-inline-size: 100%/);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /white-space: normal/);
  assert.doesNotMatch(styles, /text-overflow: ellipsis/);
});

test('Pagination retains logical RTL arrows and native button ownership', () => {
  assert.match(styles, /\.inkra-pagination__arrow:dir\(rtl\) \{ transform: scaleX\(-1\)/);
  assert.doesNotMatch(source, /onKeyDown|role="button"|tabIndex=/);
  assert.match(source, /<Button[\s\S]*aria-label=\{text\[kind\]\}/);
  assert.match(source, /<Button[\s\S]*aria-current=\{entry === current \? 'page' : undefined\}/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*?\.inkra-pencil-surface\.inkra-pagination__selection \{ display: none !important; \}/);
});
