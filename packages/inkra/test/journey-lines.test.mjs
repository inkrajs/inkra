import assert from 'node:assert/strict';
import test from 'node:test';
import { journeyLineStyleFor, resolveJourneyLineStyle, resolveJourneyRouteStyle, clipJourneyLine, dashJourneyLine, paintJourneyLine, paintJourneyLandCoverBoundaries } from '../dist/journey-map/lines.js';
import { paintTerrain } from '../dist/journey-map/terrain.js';

const computed = { getPropertyValue: key => ({ '--inkra-accent': '#2468ac', '--inkra-ink-muted': '#778899', '--mod-road': '#bc4321' })[key] ?? '' };
const resolve = value => resolveJourneyLineStyle(value, computed, '#2468ac', 2);
test('explicit official route color and width override typed defaults while typed dash and old width range remain available', () => {
  const route = { id: 'walk', type: 'trail', coordinates: [[0, 0], [1, 1]] };
  const typed = { color: '#112233', width: 12, dash: [6, 4] };
  assert.deepEqual(resolveJourneyRouteStyle(route, typed, computed, '#2468ac'), { color: '#112233', width: 12, dash: [6, 4] });
  assert.deepEqual(resolveJourneyRouteStyle({ ...route, color: 'var(--mod-road)', width: 20 }, typed, computed, '#2468ac'), { color: '#bc4321', width: 8, dash: [6, 4] });
  assert.deepEqual(resolveJourneyRouteStyle({ ...route, color: '', width: NaN }, typed, computed, '#2468ac'), { color: '#112233', width: 12, dash: [6, 4] });
  assert.equal(resolveJourneyRouteStyle({ ...route, width: 0 }, typed, computed, '#2468ac').width, .5);
  assert.equal(resolveJourneyRouteStyle({ ...route, width: 3 }, typed, computed, '#2468ac', true).width, 4);
  assert.deepEqual(typed, { color: '#112233', width: 12, dash: [6, 4] });
});
test('line style defaults, finite bounds, dash parity and theme variables are explicit and caller data stays unchanged', () => {
  assert.deepEqual(resolve(), { color: '#2468ac', width: 2, dash: [] });
  const input = { color: 'var(--missing, var(--mod-road))', width: 100, dash: [.1, 1000, 6] };
  assert.deepEqual(resolve(input), { color: '#bc4321', width: 12, dash: [.5, 128, 6, .5, 128, 6] });
  assert.deepEqual(input.dash, [.1, 1000, 6]);
  for (const width of [0, -1, NaN, Infinity]) assert.equal(resolve({ width }).width, 2);
  assert.equal(resolve({ width: .1 }).width, .5);
  for (const dash of [[0, 4], [-1, 4], [NaN], [Infinity], Array(9).fill(2), Array(2), [4, , 8]]) assert.deepEqual(resolve({ dash }).dash, []);
  assert.deepEqual(resolve({ dash: [6] }).dash, [6, 6]);
});

test('classification uses explicit own keys only, including finite numeric land IDs', () => {
  const inherited = Object.create({ forest: { color: 'red' } }); inherited.crop = { color: 'blue' }; inherited['0'] = { width: 3 };
  assert.equal(journeyLineStyleFor(inherited, 'forest'), undefined);
  for (const id of [undefined, null, 'constructor', '__proto__', NaN, Infinity, {}]) assert.equal(journeyLineStyleFor(inherited, id), undefined);
  assert.equal(journeyLineStyleFor(inherited, 'crop').color, 'blue');
  assert.equal(journeyLineStyleFor(inherited, 0).width, 3);
});

const round = value => Math.round(value * 1e6) / 1e6;
const rounded = values => values.map(part => ({ ...part, offset: round(part.offset), total: round(part.total), points: part.points.map(point => point.map(round)) }));
test('viewport clipping retains the full path arc offset rather than restarting a dash at the screen edge', () => {
  const parts = clipJourneyLine([[-103, 5], [100, 5]], 20, 20, 0);
  assert.deepEqual(rounded(parts), [{ points: [[0, 5], [20, 5]], offset: 103, total: 203 }]);
  assert.deepEqual(rounded(dashJourneyLine(parts[0], [6, 4])).map(part => part.points), [[[0, 5], [3, 5]], [[7, 5], [13, 5]], [[17, 5], [20, 5]]]);
  assert.deepEqual(clipJourneyLine([[NaN, 0], [1, 1]], 20, 20, 0), []);
  assert.deepEqual(clipJourneyLine([[-100, -100], [-50, -50]], 20, 20, 0), []);
});

test('dash phase and material distance continue across polyline vertices', () => {
  const parts = dashJourneyLine({ points: [[0, 0], [4, 0], [4, 8]], offset: 0, total: 12 }, [6, 4]);
  assert.deepEqual(parts, [{ points: [[0, 0], [4, 0], [4, 2]], offset: 0, total: 12 }, { points: [[4, 6], [4, 8]], offset: 10, total: 12 }]);
  assert.deepEqual(dashJourneyLine({ points: [[0, 0], [20, 0]], offset: 0, total: 20 }, [4, , 8]), []);
});

function recordingContext() {
  const strokes = [], fills = [], stack = []; let path = [];
  return { strokes, fills, globalAlpha: 1, fillStyle: '', strokeStyle: '', lineCap: 'round', lineWidth: 1,
    save() { stack.push([this.globalAlpha, this.fillStyle, this.strokeStyle, this.lineCap, this.lineWidth]); },
    restore() { [this.globalAlpha, this.fillStyle, this.strokeStyle, this.lineCap, this.lineWidth] = stack.pop(); },
    beginPath() { path = []; }, moveTo(x, y) { path.push([x, y]); }, lineTo(x, y) { path.push([x, y]); },
    closePath() {}, clip() {}, fillRect(...rect) { fills.push({ color: this.fillStyle, alpha: this.globalAlpha, rect }); },
    stroke() { strokes.push({ points: path, cap: this.lineCap, color: this.strokeStyle }); },
  };
}
test('patterned pencil ink uses flat ends and does not draw any centreline segment inside the configured gaps', () => {
  const context = recordingContext();
  paintJourneyLine(context, [[0, 30], [100, 30]], resolve({ dash: [6, 4], width: 6 }), 717, 100, 60);
  assert.ok(context.strokes.length > 0);
  for (const stroke of context.strokes) {
    assert.equal(stroke.cap, 'butt');
    const middle = (stroke.points[0][0] + stroke.points[1][0]) / 2;
    assert.ok(middle % 10 < 6 + 1e-6, `Ink entered dash gap at ${middle}`);
  }
  assert.equal(context.globalAlpha, 1); assert.equal(context.lineCap, 'round');
});

test('land boundaries require explicit properties.id and preserve valid outer and hole rings', () => {
  const outer = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]], hole = [[.5, .5], [1.5, .5], [1.5, 1.5], [.5, 1.5], [.5, .5]];
  const feature = properties => ({ type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [outer, hole] } });
  const paint = (properties, styles) => { const context = recordingContext(); paintJourneyLandCoverBoundaries(context, feature(properties), ([x, y]) => [x * 20 + 20, y * 20 + 20], styles, computed, 100, 100); return context.strokes; };
  for (const properties of [{}, { kind: 'forest' }, { id: 'unknown' }]) assert.deepEqual(paint(properties, { forest: { color: '#bc4321' }, land: { color: 'red' } }), []);
  const strokes = paint({ id: 'forest' }, { forest: { color: 'var(--mod-road)', dash: [6, 4] } });
  assert.ok(strokes.length > 0); assert.ok(strokes.every(stroke => stroke.color === '#bc4321' && stroke.cap === 'butt'));
  assert.ok(strokes.some(stroke => stroke.points.some(([x, y]) => x >= 29 && x <= 51 && y >= 29 && y <= 51)), 'hole boundary is painted');
});

test('prototype-named unknown terrain categories use the ordinary fallback instead of aborting scheduled map repaint', () => {
  const paint = id => {
    const context = recordingContext();
    paintTerrain(context, { type: 'Feature', properties: { id }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] } }, ([x, y]) => [x * 10 + 10, y * 10 + 10], 60, 60, false);
    return { strokes: context.strokes, fills: context.fills };
  };
  const fallback = paint('ordinary-unknown');
  assert.ok(fallback.fills.length > 0 && fallback.strokes.length > 0);
  for (const id of ['toString', 'constructor', '__proto__', 'valueOf']) assert.deepEqual(paint(id), fallback);
});
