import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { createElement as h } from 'react';
import { act, create } from 'react-test-renderer';

// Exercise current source, including an optional pre-change implementation for
// deterministic comparisons without rebuilding or changing the shared checkout.
const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const sourceRoot = new URL('../src/', import.meta.url).href;
const entryUrl = new URL('../src/data-table/index.tsx', import.meta.url).href;
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
      const input = url === entryUrl && process.env.INKRA_DATA_TABLE_SOURCE
        ? process.env.INKRA_DATA_TABLE_SOURCE : new URL(url);
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(input, 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});
const { DataTable } = await import(entryUrl);
hooks.deregister();

let previousActEnvironment;
before(() => { previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT; globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
after(() => {
  if (previousActEnvironment === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  else globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

async function withRenderer(element, check) {
  let renderer;
  try {
    await act(async () => { renderer = create(element); });
    await check(renderer);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
  }
}

function captureTable(accessorKey = 'label') {
  let table;
  return {
    columns: [{ accessorKey, header: 'Label', cell(context) { table = context.table; return String(context.getValue()); } }],
    current: () => table,
  };
}

test('DataTable keeps the filtered page model stable across equivalent controlled rerenders', async () => {
  const probe = captureTable();
  const data = Array.from({ length: 12 }, (_, index) => ({ id: String(index), label: index < 3 ? `keep ${index}` : `other ${index}` }));
  let rowIds = 0;
  const corrections = [];
  const props = { data, columns: probe.columns, getRowId: row => { rowIds++; return row.id; }, globalFilter: 'keep', pagination: true };
  const render = className => h(DataTable, {
    ...props,
    className,
    paginationState: { pageIndex: 2, pageSize: 2 },
    onPaginationChange: update => corrections.push(update),
  });
  await withRenderer(render('first'), async renderer => {
    const initial = probe.current().getRowModel();
    assert.deepEqual(initial.rows.map(row => row.id), ['2']);
    assert.deepEqual(corrections, [{ pageIndex: 1, pageSize: 2 }]);
    for (let index = 0; index < 6; index++) {
      await act(async () => renderer.update(render(`unrelated-${index}`)));
      assert.equal(probe.current().getRowModel(), initial, 'equivalent pagination must not reslice the same filtered rows');
    }
    assert.equal(rowIds, data.length, 'unrelated updates preserve the core row model too');
    assert.equal(corrections.length, 1, 'changing callback identity does not repeat a rejected correction');
  });
});

test('DataTable observes pagination scalar edits even when the controlled object is reused', async () => {
  const probe = captureTable();
  const data = Array.from({ length: 12 }, (_, index) => ({ id: String(index), label: `Row ${index}` }));
  const paginationState = { pageIndex: 0, pageSize: 2 };
  const props = { data, columns: probe.columns, getRowId: row => row.id, pagination: true, paginationState };
  await withRenderer(h(DataTable, props), async renderer => {
    assert.deepEqual(probe.current().getRowModel().rows.map(row => row.id), ['0', '1']);
    paginationState.pageIndex = 1;
    await act(async () => renderer.update(h(DataTable, props)));
    assert.deepEqual(probe.current().getRowModel().rows.map(row => row.id), ['2', '3']);
    paginationState.pageSize = 3;
    await act(async () => renderer.update(h(DataTable, props)));
    assert.deepEqual(probe.current().getRowModel().rows.map(row => row.id), ['3', '4', '5']);
  });
});

test('DataTable refreshes every row identity on data-array replacement but renders only the page', async () => {
  const probe = captureTable();
  const data = Array.from({ length: 2000 }, (_, index) => ({ id: String(index), label: `Row ${index}` }));
  const calls = [];
  const props = { data, columns: probe.columns, getRowId: (row, index, parent) => { calls.push([row.id, index, parent]); return row.id; }, pagination: true, defaultPagination: { pageIndex: 0, pageSize: 25 } };
  await withRenderer(h(DataTable, props), async renderer => {
    assert.equal(calls.length, data.length);
    assert.equal(renderer.root.findByType('tbody').findAllByType('tr').length, 25);
    calls.length = 0;
    await act(async () => renderer.update(h(DataTable, { ...props, className: 'unrelated' })));
    assert.equal(calls.length, 0);
    const next = data.slice();
    next[7] = { ...next[7], label: 'Updated row' };
    await act(async () => renderer.update(h(DataTable, { ...props, data: next })));
    assert.equal(calls.length, data.length, 'data replacement re-evaluates the public getRowId callback for every row');
    assert.deepEqual(calls.map(([, index, parent]) => [index, parent]), data.map((_, index) => [index, undefined]));
    assert.equal(probe.current().getRowModel().rows[7].getValue('label'), 'Updated row');
    assert.equal(renderer.root.findByType('tbody').findAllByType('tr').length, 25);
  });
});

test('DataTable new data arrays refresh reused objects, external accessors and index-sensitive IDs', async () => {
  let table;
  let prefix = 'before';
  let multiplier = 1;
  const first = { id: 'a', count: 2 }, second = { id: 'b', count: 3 };
  const data = [first, second];
  const columns = [{ id: 'value', header: 'Value', accessorFn: (row, index) => row.count * multiplier + index, cell(context) { table = context.table; return String(context.getValue()); } }];
  const props = { data, columns, getRowId: (row, index) => `${prefix}:${index}:${row.id}` };
  await withRenderer(h(DataTable, props), async renderer => {
    assert.deepEqual(table.getRowModel().rows.map(row => [row.id, row.getValue('value')]), [['before:0:a', 2], ['before:1:b', 4]]);
    first.count = 5;
    prefix = 'after';
    multiplier = 10;
    await act(async () => renderer.update(h(DataTable, { ...props, data: [...data].reverse() })));
    assert.deepEqual(table.getRowModel().rows.map(row => [row.id, row.getValue('value')]), [['after:0:b', 30], ['after:1:a', 51]]);
  });
});

test('DataTable immutable changes preserve sorting, filtering and selection by row ID', async () => {
  let table;
  const data = [
    { id: 'a', label: 'keep a', score: 3, eligible: true },
    { id: 'b', label: 'keep b', score: 1, eligible: true },
    { id: 'c', label: 'other c', score: 2, eligible: false },
  ];
  const columns = [
    { accessorKey: 'label', header: 'Label', cell(context) { table = context.table; return String(context.getValue()); } },
    { accessorKey: 'score', header: 'Score' },
  ];
  const selectionUpdates = [];
  const props = {
    data, columns, getRowId: row => row.id, globalFilter: 'keep', sorting: [{ id: 'score', desc: false }],
    pagination: true, paginationState: { pageIndex: 0, pageSize: 2 }, selectable: true,
    rowSelection: { a: true }, getRowCanSelect: row => row.original.eligible,
    onRowSelectionChange: update => selectionUpdates.push(update),
  };
  await withRenderer(h(DataTable, props), async renderer => {
    assert.deepEqual(table.getRowModel().rows.map(row => [row.id, row.getIsSelected()]), [['b', false], ['a', true]]);
    const next = data.slice();
    next[2] = { ...next[2], label: 'keep c', score: 0 };
    await act(async () => renderer.update(h(DataTable, { ...props, data: next })));
    assert.deepEqual(table.getPrePaginationRowModel().rows.map(row => row.id), ['c', 'b', 'a']);
    assert.deepEqual(table.getRowModel().rows.map(row => [row.id, row.getCanSelect()]), [['c', false], ['b', true]]);
    assert.deepEqual(table.getSelectedRowModel().rows.map(row => row.id), ['a']);
    assert.equal(selectionUpdates.length, 0, 'refreshing data does not synthesize a selection change');
    await act(async () => table.toggleAllPageRowsSelected(true));
    assert.equal(selectionUpdates.length, 1);
    assert.equal(typeof selectionUpdates[0], 'function');
    assert.deepEqual(selectionUpdates[0](props.rowSelection), { a: true, b: true });
    assert.equal(table.getRow('b').getIsSelected(), false, 'controlled selection waits for the parent to accept the update');
  });
});

test('DataTable corrections retain current filtering, page navigation and eligibility semantics', async () => {
  const probe = captureTable();
  const data = Array.from({ length: 9 }, (_, index) => ({ id: String(index), label: index < 5 ? `keep ${index}` : `other ${index}` }));
  const corrections = [];
  const props = {
    data, columns: probe.columns, getRowId: row => row.id, pagination: true, paginationState: { pageIndex: 8, pageSize: 2 },
    globalFilter: 'keep', selectable: true, getRowCanSelect: row => row.id !== '4',
    onPaginationChange: update => corrections.push(update),
  };
  await withRenderer(h(DataTable, props), async renderer => {
    assert.deepEqual(probe.current().getRowModel().rows.map(row => row.id), ['4']);
    assert.deepEqual(corrections, [{ pageIndex: 2, pageSize: 2 }]);
    assert.equal(renderer.root.findByType('thead').findByType('input').props.disabled, true);
    await act(async () => probe.current().previousPage());
    assert.equal(typeof corrections[1], 'function', 'navigation preserves the updater callback contract');
    assert.deepEqual(corrections[1](props.paginationState), { pageIndex: 1, pageSize: 2 });
    await act(async () => renderer.update(h(DataTable, { ...props, globalFilter: 'other' })));
    assert.deepEqual(probe.current().getRowModel().rows.map(row => row.id), ['7', '8']);
    assert.deepEqual(corrections.filter(update => typeof update !== 'function').at(-1), { pageIndex: 1, pageSize: 2 });
    await act(async () => renderer.update(h(DataTable, { ...props, globalFilter: 'absent' })));
    assert.deepEqual(corrections.filter(update => typeof update !== 'function').at(-1), { pageIndex: 0, pageSize: 2 });
    assert.ok(JSON.stringify(renderer.toJSON()).includes('Page 0 of 0'));
    const pageButtons = renderer.root.findAllByType('button').filter(node => /^(Previous|Next) page$/.test(node.props['aria-label'] ?? ''));
    assert.equal(pageButtons.length, 2);
    assert.ok(pageButtons.every(node => node.props.disabled));
  });
});
