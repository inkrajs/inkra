import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const dist = new URL(process.env.INKRA_COLLECTION_DIST ?? '../dist/', import.meta.url);
const { TreeSelect } = await import(new URL('tree-select/index.js', dist));
const { Select } = await import(new URL('select/Select.js', dist));

test('TreeSelect closed popup constructs a 12,000-deep tree without wrapper recursion', () => {
  let node = { id: '11999', label: 'Leaf' };
  for (let index = 11998; index >= 0; index--) node = { id: String(index), label: `Node ${index}`, children: [node] };
  let labels = 0;
  const html = renderToStaticMarkup(h(TreeSelect, { items: [node], renderLabel: item => { labels++; return item.label; } }));
  assert.equal(labels, 12000);
  assert.ok(html.includes('inkra-tree-select'));
});

test('Select single closed controls retain SSR semantics across repeated values', () => {
  // Radix's single-select effects require real DOM globals. Its server boundary
  // remains testable without pretending synthetic refs provide browser behavior.
  for (let index = 0; index < 10; index++) {
    const html = renderToStaticMarkup(h(Select.Root, { value: String(index), open: false }, h(Select.Trigger, { 'aria-label': 'Selection' }, h(Select.Value, null, `Selected ${index}`))));
    assert.match(html, /role="combobox"/);
    assert.match(html, /aria-expanded="false"/);
    assert.ok(html.includes(`Selected ${index}`));
  }
});
