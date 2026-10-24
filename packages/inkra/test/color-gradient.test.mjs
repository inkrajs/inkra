import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ColorPicker, normalizeColorPaint, formatColorPaint, createColorGradient } from '../dist/color-picker/index.js';

const stops = [{ id: 'a', color: '#1234', position: 0 }, { id: 'b', color: '#fff', position: 100 }];

test('gradient normalization retains identity, stable hard stops and bounded geometry', () => {
  const paint = normalizeColorPaint({ type: 'linear', angle: -90, center: { x: -10, y: 150 }, stops: [
    { id: 'same', color: '#fff', position: 150 },
    { id: 'same', color: '#0008', position: -10 },
    { color: '#abc', position: 0 },
  ] });
  assert.equal(paint.angle, 270);
  assert.deepEqual(paint.center, { x: 0, y: 100 });
  assert.deepEqual(paint.stops.map(stop => stop.position), [0, 0, 100]);
  assert.deepEqual(paint.stops.map(stop => stop.color), ['#00000088', '#aabbccff', '#ffffffff']);
  assert.equal(new Set(paint.stops.map(stop => stop.id)).size, 3);
  assert.deepEqual(normalizeColorPaint(paint), paint);
  assert.equal(normalizeColorPaint({ type: 'linear', stops, angle: 359.999 }).angle, 0);
});

test('gradient validation rejects invalid data and arbitrary CSS expressions', () => {
  for (const input of [null, {}, 'linear-gradient(red, blue)', { type: 'linear', stops: [] },
    { type: 'linear', stops, angle: NaN }, { type: 'radial', stops, center: { x: Infinity, y: 50 } },
    { type: 'radial', stops, shape: 'square' }, { type: 'linear', stops: [...stops, { color: 'red', position: 50 }] },
    { type: 'linear', stops: Array.from({ length: 65 }, () => stops[0]) }]) {
    assert.equal(normalizeColorPaint(input), null);
  }
  assert.equal(normalizeColorPaint('#abc'), '#aabbccff');
  assert.equal(createColorGradient('linear', 'invalid').stops[0].color, '#4b96aaff');
});

test('serializers cover linear, radial, conic and their repeating variants', () => {
  assert.equal(formatColorPaint({ type: 'linear', stops, angle: 45 }), 'linear-gradient(45deg, #11223344 0%, #ffffffff 100%)');
  assert.equal(formatColorPaint({ type: 'radial', stops, shape: 'circle', extent: 'closest-side', center: { x: 25, y: 75 } }), 'radial-gradient(circle closest-side at 25% 75%, #11223344 0%, #ffffffff 100%)');
  assert.equal(formatColorPaint({ type: 'conic', stops, angle: 30 }), 'conic-gradient(from 30deg at 50% 50%, #11223344 0%, #ffffffff 100%)');
  for (const type of ['linear', 'radial', 'conic']) {
    assert(formatColorPaint({ ...createColorGradient(type), repeating: true }).startsWith(`repeating-${type}-gradient(`));
  }
});

test('gradient is explicit opt-in; structured paint serializes to the single named field', () => {
  const paint = { type: 'linear', stops };
  const html = renderToStaticMarkup(createElement(ColorPicker, { allowGradient: true, defaultValue: paint, name: 'paint', maxStops: 2 }));
  assert.match(html, /inkra-color-picker__gradient-preview/);
  assert.match(html, /name="paint" value="linear-gradient\(/);
  assert.equal((html.match(/name="paint"/g) ?? []).length, 1);
  assert.match(html, /aria-label="Add stop"[^>]*disabled=""/);
  const plain = renderToStaticMarkup(createElement(ColorPicker, { defaultValue: '#abc', presets: [{ value: paint }] }));
  assert.doesNotMatch(plain, /inkra-color-picker__gradient-preview|inkra-color-picker__types/);
  assert.match(plain, /value="#aabbccff"/);
});
