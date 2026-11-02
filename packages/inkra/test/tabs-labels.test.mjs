import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldCollapseTabLabels as collapse } from '../dist/tabs/useLabels.js';
test('adaptive labels account for gaps, equal-width shares and icon availability', () => {
  const mixed = [{width: 120, icon: true}, {width: 50, icon: true}];
  assert.equal(collapse(mixed, 180, 10, false, false), false);
  assert.equal(collapse(mixed, 179, 10, false, false), true);
  assert.equal(collapse(mixed, 180, 10, true, false), true);
  assert.equal(collapse(mixed, 250, 10, true, false), false);
  assert.equal(collapse(mixed, 0, 10, true, false), false);
  assert.equal(collapse([{width: 200, icon: false}], 50, 0, true, false), false);
  assert.equal(collapse(mixed, 100, 0, false, true), true);
  assert.equal(collapse(mixed, 125, 0, false, true), false);
});
