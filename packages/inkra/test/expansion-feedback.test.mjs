import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';

import {
  Empty,
  Toast,
  ToggleGroup,
  createToastManager,
  useToastManager,
} from '../dist/index.js';

test('Toast exposes provider, hook and external manager without simulating queue behavior', () => {
  assert.equal(Toast.Provider instanceof Function, true);
  assert.equal(Toast.useToastManager, useToastManager);
  assert.equal(Toast.createToastManager, createToastManager);

  const manager = createToastManager();
  for (const method of ['add', 'update', 'close', 'promise']) {
    assert.equal(typeof manager[method], 'function');
  }
  const id = manager.add({ title: 'Saved', description: 'Draft saved', timeout: 0 });
  assert.equal(typeof id, 'string');
  manager.update(id, { description: 'Draft updated' });
  manager.close(id);
});

test('Empty keeps every content region optional and preserves native semantics', () => {
  const html = render(h(Empty.Root, { size: 'lg', align: 'start', 'aria-labelledby': 'empty-title' },
    h(Empty.Icon, null, h('span', null, '?')),
    h(Empty.Title, { as: 'h2', id: 'empty-title' }, 'No notes'),
    h(Empty.Description, null, 'Create the first note.'),
    h(Empty.Actions, null, h('button', { type: 'button' }, 'Create note'))));
  assert.match(html, /class="inkra-empty" data-align="start" data-size="lg"/);
  assert.match(html, /<h2[^>]*id="empty-title"/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /<button type="button">Create note<\/button>/);
  assert.doesNotMatch(html, /role="button"| size=| align=/);

  const minimal = render(h(Empty.Root, null, h(Empty.Title, null, 'Nothing here')));
  assert.match(minimal, /<h3/);
  assert.doesNotMatch(minimal, /inkra-empty__icon|inkra-empty__description|inkra-empty__actions/);
});

test('Empty provides distinct pencil illustrations with accessible SVG fallbacks', () => {
  const geometries = new Set();
  for (const illustration of ['inbox', 'search', 'folder', 'documents', 'messages', 'image', 'offline', 'favorites']) {
    const html = render(h(Empty.Icon, { illustration, size: 144 }));
    assert.match(html, new RegExp(`data-illustration="${illustration}"`));
    assert.match(html, /--inkra-empty-icon-size:144px/);
    assert.equal((html.match(/<canvas/g) ?? []).length, 2);
    assert.equal((html.match(/<svg/g) ?? []).length, 2);
    assert((html.match(/<path/g) ?? []).length >= 6);
    assert.doesNotMatch(html, / illustration=| size=/);
    geometries.add([...html.matchAll(/ d="([^"]+)"/g)].map(match => match[1]).join('|'));
  }
  assert.equal(geometries.size, 8);
  const named = render(h(Empty.Icon, { decorative: false, 'aria-label': 'No results' }));
  assert.match(named, /<div[^>]*aria-label="No results"[^>]*role="img"/);
  assert.doesNotMatch(named, /<div[^>]*aria-hidden/);
  assert.match(named, /data-illustration="inbox"/);
  for (const size of [0, -1, NaN, Infinity]) {
    assert.doesNotMatch(render(h(Empty.Icon, { size })), /--inkra-empty-icon-size/);
  }
  assert.doesNotMatch(render(h(Empty.Icon, { children: null })), /<canvas|<svg|data-illustration/);
  assert.doesNotMatch(render(h(Empty.Icon, null, h('span', null, 'Custom'))), /<canvas|<svg|data-illustration/);
});

test('ToggleGroup uses pressed buttons, array values and real group semantics', () => {
  const html = render(h(ToggleGroup.Root, {
    'aria-label': 'Formatting',
    defaultValue: ['bold'],
    multiple: true,
    orientation: 'horizontal',
    size: 'sm',
  },
  h(ToggleGroup.Item, { value: 'bold' }, 'Bold'),
  h(ToggleGroup.Item, { value: 'italic', disabled: true }, 'Italic')));

  assert.match(html, /role="group"/);
  assert.match(html, /aria-label="Formatting"/);
  assert.match(html, /data-orientation="horizontal"/);
  assert.match(html, /data-size="sm"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /inkra-toggle-group__selection/);
  assert.doesNotMatch(html, /role="tab"|aria-selected| multiple=| orientation=| size=/);
});

test('ToggleGroup supports single selection, vertical orientation and native RTL', () => {
  const html = render(h(ToggleGroup.Root, {
    'aria-label': 'Alignment',
    defaultValue: ['start'],
    dir: 'rtl',
    orientation: 'vertical',
  },
  h(ToggleGroup.Item, { value: 'start', startIcon: h('i', null, 'S') }, 'Start'),
  h(ToggleGroup.Item, { value: 'end', endIcon: h('i', null, 'E') }, 'End')));
  assert.match(html, /dir="rtl"/);
  assert.match(html, /data-orientation="vertical"/);
  const iconSlots = html.match(/<span(?=[^>]*class="inkra-toggle-group__icon")(?=[^>]*aria-hidden="true")[^>]*>/g) ?? [];
  assert.equal(iconSlots.length, 2);
  assert.doesNotMatch(html, / startIcon=| endIcon=/);
});
