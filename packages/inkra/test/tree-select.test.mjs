import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  filterTreeSelectNodes,
  indexTreeSelectNodes,
  normalizeTreeSelectNodes,
  updateTreeSelectSelection,
} from '../src/tree-select/model.ts';

const nodes = [
  {
    id: 'workspace',
    label: 'Workspace',
    keywords: 'root',
    children: [
      { id: 'drafts', label: 'Drafts' },
      { id: 'published', label: 'Published' },
      { id: 'locked', label: 'Locked', disabled: true },
    ],
  },
  {
    id: 'assets',
    label: 'Assets',
    children: [{ id: 'images', label: 'Images', keywords: 'photos' }],
  },
];

const componentSource = await readFile(new URL('../src/tree-select/index.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/tree-select/styles.css', import.meta.url), 'utf8');
const treeSelectModule = process.env.INKRA_TREE_SELECT_MODULE
  ? new URL(process.env.INKRA_TREE_SELECT_MODULE, import.meta.url).href
  : null;

test('TreeSelect normalizes duplicate stable ids by preserving the first node', () => {
  const normalized = normalizeTreeSelectNodes([
    ...nodes,
    { id: 'drafts', label: 'Duplicate top-level draft' },
  ]);
  const index = indexTreeSelectNodes(normalized);
  assert.deepEqual(index.orderedIds, ['workspace', 'drafts', 'published', 'locked', 'assets', 'images']);
  assert.equal(index.byId.get('drafts')?.label, 'Drafts');
  assert.equal(index.parentById.get('images'), 'assets');
});

test('TreeSelect filtering retains ancestors, supports keywords and does not mutate selection', () => {
  const filtered = filterTreeSelectNodes(nodes, 'photo');
  assert.deepEqual(filtered.nodes.map(node => node.id), ['assets']);
  assert.deepEqual(filtered.nodes[0].children?.map(node => node.id), ['images']);
  assert.deepEqual([...filtered.expandedIds], ['assets']);
  assert.deepEqual(updateTreeSelectSelection(nodes, ['published'], 'images', true, {
    multiple: true,
    branchSelection: 'leaf',
    selectionPropagation: 'none',
  }), ['published', 'images']);
});

test('TreeSelect leaf-only mode ignores branch selection while independent leaves toggle', () => {
  assert.deepEqual(updateTreeSelectSelection(nodes, ['drafts'], 'workspace', true, {
    multiple: true,
    branchSelection: 'leaf',
    selectionPropagation: 'down',
  }), ['drafts']);
  assert.deepEqual(updateTreeSelectSelection(nodes, ['drafts'], 'published', true, {
    multiple: true,
    branchSelection: 'leaf',
    selectionPropagation: 'none',
  }), ['drafts', 'published']);
});

test('TreeSelect downward propagation skips disabled nodes and preserves unknown controlled ids', () => {
  assert.deepEqual(updateTreeSelectSelection(nodes, ['external'], 'workspace', true, {
    multiple: true,
    branchSelection: 'all',
    selectionPropagation: 'down',
  }), ['workspace', 'drafts', 'published', 'external']);
  assert.deepEqual(updateTreeSelectSelection(nodes, ['workspace', 'drafts', 'published', 'external'], 'workspace', false, {
    multiple: true,
    branchSelection: 'all',
    selectionPropagation: 'down',
  }), ['external']);
});

test('TreeSelect bidirectional propagation derives enabled parent branches', () => {
  const first = updateTreeSelectSelection(nodes, [], 'drafts', true, {
    multiple: true,
    branchSelection: 'all',
    selectionPropagation: 'both',
  });
  assert.deepEqual(first, ['drafts']);
  const complete = updateTreeSelectSelection(nodes, first, 'published', true, {
    multiple: true,
    branchSelection: 'all',
    selectionPropagation: 'both',
  });
  assert.deepEqual(complete, ['workspace', 'drafts', 'published']);
  assert.deepEqual(updateTreeSelectSelection(nodes, complete, 'drafts', false, {
    multiple: true,
    branchSelection: 'all',
    selectionPropagation: 'both',
  }), ['published']);
});

test('TreeSelect single mode emits one stable id without applying multiple propagation', () => {
  assert.deepEqual(updateTreeSelectSelection(nodes, ['drafts'], 'images', true, {
    multiple: false,
    branchSelection: 'all',
    selectionPropagation: 'both',
  }), ['images']);
});

test('TreeSelect composes existing Tree, Popover, Input and Button primitives', () => {
  assert.match(componentSource, /<Popover\.Root/);
  assert.match(componentSource, /<Tree\.Root/);
  assert.match(componentSource, /<Input/);
  assert.match(componentSource, /<Button/);
  assert.match(componentSource, /<ButtonGroup/);
  assert.match(componentSource, /filterTreeSelectNodes/);
  assert.match(componentSource, /updateTreeSelectSelection/);
  assert.match(componentSource, /onOpenAutoFocus/);
  assert.match(componentSource, /treeRef\.current\?\.focus/);
  assert.match(componentSource, /onPointerDown=\{event => event\.preventDefault\(\)\}/);
  assert.match(componentSource, /setOpen\(false\)/);
  assert.match(componentSource, /triggerRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(componentSource, /role=["']tree["']|role=["']treeitem["']/);
});

test('TreeSelect styles preserve stable controls, bounded popup and accessibility fallbacks', () => {
  assert.match(styles, /--inkra-tree-select-control-height:\s*var\(--inkra-control-md\)/);
  assert.match(styles, /data-size="sm".*var\(--inkra-control-sm\)/);
  assert.match(styles, /data-size="lg".*var\(--inkra-control-lg\)/);
  assert.match(styles, /\.inkra-button-group\.inkra-tree-select__control/);
  assert.match(styles, /block-size:\s*var\(--inkra-tree-select-control-height\)/);
  assert.match(styles, /min-height:\s*var\(--inkra-touch-target\)/);
  assert.match(styles, /\.inkra-tree-select__clear\[aria-hidden="true"\]/);
  assert.match(styles, /--inkra-accent-strong:\s*var\(--inkra-danger\)/);
  assert.match(styles, /text-overflow:\s*ellipsis/);
  assert.match(styles, /--radix-popover-trigger-width/);
  assert.match(styles, /max-height:\s*min\(22rem/);
  assert.match(styles, /overflow:\s*auto/);
  assert.match(styles, /@media \(max-width: 30rem\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /@media print/);
  assert.doesNotMatch(styles, /border-radius:\s*(?:9|[1-9][0-9]+)px/);
});

test('TreeSelect reset waits for cancellation and preserves controlled value ownership', () => {
  assert.match(componentSource, /const reset = \(event: Event\)/);
  assert.match(componentSource, /resetTimer = setTimeout\(\(\) => \{/);
  assert.match(componentSource, /if \(event\.defaultPrevented\) return/);
  assert.match(componentSource, /if \(!controlledSelection\) setUncontrolledSelection\(defaultSelection\.current\)/);
  assert.match(componentSource, /formAnchorRef\.current\?\.form/);
  assert.match(componentSource, /clearTimeout\(resetTimer\)/);
});

test('TreeSelect SSR keeps the trigger and submitted values without requiring a portal', { skip: !treeSelectModule }, async () => {
  const { TreeSelect } = await import(treeSelectModule);
  const markup = renderToStaticMarkup(createElement(TreeSelect, {
    'aria-label': 'Destination',
    defaultValue: 'drafts',
    items: nodes,
    name: 'destination',
  }));
  assert.match(markup, /aria-label="Destination"/);
  assert.match(markup, /Drafts/);
  assert.match(markup, /name="destination"/);
  assert.match(markup, /value="drafts"/);
  assert.doesNotMatch(markup, /role="tree"/);
});

