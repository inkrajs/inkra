import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import * as Inkra from '@inkra/react';

console.error = (...args) => { throw new Error(args.join(' ')); };
console.warn = console.error;

for (const name of ['Button', 'ButtonLink', 'ButtonGroup', 'PencilIcon', 'Input', 'InputNumber', 'Slider', 'Select', 'Tabs', 'Calendar', 'DayAgenda', 'JourneyMap', 'DropdownMenu', 'Card', 'Table']) assert(Inkra[name], `Missing public export ${name}`);
const markup = renderToString(h('main', null,
  h(Inkra.Button, null, 'Save'),
  h(Inkra.Field, { label: 'Name' }, h(Inkra.Input, { defaultValue: 'Inkra', clearable: true })),
  h(Inkra.Select.Root, { defaultValue: 'en' }, h(Inkra.Select.Trigger, { iconOnly: true, 'aria-label': 'Language' }, h(Inkra.Select.Value, null, 'English'))),
  h(Inkra.Tabs.Root, { defaultValue: 'one' }, h(Inkra.Tabs.List, { 'aria-label': 'Views' }, h(Inkra.Tabs.Trigger, { value: 'one' }, 'One')), h(Inkra.Tabs.Content, { value: 'one' }, 'Content')),
));
assert.match(markup, /Save/);
assert.match(markup, /Language/);
assert.match(markup, /value="Inkra"/);
assert.match(markup, /role="tabpanel"/);
const cssUrl = import.meta.resolve('@inkra/react/styles.css');
const css = readFileSync(new URL(cssUrl), 'utf8');
assert.match(css, /inkra-select__trigger/);
assert.match(css, /@font-face/);
for (const match of css.matchAll(/url\(['"]?([^'"\s)]+)['"]?\)/g)) {
  if (/^(data:|https?:|#)/.test(match[1])) continue;
  assert(existsSync(new URL(match[1], cssUrl)), `Missing stylesheet asset ${match[1]}`);
}
assert(existsSync(new URL(import.meta.resolve('@inkra/react/tokens.css'))));
console.log('Public exports, SSR markup and stylesheet assets verified from installed package.');
