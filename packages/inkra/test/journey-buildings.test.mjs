import test from 'node:test';
import assert from 'node:assert/strict';
import { buildingPositions, paintBuildings, resolveBuildingStyle } from '../dist/journey-map/buildings.js';

const outer = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]];
const hole = [[.5, .5], [.5, 1.5], [1.5, 1.5], [1.5, .5], [.5, .5]];
const feature = (purpose, coordinates = [outer, hole]) => ({ type: 'Feature', properties: { purpose }, geometry: { type: 'Polygon', coordinates } });
const collection = (...features) => ({ type: 'FeatureCollection', features });
const style = (values = {}) => ({ getPropertyValue: name => ({ '--inkra-ink-muted': '#777777', '--inkra-ink': '#333333', '--inkra-accent': '#339966', ...values })[name] ?? '' });

function recordingContext() {
  const operations = [], stack = [];
  const ctx = { operations, globalAlpha: 1, fillStyle: '', strokeStyle: '',
    save() { stack.push([this.globalAlpha, this.fillStyle, this.strokeStyle]); },
    restore() { [this.globalAlpha, this.fillStyle, this.strokeStyle] = stack.pop(); },
    beginPath() { operations.push(['begin']); }, moveTo(x, y) { operations.push(['move', x, y]); },
    lineTo(x, y) { operations.push(['line', x, y]); }, closePath() { operations.push(['close']); },
    clip(rule) { operations.push(['clip', rule]); }, fillRect(...rect) { operations.push(['fill', this.fillStyle, this.globalAlpha, ...rect]); },
    stroke() { operations.push(['stroke', this.strokeStyle]); },
  };
  return ctx;
}
const project = ([x, y]) => [x * 10 + 10, y * 10 + 10];

test('building classification is explicit and unknown uses keep neutral theme colors', () => {
  const styles = { shop: { fill: 'var(--inkra-accent)' }, home: { fill: '#ccbbaa', stroke: '#102030' } };
  assert.deepEqual(resolveBuildingStyle(feature('shop'), styles, style()), { fill: '#339966', stroke: '#333333', hatch: true });
  assert.deepEqual(resolveBuildingStyle(feature('home'), styles, style()), { fill: '#ccbbaa', stroke: '#102030', hatch: true });
  for (const purpose of [undefined, 'unknown', 'constructor', '__proto__']) {
    assert.deepEqual(resolveBuildingStyle(feature(purpose), styles, style()), { fill: '#777777', stroke: '#333333', hatch: true });
  }
  const unclassified = feature(undefined); unclassified.properties.kind = 'shop'; unclassified.properties.id = 'shop';
  assert.equal(resolveBuildingStyle(unclassified, styles, style()).fill, '#777777');
});

test('building CSS variables resolve in the current theme, with missing and cyclic fallback', () => {
  const styles = { shop: { fill: 'var(--missing, var(--inkra-accent))', stroke: 'var(--cycle)' } };
  assert.deepEqual(resolveBuildingStyle(feature('shop'), styles, style({ '--cycle': 'var(--cycle)' })), { fill: '#339966', stroke: '#333333', hatch: true });
  assert.equal(resolveBuildingStyle(feature('shop'), styles, style({ '--inkra-accent': '#bbccdd' })).fill, '#bbccdd');
  assert.equal(resolveBuildingStyle(feature('shop'), { shop: { fill: 'var(--missing, rgb(1, 2, 3))' } }, style()).fill, 'rgb(1, 2, 3)');
});

test('building bounds preserve GeoJSON ordering and exclude invalid polygons including invalid holes', () => {
  const invalidHole = feature('shop', [outer, [[NaN, 0], [1, 0], [1, 1], [NaN, 0]]]);
  const open = feature('shop', [[[0, 0], [1, 0], [1, 1], [0, 1]]]);
  const outside = feature('shop', [[[181, 0], [181, 1], [180, 1], [181, 0]]]);
  const valid = feature('home');
  const multiple = { ...feature('shop'), geometry: { type: 'MultiPolygon', coordinates: [[outer], invalidHole.geometry.coordinates] } };
  const data = collection(invalidHole, open, outside, valid, multiple);
  assert.deepEqual(buildingPositions(data), [...outer, ...hole, ...outer]);
  assert.deepEqual(buildingPositions(collection({ ...valid, properties: null, geometry: null }, { ...valid, geometry: { type: 'MultiPolygon', coordinates: null } }, feature('shop', [outer, null]))), []);
  assert.equal(data.features[3], valid, 'caller data is retained');
});

test('building paint preserves courtyard holes with evenodd clipping and independent purpose colors', () => {
  const ctx = recordingContext();
  const data = collection(feature('shop'), feature('home'));
  paintBuildings(ctx, data, project, 100, 100, false, style(), { shop: { fill: '#aa0011' }, home: { fill: '#1122aa' } });
  assert.equal(ctx.operations.filter(op => op[0] === 'clip' && op[1] === 'evenodd').length, 2);
  const firstClip = ctx.operations.findIndex(op => op[0] === 'clip');
  assert.equal(ctx.operations.slice(0, firstClip).filter(op => op[0] === 'close').length, 2, 'outer and courtyard remain separate subpaths');
  assert.deepEqual(ctx.operations.filter(op => op[0] === 'fill').map(op => op[1]), ['#aa0011', '#1122aa']);
  assert(ctx.operations.some(op => op[0] === 'stroke' && op[1] === '#333333'));
  assert.equal(ctx.globalAlpha, 1, 'canvas state is restored for later map layers');
});

test('invalid or offscreen building data paints nothing and nonfinite projections are ignored', () => {
  const ctx = recordingContext();
  paintBuildings(ctx, collection(feature('shop', [[[0, 0], [NaN, 0], [2, 2], [0, 0]]])), project, 100, 100, false, style());
  paintBuildings(ctx, collection(feature('shop')), ([x, y]) => [x + 1000, y + 1000], 100, 100, false, style());
  paintBuildings(ctx, collection(feature('shop')), () => [Infinity, 0], 100, 100, false, style());
  paintBuildings(ctx, collection(feature('shop')), project, Infinity, 100, false, style());
  assert.deepEqual(ctx.operations, []);
});

test('building wash is deterministic across repeated painting and theme changes affect its color', () => {
  const a = recordingContext(), b = recordingContext(), dark = recordingContext();
  const data = collection(feature('shop'));
  paintBuildings(a, data, project, 100, 100, false, style());
  paintBuildings(b, data, project, 100, 100, false, style());
  paintBuildings(dark, data, project, 100, 100, true, style({ '--inkra-ink-muted': '#bbbbbb' }));
  assert.deepEqual(a.operations, b.operations);
  assert.equal(dark.operations.find(op => op[0] === 'fill')[1], '#bbbbbb');
  assert.notDeepEqual(a.operations, dark.operations);
});

test('building hatches entering a replenished pan strip retain the same world-grid deposits as a full paint', () => {
  const data = collection({ ...feature('shop'), id: 'stable-building' });
  function deposits(offset, width, height) {
    const segments = [], stack = []; let path = [];
    const ctx = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
      save() { stack.push([this.globalAlpha, this.fillStyle, this.strokeStyle, this.lineWidth]); },
      restore() { [this.globalAlpha, this.fillStyle, this.strokeStyle, this.lineWidth] = stack.pop(); },
      beginPath() { path = []; }, moveTo(x, y) { path.push([x + offset[0], y + offset[1]]); },
      lineTo(x, y) { path.push([x + offset[0], y + offset[1]]); }, closePath() {}, clip() {}, fillRect() {},
      stroke() {
        if (this.strokeStyle !== '#777777' || path.length !== 2) return;
        const xs = path.map(p => p[0]), ys = path.map(p => p[1]), margin = this.lineWidth / 2;
        if (Math.max(...xs) + margin < 120 || Math.min(...xs) - margin > 200 || Math.max(...ys) + margin < 90 || Math.min(...ys) - margin > 180) return;
        segments.push([...path.flat(), this.globalAlpha, this.lineWidth].map(value => Number(value.toFixed(6))));
      } };
    paintBuildings(ctx, data, ([x, y]) => [x * 100 + 20 - offset[0], y * 100 + 20 - offset[1]], width, height, false, style());
    return segments.map(row => JSON.stringify(row)).sort();
  }
  const whole = deposits([0, 0], 260, 260), strip = deposits([120, 90], 80, 90);
  assert.ok(whole.length > 100, 'Compare real pencil deposits crossing the strip boundary');
  assert.deepEqual(strip, whole);
});

test('omitted building hatch remains equivalent to explicit true in each theme', () => {
  for (const dark of [false, true]) {
    const omitted = recordingContext(), enabled = recordingContext();
    const data = collection(feature('shop'));
    paintBuildings(omitted, data, project, 100, 100, dark, style(), { shop: {} });
    paintBuildings(enabled, data, project, 100, 100, dark, style(), { shop: { hatch: true } });
    assert.deepEqual(omitted.operations, enabled.operations);
    assert.equal(resolveBuildingStyle(feature('shop'), { shop: {} }, style()).hatch, true);
  }
});

test('hatch false removes dense pencil calls while preserving fill and outline calls', () => {
  const enabled = recordingContext(), disabled = recordingContext();
  const data = collection(feature('shop'));
  paintBuildings(enabled, data, project, 100, 100, false, style());
  paintBuildings(disabled, data, project, 100, 100, false, style(), { shop: { hatch: false } });
  const strokes = (ctx, color) => ctx.operations.filter(op => op[0] === 'stroke' && op[1] === color);
  assert(strokes(enabled, '#777777').length > 0, 'baseline contains dense hatch deposits');
  assert.equal(strokes(disabled, '#777777').length, 0);
  assert.deepEqual(strokes(disabled, '#333333'), strokes(enabled, '#333333'));
  assert(strokes(disabled, '#333333').length > 0, 'building rings remain');
  assert.deepEqual(disabled.operations.filter(op => op[0] === 'fill'), enabled.operations.filter(op => op[0] === 'fill'));
  assert(disabled.operations.length < enabled.operations.length);
});

test('resolved transparent skips only invisible outline calls and keeps the narrow keyword rule', () => {
  const data = collection(feature('shop'));
  for (const stroke of ['transparent', ' TRANSPARENT ', 'var(--outline)']) {
    const ctx = recordingContext();
    paintBuildings(ctx, data, project, 100, 100, false, style({ '--outline': 'tRaNsPaReNt' }), { shop: { stroke, hatch: false } });
    assert.equal(ctx.operations.filter(op => op[0] === 'stroke').length, 0);
    assert.equal(ctx.operations.filter(op => op[0] === 'fill').length, 1);
  }
  const withHatch = recordingContext();
  paintBuildings(withHatch, data, project, 100, 100, false, style(), { shop: { stroke: 'transparent' } });
  assert(withHatch.operations.some(op => op[0] === 'stroke' && op[1] === '#777777'), 'transparent outline does not suppress the hatch');
  assert(!withHatch.operations.some(op => op[0] === 'stroke' && op[1] === 'transparent'));
  const rgba = recordingContext();
  paintBuildings(rgba, data, project, 100, 100, false, style(), { shop: { stroke: 'rgba(0, 0, 0, 0)', hatch: false } });
  assert(rgba.operations.some(op => op[0] === 'stroke'), 'other alpha syntax is deliberately not interpreted');
});

test('hatch false retains courtyard clipping, wash opacity and canvas state', () => {
  const ctx = recordingContext();
  paintBuildings(ctx, collection(feature('shop')), project, 100, 100, false, style(), { shop: { hatch: false, stroke: 'transparent' } });
  assert.equal(ctx.operations.filter(op => op[0] === 'close').length, 2, 'outer and courtyard stay separate subpaths');
  assert.deepEqual(ctx.operations.filter(op => op[0] === 'clip'), [['clip', 'evenodd']]);
  assert.deepEqual(ctx.operations.filter(op => op[0] === 'fill'), [['fill', '#777777', .1, 10, 10, 20, 20]]);
  assert.equal(ctx.globalAlpha, 1);
});

test('unknown purpose cannot inherit another purpose hatch setting', () => {
  const styles = { shop: { hatch: false } };
  assert.equal(resolveBuildingStyle(feature('shop'), styles, style()).hatch, false);
  for (const purpose of [undefined, 'unknown', 'constructor', '__proto__']) {
    assert.equal(resolveBuildingStyle(feature(purpose), styles, style()).hatch, true);
  }
});

test('resolved building colors cache-key model distinguishes hatch toggles', () => {
  const data = collection(feature('shop'));
  // JourneyMap serializes the resolved feature styles in its base-raster signature.
  // This checks that model; it does not stand in for a mounted map cache test.
  const key = styles => JSON.stringify(data.features.map(item => resolveBuildingStyle(item, styles, style())));
  const defaultKey = key(undefined), disabledKey = key({ shop: { hatch: false } });
  assert.notEqual(disabledKey, defaultKey);
  assert.equal(key({ shop: { hatch: true } }), defaultKey);
  assert.equal(key({ shop: { hatch: false } }), disabledKey);
});
