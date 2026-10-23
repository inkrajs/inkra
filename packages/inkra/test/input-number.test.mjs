import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InputNumber } from '../dist/input-number/index.js';
import { Field } from '../dist/form/Field.js';

const render = props => renderToStaticMarkup(createElement(InputNumber, props));
const inputTag = html => html.match(/<input\b[^>]*>/)?.[0] ?? '';
const button = (html, label) => html.match(new RegExp(`<button\\b[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? '';

test('InputNumber defaults to native numeric input and a single pencil underline', () => {
  const html = render({ name: 'quantity', defaultValue: 2, 'aria-label': 'Quantity' });
  assert.match(html, /data-variant="underline"/);
  assert.match(html, /inkra-input-number/);
  assert.match(inputTag(html), /type="number"/);
  assert.match(inputTag(html), /name="quantity"/);
  assert.match(inputTag(html), /value="2"/);
  assert.match(inputTag(html), /step="1"/);
  assert.match(button(html, 'Decrease value'), /type="button"/);
  assert.match(button(html, 'Increase value'), /type="button"/);
  assert.match(inputTag(html), /text-align:center/);
  assert(html.indexOf('aria-label="Decrease value"') < html.indexOf('<input'));
  assert(html.indexOf('aria-label="Increase value"') > html.indexOf('<input'));
  assert.doesNotMatch(html, /inkra-input__clear/);
  assert.doesNotMatch(inputTag(html), /controls=|incrementButtonLabel=|decrementButtonLabel=/);
});

test('InputNumber forwards decimal limits, alignment and explicit outline appearance', () => {
  const html = render({ min: -2.5, max: 7.5, step: 0.25, value: 1.25, onValueChange() {}, variant: 'outline', textAlign: 'end', suffix: 'kg', classNames: { root: 'quantity-root' } });
  assert.match(inputTag(html), /min="-2.5"/);
  assert.match(inputTag(html), /max="7.5"/);
  assert.match(inputTag(html), /step="0.25"/);
  assert.match(inputTag(html), /value="1.25"/);
  assert.match(inputTag(html), /text-align:end/);
  assert.match(html, /data-variant="outline"/);
  assert.match(html, /inkra-input-number quantity-root/);
  assert.match(html, /inkra-input__affix--suffix/);
});

test('InputNumber null remains empty and non-finite values do not leak to DOM', () => {
  assert.match(inputTag(render({ value: null, defaultValue: 3, onValueChange() {} })), /value=""/);
  assert.match(inputTag(render({ value: 0, onValueChange() {} })), /value="0"/);
  assert.match(inputTag(render({ defaultValue: Number.NaN })), /value=""/);
  assert.match(inputTag(render({ defaultValue: Infinity })), /value=""/);
});

test('InputNumber disables stepping at boundaries and when arbitrary precision is requested', () => {
  const minimum = render({ min: 0, max: 10, defaultValue: 0 });
  assert.match(button(minimum, 'Decrease value'), /disabled=""/);
  assert.doesNotMatch(button(minimum, 'Increase value'), /disabled=""/);
  const maximum = render({ min: 0, max: 10, defaultValue: 10 });
  assert.match(button(maximum, 'Increase value'), /disabled=""/);
  assert.doesNotMatch(button(maximum, 'Decrease value'), /disabled=""/);
  const arbitrary = render({ step: 'any', defaultValue: 1.234 });
  assert.match(inputTag(arbitrary), /step="any"/);
  assert.match(button(arbitrary, 'Increase value'), /disabled=""/);
  assert.match(button(arbitrary, 'Decrease value'), /disabled=""/);
});

test('InputNumber inherits Field readOnly and disabled state for both steppers', () => {
  for (const state of ['disabled', 'readOnly']) {
    const html = renderToStaticMarkup(createElement(Field, { label: 'Quantity', [state]: true }, createElement(InputNumber, { defaultValue: 2, clearable: true })));
    assert.match(inputTag(html), state === 'disabled' ? /disabled=""/ : /readOnly=""/);
    assert.match(button(html, 'Decrease value'), /disabled=""/);
    assert.match(button(html, 'Increase value'), /disabled=""/);
    assert.doesNotMatch(html, /inkra-input__clear/);
  }
});

test('InputNumber can hide step controls and supplies localized accessible labels', () => {
  const hidden = render({ controls: false, clearable: true, defaultValue: 3, clearButtonLabel: 'Clear quantity' });
  assert.doesNotMatch(hidden, /inkra-input-number__controls/);
  assert.doesNotMatch(hidden, /inkra-input__clear/);
  const localized = render({ incrementButtonLabel: 'More items', decrementButtonLabel: 'Fewer items' });
  assert.match(button(localized, 'More items'), /type="button"/);
  assert.match(button(localized, 'Fewer items'), /type="button"/);
  assert.doesNotMatch(localized, /title="(?:More items|Fewer items)"/);
});

test('InputNumber consumes modifier and hold configuration without leaking native attributes', () => {
  const html = render({
    defaultValue: 0.25,
    step: 0.25,
    stepModifiers: [{ shiftKey: true, step: 10 }, { altKey: true, step: 0.1 }],
    pressAndHold: false,
    repeatDelay: 500,
    repeatInterval: 120,
  });
  assert.match(inputTag(html), /value="0.25"/);
  assert.match(inputTag(html), /step="0.25"/);
  assert.doesNotMatch(inputTag(html), /stepModifiers=|pressAndHold=|repeatDelay=|repeatInterval=/i);
});
