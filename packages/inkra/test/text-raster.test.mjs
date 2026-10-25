import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boundedTextResolution } from '../dist/internal/textRenderer.js';

test('short text keeps existing quality while Retina paragraphs fit the fixed budget', () => {
  assert.equal(boundedTextResolution(100, 34, 1), 2);
  assert.equal(boundedTextResolution(100, 34, 2), 4);
  assert.equal(boundedTextResolution(1255, 34, 2), 3);
  assert.equal(boundedTextResolution(4000, 34, 2), 1);
  for (const width of [100, 1255, 1800, 4000, 8000]) {
    for (const height of [24, 34, 70]) {
      for (const dpr of [1, 1.5, 2, 3]) {
        const resolution = boundedTextResolution(width, height, dpr);
        assert(resolution >= 0 && resolution <= 4);
        assert(width * height * resolution ** 2 <= 524288);
        assert(width * resolution <= 8192 && height * resolution <= 8192);
      }
    }
  }
});

test('oversized and invalid text dimensions preserve readable DOM fallback', () => {
  for (const values of [[10000, 10000, 2], [8193, 1, 2], [0, 34, 2], [-1, 34, 2], [100, NaN, 2], [100, 34, Infinity]]) {
    assert.equal(boundedTextResolution(...values), 0);
  }
});
