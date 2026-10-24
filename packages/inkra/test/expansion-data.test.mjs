import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dataTable = readFileSync(new URL('../src/data-table/index.tsx', import.meta.url), 'utf8');
const dataTableStyles = readFileSync(new URL('../src/data-table/styles.css', import.meta.url), 'utf8');
const tree = readFileSync(new URL('../src/tree/index.tsx', import.meta.url), 'utf8');
const treeStyles = readFileSync(new URL('../src/tree/styles.css', import.meta.url), 'utf8');

test('DataTable composes TanStack v8 with the existing semantic Table and Checkbox', () => {
  assert.match(dataTable, /from '@tanstack\/react-table'/);
  for (const api of ['useReactTable', 'getCoreRowModel', 'getFilteredRowModel', 'getSortedRowModel', 'getPaginationRowModel', 'flexRender']) {
    assert.match(dataTable, new RegExp(`\\b${api}\\b`));
  }
  assert.match(dataTable, /import \{ Table \} from '\.\.\/content\/index\.js'/);
  assert.match(dataTable, /import \{ Checkbox \} from '\.\.\/selection\/Checkbox\.js'/);
  assert.match(dataTable, /getRowId: NonNullable<TableOptions<TData>\['getRowId'\]>/);
  assert.match(dataTable, /<Table\.Root/);
  assert.match(dataTable, /<Table\.Head[\s\S]*aria-sort=/);
  assert.match(dataTable, /<Checkbox[\s\S]*indeterminate=/);
  assert.doesNotMatch(dataTable, /<div[^>]+role=["'](?:grid|table|row|cell)["']/);
});

test('DataTable keeps pagination and select-all valid as filtering or eligibility changes', () => {
  assert.match(dataTable, /handleFilter[\s\S]*pageIndex: 0/);
  assert.match(dataTable, /getPrePaginationRowModel\(\)\.rows\.length/);
  assert.match(dataTable, /normalizeDataTablePagination\(initialPagination, filteredRowCount\)/);
  assert.match(dataTable, /paginationCorrection\.current === signature/);
  assert.match(dataTable, /rows\.some\(row => row\.getCanSelect\(\)\)/);
  assert.match(dataTable, /disabled=\{loading \|\| !hasSelectableRows\}/);
});

test('DataTable styles preserve local overflow, native targets and forced colors', () => {
  assert.match(dataTableStyles, /\.inkra-data-table__container/);
  assert.match(dataTableStyles, /\.inkra-data-table__selection\.inkra-selection-control/);
  assert.match(dataTableStyles, /var\(--inkra-touch-target\)/);
  assert.match(dataTableStyles, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(dataTableStyles, /transition:[^;]*(?:width|height)/);
});

test('Tree delegates navigation, selection and expansion to React Aria Components', () => {
  assert.match(tree, /from 'react-aria-components\/Tree'/);
  assert.match(tree, /from 'react-aria-components\/Button'/);
  assert.match(tree, /Tree as AriaTree/);
  assert.match(tree, /TreeItem as AriaTreeItem/);
  assert.match(tree, /TreeItemContent as AriaTreeItemContent/);
  assert.match(tree, /Button as AriaButton/);
  assert.match(tree, /slot="chevron"/);
  assert.match(tree, /selectionMode = 'single'/);
  assert.match(tree, /TreeRootProps<T extends object = object> = Omit<AriaTreeProps<T>/);
  assert.doesNotMatch(tree, /from 'react-aria-components';/);
  assert.doesNotMatch(tree, /onKeyDown|addEventListener\(['"]keydown|event\.key/);
  assert.doesNotMatch(tree, /dragAndDropHooks|useDragAndDrop/);
});

test('Tree styling supports logical indentation, RTL, reduced motion and forced colors', () => {
  assert.match(treeStyles, /padding-inline-start/);
  assert.match(treeStyles, /--inkra-tree-level/);
  assert.match(treeStyles, /:dir\(rtl\)/);
  assert.match(treeStyles, /prefers-reduced-motion: reduce/);
  assert.match(treeStyles, /forced-colors: active/);
  assert.match(treeStyles, /min-height: var\(--inkra-touch-target\)/);
});
