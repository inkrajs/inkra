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
const source = readFileSync(new URL('../src/data-table/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/data-table/styles.css', import.meta.url), 'utf8');
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
const { DataTable } = await import('../src/data-table/index.tsx');
const { normalizeDataTablePagination } = await import('../src/data-table/model.ts');
hooks.deregister();

test('DataTable normalizes invalid and empty pagination without inventing pages', () => {
  assert.deepEqual(normalizeDataTablePagination({ pageIndex: 8, pageSize: 3 }, 7), { pageIndex: 2, pageSize: 3 });
  assert.deepEqual(normalizeDataTablePagination({ pageIndex: 8, pageSize: 3 }, 0), { pageIndex: 0, pageSize: 3 });
  assert.deepEqual(normalizeDataTablePagination({ pageIndex: -2, pageSize: 0 }, 4), { pageIndex: 0, pageSize: 1 });
  assert.deepEqual(normalizeDataTablePagination({ pageIndex: Number.NaN, pageSize: Number.NaN }, 21), { pageIndex: 0, pageSize: 10 });
  assert.match(source, /const normalizedUpdater: Updater<PaginationState>/);
  assert.match(source, /onPaginationChange\?\.\(normalizedUpdater\)/);
  assert.match(source, /paginationCorrection\.current === signature/);
  assert.doesNotMatch(source, /Math\.max\(1, table\.getPageCount\(\)\)/);
  assert.doesNotMatch(source, /export function normalizeDataTablePagination/);
});

test('DataTable treats filtered row-count changes as distinct controlled correction stages', () => {
  const controlled = { pageIndex: 9, pageSize: 2 };
  assert.deepEqual(normalizeDataTablePagination(controlled, 5), { pageIndex: 2, pageSize: 2 });
  assert.deepEqual(normalizeDataTablePagination(controlled, 6), { pageIndex: 2, pageSize: 2 });
  assert.match(source, /const signature = `\$\{filteredRowCount\}:/);
  assert.match(source, /\}, \[effectivePagination\.pageIndex, effectivePagination\.pageSize, filteredRowCount, onPaginationChange, pagination,/);
});

test('DataTable current source pencils final string headers and cells while preserving table semantics', () => {
  const rows = [{ id: 'a', name: 'Alpha', count: 2 }];
  const columns = [{ accessorKey: 'name', header: 'Name' }, { accessorKey: 'count', header: createElement('strong', null, 'Count') }];
  const html = renderToStaticMarkup(createElement(DataTable, {
    columns,
    data: rows,
    filterable: true,
    getRowId: row => row.id,
    pagination: true,
  }));
  assert.match(html, /<table/);
  assert.match(html, /aria-sort="none"/);
  assert.match(html, /inkra-data-table__sort-focus/);
  assert.match(html, /inkra-data-table__sort-icon/);
  assert.match(html, /inkra-pencil-text__source">Name</);
  assert.match(html, /inkra-pencil-text__source">Alpha</);
  assert.match(html, /inkra-pencil-text__source">Filter rows</);
  assert.match(html, /<strong>Count<\/strong>/);
  assert.equal((html.match(/<strong>Count<\/strong>/g) ?? []).length, 1, 'custom ReactNode header stays intact');
  assert.match(source, /defaultColumn: \{[\s\S]*cell: context => pencilCopy\(context\.renderValue/);
  assert.match(source, /header: context => pencilCopy\(context\.column\.id/);
  assert.match(source, /flexRender\(cell\.column\.columnDef\.cell, cell\.getContext\(\)\)/);
  assert.doesNotMatch(source, /cell\.column\.columnDef\.cell\(cell\.getContext\(\)\)/);
});

test('DataTable sort state uses distinct geometry and pencil focus with platform fallback', () => {
  assert.match(source, /sortAscendingIcon/);
  assert.match(source, /sortDescendingIcon/);
  assert.match(source, /data-direction=\{direction \|\| 'none'\}/);
  assert.match(source, /direction === 'asc' \? sortAscendingIcon : direction === 'desc' \? sortDescendingIcon : sortIcon/);
  assert.match(source, /<PencilSurface[\s\S]*inkra-data-table__sort-focus/);
  assert.match(styles, /\.inkra-data-table__sort:focus-visible \{ outline: 0; \}/);
  assert.match(styles, /\.inkra-data-table__sort:focus-visible > \.inkra-data-table__sort-focus \{ opacity: 1; \}/);
  assert.match(styles, /forced-colors: active[\s\S]*\.inkra-data-table__sort-focus \{ display: none !important; \}/);
  assert.match(styles, /outline: var\(--inkra-focus-width\) solid Highlight/);
});

test('DataTable pagination responds to its own narrow container and logical direction', () => {
  assert.match(styles, /\.inkra-data-table \{ container-type: inline-size/);
  assert.match(styles, /@container \(max-width: 30rem\)/);
  assert.match(styles, /grid-template-columns: var\(--inkra-touch-target\) minmax\(0, 1fr\) var\(--inkra-touch-target\)/);
  assert.match(styles, /\.inkra-data-table__page-arrow:dir\(rtl\) \{ transform: scaleX\(-1\); \}/);
  assert.match(source, /pageCount === 0 \? 0 : effectivePagination\.pageIndex \+ 1/);
  assert.match(source, /disabled=\{loading \|\| pageCount === 0/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});
