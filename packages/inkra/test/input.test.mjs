import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Button, Field, Input } from '../dist/index.js';

const render = props => renderToStaticMarkup(createElement(Input, props));
const inputTag = html => html.match(/<input\b[^>]*>/)?.[0] ?? '';
const clearTag = html => html.match(/<button\b[^>]*class="inkra-input__clear"[^>]*>/)?.[0] ?? '';

test('Input preserves native props and defaults to a single pencil underline', () => {
  const html = render({ id: 'search', type: 'search', name: 'query', form: 'search-form', autoComplete: 'off', maxLength: 80, className: 'native-input', defaultValue: 'Notes', 'aria-label': 'Search' });
  assert.match(html, /data-full-width="true"/);
  assert.match(html, /data-variant="underline"/);
  assert.match(html, /inkra-input__underline/);
  assert.doesNotMatch(html, /inkra-pencil-surface--outline/);
  assert.match(inputTag(html), /id="search"/);
  assert.match(inputTag(html), /name="query"/);
  assert.match(inputTag(html), /form="search-form"/);
  assert.match(inputTag(html), /maxLength="80"/);
  assert.match(inputTag(html), /class="inkra-input native-input"/);
  assert.match(inputTag(html), /value="Notes"/);
  assert.doesNotMatch(html, /inkra-input__clear|inkra-input__loading/);
});

test('Input reserves a named native clear button only for clearable text-like types', () => {
  const filled = render({ type: 'search', clearable: true, defaultValue: 'Notes', clearButtonLabel: 'Clear search' });
  assert.match(filled, /data-clearable="true"/);
  assert.match(clearTag(filled), /type="button"/);
  assert.match(clearTag(filled), /aria-label="Clear search"/);
  assert.match(clearTag(filled), /data-visible="true"/);
  assert.match(clearTag(filled), /tabindex="0"/);
  assert.doesNotMatch(clearTag(filled), /disabled|aria-hidden/);
  assert.match(clearTag(render({ clearable: true })), /data-visible="false"/);
  assert.match(clearTag(render({ clearable: true })), /aria-hidden="true"/);
  assert.match(clearTag(render({ clearable: true })), /disabled=""/);
  assert.match(clearTag(render({ clearable: true })), /tabindex="-1"/);
  assert.doesNotMatch(render({ type: 'file', clearable: true }), /inkra-input__clear/);
  assert.doesNotMatch(render({ type: 'range', clearable: true }), /inkra-input__clear/);
});

test('Input respects Field readonly and disabled state for clearing and custom actions', () => {
  for (const state of ['disabled', 'readOnly']) {
    const html = renderToStaticMarkup(createElement(Field, { label: 'Name', [state]: true }, createElement(Input, {
      clearable: true,
      defaultValue: 'Notes',
      endAction: createElement('button', { type: 'button' }, 'Copy'),
    })));
    assert.match(clearTag(html), /disabled=""/);
    assert.match(clearTag(html), /data-visible="false"/);
    if (state === 'disabled') assert.match(html, /class="inkra-input__end-action" inert=""/);
    else assert.doesNotMatch(html, / inert=/);
  }
});

test('Input distinguishes decorative icons, visible affixes and interactive actions', () => {
  const html = render({
    startIcon: createElement('span', null, 'Search icon'),
    endIcon: createElement('span', null, 'Verified icon'),
    prefix: 'https://',
    suffix: '.com',
    endAction: createElement('button', { type: 'button' }, 'Open'),
    dir: 'rtl',
  });
  assert.match(html, /^<span[^>]*dir="rtl"/);
  assert.equal((html.match(/aria-hidden="true" class="inkra-field-control__icon/g) ?? []).length, 2);
  assert.match(html, /inkra-input__affix--prefix/);
  assert.match(html, /inkra-input__affix--suffix/);
  assert.match(html, /https:\/\//);
  assert.match(html, /class="inkra-input__end-action">[\s\S]*<button type="button">Open<\/button>/);
  assert.doesNotMatch(inputTag(html), /prefix=|suffix=|endAction=|startIcon=|endIcon=/);
});

test('Input trailing action has one decorative vertical pencil divider inside the shared control', () => {
  const html = render({ variant: 'outline', endAction: createElement('button', { type: 'button' }, 'Copy'), dir: 'rtl' });
  assert.equal((html.match(/inkra-input__action-divider/g) ?? []).length, 1);
  assert.match(html, /aria-hidden="true" class="inkra-pencil-line inkra-input__action-divider" data-orientation="vertical"/);
  assert.equal((html.match(/inkra-pencil-surface--outline/g) ?? []).length, 1);
  assert.doesNotMatch(render({ clearable: true, defaultValue: 'Notes' }), /inkra-input__action-divider/);
});

test('Only embedded Input buttons delegate their wash and outline to Input', () => {
  const button = createElement(Button, { variant: 'ghost', 'aria-label': 'Copy', size: 'icon' }, 'Copy');
  const embedded = render({ endAction: button });
  const standalone = renderToStaticMarkup(button);
  assert.match(embedded, /inkra-pencil-surface--ghost inkra-pencil-surface--clipped inkra-button__surface/);
  assert.match(embedded, /inkra-pencil-surface--selection inkra-input__action-wash/);
  assert.equal((embedded.match(/inkra-pencil-surface__border/g) ?? []).length, 2);
  assert.match(standalone, /inkra-pencil-surface--quiet inkra-pencil-surface--clipped inkra-button__surface/);
  assert.equal((standalone.match(/inkra-pencil-surface__border/g) ?? []).length, 1);
  assert.doesNotMatch(standalone, /inkra-input__action-wash/);
});

test('Input loading is nonblocking and supports a stable explicitly reserved slot', () => {
  const idle = render({ loading: false });
  const loading = render({ loading: true, defaultValue: 'Notes' });
  assert.match(idle, /inkra-input__loading" data-active="false"/);
  assert.match(loading, /inkra-input__loading" data-active="true"/);
  assert.match(inputTag(loading), /aria-busy="true"/);
  assert.doesNotMatch(inputTag(loading), /disabled|readOnly|loading=/);
  assert.doesNotMatch(inputTag(idle), /aria-busy="true"/);
});

test('Input exposes appearance, alignment and slot classes without leaking custom DOM props', () => {
  for (const [variant, surface] of [['underline', 'ghost'], ['outline', 'outline'], ['soft', 'quiet'], ['ghost', 'ghost']]) {
    const html = render({ variant, fullWidth: false, textAlign: 'end', classNames: { root: 'root-slot', control: 'control-slot', input: 'input-slot' } });
    assert.match(html, new RegExp(`inkra-pencil-surface--${surface}`));
    assert.match(html, /data-full-width="false"/);
    assert.match(html, /class="inkra-field-control-hit inkra-input-root root-slot"/);
    assert.match(html, /inkra-field-control--input control-slot/);
    assert.match(inputTag(html), /class="inkra-input input-slot"/);
    assert.match(inputTag(html), /style="text-align:end"/);
    assert.doesNotMatch(inputTag(html), /fullWidth=|textAlign=|classNames=|variant=/);
  }
  assert.match(render({ invalid: true, variant: 'ghost' }), /inkra-pencil-surface--danger/);
});

test('Input shares its frame with logical leading and trailing actions', () => {
  const html = render({ startAction: createElement('button', { type: 'button' }, 'Before'), endAction: createElement('button', { type: 'button' }, 'After') });
  assert(html.indexOf('>Before<') < html.indexOf('<input'));
  assert(html.indexOf('>After<') > html.indexOf('<input'));
  assert.match(html, /inkra-input__start-action/);
  assert.doesNotMatch(inputTag(html), /startAction=|endAction=/);
});

test('Input accepts controlled values and value callbacks without forcing readOnly', () => {
  const html = render({ value: 'Controlled', clearable: true, onValueChange: () => {}, onClear: () => {} });
  assert.match(inputTag(html), /value="Controlled"/);
  assert.match(clearTag(html), /data-visible="true"/);
  assert.doesNotMatch(inputTag(html), /readOnly|onValueChange|onClear/);
});
