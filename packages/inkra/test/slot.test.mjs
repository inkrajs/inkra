import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';

const slotModule = process.env.INKRA_SLOT_MODULE
  ? new URL(process.env.INKRA_SLOT_MODULE, import.meta.url).href
  : new URL('../dist/slot/index.js', import.meta.url).href;
const { Slot } = await import(slotModule);

test('static Slot is a neutral container without forced button semantics', () => {
  const html = render(h(Slot, { 'aria-label': 'Map resource', size: 'lg' }, h('span', null, 'Map')));
  assert.match(html, /^<div/);
  assert.match(html, /aria-label="Map resource"/);
  assert.match(html, /data-size="lg"/);
  assert.match(html, /inkra-slot__content/);
  assert.doesNotMatch(html, /<button|role="button"|aria-pressed/);
});

test('interactive Slot uses one native button with selection and disabled semantics', () => {
  const html = render(h(Slot, {
    interactive: true,
    selected: true,
    disabled: true,
    'aria-label': 'Use torch',
  }, h('span', null, 'Torch')));
  assert.match(html, /^<button/);
  assert.match(html, /type="button"/);
  assert.match(html, /aria-label="Use torch"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /disabled=""/);
  assert.equal((html.match(/<button/g) ?? []).length, 1);
  assert.doesNotMatch(html, / interactive=| selected=/);
});

test('Slot supports empty content, Badge counts and custom count rendering', () => {
  const empty = render(h(Slot, { empty: true, emptyContent: h('span', null, 'Empty'), count: 12, 'aria-label': 'Empty resource slot' }));
  assert.match(empty, /data-empty="true"/);
  assert.match(empty, />Empty</);
  assert.match(empty, /inkra-badge/);
  assert.match(empty, />12</);
  assert.doesNotMatch(empty, / empty=| count=/);

  const custom = render(h(Slot, { count: 3, renderCount: value => h('output', { 'data-count': value }, `${value}x`) }, 'Resource'));
  assert.match(custom, /<output data-count="3">3x<\/output>/);
  assert.doesNotMatch(custom, /inkra-badge/);
});

test('Slot CSS fixes geometry, logical badge placement and accessible fallbacks', () => {
  const css = readFileSync(new URL('../src/slot/styles.css', import.meta.url), 'utf8');
  assert.match(css, /--inkra-slot-size:\s*64px/);
  assert.match(css, /data-size="sm"[^}]*48px/);
  assert.match(css, /data-size="lg"[^}]*80px/);
  assert.match(css, /inset-inline-end:\s*-8px/);
  assert.match(css, /min-inline-size:\s*var\(--inkra-slot-size\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(css, /border-radius:\s*999|border-style:\s*dashed/);
});
