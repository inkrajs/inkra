import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  normalizeInputNumberRepeat,
  resolveInputNumberStep,
  stepInputNumber,
} from '../src/input-number/model.ts';

const modifiers = changes => ({ shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...changes });

test('InputNumber default modifier is exact Shift with absolute step ten', () => {
  assert.equal(resolveInputNumberStep(modifiers({ shiftKey: true })), 10);
  assert.equal(resolveInputNumberStep(modifiers({})), undefined);
  assert.equal(resolveInputNumberStep(modifiers({ shiftKey: true, altKey: true })), undefined);
  assert.equal(resolveInputNumberStep(modifiers({ shiftKey: true, ctrlKey: true })), undefined);
  assert.equal(resolveInputNumberStep(modifiers({ shiftKey: true }), []), undefined);
});

test('InputNumber custom modifier chords match exactly and reject invalid amounts', () => {
  const rules = [
    { shiftKey: true, step: 0 },
    { shiftKey: true, step: Infinity },
    { shiftKey: true, step: NaN },
    { shiftKey: true, step: -1 },
    { shiftKey: true, step: 0.25 },
    { shiftKey: true, step: 20 },
    { ctrlKey: true, altKey: true, step: 100 },
    { metaKey: true, step: 1000 },
  ];
  assert.equal(resolveInputNumberStep(modifiers({ shiftKey: true }), rules), 0.25);
  assert.equal(resolveInputNumberStep(modifiers({ ctrlKey: true, altKey: true }), rules), 100);
  assert.equal(resolveInputNumberStep(modifiers({ metaKey: true }), rules), 1000);
  assert.equal(resolveInputNumberStep(modifiers({ altKey: true }), rules), undefined);
  assert.equal(resolveInputNumberStep(modifiers({}), [{ step: 2 }]), 2);
});

test('InputNumber repeat timings have finite bounded defaults', () => {
  for (const invalid of [undefined, NaN, Infinity, -Infinity]) {
    assert.equal(normalizeInputNumberRepeat(invalid, 400, 150), 400);
  }
  assert.equal(normalizeInputNumberRepeat(-10, 400, 150), 150);
  assert.equal(normalizeInputNumberRepeat(0, 80, 32), 32);
  assert.equal(normalizeInputNumberRepeat(120, 80, 32), 120);
  assert.equal(normalizeInputNumberRepeat(1e12, 80, 32), 60_000);
});

test('InputNumber delegates ordinary stepping and does not step blocked controls', () => {
  let calls = 0;
  const input = {
    value: '1', valueAsNumber: 1, step: '0.25', min: '0', max: '10',
    disabled: false, readOnly: false,
    stepUp() { calls += 1; this.value = '1.25'; },
    stepDown() { calls += 1; this.value = '0.75'; },
  };
  assert.equal(stepInputNumber(input, 'increment'), true);
  assert.equal(input.value, '1.25');
  for (const state of [{ disabled: true }, { readOnly: true }, { step: 'any' }, { min: '20' }, { valueAsNumber: 10 }]) {
    assert.equal(stepInputNumber({ ...input, ...state }, 'increment'), false);
  }
  assert.equal(calls, 1);
});

test('InputNumber modifier probe preserves source attributes and clamps native output', () => {
  let probe;
  const input = {
    value: '3.25', valueAsNumber: 3.25, step: '0.25', min: '0', max: '12',
    disabled: false, readOnly: false,
    cloneNode(deep) {
      assert.equal(deep, false);
      probe = {
        removed: [],
        removeAttribute(name) { this.removed.push(name); },
        stepUp() { this.valueAsNumber = 13.25; },
      };
      return probe;
    },
  };
  assert.equal(stepInputNumber(input, 'increment', 10), true);
  assert.equal(input.value, '12');
  assert.equal(input.step, '0.25');
  assert.equal(input.min, '0');
  assert.equal(input.max, '12');
  assert.equal(probe.step, '10');
  assert.equal(probe.defaultValue, '3.25');
  assert.deepEqual(probe.removed, ['min', 'max']);
});

test('InputNumber stops repeat across lifecycle events and suppresses pointer clicks only', () => {
  const source = readFileSync(new URL('../src/input-number/index.tsx', import.meta.url), 'utf8');
  assert.match(source, /onPointerCancel: stopHolding/);
  assert.match(source, /onLostPointerCapture: stopHolding/);
  assert.match(source, /onBlur: stopHolding/);
  assert.match(source, /document\.hidden/);
  assert.match(source, /window\.addEventListener\('blur', stopHolding\)/);
  assert.match(source, /clearTimeout\(timerRef\.current\)/);
  assert.match(source, /event\.detail > 0 && suppressClickRef\.current/);
  assert.match(source, /event\.nativeEvent\.isComposing/);
  assert.match(source, /onKeyDown\?\.\(event\)/);
});
