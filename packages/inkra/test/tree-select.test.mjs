import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  filterTreeSelectNodes,
  filterTreeSelectNodesFromIndex,
  indexTreeSelectNodes,
  normalizeTreeSelectNodes,
  updateTreeSelectSelection,
  updateTreeSelectSelectionFromIndex,
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


function nestedNodes(count) {
  let children = [];
  for (let position = count - 1; position >= 0; position--) {
    children = [{ id: `node-${position}`, label: `Node ${position}`, children }];
  }
  return children;
}

const bothDirections = { multiple: true, branchSelection: 'all', selectionPropagation: 'both' };

test('TreeSelect models index, search and select deeply nested input without recursive stack growth', () => {
  const count = 20000;
  const index = indexTreeSelectNodes(nestedNodes(count));
  assert.equal(index.orderedIds.length, count);
  assert.equal(index.parentById.get(`node-${count - 1}`), `node-${count - 2}`);
  const filtered = filterTreeSelectNodesFromIndex(index, `Node ${count - 1}`);
  assert.equal(filtered.visibleIds.size, count);
  assert.equal(filtered.expandedIds.size, count - 1);
  const selected = updateTreeSelectSelectionFromIndex(index, [], 'node-0', true, bothDirections);
  assert.equal(selected.length, count);
  assert.equal(selected[0], 'node-0');
  assert.equal(selected[count - 1], `node-${count - 1}`);
  assert.deepEqual(updateTreeSelectSelectionFromIndex(index, selected, `node-${count - 1}`, false, bothDirections), []);
});

test('TreeSelect bidirectional propagation reads each subtree a bounded number of times', () => {
  const count = 1000;
  const index = indexTreeSelectNodes(nestedNodes(count));
  let childReads = 0;
  for (const node of index.byId.values()) {
    const children = node.children;
    Object.defineProperty(node, 'children', { get() { childReads++; return children; } });
  }
  assert.equal(updateTreeSelectSelectionFromIndex(index, [], 'node-0', true, bothDirections).length, count);
  assert.ok(childReads <= count * 4, `Expected linear subtree reads, received ${childReads}`);
});

test('TreeSelect cached filtering preserves references and matching-subtree expansion order', () => {
  const index = indexTreeSelectNodes(nodes);
  const empty = filterTreeSelectNodesFromIndex(index, ' ');
  assert.equal(empty.nodes, index.nodes);
  assert.deepEqual([...empty.visibleIds], index.orderedIds);
  assert.equal(empty.expandedIds.size, 0);
  const matched = filterTreeSelectNodesFromIndex(index, 'root');
  assert.equal(matched.nodes[0], index.nodes[0]);
  assert.deepEqual([...matched.visibleIds], ['workspace', 'drafts', 'published', 'locked']);
  assert.deepEqual([...matched.expandedIds], ['workspace']);
  assert.match(componentSource, /filterTreeSelectNodesFromIndex\(normalized, query\)/);
  assert.match(componentSource, /updateTreeSelectSelectionFromIndex\(normalized, selectedIds/);
  assert.match(componentSource, /selectedKeys=\{selectedSet\}/);
});

test('TreeSelect propagation counts enabled descendants below disabled branches', () => {
  const tree = [{ id: 'root', label: 'Root', children: [
    { id: 'disabled', label: 'Disabled', disabled: true, children: [
      { id: 'leaf', label: 'Leaf' },
    ] },
    { id: 'empty', label: 'Empty', children: [{ id: 'locked', label: 'Locked', disabled: true }] },
  ] }];
  assert.deepEqual(updateTreeSelectSelection(tree, ['disabled', 'external', 'external'], 'root', true, bothDirections),
    ['root', 'disabled', 'leaf', 'empty', 'external']);
  assert.deepEqual(updateTreeSelectSelection(tree, ['root', 'disabled', 'leaf', 'empty', 'external'], 'leaf', false, bothDirections),
    ['disabled', 'empty', 'external']);
});

// Deliberately simple reference implementation: useful for checking all modes
// without coupling the expectations to the optimized bottom-up implementation.
function referenceSelection(input, current, toggledId, selected, options) {
  const index = indexTreeSelectNodes(input);
  const selectable = id => index.byId.has(id) && !index.disabledIds.has(id)
    && (options.branchSelection === 'all' || !index.branchIds.has(id));
  if (!selectable(toggledId)) return [...current];
  if (!options.multiple) return selected ? [toggledId] : [];
  const descendants = id => {
    const result = [];
    const visit = node => {
      for (const child of node.children ?? []) { result.push(child.id); visit(child); }
    };
    visit(index.byId.get(id));
    return result;
  };
  const next = new Set(current);
  const affected = [toggledId, ...(options.selectionPropagation === 'none' ? [] : descendants(toggledId))];
  for (const id of affected) {
    if (selectable(id)) { if (selected) next.add(id); else next.delete(id); }
  }
  if (options.selectionPropagation === 'both' && options.branchSelection === 'all') {
    for (const id of [...index.orderedIds].reverse()) {
      if (!index.branchIds.has(id) || !selectable(id)) continue;
      const children = descendants(id).filter(selectable);
      if (!children.length) continue;
      if (children.every(child => next.has(child))) next.add(id); else next.delete(id);
    }
  }
  return [...index.orderedIds.filter(id => next.has(id)), ...new Set(current.filter(id => !index.byId.has(id)))];
}

test('TreeSelect optimized selection matches a reference across deterministic random forests and modes', () => {
  let seed = 17;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let example = 0; example < 50; example++) {
    const forest = [];
    const records = [];
    for (let position = 0; position < 40; position++) {
      const node = { id: `node-${Math.floor(random() * 35)}`, label: `Node ${position}`, disabled: random() < .2, children: [] };
      const parent = records.length && random() < .7 ? records[Math.floor(random() * records.length)] : null;
      (parent ? parent.children : forest).push(node);
      records.push(node);
    }
    for (const multiple of [false, true]) for (const branchSelection of ['leaf', 'all']) for (const selectionPropagation of ['none', 'down', 'both']) {
      const current = records.filter(() => random() < .5).map(node => node.id).concat('external', 'external');
      const toggledId = records[Math.floor(random() * records.length)].id;
      const selected = random() < .5;
      const options = { multiple, branchSelection, selectionPropagation };
      assert.deepEqual(updateTreeSelectSelection(forest, current, toggledId, selected, options),
        referenceSelection(forest, current, toggledId, selected, options));
    }
  }
});
