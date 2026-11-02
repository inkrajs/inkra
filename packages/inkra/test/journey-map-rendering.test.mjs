import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JourneyMap } from '../dist/journey-map/index.js';
import { pencilStroke } from '../dist/internal/stroke.js';
import { JourneyBaseBitmap, journeyAnimationMs, journeyCanvasSize, journeyFocusZoom, journeyPanRegions, prepareJourneyCanvas, resolveJourneyMapRendering } from '../dist/journey-map/rendering.js';

test('rendering strategies are SSR safe and preserve the same native fallback', () => {
  const props = { places: [{ id: 'lake', label: 'Lake', latitude: -43, longitude: 170 }], attribution: 'Source', selectedPlace: 'lake' };
  const reference = renderToStaticMarkup(createElement(JourneyMap, props));
  for (const rendering of ['auto', 'legacy', { boundaryViewport: false, cacheBase: true }]) {
    const html = renderToStaticMarkup(createElement(JourneyMap, { ...props, rendering }));
    assert.equal(html, reference);
    assert.match(html, /aria-pressed="true"/);
    assert.doesNotMatch(html, /rendering=/);
  }
  const immediate = renderToStaticMarkup(createElement(JourneyMap, { ...props, animate: false, animationDuration: 0, focusZoomScale: 4 }));
  assert.equal(immediate, reference, 'view options do not leak into DOM or change SSR');
  assert.deepEqual(resolveJourneyMapRendering({ boundaryViewport: false, reuseCanvas: undefined }), {
    boundaryViewport: false, terrainViewport: true, reuseCanvas: true, cacheBase: true,
  });
});

test('programmatic motion honors explicit opt-out and reduced motion, with absolute overview magnification', () => {
  assert.equal(journeyAnimationMs(true, 420, false), 420);
  assert.equal(journeyAnimationMs(false, 420, false), 0);
  assert.equal(journeyAnimationMs(true, 420, true), 0);
  assert.equal(journeyAnimationMs(true, 0, false), 0);
  assert.equal(journeyAnimationMs(true, NaN, false), 420);
  assert.equal(journeyAnimationMs(true, 9000, false), 5000);
  assert.equal(journeyFocusZoom(5, 1), 5);
  assert.equal(journeyFocusZoom(5, 2), 6);
  assert.equal(journeyFocusZoom(5, 4), 7);
  assert.equal(journeyFocusZoom(5, 128), 11);
  assert.equal(journeyFocusZoom(5, NaN), 6);
  assert.equal(journeyFocusZoom(5, 0), 6);
});

test('offscreen rejection preserves visible border strokes including the map top', () => {
  const record = options => {
    const strokes = [];
    const ctx = { globalAlpha: 1, save() {}, restore() {}, beginPath() {},
      moveTo(x, y) { this.a = [x, y]; }, lineTo(x, y) { this.b = [x, y]; },
      stroke() { strokes.push([...this.a, ...this.b, this.lineWidth, this.globalAlpha]); } };
    pencilStroke(ctx, [[-300, 2], [400, 2]], '#123', 1.2, 137, .3, 3, false,
      { grain: .7, breaks: .15, variation: .8, gain: 2.5, step: .8, ...options });
    return strokes;
  };
  const full = record({});
  const rejected = record({ viewport: [100, 100], viewportTop: -8 });
  const visible = strokes => strokes.filter(([ax, ay, bx, by, width]) =>
    Math.max(ax, bx) + width / 2 >= 0 && Math.min(ax, bx) - width / 2 <= 100
    && Math.max(ay, by) + width / 2 >= 0 && Math.min(ay, by) - width / 2 <= 100);
  assert.ok(rejected.length < full.length / 2, 'offscreen Canvas submissions are actually removed');
  assert.ok(visible(rejected).length > 0, 'the top of the map is not treated as a 36px text header');
  assert.deepEqual(visible(rejected), visible(full), 'visible pencil samples, alpha and widths are unchanged');
});

test('allocation respects physical budgets without reducing normal map DPR', () => {
  assert.equal(journeyCanvasSize(900, 600, 2).dpr, 2);
  const adapted = journeyCanvasSize(1600, 800, 2);
  assert.ok(adapted.dpr >= 1 && adapted.dpr < 2);
  for (let width = 257; width <= 8192; width += 173) {
    for (const height of [17, 420, 600, 800]) {
      const size = journeyCanvasSize(width, height, 3);
      if (!size) continue;
      assert.ok(size.pixelWidth <= 8192 && size.pixelHeight <= 8192);
      assert.ok(size.pixelWidth * size.pixelHeight <= 4 * 1024 * 1024);
      assert.ok(size.dpr >= 1 && size.dpr <= 2);
    }
  }
  for (const [w, h] of [[0, 420], [NaN, 420], [900, Infinity], [9000, 420], [6000, 800]]) {
    assert.equal(journeyCanvasSize(w, h, 2), undefined);
  }
});

class Canvas extends EventTarget {
  _width = 300;
  _height = 150;
  writes = [];
  pixels = [];
  style = {};
  context = {
    lost: false, globalAlpha: 1, transform: [1, 0, 0, 1, 0, 0], stack: [],
    isContextLost() { return this.lost; },
    setTransform(...values) { this.transform = values; },
    save() { this.stack.push([...this.transform]); },
    restore() { this.transform = this.stack.pop(); },
    clearRect: () => { this.pixels = []; },
    drawImage: source => { this.pixels = [...source.pixels]; },
  };
  get width() { return this._width; }
  set width(value) { this.writes.push(['width', value]); this._width = value; this.pixels = []; }
  get height() { return this._height; }
  set height(value) { this.writes.push(['height', value]); this._height = value; this.pixels = []; }
  getContext() { return this.context; }
}

function withDocument(run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const canvases = [];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement(tag) { assert.equal(tag, 'canvas'); const canvas = new Canvas(); canvases.push(canvas); return canvas; },
  } });
  try { run(canvases); } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
}

test('backing-store reuse clears prior pixels without repeated size resets or accumulated transforms', () => {
  const canvas = new Canvas();
  const size = journeyCanvasSize(900, 600, 2);
  prepareJourneyCanvas(canvas, size, true);
  canvas.writes = [];
  canvas.pixels = ['old selection'];
  prepareJourneyCanvas(canvas, size, true);
  assert.deepEqual(canvas.writes, []);
  assert.deepEqual(canvas.pixels, []);
  assert.deepEqual(canvas.context.transform, [2, 0, 0, 2, 0, 0]);
  prepareJourneyCanvas(canvas, size, true);
  assert.deepEqual(canvas.context.transform, [2, 0, 0, 2, 0, 0]);
  prepareJourneyCanvas(canvas, size, false);
  assert.deepEqual(canvas.writes, [['width', 1800], ['height', 1200]]);
  assert.deepEqual(canvas.context.transform, [2, 0, 0, 2, 0, 0]);
});

test('base snapshot excludes later marker changes and rejects other views/themes and context recovery', () => withDocument(canvases => {
  const base = new JourneyBaseBitmap();
  const source = new Canvas(), target = new Canvas();
  const size = journeyCanvasSize(900, 600, 2);
  source.pixels = ['land', 'route'];
  base.capture(source, size, 'view-1/light');
  source.pixels.push('selected marker');
  assert.equal(base.restore(target.context, 'view-1/light'), true);
  assert.deepEqual(target.pixels, ['land', 'route']);
  for (const changedKey of ['view-2/light', 'view-1/dark', 'view-1/light/dpr-1']) {
    target.pixels = ['untouched'];
    assert.equal(base.restore(target.context, changedKey), false);
    assert.deepEqual(target.pixels, ['untouched']);
  }
  canvases[0].dispatchEvent(new Event('contextrestored'));
  assert.equal(base.restore(target.context, 'view-1/light'), false, 'a recovered transparent surface is not a valid cache hit');
  source.pixels = ['new base'];
  base.capture(source, size, 'view-1/dark');
  assert.equal(canvases.length, 1, 'view changes replace one bounded entry');
  assert.equal(base.restore(target.context, 'view-1/dark'), true);
  assert.deepEqual(target.pixels, ['new base']);
  base.clear();
  assert.equal(canvases[0].width * canvases[0].height, 0);
  assert.equal(base.restore(target.context, 'view-1/dark'), false);
}));

test('oversized or failed base caches retain direct-rendered content and release retained pixels', () => withDocument(canvases => {
  const base = new JourneyBaseBitmap();
  const source = new Canvas(), target = new Canvas();
  source.pixels = ['visible map'];
  base.capture(source, journeyCanvasSize(900, 600, 2), 'small');
  base.capture(source, journeyCanvasSize(1600, 800, 2), 'large');
  assert.equal(canvases.length, 1, 'an oversized entry does not allocate another backing store');
  assert.equal(canvases[0].width * canvases[0].height, 0);
  assert.equal(base.restore(target.context, 'small'), false);
  assert.equal(base.restore(target.context, 'large'), false);
  assert.deepEqual(source.pixels, ['visible map']);
  globalThis.document.createElement = () => { throw new Error('allocation failed'); };
  assert.doesNotThrow(() => base.capture(source, journeyCanvasSize(900, 600, 2), 'failed'));
  assert.equal(base.restore(target.context, 'failed'), false);
  assert.deepEqual(source.pixels, ['visible map']);
}));

test('terrain row envelopes conservatively retain polygon strips and holes', async () => {
  const { terrainRowBounds } = await import('../dist/journey-map/terrain.js');
  const diagonal = [[0, 0], [20, 0], [120, 100], [100, 100], [0, 0]];
  assert.deepEqual(terrainRowBounds([diagonal], 40, 60), [40, 80]);
  assert.equal(terrainRowBounds([diagonal], 110, 120), undefined);
  assert.deepEqual(terrainRowBounds([[[0, 0], [100, 0], [100, 100], [0, 100]], [[20, 20], [80, 20], [80, 80], [20, 80]]], 30, 40), [0, 100]);
  for (let y = 0; y <= 100; y += 5) {
    const [left, right] = terrainRowBounds([diagonal], y - 25, y + 20);
    for (let pointY = Math.max(0, y - 25); pointY <= Math.min(100, y + 20); pointY += 1) {
      assert(left <= pointY && right >= pointY + 20, 'Every potentially visible polygon point remains inside the row envelope');
    }
  }
});


test('pan replenishment covers every newly exposed pixel exactly once in all directions', () => {
  const width = 100, height = 80;
  for (const dx of [-150, -20, 0, 20, 150]) for (const dy of [-100, -15, 0, 15, 100]) {
    const regions = journeyPanRegions(width, height, dx, dy);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const uncovered = x < dx || x >= width + dx || y < dy || y >= height + dy;
      const covered = regions.filter(([left, top, w, h]) => x >= left && x < left + w && y >= top && y < top + h).length;
      assert.equal(covered, Number(uncovered), `offset ${dx},${dy} at ${x},${y}`);
    }
  }
});

test('large logical hosts can downsample within existing backing budgets without changing their CSS size', () => {
  for (const [width, height] of [[1920, 2500], [3440, 1440], [3840, 2160]]) {
    assert.equal(journeyCanvasSize(width, height, 2), undefined, 'Default helper behavior remains unchanged');
    const size = journeyCanvasSize(width, height, 2, true);
    assert.equal(size.width, width); assert.equal(size.height, height);
    assert.ok(size.dpr > 0 && size.dpr < 1);
    assert.ok(size.pixelWidth * size.pixelHeight <= 4 * 1024 * 1024);
    assert.ok(size.pixelWidth <= 8192 && size.pixelHeight <= 8192);
  }
  assert.equal(journeyCanvasSize(300, 1e100, 2, true), undefined);
});

test('prototype property names use the same terrain fallback as other unknown source identifiers', async () => {
  const { paintTerrain } = await import('../dist/journey-map/terrain.js');
  const geometry = { type: 'Polygon', coordinates: [[[0, 0], [50, 0], [50, 50], [0, 50], [0, 0]]] };
  const colors = (id, role) => {
    const fills = [];
    const ctx = { globalAlpha: 1, save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {}, stroke() {},
      fillRect() { fills.push(this.fillStyle); } };
    paintTerrain(ctx, { type: 'Feature', geometry, properties: { id } }, p => p, 100, 100, false, role);
    return fills;
  };
  for (const role of ['land', 'water']) for (const id of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.deepEqual(colors(id, role), colors(undefined, role));
  }
  assert.notDeepEqual(colors('unknown-source', 'water'), colors('unknown-source', 'land'));
  assert.deepEqual(colors('urban', 'water'), colors('urban', 'land'), 'Known explicit categories still win');
});


test('source identifiers do not change unclassified water into land', async () => {
  const { paintTerrain } = await import('../dist/journey-map/terrain.js');
  const geometry = { type: 'Polygon', coordinates: [[[0, 0], [50, 0], [50, 50], [0, 50], [0, 0]]] };
  const colors = (id, role) => {
    const fills = [];
    const ctx = { globalAlpha: 1, save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {}, stroke() {},
      fillRect() { fills.push(this.fillStyle); } };
    paintTerrain(ctx, { type: 'Feature', geometry, properties: { id } }, p => p, 100, 100, false, role);
    return fills;
  };
  assert.deepEqual(colors(1159127099, 'water'), colors(undefined, 'water'), 'natural feature ids retain the water-layer palette');
  assert.notDeepEqual(colors(1159127099, 'water'), colors(1159127099, 'land'));
  assert.deepEqual(colors('urban', 'water'), colors('urban', 'land'), 'explicit known terrain categories still override the layer default');
});
