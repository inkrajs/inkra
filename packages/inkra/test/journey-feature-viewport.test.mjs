import assert from 'node:assert/strict';
import test from 'node:test';
// Pure helper unit tests; the library must be built before importing dist.
import {
  createJourneyFeatureBoundsCache,
  journeyFeatureBoundsIntersect,
  journeyFeatureRootAllowsBounds,
  journeyFeatureViewportBounds,
} from '../dist/journey-map/featureViewport.js';

// Pure synthetic bbox and public-port models only. Nothing here mounts Leaflet,
// exercises native hit coordination, or measures projection/performance savings.
const bounds = (west, south, east, north) => ({ west, south, east, north });
const line = coordinates => ({ type: 'LineString', coordinates });
const ring = (west, south, east, north) => [[west, south], [east, south], [east, north], [west, north], [west, south]];
const polygon = coordinates => ({ type: 'Polygon', coordinates });
const freezeTree = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
};
const trackedPosition = (x, y, counter) => {
  const point = [x, y];
  Object.defineProperty(point, 0, { enumerable: true, configurable: false, get() { counter.reads++; return x; } });
  return Object.freeze(point);
};
const flatPose = Object.freeze({ zoom: 7, offset: Object.freeze([0, 0]) });
const flatMap = () => {
  const calls = [];
  return { calls, unproject(point, zoom) { calls.push({ point: [...point], zoom }); return { lat: -point[1] / 10, lng: point[0] / 10 }; } };
};

test('GeoJSON line bounds come from coordinates, ignoring external bbox metadata', () => {
  const cache = createJourneyFeatureBoundsCache();
  const geometry = { ...line([[10, 2], [14, 4], [12, 3]]), bbox: [-90, -80, -89, -79] };
  assert.deepEqual(cache.geometry(geometry), bounds(10, 2, 14, 4));
  const feature = { type: 'Feature', properties: {}, bbox: [-90, -80, -89, -79], geometry };
  assert.deepEqual(cache.feature(feature), bounds(10, 2, 14, 4));
  assert.deepEqual(cache.geometry({ type: 'MultiLineString', coordinates: [[[10, 2], [14, 4]], [[8, 1], [9, 3]]] }), bounds(8, 1, 14, 4));
});

test('all polygon rings and MultiPolygon parts are retained without coordinate changes', () => {
  const cache = createJourneyFeatureBoundsCache();
  const geometry = freezeTree({ type: 'MultiPolygon', coordinates: [
    [ring(-4, -3, 4, 3), ring(-1, -1, 1, 1)],
    [ring(7, 5, 9, 8)],
  ] });
  const original = JSON.stringify(geometry), outer = geometry.coordinates[0][0], hole = geometry.coordinates[0][1];
  assert.deepEqual(cache.geometry(geometry), bounds(-4, -3, 9, 8));
  assert.equal(geometry.coordinates[0][0], outer); assert.equal(geometry.coordinates[0][1], hole);
  assert.equal(JSON.stringify(geometry), original);
});

test('route coordinates use a separate latitude-longitude cache from GeoJSON longitude-latitude', () => {
  const cache = createJourneyFeatureBoundsCache();
  const coordinates = freezeTree([[2, 10], [4, 14]]);
  assert.deepEqual(cache.route(coordinates), bounds(10, 2, 14, 4));
  assert.deepEqual(cache.geometry(line(coordinates)), bounds(2, 10, 4, 14));
  assert.deepEqual(cache.route(coordinates), bounds(10, 2, 14, 4));
  assert.deepEqual(cache.route(Object.freeze([Object.freeze([2, 10])])), bounds(10, 2, 10, 2), 'one-point routes preserve the existing fit eligibility');
});

test('immutable same-geometry and cloned-feature hot queries do not rescan vertices', () => {
  const cache = createJourneyFeatureBoundsCache(), counter = { reads: 0 };
  const geometry = Object.freeze(line(Object.freeze([trackedPosition(10, 2, counter), trackedPosition(14, 4, counter)])));
  const first = cache.geometry(geometry), coldReads = counter.reads;
  assert.ok(coldReads > 0);
  assert.equal(cache.geometry(geometry), first);
  assert.equal(cache.feature({ type: 'Feature', properties: { label: 'One' }, geometry }), first);
  assert.equal(cache.feature({ type: 'Feature', properties: { label: 'Two' }, geometry }), first);
  assert.equal(counter.reads, coldReads, 'new feature wrappers reuse the immutable geometry result');
});

test('a replacement geometry reference is scanned and receives its own bounds', () => {
  const cache = createJourneyFeatureBoundsCache(), counter = { reads: 0 };
  const first = Object.freeze(line(Object.freeze([trackedPosition(10, 2, counter), trackedPosition(14, 4, counter)])));
  assert.deepEqual(cache.geometry(first), bounds(10, 2, 14, 4));
  const before = counter.reads;
  const replacement = Object.freeze(line(Object.freeze([trackedPosition(20, 6, counter), trackedPosition(24, 8, counter)])));
  assert.deepEqual(cache.geometry(replacement), bounds(20, 6, 24, 8));
  assert.ok(counter.reads > before);
  assert.deepEqual(cache.geometry(first), bounds(10, 2, 14, 4));
});

test('immutable route-array hot queries do not rescan, while a new array invalidates the cache', () => {
  const cache = createJourneyFeatureBoundsCache(), counter = { reads: 0 };
  const coordinates = Object.freeze([trackedPosition(2, 10, counter), trackedPosition(4, 14, counter)]);
  const first = cache.route(coordinates), coldReads = counter.reads;
  assert.ok(coldReads > 0); assert.equal(cache.route(coordinates), first); assert.equal(counter.reads, coldReads);
  assert.deepEqual(cache.route(Object.freeze([...coordinates])), bounds(10, 2, 14, 4));
  assert.ok(counter.reads > coldReads, 'the immutable outer coordinate array owns route invalidation');
});

test('unknown results are cached too, so repeated malformed geometry does not rescan', () => {
  const cache = createJourneyFeatureBoundsCache(), counter = { reads: 0 };
  const geometry = Object.freeze(line(Object.freeze([trackedPosition(NaN, 2, counter), trackedPosition(14, 4, counter)])));
  assert.equal(cache.geometry(geometry), undefined);
  const coldReads = counter.reads; assert.ok(coldReads > 0);
  assert.equal(cache.geometry(geometry), undefined); assert.equal(counter.reads, coldReads);
});

test('null, empty, malformed, unsupported and explicitly CRS-tagged inputs stay unknown', () => {
  const cache = createJourneyFeatureBoundsCache();
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  assert.equal(cache.geometry(revoked.proxy), undefined);
  assert.equal(cache.route(revoked.proxy), undefined);
  const unknown = [null, undefined, {}, { type: 'Point', coordinates: [0, 0] },
    { type: 'GeometryCollection', geometries: [line([[0, 0], [1, 1]])] },
    line([]), line([[0, 0]]), line([[0, 0], [Infinity, 1]]), line([[0, 0], [1, 1, NaN]]),
    line([[0, 0], [181, 1]]), line([[0, 0], [1, 86]]),
    { type: 'MultiLineString', coordinates: [] }, { type: 'MultiLineString', coordinates: [[[0, 0], [1, 1]], []] },
    polygon([]), polygon([[]]), polygon([[[0, 0], [1, 0], [1, 1], [0, 1]]]),
    { type: 'MultiPolygon', coordinates: [] },
    { ...line([[0, 0], [1, 1]]), crs: { type: 'name', properties: { name: 'unsupported' } } }];
  for (const value of unknown) {
    const result = cache.geometry(value);
    assert.equal(result, undefined); assert.equal(journeyFeatureBoundsIntersect(result, bounds(30, 30, 31, 31)), true);
  }
  assert.equal(cache.feature({ type: 'Feature', properties: {}, geometry: null }), undefined);
  assert.equal(cache.feature({ type: 'Feature', crs: { type: 'name', properties: { name: 'EPSG:4326' } }, geometry: line([[0, 0], [1, 1]]) }), undefined);
  assert.equal(cache.feature(line([[0, 0], [1, 1]])), undefined);
  assert.equal(journeyFeatureRootAllowsBounds({ type: 'FeatureCollection', features: [] }), true);
  assert.equal(journeyFeatureRootAllowsBounds({ type: 'FeatureCollection', features: [], crs: null }), true);
  assert.equal(journeyFeatureRootAllowsBounds({ type: 'FeatureCollection', features: [], crs: { type: 'name', properties: { name: 'EPSG:4326' } } }), false, 'parent CRS declarations keep all children, without guessing their interpretation');
  assert.equal(journeyFeatureRootAllowsBounds({ type: 'GeometryCollection', geometries: [] }), false);
  assert.equal(journeyFeatureRootAllowsBounds(null), false);
  assert.equal(journeyFeatureRootAllowsBounds(Object.defineProperty({}, 'crs', { get() { throw Error('unknown source metadata'); } })), false);
  for (const value of [null, [], [[0, 0], [NaN, 0]], [[0, 0], [0, 181]], [[0, 0], [86, 1]]]) assert.equal(cache.route(value), undefined);
});

test('dateline crossings and more-than-180-degree spans are unknown rather than falsely rejected', () => {
  const cache = createJourneyFeatureBoundsCache(), viewport = bounds(-1, -1, 1, 1);
  for (const geometry of [line([[170, 0], [-170, 0]]), line([[-100, 0], [0, 0], [100, 0]])]) {
    assert.equal(cache.geometry(geometry), undefined);
    assert.equal(journeyFeatureBoundsIntersect(cache.geometry(geometry), viewport), true);
  }
  assert.equal(cache.route([[0, 170], [0, -170]]), undefined);
  assert.equal(cache.route([[0, -100], [0, 0], [0, 100]]), undefined);
});

test('intersection includes touching edges and rejects only strict known disjointness', () => {
  const viewport = bounds(-1, -1, 1, 1);
  for (const value of [bounds(-3, -1, -1, 1), bounds(1, -1, 3, 1), bounds(-1, 1, 1, 3), bounds(-1, -3, 1, -1)]) assert.equal(journeyFeatureBoundsIntersect(value, viewport), true);
  for (const value of [bounds(-3, -1, -1.01, 1), bounds(1.01, -1, 3, 1), bounds(-1, 1.01, 1, 3), bounds(-1, -3, 1, -1.01)]) assert.equal(journeyFeatureBoundsIntersect(value, viewport), false);
  for (const value of [undefined, bounds(2, 0, 1, 1), bounds(0, NaN, 1, 1), bounds(-100, 0, 100, 1)]) {
    assert.equal(journeyFeatureBoundsIntersect(value, viewport), true);
    assert.equal(journeyFeatureBoundsIntersect(viewport, value), true);
  }
});

test('a route crossing the viewport is retained even when both endpoints lie outside', () => {
  const cache = createJourneyFeatureBoundsCache(), coordinates = freezeTree([[0, -10], [0, 10]]);
  assert.ok(coordinates.every(([, longitude]) => longitude < -1 || longitude > 1));
  assert.equal(journeyFeatureBoundsIntersect(cache.route(coordinates), bounds(-1, -1, 1, 1)), true);
});

test('enclosing polygons and a viewport lying entirely inside a hole remain candidates', () => {
  const cache = createJourneyFeatureBoundsCache(), viewport = bounds(-1, -1, 1, 1);
  const enclosing = polygon([ring(-10, -10, 10, 10)]), donut = polygon([ring(-10, -10, 10, 10), ring(-2, -2, 2, 2)]);
  assert.equal(journeyFeatureBoundsIntersect(cache.geometry(enclosing), viewport), true);
  assert.equal(journeyFeatureBoundsIntersect(cache.geometry(donut), viewport), true, 'whole-feature bounds do not guess hole visibility');
});

test('saved-pose rectangle conversion uses four public unproject calls with offset and CSS margin', () => {
  const map = flatMap(), pose = freezeTree({ zoom: 7, offset: [100, 200] });
  const rect = Object.freeze({ x: 110, y: 220, width: 40, height: 20 });
  assert.deepEqual(journeyFeatureViewportBounds(map, pose, rect, 2, true), bounds(.7, -4.3, 5.3, -1.7));
  assert.equal(map.calls.length, 4); assert.ok(map.calls.every(call => call.zoom === 7));
  const points = map.calls.map(call => call.point).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  assert.deepEqual(points, [[7, 17], [7, 43], [53, 17], [53, 43]]);
  assert.deepEqual(pose.offset, [100, 200]); assert.deepEqual(rect, { x: 110, y: 220, width: 40, height: 20 });
});

test('zero requested margin still reserves at least one CSS pixel for rounded projection', () => {
  const map = flatMap();
  assert.deepEqual(journeyFeatureViewportBounds(map, flatPose, { x: 0, y: 0, width: 10, height: 10 }, 0, true), bounds(-.1, -1.1, 1.1, .1));
  assert.equal(map.calls.length, 4);
});

test('unsupported projections and malformed poses or rectangles return keep-all before unprojection', () => {
  const map = flatMap(), rect = { x: 0, y: 0, width: 10, height: 10 };
  assert.equal(journeyFeatureViewportBounds(map, flatPose, rect, 0, false), undefined);
  for (const pose of [undefined, { zoom: NaN, offset: [0, 0] }, { zoom: 7, offset: [Infinity, 0] }]) assert.equal(journeyFeatureViewportBounds(map, pose, rect, 0, true), undefined);
  for (const bad of [{ ...rect, width: 0 }, { ...rect, height: -1 }, { ...rect, x: Infinity }, { ...rect, width: NaN }]) assert.equal(journeyFeatureViewportBounds(map, flatPose, bad, 0, true), undefined);
  for (const margin of [-1, Infinity, NaN]) assert.equal(journeyFeatureViewportBounds(map, flatPose, rect, margin, true), undefined);
  assert.equal(map.calls.length, 0);
});

test('world copies, wrapped or too-wide viewports, invalid results and unproject failures stay unknown', () => {
  assert.equal(journeyFeatureViewportBounds(flatMap(), flatPose, { x: 1900, y: 0, width: 10, height: 10 }, 0, true), undefined);
  assert.equal(journeyFeatureViewportBounds(flatMap(), flatPose, { x: -950, y: 0, width: 1900, height: 10 }, 0, true), undefined);
  const wrapped = { unproject([x, y]) { const raw = x / 10; return { lat: -y / 10, lng: raw > 180 ? raw - 360 : raw }; } };
  assert.equal(journeyFeatureViewportBounds(wrapped, flatPose, { x: 1690, y: 0, width: 220, height: 10 }, 0, true), undefined);
  assert.equal(journeyFeatureViewportBounds({ unproject() { return { lat: NaN, lng: 0 }; } }, flatPose, { x: 0, y: 0, width: 10, height: 10 }, 0, true), undefined);
  assert.equal(journeyFeatureViewportBounds({ unproject() { throw Error('unavailable public projection'); } }, flatPose, { x: 0, y: 0, width: 10, height: 10 }, 0, true), undefined);
});
