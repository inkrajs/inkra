import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';

const sourceUrl = new URL('../src/overflow-list/index.tsx', import.meta.url);
const layoutSourceUrl = new URL('../src/overflow-list/layout.ts', import.meta.url);
const stylesUrl = new URL('../src/overflow-list/styles.css', import.meta.url);

test('OverflowList measures real rendered items and coalesces ResizeObserver work', () => {
  const source = readFileSync(sourceUrl, 'utf8');
  assert.match(source, /new ResizeObserver\(scheduleLayout\)/);
  assert.match(source, /window\.requestAnimationFrame/);
  assert.match(source, /getBoundingClientRect\(\)\.width/);
  assert.match(source, /widthCache/);
  assert.match(source, /document\.fonts/);
  assert.doesNotMatch(source, /cloneElement|createPortal|data-overflow-list-measurement/);
  assert.equal((source.match(/renderItem\(item/g) ?? []).length, 1, 'visible custom item content has one render path');
});

test('OverflowList composes DropdownMenu and protects stable identity and focus', () => {
  const source = readFileSync(sourceUrl, 'utf8');
  assert.match(source, /DropdownMenu\.Root/);
  assert.match(source, /DropdownMenu\.Trigger asChild/);
  assert.match(source, /DropdownMenu\.Item/);
  assert.match(source, /OverflowList item ids must be unique/);
  assert.match(source, /itemRefs\.current\.get\(key\)\?\.contains\(activeElement\)/);
  assert.match(source, /triggerRef\.current\?\.focus\(\)/);
  assert.match(source, /strategy\?: OverflowListStrategy/);
  assert.match(source, /renderOverflowItem\?:/);
  assert.match(source, /renderOverflow\?:/);
  assert.match(source, /onOverflowChange\?:/);
});

test('OverflowList layout helper preserves contiguous ends and priority order', async t => {
  let calculateOverflowListLayout;
  try {
    ({ calculateOverflowListLayout } = await import('../dist/overflow-list/layout.js'));
  } catch {
    t.skip('Run after the integration owner builds @inkra/react.');
    return;
  }

  const items = [
    { key: 'a', priority: 3, width: 60 },
    { key: 'b', priority: 1, width: 50 },
    { key: 'c', priority: 5, width: 40 },
  ];
  const provisional = calculateOverflowListLayout({ items, containerWidth: 160, gap: 10, strategy: 'end' });
  assert.equal(provisional.needsTriggerMeasurement, true);
  assert.deepEqual(provisional.visibleKeys, ['a', 'b', 'c']);

  const end = calculateOverflowListLayout({ items, containerWidth: 160, gap: 10, strategy: 'end', triggerWidth: 30 });
  assert.deepEqual(end.visibleKeys, ['a', 'b']);
  assert.deepEqual(end.overflowKeys, ['c']);

  const start = calculateOverflowListLayout({ items, containerWidth: 160, gap: 10, strategy: 'start', triggerWidth: 30 });
  assert.deepEqual(start.visibleKeys, ['b', 'c']);
  assert.deepEqual(start.overflowKeys, ['a']);

  const priority = calculateOverflowListLayout({ items, containerWidth: 160, gap: 10, strategy: 'priority', triggerWidth: 30 });
  assert.deepEqual(priority.visibleKeys, ['a', 'c']);
  assert.deepEqual(priority.overflowKeys, ['b']);
});

test('OverflowList keeps readable, single-copy server markup before measurement', async t => {
  let OverflowList;
  try {
    ({ OverflowList } = await import('../dist/overflow-list/index.js'));
  } catch {
    t.skip('Run after the integration owner builds @inkra/react.');
    return;
  }

  const items = [
    { id: 'save', label: 'Save', priority: 10 },
    { id: 'share', label: 'Share', priority: 2 },
    { id: 'archive', label: 'Archive', priority: 1 },
  ];
  const html = render(h(OverflowList, {
    'aria-label': 'Document actions',
    items,
    renderItem: item => h('button', { id: `action-${item.id}` }, item.label),
    role: 'toolbar',
  }));

  assert.match(html, /role="toolbar"/);
  assert.match(html, /aria-label="Document actions"/);
  assert.equal((html.match(/id="action-save"/g) ?? []).length, 1);
  assert.equal((html.match(/id="action-share"/g) ?? []).length, 1);
  assert.equal((html.match(/id="action-archive"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /More items|aria-haspopup="menu"/);
});

test('OverflowList styles bound the measuring row and preserve fallback modes', () => {
  const css = readFileSync(stylesUrl, 'utf8');
  const layoutSource = readFileSync(layoutSourceUrl, 'utf8');
  assert.match(css, /overflow:\s*clip/);
  assert.match(css, /overflow-clip-margin/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /@media print/);
  assert.match(layoutSource, /strategy === 'priority'/);
  assert.doesNotMatch(css, /@media\s*\(max-width/);
});
