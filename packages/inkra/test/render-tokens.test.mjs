import assert from 'node:assert/strict';
import test from 'node:test';
import { readRenderToken } from '../dist/internal/renderTokens.js';

test('render tokens preserve defaults, parse CSS lengths and bound invalid settings', () => {
  const read = value => readRenderToken({ getPropertyValue: () => value }, '--inkra-stroke-width', 1.2, 0.3, 3);
  assert.equal(read(''), 1.2);
  assert.equal(read('invalid'), 1.2);
  assert.equal(read('Infinity'), 1.2);
  assert.equal(read('2.5px'), 2.5);
  assert.equal(read('-4'), 0.3);
  assert.equal(read('1000'), 3);
});
