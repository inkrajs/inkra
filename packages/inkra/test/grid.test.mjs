import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { Grid, GridBoard, GridResizable } from '../dist/layout/index.js';

test('Grid keeps its simple API and exposes opt-in track and board compositions', () => {
  assert.equal(Grid.Board, GridBoard);
  assert.equal(Grid.Resizable, GridResizable);
  assert.match(render(h(Grid, { columns: 3 }, 'Simple')), /inkra-grid/);
});

test('Resizable grid has unique panel ids, semantic separators and all cells in server output', () => {
  const html = render(h(Grid.Resizable, {
    columns: [{ id: 'a' }, { id: 'b' }], rows: [{ id: 'one' }, { id: 'two' }],
    getHandleLabel: (axis, before, after) => `${axis}: ${before}/${after}`,
  }, ({ row, column }) => `${row}-${column}`));
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.equal((html.match(/role="separator"/g) ?? []).length, 3);
  for (const text of ['one-a', 'one-b', 'two-a', 'two-b']) assert.ok(html.includes(text));
});

test('Board renders readable cards and named move/resize actions on the server', () => {
  const html = render(h(Grid.Board, {
    defaultLayout: [{ i: 'a', x: 0, y: 0, w: 4, h: 3 }, { i: 'b', x: 4, y: 0, w: 4, h: 3, static: true }],
    getItemLabel: id => `Card ${id}`,
  }, item => h('input', { 'aria-label': `Input ${item.i}`, defaultValue: 'Editable' })));
  assert.match(html, /Card a/);
  assert.match(html, /Input b/);
  assert.equal((html.match(/class="inkra-grid-board__move"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /onLayoutChange=/);
});

test('Board rejects invalid ids and unsafe grid coordinates before invoking the layout engine', () => {
  const item = { i: 'card', x: 0, y: 0, w: 4, h: 3 };
  const board = layout => render(h(Grid.Board, { layout }, () => 'Content'));
  for (const id of ['', '  ', undefined, 3]) assert.throws(() => board([{ ...item, i: id }]), /unique, non-empty string ids/);
  assert.throws(() => board([item, { ...item }]), /unique, non-empty string ids/);
  assert.throws(() => board([null]), /unique, non-empty string ids/);
  for (const key of ['x', 'y', 'w', 'h']) {
    for (const value of [NaN, Infinity, -Infinity, 1.5, -1]) assert.throws(() => board([{ ...item, [key]: value }]), /finite integer/);
  }
  for (const key of ['w', 'h']) assert.throws(() => board([{ ...item, [key]: 0 }]), /finite integer/);
  for (const key of ['minW', 'maxW', 'minH', 'maxH']) assert.throws(() => board([{ ...item, [key]: NaN }]), /positive integer/);
  assert.throws(() => board([{ ...item, minW: 5, maxW: 3 }]), /minimum size/);
  assert.doesNotThrow(() => board([{ ...item, maxW: Infinity, maxH: Infinity }]));
});

test('Disabled Board resize handles are native disabled controls with accessible names', () => {
  const html = render(h(Grid.Board, { disabled: true, defaultLayout: [{ i: 'card', x: 0, y: 0, w: 4, h: 3 }],
    getActionLabel: (action, id) => `${action} ${id}` }, () => 'Content'));
  assert.match(html, /disabled=""[^>]+aria-label="resize card"/);
  assert.doesNotMatch(html, /class="inkra-grid-board__move"/);
});
