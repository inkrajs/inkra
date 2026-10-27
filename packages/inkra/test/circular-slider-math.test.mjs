import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceArcPosition, initialArcPosition, snapCircularValue, stepCircularValue } from '../dist/slider/circularMath.js';

test('circular slider keeps non-zero-min and decimal grids and reachable off-grid max', () => {
  assert.equal(snapCircularValue(7.6, 3, 14, 2), 7);
  assert.equal(snapCircularValue(13.9, 3, 14, 2), 14);
  assert.equal(stepCircularValue(14, -1, 3, 14, 2), 13);
  assert.equal(stepCircularValue(13, 1, 3, 14, 2), 14);
  assert.equal(snapCircularValue(0.30000000000000004, 0.1, 1, 0.1), 0.3);
  assert.equal(stepCircularValue(0.3, 1, 0.1, 1, 0.1), 0.4);
  assert.equal(stepCircularValue(5, 10, 3, 14, 2), 14);
  assert.equal(stepCircularValue(13, -10, 3, 14, 2), 3);
});

test('partial circular arcs pick the nearest gap endpoint in both directions', () => {
  assert.equal(initialArcPosition(140, 225, 270, true, 0), 270);
  assert.equal(initialArcPosition(220, 225, 270, true, 0), 0);
  assert.equal(initialArcPosition(220, 135, 270, false, 0), 270);
  assert.equal(initialArcPosition(140, 135, 270, false, 0), 0);
  assert.equal(initialArcPosition(0, 225, 270, true, 0), 135);
});

test('full-circle track presses are absolute except the exact ambiguous seam', () => {
  assert.equal(initialArcPosition(1, 0, 360, true, 359), 1);
  assert.equal(initialArcPosition(90, 0, 360, true, 360), 90);
  assert.equal(initialArcPosition(180, 0, 360, true, 360), 180);
  assert.equal(initialArcPosition(359, 0, 360, true, 1), 359);
  assert.equal(initialArcPosition(0, 0, 360, true, 360), 360);
  assert.equal(initialArcPosition(0, 0, 360, true, 0), 0);
});

test('dragging crosses the 360 seam without jumping and reverses immediately from a bound', () => {
  assert.equal(advanceArcPosition(359, 359, 1, 360, true), 360);
  assert.equal(advanceArcPosition(360, 1, 359, 360, true), 358);
  assert.equal(advanceArcPosition(1, 1, 359, 360, true), 0);
  assert.equal(advanceArcPosition(0, 359, 1, 360, true), 2);
  assert.equal(advanceArcPosition(359, 1, 359, 360, false), 360);
  assert.equal(advanceArcPosition(269, 134, 140, 270, true), 270);
});
