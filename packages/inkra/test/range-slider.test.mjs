import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RangeSlider } from '../dist/range-slider/index.js';

test('RangeSlider renders exactly two named thumbs on the existing Slider engine', () => {
  const html = renderToStaticMarkup(createElement(RangeSlider, {
    defaultValue: [20, 80],
    min: 0,
    max: 100,
    step: 5,
    minDistance: 10,
    seed: 'budget-range',
  }));

  assert.equal((html.match(/role="slider"/g) ?? []).length, 2);
  assert.match(html, /aria-label="Minimum value"/);
  assert.match(html, /aria-label="Maximum value"/);
  assert.match(html, /clip-path:inset\(0 20% 0 20%\)/);
  assert.equal((html.match(/inkra-slider__thumb-surface/g) ?? []).length, 2);
});

test('RangeSlider preserves custom thumb names, RTL, disabled and value text contracts', () => {
  const html = renderToStaticMarkup(createElement(RangeSlider, {
    value: [15, 45],
    thumbLabels: ['Earliest date', 'Latest date'],
    getValueLabel: value => `Day ${value}`,
    dir: 'rtl',
    disabled: true,
  }));

  assert.match(html, /dir="rtl"/);
  assert.match(html, /data-disabled=""/);
  assert.match(html, /aria-label="Earliest date"/);
  assert.match(html, /aria-label="Latest date"/);
  assert.match(html, /aria-valuetext="Day 15"/);
  assert.match(html, /aria-valuetext="Day 45"/);
});

test('RangeSlider maps value distance to Radix steps and exposes an explicit crossing rule', () => {
  const source = readFileSync(new URL('../src/range-slider/index.tsx', import.meta.url), 'utf8');

  assert.match(source, /import \{ Slider \} from '\.\.\/slider\/index\.js'/);
  assert.match(source, /Math\.ceil\(minDistance \/ step\)/);
  assert.match(source, /minStepsBetweenThumbs=\{allowCross \? 0 : getMinimumSteps\(minDistance, step\)\}/);
  assert.match(source, /preserveThumbOrder=\{!allowCross\}/);
  assert.doesNotMatch(source, /SliderPrimitive|onPointerMove|onKeyDown/);
});

test('RangeSlider keeps a two-number controlled callback contract', () => {
  const source = readFileSync(new URL('../src/range-slider/index.tsx', import.meta.url), 'utf8');

  assert.match(source, /export type RangeSliderValue = \[number, number\]/);
  assert.match(source, /onValueChange\?: \(value: RangeSliderValue\) => void/);
  assert.match(source, /onValueCommit\?: \(value: RangeSliderValue\) => void/);
  assert.match(source, /normalizeRangeValue\(defaultValue \?\? \[min, max\]\)/);
  assert.match(source, /value\[0\] <= value\[1\] \? value : \[value\[1\], value\[0\]\]/);
});

test('RangeSlider derives its uncontrolled default from custom bounds', () => {
  const html = renderToStaticMarkup(createElement(RangeSlider, {
    min: 10,
    max: 30,
  }));

  assert.match(html, /aria-valuenow="10"/);
  assert.match(html, /aria-valuenow="30"/);
  assert.match(html, /clip-path:inset\(0 0% 0 0%\)/);
});

test('RangeSlider normalizes reversed endpoint input to low then high', () => {
  const html = renderToStaticMarkup(createElement(RangeSlider, {
    value: [80, 20],
    thumbLabels: ['Low', 'High'],
  }));

  assert.match(html, /aria-label="Low"[^>]*aria-valuenow="20"/);
  assert.match(html, /aria-label="High"[^>]*aria-valuenow="80"/);
});
