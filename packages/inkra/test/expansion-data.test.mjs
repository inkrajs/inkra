import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dataTable = readFileSync(new URL('../src/data-table/index.tsx', import.meta.url), 'utf8');
const dataTableStyles = readFileSync(new URL('../src/data-table/styles.css', import.meta.url), 'utf8');
const tree = readFileSync(new URL('../src/tree/index.tsx', import.meta.url), 'utf8');
const treeStyles = readFileSync(new URL('../src/tree/styles.css', import.meta.url), 'utf8');
const docs = readFileSync(new URL('../../../apps/docs/src/components/expansion/DataExamples.tsx', import.meta.url), 'utf8');
const browser = readFileSync(new URL('../../../apps/docs/scripts/verify-expansion-data.mjs', import.meta.url), 'utf8');

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
  assert.match(dataTable, /Math\.ceil\(filteredRowCount \/ resolvedPagination\.pageSize\) - 1/);
  assert.match(dataTable, /resolvedPagination\.pageIndex <= lastPageIndex/);
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

test('Data documentation exports the route contract and honest interaction scope', () => {
  assert.match(docs, /export const dataDocs: Record<string, ExpansionDoc>/);
  assert.match(docs, /'data-table':/);
  assert.match(docs, /tree:/);
  assert.match(docs, /useLocale\(\)/);
  assert.match(docs, /locale === 'zh-CN'/);
  assert.match(docs, /ComponentExample/);
  assert.match(docs, /ComponentPlayground/);
  assert.match(docs, /PropertyTabs/);
  assert.match(docs, /onPaginationChange=\{updater =>/);
  assert.match(docs, /density="\$\{density\}"/);
  assert.match(docs, /getRowCanSelect=\{\(\) => \$\{!disableRows\}\}/);
  assert.match(docs, /onExpandedChange=\{setExpandedKeys\}/);
  assert.match(docs, /onSelectionChange=\{setSelectedKeys\}/);
  assert.doesNotMatch(docs, /<Tree\.Item[^>]*>\.\.\.<\/Tree\.Item>|<Tree\.Root[^>]*>\.\.\.<\/Tree\.Root>/);
  assert.match(docs, /数据再多，也能排得明明白白。翻页、筛选、挑几行，都交给它。/);
  assert.match(docs, /文件夹里还有文件夹？展开看看，每一层都有自己的位置。/);
  assert.match(docs, /Virtualization, inline editing and server transport are not included/);
  assert.match(docs, /Drag and drop is not included/);
  assert.match(browser, /process\.env\.BASE_URL/);
});
