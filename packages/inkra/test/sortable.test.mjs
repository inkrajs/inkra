import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';

const modelModule = process.env.INKRA_SORTABLE_MODEL_MODULE
  ? new URL(process.env.INKRA_SORTABLE_MODEL_MODULE, import.meta.url).href
  : new URL('../dist/sortable/model.js', import.meta.url).href;
const sortableModule = process.env.INKRA_SORTABLE_MODULE
  ? new URL(process.env.INKRA_SORTABLE_MODULE, import.meta.url).href
  : new URL('../dist/sortable/index.js', import.meta.url).href;

const {
  findSortableLocation,
  projectSortableMove,
  sortableContainersEqual,
} = await import(modelModule);
const { Sortable } = await import(sortableModule);

const getId = item => item.id;
const fixtures = () => [
  { id: 'ideas', label: 'Ideas', items: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }, { id: 'c', label: 'Gamma' }] },
  { id: 'done', label: 'Done', items: [{ id: 'd', label: 'Delta' }] },
];

test('model reorders within one container without mutating caller data', () => {
  const source = fixtures();
  const next = projectSortableMove(source, 'a', getId, {
    overContainerId: 'ideas',
    overItemId: 'c',
    insertAfter: true,
  });
  assert.deepEqual(next[0].items.map(getId), ['b', 'c', 'a']);
  assert.deepEqual(source[0].items.map(getId), ['a', 'b', 'c']);
  assert.notEqual(next, source);
  assert.notEqual(next[0].items, source[0].items);
});

test('model moves across containers and supports an empty target', () => {
  const source = fixtures();
  source[1] = { ...source[1], items: [] };
  const next = projectSortableMove(source, 'b', getId, { overContainerId: 'done' });
  assert.deepEqual(next.map(container => container.items.map(getId)), [['a', 'c'], ['b']]);
  assert.deepEqual(findSortableLocation(next, 'b', getId), { containerId: 'done', index: 0 });
});

test('model inserts before and after cross-container item targets', () => {
  const source = fixtures();
  const before = projectSortableMove(source, 'a', getId, {
    overContainerId: 'done',
    overItemId: 'd',
  });
  const after = projectSortableMove(source, 'a', getId, {
    overContainerId: 'done',
    overItemId: 'd',
    insertAfter: true,
  });
  assert.deepEqual(before[1].items.map(getId), ['a', 'd']);
  assert.deepEqual(after[1].items.map(getId), ['d', 'a']);
});

test('model ignores disabled, missing and self targets', () => {
  const source = fixtures();
  const disabled = [{ ...source[0] }, { ...source[1], disabled: true }];
  assert(sortableContainersEqual(
    disabled,
    projectSortableMove(disabled, 'a', getId, { overContainerId: 'done' }),
    getId,
  ));
  assert(sortableContainersEqual(
    source,
    projectSortableMove(source, 'a', getId, { overContainerId: 'ideas', overItemId: 'a', insertAfter: true }),
    getId,
  ));
  assert(sortableContainersEqual(
    source,
    projectSortableMove(source, 'missing', getId, { overContainerId: 'ideas' }),
    getId,
  ));
});

test('Sortable renders list and grid containers on the server without browser globals', () => {
  const html = render(h(Sortable, {
    containers: [
      { ...fixtures()[0], layout: 'list' },
      { ...fixtures()[1], layout: 'grid', disabled: true },
    ],
    getItemId: getId,
    getItemLabel: item => item.label,
    handle: true,
    isItemDisabled: item => item.id === 'b',
    onChange() {},
    renderItem: ({ item }) => h('span', null, item.label),
  }));
  assert.match(html, /data-layout="list"/);
  assert.match(html, /data-layout="grid"/);
  assert.match(html, /data-sortable-id="a"/);
  assert.match(html, /data-sortable-id="b"[^>]*data-disabled="true"|data-disabled="true"[^>]*data-sortable-id="b"/);
  assert.match(html, /data-sortable-handle/);
  assert.match(html, /aria-label="Ideas"/);
  assert.doesNotMatch(html, /window|document/);
});

test('Sortable source delegates interaction mechanics to dnd-kit and preserves cancel projection', () => {
  const source = readFileSync(new URL('../src/sortable/index.tsx', import.meta.url), 'utf8');
  assert.match(source, /from '@dnd-kit\/core'/);
  assert.match(source, /from '@dnd-kit\/sortable'/);
  assert.match(source, /sortableKeyboardCoordinates/);
  assert.match(source, /useSensor\(TouchSensor/);
  assert.match(source, /<DragOverlay/);
  assert.match(source, /function handleDragCancel/);
  assert.match(source, /setProjected\(null\)/);
  assert.match(source, /onChange\(next, details\)/);
  assert.match(source, /isInteractiveTarget/);
  assert.match(source, /button, a, input, select, textarea/);
  assert.match(source, /activationConstraint: \{ delay: 180, tolerance: 8 \}/);
  assert.match(source, /engineItemId/);
  assert.match(source, /disabled: disabled \? \{ draggable: true, droppable: false \} : false/);
  assert.match(source, /overData\.disabled/);
  assert.match(source, /overData\?\.disabled/);
  assert.match(source, /cloneSortableContainers\(initialRef\.current\)/);
  assert.match(source, /const acceptingOver = isOver && !disabled/);
  assert.doesNotMatch(source, /onChange\([^)]*handleDragOver/);
});

test('Sortable CSS keeps touch targets, responsive containers and accessible fallbacks', () => {
  const css = readFileSync(new URL('../src/sortable/styles.css', import.meta.url), 'utf8');
  assert.match(css, /height: var\(--inkra-touch-target\)/);
  assert.match(css, /touch-action: none/);
  assert.match(css, /inkra-sortable__focus/);
  assert.match(css, /grid-template-columns: repeat\(auto-fit/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
}
);
