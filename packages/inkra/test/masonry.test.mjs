import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import ts from 'typescript';

const sourceUrl = new URL('../src/masonry/index.tsx', import.meta.url);
const layoutUrl = new URL('../src/masonry/layout.ts', import.meta.url);
const stylesUrl = new URL('../src/masonry/styles.css', import.meta.url);

test('Masonry observes real item and container size changes with bounded frame work', () => {
  const source = readFileSync(sourceUrl, 'utf8');
  assert.match(source, /new ResizeObserver\(scheduleLayout\)/);
  assert.match(source, /window\.requestAnimationFrame/);
  assert.match(source, /root\.clientWidth - paddingLeft - paddingRight/);
  assert.match(source, /height: node\.offsetHeight/);
  assert.match(source, /position\.x \+ paddingLeft/);
  assert.match(source, /position\.y \+ paddingTop/);
  assert.match(source, /rootStyle\.boxSizing === 'border-box'/);
  assert.match(source, /document\.fonts/);
  assert.match(source, /samePositions/);
  assert.doesNotMatch(source, /getBoundingClientRect/);
  assert.doesNotMatch(source, /MutationObserver|setInterval|cloneElement|createPortal/);
});

test('Masonry requires stable unique keys and preserves one DOM render path', () => {
  const source = readFileSync(sourceUrl, 'utf8');
  assert.match(source, /getItemKey: \(item: Item, index: number\) => MasonryKey/);
  assert.match(source, /Masonry item keys must be unique/);
  assert.match(source, /key=\{entry\.internalKey\}/);
  assert.match(source, /data-masonry-key/);
  assert.equal((source.match(/renderItem\(state\)/g) ?? []).length, 1);
  assert.doesNotMatch(source, /items\.sort\(|entries\.sort\(/);
});

test('Masonry layout supports adaptive columns, shortest packing, sequential placement and RTL', async () => {
  const source = readFileSync(layoutUrl, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const { calculateMasonryLayout, resolveMasonryColumnCount } = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  );

  assert.equal(resolveMasonryColumnCount({ containerWidth: 760, minColumnWidth: 220, columnGap: 20 }), 3);
  assert.equal(resolveMasonryColumnCount({ containerWidth: 760, minColumnWidth: 220, columnGap: 20, maxColumns: 2 }), 2);
  assert.equal(resolveMasonryColumnCount({ containerWidth: 760, columns: 4 }), 4);
  assert.equal(calculateMasonryLayout({
    containerWidth: 760,
    minColumnWidth: 220,
    columnGap: 20,
    items: [{ key: 'only', height: 80 }],
  }).columnCount, 1);
  const constrained = calculateMasonryLayout({
    containerWidth: 100,
    columns: 8,
    columnGap: 40,
    items: Array.from({ length: 8 }, (_, index) => ({ key: String(index), height: 20 })),
  });
  assert(constrained.positions.every(item => item.x >= 0 && item.x + item.width <= 100));

  const items = [100, 220, 80, 90].map((height, index) => ({ key: String(index), height }));
  const shortest = calculateMasonryLayout({
    containerWidth: 620,
    items,
    columns: 3,
    columnGap: 10,
    rowGap: 12,
    strategy: 'shortest',
  });
  assert.deepEqual(shortest.positions.map(item => item.column), [0, 1, 2, 2]);
  assert.equal(shortest.positions[3].y, 92);
  assert.equal(shortest.height, 220);

  const shortestKeepsCheckingColumnZero = calculateMasonryLayout({
    containerWidth: 620,
    items: [10, 100, 100, 10, 10].map((height, index) => ({ key: `zero-${index}`, height })),
    columns: 3,
    strategy: 'shortest',
  });
  assert.deepEqual(shortestKeepsCheckingColumnZero.positions.map(item => item.column), [0, 1, 2, 0, 0]);

  const sequential = calculateMasonryLayout({
    containerWidth: 620,
    items,
    columns: 3,
    columnGap: 10,
    rowGap: 12,
    strategy: 'sequential',
  });
  assert.deepEqual(sequential.positions.map(item => item.column), [0, 1, 2, 0]);
  assert.equal(sequential.positions[3].y, 112);

  const rtl = calculateMasonryLayout({
    containerWidth: 620,
    items: items.slice(0, 3),
    columns: 3,
    columnGap: 10,
    direction: 'rtl',
  });
  assert(rtl.positions[0].x > rtl.positions[1].x);
  assert.equal(rtl.positions[2].x, 0);
});

test('Masonry SSR keeps every item readable in source order before enhancement', async t => {
  let Masonry;
  try {
    ({ Masonry } = await import('../dist/masonry/index.js'));
  } catch {
    t.skip('Run after the integration owner builds @inkra/react.');
    return;
  }
  const items = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }, { id: 'c', label: 'Gamma' }];
  const html = render(h(Masonry, {
    'aria-label': 'Notes',
    items,
    getItemKey: item => item.id,
    renderItem: ({ item }) => h('article', null, item.label),
    role: 'list',
  }));
  assert.match(html, /data-layout="fallback"/);
  assert.match(html, /role="list"/);
  assert.equal((html.match(/role="listitem"/g) ?? []).length, 3);
  assert(html.indexOf('Alpha') < html.indexOf('Beta'));
  assert(html.indexOf('Beta') < html.indexOf('Gamma'));
  assert.doesNotMatch(html, /position:absolute|translate3d/);
});

test('Masonry styles prevent page overflow and retain motion, forced-color and print fallbacks', () => {
  const css = readFileSync(stylesUrl, 'utf8');
  const layout = readFileSync(layoutUrl, 'utf8');
  assert.match(css, /overflow:\s*clip/);
  assert.match(css, /max-inline-size:\s*100%/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /@media print/);
  assert.match(layout, /strategy === 'shortest'/);
  assert.match(layout, /direction === 'rtl'/);
  assert.doesNotMatch(css, /@media\s*\(max-width/);
});
