import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';

import {
  clampVirtualListIndex,
  getVirtualListSsrIndexes,
  normalizeVirtualListOverscan,
  normalizeVirtualListSize,
  normalizeVirtualListSpacing,
  virtualListKeyAttribute,
} from '../src/virtual-list/model.ts';

const componentSource = readFileSync(new URL('../src/virtual-list/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/virtual-list/styles.css', import.meta.url), 'utf8');
const virtualListModule = process.env.INKRA_VIRTUAL_LIST_MODULE
  ? new URL(process.env.INKRA_VIRTUAL_LIST_MODULE, import.meta.url).href
  : null;

test('VirtualList normalizes estimates, overscan and spacing without implementing range math', () => {
  assert.equal(normalizeVirtualListSize(64), 64);
  assert.equal(normalizeVirtualListSize(0), 44);
  assert.equal(normalizeVirtualListSize(Number.NaN, 52), 52);
  assert.equal(normalizeVirtualListOverscan(6), 6);
  assert.equal(normalizeVirtualListOverscan(2.9), 2);
  assert.equal(normalizeVirtualListOverscan(-5), 0);
  assert.equal(normalizeVirtualListOverscan(undefined), 4);
  assert.equal(normalizeVirtualListSpacing(12), 12);
  assert.equal(normalizeVirtualListSpacing(-8), 0);
});

test('VirtualList SSR indexes are deterministic, bounded and configurable', () => {
  assert.deepEqual(getVirtualListSsrIndexes(4, undefined), [0, 1, 2, 3]);
  assert.deepEqual(getVirtualListSsrIndexes(20, undefined), Array.from({ length: 12 }, (_, index) => index));
  assert.deepEqual(getVirtualListSsrIndexes(20, 3), [0, 1, 2]);
  assert.deepEqual(getVirtualListSsrIndexes(2, 20), [0, 1]);
  assert.deepEqual(getVirtualListSsrIndexes(20, -1), []);
});

test('VirtualList imperative indexes clamp to live data and stable keys remain serializable', () => {
  assert.equal(clampVirtualListIndex(18, 10), 9);
  assert.equal(clampVirtualListIndex(-3, 10), 0);
  assert.equal(clampVirtualListIndex(3.9, 10), 3);
  assert.equal(clampVirtualListIndex(0, 0), null);
  assert.equal(virtualListKeyAttribute('note-42'), 'note-42');
  assert.equal(virtualListKeyAttribute(42n), '42');
});

test('VirtualList delegates measurement and recycling to TanStack Virtual', () => {
  assert.match(componentSource, /from '@tanstack\/react-virtual'/);
  assert.match(componentSource, /useVirtualizer<HTMLElement, HTMLLIElement>/);
  assert.match(componentSource, /getItemKey: resolveItemKey/);
  assert.match(componentSource, /overscan: normalizeVirtualListOverscan\(overscan\)/);
  assert.match(componentSource, /ref=\{virtualized && measureItems \? virtualizer\.measureElement : undefined\}/);
  assert.match(componentSource, /virtualizer\.scrollToIndex/);
  assert.match(componentSource, /getScrollElement: resolveScrollElement/);
  assert.doesNotMatch(componentSource, /ResizeObserver|binarySearch|requestAnimationFrame|Math\.random/);
});

test('VirtualList row separators reuse PencilLine without changing measured layout', () => {
  const separatorBlock = styles.match(/\.inkra-virtual-list__item > \.inkra-virtual-list__separator\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(componentSource, /import \{ PencilLine \} from '\.\.\/PencilLine\.js'/);
  assert.match(componentSource, /row\.index > 0 && <PencilLine/);
  assert.match(componentSource, /seed=\{`virtual-list-separator-\$\{virtualListKeyAttribute\(row\.key\)\}`\}/);
  assert.match(styles, /\.inkra-virtual-list__item > \.inkra-virtual-list__separator[\s\S]*position: absolute/);
  assert.match(styles, /inset-block-start: -4px/);
  assert.doesNotMatch(styles, /data-first/);
  assert.doesNotMatch(separatorBlock, /(?:^|\s)border(?:-[\w-]+)?:/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*inkra-virtual-list__separator[\s\S]*opacity: 1/);
  assert.match(styles, /@media print[\s\S]*inkra-virtual-list__separator[\s\S]*opacity: 1/);
});

test('VirtualList keeps selection caller-owned and preserves list identity semantics', () => {
  assert.match(componentSource, /renderItem: \(state: VirtualListItemState<Item>\) => ReactNode/);
  assert.match(componentSource, /getItemProps\?:/);
  assert.doesNotMatch(componentSource, /selectedItem|defaultSelected|onSelectionChange|useState\([^)]*selected/);
  assert.match(componentSource, /key=\{row\.key\}/);
  assert.match(componentSource, /aria-posinset=\{row\.index \+ 1\}/);
  assert.match(componentSource, /aria-setsize=\{items\.length\}/);
  assert.match(componentSource, /role=\{itemRole \?\? 'listitem'\}/);
});

test('VirtualList CSS provides bounded native scrolling and forced-color focus', () => {
  assert.match(styles, /\.inkra-virtual-list[\s\S]*overflow: auto/);
  assert.match(styles, /scrollbar-gutter: stable/);
  assert.match(styles, /data-external-scroll="true"/);
  assert.match(styles, /position: absolute/);
  assert.match(styles, /min-block-size: var\(--inkra-touch-target\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /outline-color: Highlight/);
});

test('VirtualList keeps the pencil frame outside the native scroll element', () => {
  assert.match(componentSource, /<PencilSurface as="div" className="inkra-virtual-list__frame"/);
  assert.match(componentSource, /<div \{\.\.\.rootProps\} ref=\{rootRef\}>\{content\}<\/div>/);
  assert.doesNotMatch(componentSource, /<PencilSurface \{\.\.\.rootProps\}/);
  assert.match(componentSource, /empty \?\? <PencilText>\{emptyLabel\}<\/PencilText>/);
  assert.match(styles, /\.inkra-virtual-list__frame:has\(> \.inkra-virtual-list:focus-visible\)/);
});

test('VirtualList SSR renders a stable static prefix, custom rows and empty state', { skip: !virtualListModule }, async () => {
  const { VirtualList } = await import(virtualListModule);
  const items = [
    { id: 'alpha', label: 'Alpha' },
    { id: 'beta', label: 'Beta' },
    { id: 'gamma', label: 'Gamma' },
  ];
  const markup = render(h(VirtualList, {
    items,
    itemKey: item => item.id,
    estimateSize: 52,
    ssrItemCount: 2,
    'aria-label': 'Notes',
    listLabel: 'Visible notes',
    renderItem: ({ item }) => h('strong', null, item.label),
  }));
  assert.match(markup, /role="region"/);
  assert.match(markup, /aria-label="Notes"/);
  assert.match(markup, /role="list"/);
  assert.match(markup, /data-item-key="alpha"/);
  assert.match(markup, /data-item-key="beta"/);
  assert.doesNotMatch(markup, /data-item-key="gamma"/);
  assert.match(markup, /aria-setsize="3"/);
  assert.match(markup, /<strong>Alpha<\/strong>/);
  assert.match(markup, /inkra-pencil-line inkra-virtual-list__separator/);
  assert.doesNotMatch(markup, /data-virtualized="true"/);

  const emptyMarkup = render(h(VirtualList, {
    items: [],
    itemKey: item => item.id,
    estimateSize: 52,
    emptyLabel: 'Nothing here',
    renderItem: () => null,
  }));
  assert.match(emptyMarkup, /role="status"/);
  assert.match(emptyMarkup, /Nothing here/);
});
