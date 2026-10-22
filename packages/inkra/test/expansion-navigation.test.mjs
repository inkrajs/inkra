import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const modelSource = source('../src/pagination/model.ts');
const compiled = ts.transpileModule(modelSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { normalizeTotal, clampPage, getPaginationEntries } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const pagination = source('../src/pagination/index.tsx');
const command = source('../src/command/index.tsx');

// Load only this package's TS sources in memory; never write or clean shared dist.
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
const { Command } = await import('../src/command/index.tsx');
hooks.deregister();

test('Pagination source SSR exposes a single current page, boundary controls and no links', () => {
  const html = renderToStaticMarkup(createElement(Pagination, { totalPages: 20, page: 20, showFirstLast: true }));
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.match(html, /<button[^>]*aria-current="page"[^>]*aria-label="Page 20"/);
  assert.match(html, /aria-label="Next page"[^>]*disabled=""/);
  assert.match(html, /aria-label="Last page"[^>]*disabled=""/);
  assert.match(html, /More pages/);
  assert.doesNotMatch(html, /<a\b/);
  const empty = renderToStaticMarkup(createElement(Pagination, { totalPages: 0, showFirstLast: true }));
  assert.equal((empty.match(/<button/g) || []).length, 4);
  assert.equal((empty.match(/disabled=""/g) || []).length, 4);
  assert.doesNotMatch(empty, /aria-current/);
  const clamped = renderToStaticMarkup(createElement(Pagination, { totalPages: 2, page: 99 }));
  assert.match(clamped, /<button[^>]*aria-current="page"[^>]*aria-label="Page 2"/);
});

test('Command source SSR preserves cmdk combobox/listbox and disabled option semantics', () => {
  const html = renderToStaticMarkup(createElement(Command.Root, { label: 'Workspace commands' },
    createElement(Command.Input, { placeholder: 'Search' }),
    createElement(Command.List, { label: 'Results' },
      createElement(Command.Group, { heading: 'Notes' },
        createElement(Command.Item, { value: 'new', shortcut: 'Ctrl+N' }, 'New note'),
        createElement(Command.Item, { value: 'archive', disabled: true }, 'Archive')))));
  assert.match(html, /role="combobox"/);
  assert.match(html, /role="listbox"/);
  assert.match(html, /role="option" aria-disabled="true"/);
  assert.match(html, /Workspace commands/);
  assert.match(html, /<kbd/);
  assert.match(html, /Ctrl\+N/);
});

test('Pagination normalizes empty, invalid and fractional totals and pages', () => {
  for (const value of [0, -1, NaN, Infinity, -Infinity]) {
    assert.equal(normalizeTotal(value), 0);
    assert.deepEqual(getPaginationEntries(value, 3), []);
  }
  assert.equal(normalizeTotal(4.8), 4);
  assert.equal(clampPage(7, 0), 0);
  assert.equal(clampPage(-3, 10), 1);
  assert.equal(clampPage(NaN, 10), 1);
  assert.equal(clampPage(4.9, 10), 4);
  assert.equal(clampPage(99, 3), 3);
});

test('Pagination produces short, ordered windows without an unnecessary single-page ellipsis', () => {
  assert.deepEqual(getPaginationEntries(1, 1), [1]);
  assert.deepEqual(getPaginationEntries(5, 3), [1, 2, 3, 4, 5]);
  assert.deepEqual(getPaginationEntries(20, 10), [1, 'ellipsis-start', 9, 10, 11, 'ellipsis-end', 20]);
  assert.deepEqual(getPaginationEntries(20, 1), [1, 2, 'ellipsis-end', 20]);
  assert.deepEqual(getPaginationEntries(20, 20), [1, 'ellipsis-start', 19, 20]);
  assert.deepEqual(getPaginationEntries(20, 10, 0, 0), ['ellipsis-start', 10, 'ellipsis-end']);
});

test('Pagination window remains bounded for huge inputs and all small input combinations', () => {
  assert(getPaginationEntries(Number.MAX_SAFE_INTEGER, 900, Infinity, 999).length <= 16);
  for (let total = 1; total < 45; total += 1) {
    for (let page = -1; page <= total + 1; page += 1) {
      for (const siblings of [0, 1, 3]) {
        const entries = getPaginationEntries(total, page, siblings, 1);
        const pages = entries.filter(value => typeof value === 'number');
        assert.equal(pages.length, new Set(pages).size);
        assert.deepEqual(pages, [...pages].sort((a, b) => a - b));
        assert(pages.every(value => value >= 1 && value <= total));
        assert(pages.includes(clampPage(page, total)));
        assert.equal(entries.length, new Set(entries).size);
      }
    }
  }
});

test('Pagination uses native buttons and current-page semantics with controlled state and total clamping', () => {
  assert.match(pagination, /<nav aria-label=/);
  assert.match(pagination, /<ul[\s\S]*<li/);
  assert.match(pagination, /aria-current=\{entry === current \? 'page' : undefined\}/);
  assert.match(pagination, /page === undefined\) setInternalPage/);
  assert.match(pagination, /target === current\) return/);
  assert.match(pagination, /onPageChange\?\.\(target\)/);
  assert.match(pagination, /useEffect\([\s\S]*clampPage\(value, total\)/);
  assert.doesNotMatch(pagination, /href=|role="link"|onKeyDown/);
});

test('Command delegates search, groups and keyboard selection to cmdk and guards IME submission', () => {
  assert.match(command, /from 'cmdk'/);
  for (const part of ['Input', 'List', 'Group', 'Item', 'Empty', 'Separator']) assert.match(command, new RegExp(`<Primitive\\.${part}\\b`));
  assert.match(command, /loop = true/);
  assert.match(command, /composing\.current \|\| event\.nativeEvent\.isComposing \|\| event\.keyCode === 229/);
  assert.match(command, /event\.preventDefault\(\)/);
  assert.match(command, /onCompositionStartCapture/);
  assert.match(command, /<kbd/);
  assert.doesNotMatch(command, /addEventListener|ArrowDown|ArrowUp|fuzzy|new RegExp/);
  assert.match(command, /PencilSurface/);
  assert.match(command, /PencilText/);
  assert.match(command, /PencilLine/);
});

test('Navigation styling keeps logical layout, forced colors, native targets and reduced motion', () => {
  const paginationCss = source('../src/pagination/styles.css');
  assert.match(paginationCss, /flex-wrap: nowrap/);
  assert.match(paginationCss, /overflow-x: auto/);
  assert.match(paginationCss, /scroll-padding-inline: 8px/);
  for (const component of ['pagination', 'command']) {
    const css = source(`../src/${component}/styles.css`);
    assert.match(css, /var\(--inkra-touch-target\)/);
    assert.match(css, /forced-colors: active/);
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(css, /inline-size|padding-inline/);
    assert.doesNotMatch(css, /transition:[^;]*(?:width|height)/);
  }
});

test('Navigation docs expose the shared contract and installed-package browser evidence script', () => {
  const docs = source('../../../apps/docs/src/components/expansion/NavigationExamples.tsx');
  assert.match(docs, /export const navigationDocs: Record<string, ExpansionDoc>/);
  assert.match(docs, /locale === 'zh-CN'/);
  assert.match(docs, /from '@inkra\/react'/);
  assert.match(docs, /ComponentExample/);
  assert.match(docs, /ComponentPlayground/);
  assert.match(docs, /PropertyTabs/);
  assert.match(docs, /<Overlay\.Portal/);
  assert.match(docs, /not link navigation/);
  assert.match(docs, /Shortcut hints do not register global keys/);
  const browser = source('../../../apps/docs/scripts/verify-expansion-navigation.mjs');
  assert.match(browser, /process\.env\.BASE_URL/);
  assert.match(browser, /compositionstart/);
  assert.match(browser, /forcedColors/);
});
