import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Textarea } from '../dist/index.js';

const render = props => renderToStaticMarkup(createElement(Textarea, props));
test('Textarea counter uses native UTF-16 units and the automatic threshold', () => {
  const quiet = render({ defaultValue: 'abc', maxLength: 10 });
  assert.match(quiet, /data-visible="false"/);
  assert.doesNotMatch(quiet, /aria-describedby=/);
  const near = render({ defaultValue: '中文😀', maxLength: 5 });
  assert.match(near, /1 remaining/);
  assert.match(near, /data-visible="true"/);
  assert.match(near, /aria-describedby="inkra-textarea-/);
  assert.match(render({ value: 'too long', maxLength: 3, readOnly: true }), /5 over limit/);
  assert.match(render({ maxLength: 0 }), /0 remaining/);
});
test('Textarea count modes and localization preserve the native textarea and ref surface', () => {
  assert.match(render({ maxLength: 10, countDisplay: 'always', countMode: 'fraction', defaultValue: 'abc' }), /3 \/ 10/);
  assert.match(render({ maxLength: 10, countDisplay: 'always', countMode: 'progress', defaultValue: 'abc' }), /role="progressbar"/);
  assert.doesNotMatch(render({ maxLength: 10, countMode: 'none' }), /inkra-textarea__count/);
  assert.doesNotMatch(render({}), /inkra-textarea__footer/);
  assert.match(render({ maxLength: 10, countDisplay: 'always', getCountLabel: ({ remaining }) => `Left: ${remaining}` }), /Left: 10/);
  assert.match(render({ defaultValue: 'notes' }), />notes<\/textarea>/);
});
test('Resize is off by default; custom handle has keyboard and value semantics', () => {
  assert.doesNotMatch(render({}), /inkra-textarea__resize/);
  const enabled = render({ resize: 'vertical', resizeLabel: 'Adjust height', disabled: true });
  assert.match(enabled, /resize:none/);
  assert.match(enabled, /role="slider"/);
  assert.match(enabled, /aria-label="Adjust height"/);
  assert.match(enabled, /aria-valuemin="96"/);
  assert.match(enabled, /aria-valuemax="1200"/);
});
