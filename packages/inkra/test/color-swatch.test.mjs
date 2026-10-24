import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ColorSwatch } from '../dist/color-swatch/index.js';

test('ColorSwatch exposes a named native button and controlled selection', () => {
  const html = renderToStaticMarkup(createElement(ColorSwatch, {
    color: 'var(--brand)', label: 'Ocean', selected: true, disabled: true, size: 'sm', seed: 'ocean',
  }));
  assert.match(html, /<button[^>]*aria-label="Ocean"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /data-swatch-size="sm"/);
  assert.match(html, /type="button"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /color:var\(--brand\)/);
  assert.match(html, /inkra-color-swatch__wash/);
  assert.doesNotMatch(html, /<button[^>]* (color|selected|label|seed)=/);
});
