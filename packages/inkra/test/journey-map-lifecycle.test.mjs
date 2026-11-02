import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JourneyMap } from '../dist/journey-map/index.js';
import { createJourneyLeafletMap } from '../dist/journey-map/lifecycle.js';

class FakeMap {
  pane = {}; pans = [];
  constructor(container, options) { this.container = container; this.options = options; }
  getPane(name) { assert.equal(name, 'mapPane'); return this.pane; }
  panBy(offset, options) { assert.ok(this.pane, 'A removed map must not perform a pan'); this.pans.push({ receiver: this, offset, options }); return this; }
  remove() { this.pane = undefined; return this; }
}
test('owned maps preserve normal public pan receiver, arguments and chaining, then ignore delayed inertia after remove', () => {
  const container = {}, settings = { zoomControl: false }, map = createJourneyLeafletMap(FakeMap, container, settings);
  assert.equal(map.container, container); assert.equal(map.options, settings);
  const offset = [12, 34], options = { animate: true };
  assert.equal(map.panBy(offset, options), map);
  assert.equal(map.pans[0].receiver, map); assert.equal(map.pans[0].offset, offset); assert.equal(map.pans[0].options, options);
  const queuedPan = () => map.panBy(offset, options);
  assert.equal(map.remove(), map); assert.equal(queuedPan(), map); assert.equal(map.pans.length, 1);
});
test('a missing public map pane also prevents late pan work', () => {
  const map = createJourneyLeafletMap(FakeMap, {}, {}); map.pane = undefined;
  assert.equal(map.panBy([1, 2]), map); assert.deepEqual(map.pans, []);
});
test('viewport heights keep ordinary full-window sizes, legacy defaults and finite input safety', () => {
  const props = { places: [], attribution: 'Example' };
  for (const [height, expected] of [[undefined, 480], [NaN, 480], [Infinity, 480], [-Infinity, 480], [-1, 240], [0, 240], [240, 240], [480, 480], [900, 900], [1080, 1080], [1440, 1440]]) {
    const html = renderToStaticMarkup(createElement(JourneyMap, { ...props, height }));
    assert.match(html, new RegExp(`class="inkra-journey-map__viewport" style="height:${expected}px"`));
  }
});
test('an explicitly undefined optional feature label retains its localized default', () => {
  const html = renderToStaticMarkup(createElement(JourneyMap, { places: [], attribution: 'Example', showFeatureList: true,
    routes: [{ id: 'route', coordinates: [[0, 0], [1, 1]] }], labels: { zoomIn: 'In', zoomOut: 'Out', reset: 'Reset', unavailable: 'Unavailable', features: undefined } }));
  assert.match(html, /inkra-journey-map__features" aria-label="Map annotations"/);
});
