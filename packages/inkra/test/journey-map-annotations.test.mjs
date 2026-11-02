import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { JourneyMap } from '../dist/journey-map/index.js';
import { journeyAreaLabel, paintJourneyArea, validJourneyArea } from '../dist/journey-map/annotations.js';

const ring = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
const hole = [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]];
const area = { id: 'park', label: 'Park', geometry: { type: 'Polygon', coordinates: [ring, hole] } };
const inside = ([x, y], polygon) => {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
};

test('regions reject invalid nested geometry and require closed finite rings', () => {
  assert(validJourneyArea(area));
  for (const geometry of [null, {}, { type: 'Point', coordinates: [0, 0] },
    { type: 'Polygon', coordinates: [] }, { type: 'Polygon', coordinates: [null] },
    { type: 'Polygon', coordinates: [ring.slice(0, -1)] },
    { type: 'MultiPolygon', coordinates: [null] },
    { type: 'Polygon', coordinates: [[[0, 0], [NaN, 1], [1, 1], [0, 0]]] },
    { type: 'Polygon', coordinates: [[[0, 0], [181, 1], [1, 1], [0, 0]]] }]) {
    assert.equal(validJourneyArea({ ...area, geometry }), false);
  }
});

test('default labels stay in the filled area, including concave and disjoint polygons', () => {
  const point = journeyAreaLabel(area);
  assert(inside(point, ring)); assert(!inside(point, hole));
  const concave = [[0, 0], [10, 0], [10, 2], [2, 2], [2, 10], [0, 10], [0, 0]];
  assert(inside(journeyAreaLabel({ ...area, geometry: { type: 'Polygon', coordinates: [concave] } }), concave));
  const island = [[20, 20], [21, 20], [21, 21], [20, 21], [20, 20]];
  assert(inside(journeyAreaLabel({ ...area, geometry: { type: 'MultiPolygon', coordinates: [[island], [ring, hole]] } }), ring));
  assert.deepEqual(journeyAreaLabel({ ...area, labelPosition: { latitude: 1, longitude: 2 } }), [2, 1]);
  assert.deepEqual(journeyAreaLabel({ ...area, labelPosition: { latitude: NaN, longitude: 2 } }), point);
});

test('area paint uses even-odd fill and clipping, respects transparent fill and rejects offscreen regions', () => {
  const operations = [];
  const ctx = { globalAlpha: 1, save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    fill(rule) { operations.push(['fill', rule, this.globalAlpha]); }, clip(rule) { operations.push(['clip', rule]); }, stroke() { operations.push(['stroke', this.globalAlpha]); } };
  paintJourneyArea(ctx, { ...area, fillOpacity: 0 }, p => p, 100, 100, '#123', true);
  assert.deepEqual(operations.filter(x => x[0] !== 'stroke'), [['fill', 'evenodd', 0], ['clip', 'evenodd']]);
  assert(operations.some(x => x[0] === 'stroke'), 'transparent areas retain their outline');
  operations.length = 0;
  paintJourneyArea(ctx, { ...area, fillOpacity: .95 }, p => p, 100, 100, '#123', true);
  assert.deepEqual(operations.find(x => x[0] === 'fill'), ['fill', 'evenodd', 1]);
  operations.length = 0;
  paintJourneyArea(ctx, area, ([x, y]) => [x + 200, y], 100, 100, '#123', false);
  assert.deepEqual(operations, []);
});

test('SSR keeps readable, keyboard-selectable route and area fallback without leaking map props', () => {
  const html = render(h(JourneyMap, { places: [], attribution: 'Demo', areas: [area, { ...area, id: 'bad', label: 'Invalid', geometry: null }],
    routes: [{ id: 'walk', label: 'Walk', coordinates: [[0, 0], [1, 1]], color: 'var(--inkra-info-foreground)', width: 3 }],
    selectedRoute: 'walk', onRouteSelect() {}, selectedArea: 'park', onAreaSelect() {}, showFeatureList: true }));
  assert.match(html, /aria-label="Map annotations"/);
  assert.match(html, /aria-pressed="true"[^>]*><span[^>]*class="inkra-pencil-text"[^>]*>.*Walk/);
  assert.match(html, /Park/); assert.doesNotMatch(html, /Invalid/);
  assert.doesNotMatch(html, /selectedRoute=|selectedArea=|showFeatureList=|areas=|onRouteSelect=/);
});
