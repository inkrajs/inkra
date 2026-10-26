import assert from 'node:assert/strict';
import test from 'node:test';
import { isClosedIconContour, softenIconFillMask } from '../dist/internal/iconFill.js';

test('fill edge softening preserves interiors, holes and thin details without bleeding', () => {
  const width = 16;
  const original = new Uint8ClampedArray(width * width * 4);
  for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) original[(y * width + x) * 4 + 3] = 255;
  original[(8 * width + 8) * 4 + 3] = 0;
  original[(0 * width + 8) * 4 + 3] = 100;
  const softened = original.slice();
  softenIconFillMask(softened, width, width, 2, 37, 1);
  assert.equal(softened[(5 * width + 5) * 4 + 3], 255);
  assert.ok(softened[(2 * width + 5) * 4 + 3] < 255);
  assert.ok(softened[8 * 4 + 3] >= 50);
  for (let i = 3; i < original.length; i += 4) {
    assert.ok(softened[i] <= original[i]);
    assert.ok(softened[i] >= original[i] * 0.5 - 1);
  }
  const repeated = original.slice();
  softenIconFillMask(repeated, width, width, 2, 37, 1);
  assert.deepEqual(repeated, softened);
  const otherSeed = original.slice();
  softenIconFillMask(otherSeed, width, width, 2, 38, 1);
  assert.notDeepEqual(otherSeed, softened);
});

test('filled contours require closure and area, not an implicit polygon around a symbol', () => {
  assert.equal(isClosedIconContour([[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]), true);
  assert.equal(isClosedIconContour([[0, 0], [5, 0], [5, 5], [0, 5], [0.1, 0]]), true);
  for (const path of [[], [[0, 0]], [[0, 0], [1, 0]],
    [[0, 0], [1, 0], [2, 0], [0, 0]],
    [[0, 0], [5, 5], [10, 0]],
    [[0, 0], [5, 0], [5, 5], [0, 5]]]) {
    assert.equal(isClosedIconContour(path), false);
  }
});

test('contour classification is independent of winding and translation', () => {
  const square = [[0, 0], [8, 0], [8, 8], [0, 8], [0, 0]];
  assert.equal(isClosedIconContour([...square].reverse()), true);
  assert.equal(isClosedIconContour(square.map(([x, y]) => [x + 100, y - 80])), true);
  const circle = Array.from({ length: 49 }, (_, i) => [12 + 3 * Math.cos(i / 48 * Math.PI * 2), 12 + 3 * Math.sin(i / 48 * Math.PI * 2)]);
  assert.equal(isClosedIconContour(circle), true, 'SVG circle adapters need not end in a Z command');
});
