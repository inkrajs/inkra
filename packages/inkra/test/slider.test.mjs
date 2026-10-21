import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Slider } from '../dist/slider/index.js';

test('Slider renders named thumbs and deterministic pencil surfaces', () => {
  const html = renderToStaticMarkup(createElement(Slider, { 'aria-label': 'Offset', defaultValue: [24], seed: 'offset', max: 48 }));
  assert.match(html, /inkra-slider/);
  assert.match(html, /aria-label="Offset"/);
  assert.match(html, /role="slider"/);
  assert.match(html, /clip-path:inset\(0 50% 0 0%\)/);
  assert.match(html, /inkra-pencil-surface--selection/);
  assert.match(html, /inkra-slider__thumb-surface/);
  assert.doesNotMatch(html, /<svg/);
});

test('Slider range thumbs have distinct labels and formatted values', () => {
  const html = renderToStaticMarkup(createElement(Slider, {
    value: [20, 80],
    thumbLabels: ['Minimum budget', 'Maximum budget'],
    getValueLabel: value => `${value} dollars`,
    'aria-describedby': 'budget-help',
    name: 'budget',
    form: 'filters',
  }));
  assert.equal((html.match(/role="slider"/g) ?? []).length, 2);
  assert.match(html, /aria-label="Minimum budget"/);
  assert.match(html, /aria-label="Maximum budget"/);
  assert.match(html, /aria-valuetext="20 dollars"/);
  assert.match(html, /aria-valuetext="80 dollars"/);
  assert.equal((html.match(/aria-describedby="budget-help"/g) ?? []).length, 2);
  assert.match(html, /clip-path:inset\(0 20% 0 20%\)/);
});

test('Slider exposes size, disabled, vertical and RTL contracts', () => {
  const vertical = renderToStaticMarkup(createElement(Slider, { defaultValue: [25], orientation: 'vertical', disabled: true, size: 'lg' }));
  assert.match(vertical, /data-size="lg"/);
  assert.match(vertical, /data-disabled=""/);
  assert.match(vertical, /data-orientation="vertical"/);
  assert.match(vertical, /clip-path:inset\(75% 0 0% 0\)/);
  const rtl = renderToStaticMarkup(createElement(Slider, { defaultValue: [25], dir: 'rtl' }));
  assert.match(rtl, /dir="rtl"/);
  assert.match(rtl, /clip-path:inset\(0 0% 0 75%\)/);
  const inverted = renderToStaticMarkup(createElement(Slider, { defaultValue: [25], dir: 'rtl', inverted: true }));
  assert.match(inverted, /clip-path:inset\(0 75% 0 0%\)/);
});

test('Slider inset variant gives every size a track wider than its visual thumb', () => {
  for (const size of ['sm', 'md', 'lg']) {
    const html = renderToStaticMarkup(createElement(Slider, { variant: 'inset', size, defaultValue: [0, 100] }));
    assert.match(html, /data-variant="inset"/);
    assert.match(html, new RegExp(`data-size="${size}"`));
  }
  const css = readFileSync(new URL('../src/slider/styles.css', import.meta.url), 'utf8');
  const variants = [...css.matchAll(/\.inkra-slider\[data-variant="inset"\][^{]*\{([^}]+)\}/g)];
  assert.equal(variants.length, 3);
  for (const [, block] of variants) {
    const track = Number(block.match(/--inkra-slider-track-size: (\d+)px/)[1]);
    const thumb = Number(block.match(/--inkra-slider-thumb-size: (\d+)px/)[1]);
    assert(track > thumb);
  }
});

test('Slider delegates gestures and forms to Radix and clips a stable full-size wash', () => {
  const source = readFileSync(new URL('../src/slider/index.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/slider/styles.css', import.meta.url), 'utf8');
  assert.match(source, /@radix-ui\/react-slider/);
  assert.match(source, /SliderPrimitive\.Root/);
  assert.match(source, /onValueChange\?\.\(next\)/);
  assert.match(css, /\.inkra-slider__thumb\s*\{[^}]*height: var\(--inkra-touch-target\)/);
  assert.match(css, /forced-colors: active/);
  assert.doesNotMatch(css, /transition:.*(?:width|height)/);
});

test('Slider focus uses a pencil surface with a forced-colors fallback', () => {
  const source = readFileSync(new URL('../src/slider/index.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/slider/styles.css', import.meta.url), 'utf8');
  assert.match(source, /className="inkra-slider__focus-ring"/);
  assert.match(css, /\.inkra-slider__thumb:focus-visible\s*\{\s*outline: none;/);
  assert.match(css, /\.inkra-slider__thumb:focus-visible \.inkra-slider__focus-ring\s*\{\s*opacity: 1;/);
  const normalStyles = css.split('@media (forced-colors: active)')[0];
  assert.doesNotMatch(normalStyles, /outline:[^;]*solid/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
