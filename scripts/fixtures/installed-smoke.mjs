import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import * as Inkra from '@inkra/react';
import { Button as SubpathButton } from '@inkra/react/Button';
import { SelectStepper as SubpathStepper } from '@inkra/react/select/stepper';
import { TagInput as SubpathTagInput } from '@inkra/react/tag-input';
import { InventoryGrid as SubpathInventoryGrid } from '@inkra/react/inventory-grid';
import { Grid as SubpathGrid } from '@inkra/react/layout';
import { Guide } from '@inkra/react/guide';
import { Loading } from '@inkra/react/loading';
import { InfiniteScroll } from '@inkra/react/infinite-scroll';
import { Masonry } from '@inkra/react/masonry';
assert.equal(Guide, Inkra.Guide);
assert.equal(Loading, Inkra.Loading);
assert.equal(InfiniteScroll, Inkra.InfiniteScroll);
assert.equal(Masonry, Inkra.Masonry);
for (const family of ['guide', 'loading', 'infinite-scroll', 'masonry']) {
  assert(existsSync(new URL(import.meta.resolve(`@inkra/react/styles/${family}.css`))));
}
assert.equal(SubpathButton, Inkra.Button);
assert.equal(SubpathStepper, Inkra.Select.Stepper);
assert.equal(SubpathTagInput, Inkra.TagInput);
assert.equal(SubpathInventoryGrid, Inkra.InventoryGrid);
assert.equal(SubpathGrid.Board, Inkra.GridBoard);
assert.equal(SubpathGrid.Resizable, Inkra.GridResizable);
for (const path of ['@inkra/react/styles/base.css', '@inkra/react/styles/select.css', '@inkra/react/styles/leaflet.css']) {
  assert(existsSync(new URL(import.meta.resolve(path))), `Missing optional style entry: ${path}`);
}

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
const asyncMarkup = renderToString(h('section', null,
  h(Guide.Root, { showSkip: true }, h(Guide.Trigger, null, 'Start guide'), h(Guide.Step, { target: '#welcome', title: 'Welcome' }, 'First step')),
  h(Loading, { mode: 'region', preset: 'intel', progress: null, tips: ['One', 'Two'] }),
  h(InfiniteScroll, { onLoad: async () => {}, automatic: false, gesture: true },
    h(Masonry, { items: [{ id: 'one', text: 'First item' }], getItemKey: item => item.id, renderItem: ({ item }) => item.text })),
  h(Inkra.NumberTicker, { value: 1200, animation: 'roll' }),
));
assert.match(asyncMarkup, /Start guide/);
assert.match(asyncMarkup, /First item/);
assert.match(asyncMarkup, /inkra-number-ticker__reels/);
assert.match(asyncMarkup, /aria-live="polite">1,200/);
assert.doesNotMatch(asyncMarkup, /automatic=|gesture=/);
const gridMarkup = renderToString(h(Inkra.InventoryGrid, {
  containers: [{ id: 'bag', label: 'Backpack', columns: 3, rows: 3, items: [{ id: 'tool', label: 'Tool', position: { x: 0, y: 0 }, cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] }] }],
  onChange() {},
}));
assert.match(gridMarkup, /Backpack/);
assert.match(gridMarkup, /data-inventory-item="tool"/);
assert.match(gridMarkup, /aria-label="Tool"/);
assert(existsSync(new URL(import.meta.resolve('@inkra/react/styles/inventory-grid.css'))));
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
