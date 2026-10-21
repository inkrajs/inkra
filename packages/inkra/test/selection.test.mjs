import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Switch,
} from '../dist/index.js';

test('Checkbox preserves native form semantics and exposes mixed state', () => {
  const checked = renderToStaticMarkup(createElement(Checkbox, {
    defaultChecked: true,
    description: 'Monthly product notes',
    form: 'preferences',
    label: 'Product updates',
    name: 'updates',
    value: 'product',
  }));
  const mixed = renderToStaticMarkup(createElement(Checkbox, {
    indeterminate: true,
    label: 'Select all results',
    name: 'all',
  }));

  assert.match(checked, /^<label/);
  assert.match(checked, /type="checkbox"/);
  assert.match(checked, /name="updates"/);
  assert.match(checked, /value="product"/);
  assert.match(checked, /form="preferences"/);
  assert.match(checked, /checked=""/);
  assert.match(checked, /aria-labelledby="([^"]+-label)"/);
  assert.match(checked, /id="[^"]+-label"/);
  assert.match(checked, /aria-describedby="[^"]+-description"/);
  assert.match(checked, /inkra-pencil-surface__ink/);
  assert.match(mixed, /aria-checked="mixed"/);
  assert.match(mixed, /data-indeterminate="true"/);
  assert.match(mixed, /inkra-selection-control__glyph/);
  assert.doesNotMatch(mixed, /<svg|✓|☑|—/);
});

test('Selection controls keep descriptions out of names and preserve explicit ARIA names', () => {
  const checkbox = renderToStaticMarkup(createElement(Checkbox, {
    'aria-label': 'Explicit checkbox name',
    description: 'Checkbox description',
    label: 'Visible checkbox label',
  }));
  const toggle = renderToStaticMarkup(createElement(Switch, {
    'aria-labelledby': 'external-switch-label',
    description: 'Switch description',
    label: 'Visible switch label',
  }));
  const radio = renderToStaticMarkup(createElement(
    RadioGroup,
    { name: 'choice' },
    createElement(RadioGroupItem, {
      description: 'Radio description',
      label: 'Visible radio label',
      value: 'one',
    }),
  ));

  assert.match(checkbox, /aria-label="Explicit checkbox name"/);
  assert.doesNotMatch(checkbox, /aria-labelledby=/);
  assert.match(checkbox, /aria-describedby="[^"]+-description"/);
  assert.match(toggle, /aria-labelledby="external-switch-label"/);
  assert.match(toggle, /aria-describedby="[^"]+-description"/);
  assert.match(radio, /aria-labelledby="([^"]+-label)"/);
  assert.match(radio, /aria-describedby="[^"]+-description"/);
  assert.doesNotMatch(radio, /aria-labelledby="[^"]+-description"/);
});

test('Checkbox and Switch forward disabled and controlled native state', () => {
  const checkbox = renderToStaticMarkup(createElement(Checkbox, {
    checked: false,
    disabled: true,
    label: 'Unavailable',
    onChange() {},
  }));
  const toggle = renderToStaticMarkup(createElement(Switch, {
    checked: true,
    disabled: true,
    label: 'Notifications',
    name: 'notifications',
    onChange() {},
    value: 'enabled',
  }));

  assert.match(checkbox, /disabled=""/);
  assert.match(checkbox, /data-disabled="true"/);
  assert.doesNotMatch(checkbox, /checked=""/);
  assert.match(toggle, /type="checkbox"/);
  assert.match(toggle, /role="switch"/);
  assert.match(toggle, /checked=""/);
  assert.match(toggle, /name="notifications"/);
  assert.match(toggle, /value="enabled"/);
  assert.match(toggle, /data-checked="true"/);
  assert.match(toggle, /inkra-switch__track/);
  assert.match(toggle, /inkra-switch__thumb/);
  assert.doesNotMatch(toggle, /<button|<svg/);
});

test('RadioGroup provides one native name and selected value through fieldset semantics', () => {
  const group = renderToStaticMarkup(createElement(
    RadioGroup,
    {
      defaultValue: 'standard',
      description: 'Choose one delivery speed',
      form: 'checkout',
      label: 'Delivery',
      name: 'delivery',
      required: true,
    },
    createElement(RadioGroupItem, { label: 'Standard', value: 'standard' }),
    createElement(RadioGroupItem, {
      description: 'Additional charge',
      disabled: true,
      label: 'Express',
      value: 'express',
    }),
  ));

  assert.match(group, /^<fieldset/);
  assert.match(group, /form="checkout"/);
  assert.match(group, /<legend/);
  assert.equal((group.match(/type="radio"/g) ?? []).length, 2);
  assert.equal((group.match(/name="delivery"/g) ?? []).length, 2);
  assert.equal((group.match(/required=""/g) ?? []).length, 2);
  assert.match(group, /checked=""/);
  assert.match(group, /value="standard"/);
  assert.match(group, /disabled=""/);
  assert.match(group, /value="express"/);
  assert.equal((group.match(/inkra-radio-group__mark/g) ?? []).length, 2);
  assert.doesNotMatch(group, /role="radio"|role="radiogroup"|<button|<svg/);
});

test('RadioGroup supports segmented presentation, orientation and decorative icons', () => {
  const segmented = renderToStaticMarkup(createElement(
    RadioGroup,
    {
      defaultValue: 'graphite',
      label: 'Theme',
      name: 'theme',
      orientation: 'horizontal',
      variant: 'segmented',
    },
    createElement(RadioGroupItem, {
      icon: createElement('span', { 'data-theme-icon': 'graphite' }, 'G'),
      label: 'Graphite',
      value: 'graphite',
    }),
    createElement(RadioGroupItem, {
      disabled: true,
      icon: createElement('span', { 'data-theme-icon': 'ocean' }, 'O'),
      label: 'Ocean',
      value: 'ocean',
    }),
  ));

  assert.match(segmented, /data-variant="segmented"/);
  assert.match(segmented, /data-orientation="horizontal"/);
  assert.equal((segmented.match(/type="radio"/g) ?? []).length, 2);
  assert.equal((segmented.match(/name="theme"/g) ?? []).length, 2);
  assert.equal((segmented.match(/inkra-radio-group__segment/g) ?? []).length, 2);
  assert.equal((segmented.match(/inkra-radio-group__icon/g) ?? []).length, 2);
  assert.equal((segmented.match(/inkra-pencil-surface--selection/g) ?? []).length, 2);
  assert.equal((segmented.match(/inkra-pencil-surface--outline/g) ?? []).length, 1);
  assert.equal((segmented.match(/inkra-radio-group__frame/g) ?? []).length, 1);
  assert.equal((segmented.match(/inkra-radio-segment__surface--selection/g) ?? []).length, 2);
  assert.doesNotMatch(segmented, /inkra-radio-segment__surface--outline/);
  assert.match(segmented, /data-theme-icon="graphite"/);
  assert.match(segmented, /aria-hidden="true" class="inkra-radio-group__icon"/);
  assert.match(segmented, /disabled=""/);
  assert.doesNotMatch(segmented, /aria-orientation=|role="radio"|role="radiogroup"|<button/);
});

test('Selection controls use pencil primitives and a 44px native hit contract', () => {
  const css = readFileSync(new URL('../src/selection/selection.css', import.meta.url), 'utf8');
  const sources = ['Checkbox.tsx', 'RadioGroup.tsx', 'Switch.tsx']
    .map(file => readFileSync(new URL(`../src/selection/${file}`, import.meta.url), 'utf8'))
    .join('\n');

  assert.match(css, /min-height:\s*var\(--inkra-touch-target\)/);
  assert.match(css, /\.inkra-selection-control__input[\s\S]*height:\s*100%/);
  assert.match(css, /\.inkra-selection-control__input[\s\S]*width:\s*100%/);
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*opacity:\s*1/);
  assert.match(css, /\.inkra-switch:dir\(rtl\)\[data-checked="true"\][\s\S]*-20px/);
  assert.match(css, /\.inkra-pencil-surface\.inkra-switch__track[\s\S]*height:\s*32px/);
  assert.match(css, /\.inkra-pencil-surface\.inkra-switch__track[\s\S]*padding-inline:\s*4px/);
  assert.match(css, /\.inkra-pencil-surface\.inkra-switch__track[\s\S]*width:\s*52px/);
  assert.match(css, /\.inkra-radio-group__items\[data-orientation="horizontal"\][\s\S]*flex-wrap:\s*nowrap/);
  assert.match(css, /\.inkra-radio-group__items\[data-orientation="horizontal"\][\s\S]*overflow-x:\s*auto/);
  assert.match(css, /\.inkra-radio-group\[data-variant="segmented"\][\s\S]*flex:\s*0 0 auto/);
  assert.match(css, /\.inkra-radio-segment__surface[\s\S]*transition:\s*none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.inkra-radio-segment__surface[\s\S]*transition:\s*none/);
  assert.match(sources, /size=\{24\}/);
  assert.match(sources, /sourceSize=\{40\}/);
  assert.match(sources, /RadioGroupVariant/);
  assert.match(sources, /RadioGroupOrientation/);
  assert.doesNotMatch(css, /border:\s*1px\s+solid/);
  assert.match(sources, /PencilSurface/);
  assert.match(sources, /PencilIcon/);
  assert.match(sources, /initialDefaultValueRef/);
  assert.doesNotMatch(sources, /<svg|✓|☑/);
});
