import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  ColorPicker,
  colorAlphaPercent,
  normalizeColorValue,
  parseColorValue,
  withColorAlpha,
  withColorRgb,
} from '../dist/color-picker/index.js';

test('ColorPicker normalizes the documented hexadecimal input forms to hex8', () => {
  assert.equal(normalizeColorValue('#abc'), '#aabbccff');
  assert.equal(normalizeColorValue('#abcd'), '#aabbccdd');
  assert.equal(normalizeColorValue('#A1B2C3'), '#a1b2c3ff');
  assert.equal(normalizeColorValue(' #A1B2C380 '), '#a1b2c380');
  assert.equal(normalizeColorValue('red'), null);
  assert.equal(normalizeColorValue('rgb(1 2 3)'), null);
  assert.equal(parseColorValue('#12'), null);
});

test('ColorPicker conversions preserve RGB or alpha according to the interaction source', () => {
  assert.equal(withColorRgb('#11223380', '#abcdef'), '#abcdef80');
  assert.equal(withColorAlpha('#11223380', 0), '#11223300');
  assert.equal(withColorAlpha('#11223380', 50), '#11223380');
  assert.equal(withColorAlpha('#11223380', 100), '#112233ff');
  assert.equal(colorAlphaPercent('#11223380'), 50);
});

test('ColorPicker SSR output exposes native palette, text, slider, presets and form value', () => {
  const html = renderToStaticMarkup(createElement(ColorPicker, {
    defaultValue: '#33669980',
    form: 'brand-form',
    label: 'Brand color',
    labels: { palette: 'Choose color', value: 'Hex value', alpha: 'Opacity', presets: 'Saved colors' },
    name: 'brandColor',
    presets: [{ value: '#fff', label: 'Paper' }, '#00000080', 'invalid'],
    seed: 'brand',
  }));
  const fieldset = html.match(/<fieldset[^>]*>/)?.[0] ?? '';
  assert.match(fieldset, /class="inkra-color-picker"/);
  assert.match(fieldset, /form="brand-form"/);
  assert.match(html, /<legend[^>]*>.*Brand color/);
  assert.match(html, /type="color" value="#336699"/);
  assert.match(html, /aria-label="Choose color"/);
  assert.match(html, /role="slider"/);
  assert.match(html, /aria-valuenow="50"/);
  assert.match(html, /role="group" aria-label="Saved colors"/);
  assert.equal((html.match(/class="inkra-color-picker__preset"/g) ?? []).length, 2);
  assert.match(html, /type="hidden" form="brand-form" name="brandColor" value="#33669980"/);
});

test('ColorPicker controlled, opaque and disabled contracts are explicit in SSR', () => {
  const controlled = renderToStaticMarkup(createElement(ColorPicker, { value: '#1234', showAlpha: false }));
  assert.match(controlled, /data-controlled="true"/);
  assert.doesNotMatch(controlled, /inkra-color-picker__alpha/);
  assert.match(controlled, /value="#11223344"/);
  const invalid = renderToStaticMarkup(createElement(ColorPicker, { value: 'not-a-color', disabled: true }));
  assert.match(invalid, /data-invalid-value="true"/);
  assert.match(invalid, /<fieldset[^>]*disabled=""/);
  assert.match(invalid, /value="#4b96aaff"/);
});

test('ColorPicker delegates accessible one-dimensional input and avoids a custom 2D parser', () => {
  const source = readFileSync(new URL('../src/color-picker/index.tsx', import.meta.url), 'utf8');
  const parser = readFileSync(new URL('../src/color-picker/color.ts', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/color-picker/styles.css', import.meta.url), 'utf8');
  assert.match(source, /type="color"/);
  assert.match(source, /<Slider/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /onInvalidInput/);
  assert.match(source, /ownerForm\.addEventListener\('reset', reset\)/);
  assert.match(source, /if \(event\.defaultPrevented\) return/);
  assert.match(source, /controlled \? currentValueRef\.current : defaultValueRef\.current/);
  assert.match(source, /form=\{form\} name=\{name\}/);
  assert.match(source, /event\.nativeEvent\.isComposing \|\| event\.nativeEvent\.keyCode === 229/);
  assert.match(source, /skipNextBlurRef/);
  assert.match(parser, /#RGB, #RGBA|HEX_COLOR/);
  assert.doesNotMatch(source, /pointermove|mousemove|touchmove/);
  assert.match(css, /min-width: var\(--inkra-touch-target\)/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /inkra-color-picker__focus/);
  assert.match(css, /--inkra-accent-strong: var\(--inkra-focus\)/);
});
