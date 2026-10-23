import assert from 'node:assert/strict';
import test from 'node:test';
import { BoundedCache, boundedCanvasSize } from '../dist/internal/cache.js';
import { cachedPathParts } from '../dist/internal/iconGeometry.js';
import { pencilStroke, strokeProfile } from '../dist/internal/stroke.js';
import { drawPencilSurface } from '../dist/internal/surfaceRenderer.js';
import { drawPencilWash } from '../dist/internal/wash.js';

test('cache rejects oversized and invalid entries without evicting useful entries', () => {
  for (const invalidCost of [11, Infinity, NaN, -1]) {
    const cache = new BoundedCache(2, 10);
    cache.set('a', 'a', 5);
    cache.set('b', 'b', 5);
    assert.equal(cache.set('large', 'uncached', invalidCost), 'uncached');
    assert.equal(cache.get('a'), 'a');
    assert.equal(cache.get('b'), 'b');
    assert.equal(cache.get('large'), undefined);
  }
});

test('cache evicts empty-string keys and applies LRU and replacement budgets', () => {
  const cache = new BoundedCache(2, 10);
  cache.set('', 1, 4);
  cache.set('b', 2, 4);
  cache.set('c', 3, 4);
  assert.equal(cache.get(''), undefined);
  assert.equal(cache.get('b'), 2);
  cache.set('d', 4, 4);
  assert.equal(cache.get('c'), undefined);
  cache.set('b', 5, 9);
  assert.equal(cache.get('d'), undefined);
  cache.set('b', 6, NaN);
  assert.equal(cache.get('b'), undefined);
  cache.set('safe', 7, 10);
  assert.equal(cache.get('safe'), 7);
});

test('canvas budget rejects invalid and oversized dimensions before allocation', () => {
  assert.deepEqual(boundedCanvasSize(160.25, 44.25, 2), { width: 321, height: 89 });
  assert.deepEqual(boundedCanvasSize(2048, 2048, 1), { width: 2048, height: 2048 });
  for (const dimensions of [[Infinity, 1, 1], [NaN, 1, 1], [0, 1, 1], [-1, 1, 1], [1, 1, 0], [8193, 1, 1], [2048, 2049, 1], [4096, 4096, 2]]) {
    assert.throws(() => boundedCanvasSize(...dimensions), RangeError);
  }
  let touched = false;
  const forbidden = new Proxy({}, { get() { touched = true; throw Error('allocated'); }, set() { touched = true; throw Error('allocated'); } });
  assert.throws(() => drawPencilSurface(forbidden, null, 100000, 100000, 'action', 1, 2, {}), RangeError);
  assert.throws(() => drawPencilWash(forbidden, { x: 0, y: 0, width: 100000, height: 100000 }, 'black', 1), RangeError);
  assert.equal(touched, false);
});

test('transparent surfaces allocate no backing pixels, even for a large container', () => {
  const canvas = { width: 300, height: 150 };
  const border = { width: 300, height: 150 };
  drawPencilSurface(canvas, border, 100000, 100000, 'ghost', 1, 2, {});
  assert.deepEqual(canvas, { width: 0, height: 0 });
  assert.deepEqual(border, canvas);
});

test('icon sampling preserves ordinary geometry and bounds work before sampling', () => {
  let samples = 0;
  let length = 4;
  let parses = 0;
  const previous = globalThis.document;
  globalThis.document = { createElementNS() { parses++; return {
    setAttribute() {}, getTotalLength: () => length,
    getPointAtLength(at) { samples++; return { x: at, y: 1 }; },
  }; } };
  try {
    const first = cachedPathParts('M0 1H4');
    assert.equal(samples, 17);
    assert.equal(first[0].length, 17);
    assert.equal(cachedPathParts('M0 1H4'), first);
    assert.equal(samples, 17);
    for (const value of [Infinity, NaN, -1, 100000000]) {
      length = value;
      assert.throws(() => cachedPathParts(`M0 0H${value}`), RangeError);
      assert.equal(samples, 17);
    }
    const before = parses;
    assert.throws(() => cachedPathParts('x'.repeat(65537)), RangeError);
    assert.equal(parses, before);
  } finally { globalThis.document = previous; }
});

test('stroke sampling cannot loop forever or allocate unbounded samples', () => {
  const forbidden = new Proxy({}, { get() { throw Error('should not draw'); } });
  for (const step of [0, -1, Infinity, NaN, 1e-12]) {
    assert.doesNotThrow(() => pencilStroke(forbidden, [[0, 0], [100, 0]], 'black', 1, 1, 1, 2, false, { step }));
  }
  for (const distanceOffset of [Infinity, NaN, 1e20]) {
    assert.doesNotThrow(() => pencilStroke(forbidden, [[0, 0], [1, 0]], 'black', 1, 1, 1, 1, false, { distanceOffset }));
    assert.doesNotThrow(() => strokeProfile(distanceOffset, 100, 1));
  }
  for (const points of [[[0, 0], [Infinity, 0]], [[0, 0], [NaN, 0]], [[0, 0], [100000000, 0]]]) {
    assert.doesNotThrow(() => pencilStroke(forbidden, points, 'black', 1, 1, 1));
  }
});

test('stroke validates and snapshots each coordinate in one pass', () => {
  let reads = 0;
  const points = [0, 10].map(x => Object.defineProperties([], {
    0: { get() { reads++; return x; } },
    1: { get() { reads++; return 0; } },
  }));
  points[Symbol.iterator] = () => { throw Error('outer array iterator must not bypass the point count budget'); };
  const context = { globalAlpha: 1, save() {}, restore() {} };
  pencilStroke(context, points, 'black', 1, 1, 1, 0);
  assert.equal(reads, 4, 'validation and retained geometry should use the same coordinate reads');
});

test('surface snapshots hit by value, isolate callers, invalidate colors and lost contexts, and evict by bytes', () => {
  const previous = globalThis.document;
  const created = [];
  let strokes = 0;
  const canvas = () => {
    const listeners = {};
    const context = new Proxy({ globalAlpha: 1, isContextLost: () => false, stroke() { strokes++; } }, {
      get(target, key) { return key in target ? target[key] : () => {}; },
    });
    return { width: 1, height: 1, getContext: () => context, addEventListener(name, callback) { listeners[name] = callback; }, listeners };
  };
  globalThis.document = { createElement() { const value = canvas(); created.push(value); return value; } };
  const theme = { paper: 'white', dark: false, ink: 'black', wash: 'green' };
  const draw = (seed, color = 'black', width = 160, height = 44, border = null) => {
    const target = canvas();
    const points = drawPencilSurface(target, border, width, height, 'outline', seed, 1, { ...theme, ink: color });
    return { target, points };
  };
  try {
    draw(7001);
    assert.equal(created.length, 0, 'one-off surfaces do not allocate a snapshot');
    const first = draw(7001);
    const allocated = created.length;
    const coldStrokes = strokes;
    assert.ok(coldStrokes > 0);
    first.target.width = 0;
    first.points.push([1000, 1000]);
    const warm = draw(7001);
    assert.equal(strokes, coldStrokes);
    assert.equal(created.length, allocated);
    assert.equal(warm.points.length, 28);
    assert.equal(warm.target.width, 160);
    draw(7001, 'red');
    assert.ok(strokes > coldStrokes);
    const afterColor = strokes;
    created[0].listeners.contextlost();
    draw(7001);
    assert.ok(strokes > afterColor);
    // Separate-border mode must not share the combined snapshot.
    const beforeBorder = created.length;
    draw(7001, 'black', 160, 44, canvas());
    draw(7001, 'black', 160, 44, canvas());
    assert.equal(created.length, beforeBorder + 2);
    // Ten 1.8 MiB snapshots exceed the 16 MiB budget even below 64 entries.
    for (let seed = 8000; seed < 8010; seed++) { draw(seed, 'black', 900, 500); draw(seed, 'black', 900, 500); }
    const beforeEviction = created.length;
    draw(8000, 'black', 900, 500);
    assert.equal(created.length, beforeEviction + 1);
    const beforeOversized = created.length;
    draw(9000, 'black', 1000, 600);
    draw(9000, 'black', 1000, 600);
    assert.equal(created.length, beforeOversized, 'large surfaces paint without being retained');
    const beforeScan = created.length;
    for (let round = 0; round < 2; round++) for (let seed = 10000; seed < 10080; seed++) draw(seed);
    assert.equal(created.length, beforeScan, 'scans larger than the admission window do not thrash snapshots');
  } finally { globalThis.document = previous; }
});
