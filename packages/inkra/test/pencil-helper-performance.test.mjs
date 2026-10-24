import assert from 'node:assert/strict';
import test from 'node:test';
import { createPencilPoints, createPencilPath } from '../dist/pencil.js';

test('public pencil path helpers bound allocation and reject non-finite geometry without invalid SVG', () => {
  assert.equal(createPencilPoints({ seed: 1, points: 1e20 }).length, 65536);
  for (const value of [Infinity, -Infinity, NaN]) {
    const points = createPencilPoints({ seed: 1, points: value, width: value, height: value, roughness: value });
    assert.equal(points.length, 7);
    assert.ok(points.every(point => point.every(Number.isFinite)));
    assert.doesNotMatch(createPencilPath({ seed: 1, width: value, height: value, roughness: value }), /NaN|Infinity/);
  }
  const input = { seed: 'ordinary', width: 120, height: 8, points: 7, roughness: 1 };
  assert.deepEqual(createPencilPoints(input), createPencilPoints(input));
  assert.equal(createPencilPath(input), 'M 0.00 4.20 L 20.30 3.25 L 39.45 3.61 L 59.55 3.20 L 80.30 4.89 L 100.53 3.40 L 120.00 3.36');
});
