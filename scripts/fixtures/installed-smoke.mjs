import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import * as Inkra from '@inkra/react';

console.error = (...args) => { throw new Error(args.join(' ')); };
console.warn = console.error;

for (const name of ['Button', 'ButtonLink', 'ButtonGroup', 'PencilIcon', 'Input', 'InputNumber', 'Slider', 'Select', 'Tabs', 'Calendar', 'DayAgenda', 'JourneyMap', 'DropdownMenu', 'Card', 'Table', 'Toast', 'AlertDialog', 'Drawer', 'DatePicker', 'TimePicker', 'Pagination', 'Empty', 'ToggleGroup', 'Command', 'Upload', 'DataTable', 'Tree', 'Steps', 'Timeline']) assert(Inkra[name], `Missing public export ${name}`);
const markup = renderToString(h('main', null,
  h(Inkra.Button, null, 'Save'),
  h(Inkra.Field, { label: 'Name' }, h(Inkra.Input, { defaultValue: 'Inkra', clearable: true })),
  h(Inkra.Select.Root, { defaultValue: 'en' }, h(Inkra.Select.Trigger, { iconOnly: true, 'aria-label': 'Language' }, h(Inkra.Select.Value, null, 'English'))),
  h(Inkra.Tabs.Root, { defaultValue: 'one' }, h(Inkra.Tabs.List, { 'aria-label': 'Views' }, h(Inkra.Tabs.Trigger, { value: 'one' }, 'One')), h(Inkra.Tabs.Content, { value: 'one' }, 'Content')),
  h(Inkra.Toast.Provider, null, h('span', null, 'Notifications')),
  h(Inkra.AlertDialog.Root, null, h(Inkra.AlertDialog.Trigger, null, 'Confirm')),
  h(Inkra.Drawer.Root, null, h(Inkra.Drawer.Trigger, null, 'Details')),
  h(Inkra.DatePicker, { name: 'date', defaultValue: new Date(2026, 9, 22), locale: 'en-US' }),
  h(Inkra.TimePicker, { name: 'time', defaultValue: '09:30' }),
  h(Inkra.Pagination, { totalPages: 5, defaultPage: 2 }),
  h(Inkra.Empty.Root, null, h(Inkra.Empty.Title, null, 'No notes')),
  h(Inkra.ToggleGroup.Root, { defaultValue: ['bold'], 'aria-label': 'Formatting' }, h(Inkra.ToggleGroup.Item, { value: 'bold' }, 'Bold')),
  h(Inkra.Command.Root, null, h(Inkra.Command.Input, { 'aria-label': 'Commands' }), h(Inkra.Command.List, null, h(Inkra.Command.Item, { value: 'save' }, 'Save note'))),
  h(Inkra.Upload, { accept: 'image/*' }),
  h(Inkra.DataTable, { data: [{ id: 'one', title: 'One' }], columns: [{ accessorKey: 'title', header: 'Title' }], getRowId: row => row.id }),
  h(Inkra.Tree.Root, { 'aria-label': 'Notes' }, h(Inkra.Tree.Item, { id: 'one', textValue: 'One' }, h(Inkra.Tree.ItemContent, null, h(Inkra.Tree.ItemTitle, null, 'One')))),
  h(Inkra.Steps, { current: 0, items: [{ id: 'draft', title: 'Draft' }] }),
  h(Inkra.Timeline, { items: [{ id: 'created', title: 'Created', date: 'October 22', dateTime: '2026-10-22' }] }),
));
assert.match(markup, /Save/);
assert.match(markup, /Language/);
assert.match(markup, /value="Inkra"/);
assert.match(markup, /role="tabpanel"/);
assert.match(markup, /name="date"/);
assert.match(markup, /type="time"/);
assert.match(markup, /aria-current="step"/);
assert.match(markup, /datetime="2026-10-22"/i);
const cssUrl = import.meta.resolve('@inkra/react/styles.css');
const css = readFileSync(new URL(cssUrl), 'utf8');
assert.match(css, /inkra-select__trigger/);
assert.match(css, /@font-face/);
for (const component of ['toast', 'alert-dialog', 'drawer', 'date-picker', 'time-picker', 'pagination', 'empty', 'toggle-group', 'command', 'upload', 'data-table', 'tree', 'steps', 'timeline']) {
  assert.ok(css.includes(`.inkra-${component}`), `Missing component CSS: ${component}`);
}
for (const match of css.matchAll(/url\(['"]?([^'"\s)]+)['"]?\)/g)) {
  if (/^(data:|https?:|#)/.test(match[1])) continue;
  assert(existsSync(new URL(match[1], cssUrl)), `Missing stylesheet asset ${match[1]}`);
}
assert(existsSync(new URL(import.meta.resolve('@inkra/react/tokens.css'))));
console.log('Public exports, SSR markup and stylesheet assets verified from installed package.');
