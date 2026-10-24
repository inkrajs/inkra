import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement as h } from 'react';
import { act, create } from 'react-test-renderer';

import { Button } from '../dist/Button.js';
import { Input } from '../dist/form/Input.js';
import { Checkbox } from '../dist/selection/Checkbox.js';
import { Transfer } from '../dist/transfer/index.js';
import { TreeSelect } from '../dist/tree-select/index.js';

let previousActEnvironment;
before(() => {
  previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});
after(() => {
  if (previousActEnvironment === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  else globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

const items = [
  { id: 'alpha', label: 'Alpha' },
  { id: 'beta', label: 'Beta' },
  { id: 'gamma', label: 'Gamma' },
];
const checkbox = (renderer, label) => renderer.root.findAllByType(Checkbox).find(node => node.props.label === label);

test('Transfer does not rerun search filters for selection or unrelated rerenders', async () => {
  const calls = { source: 0, target: 0 };
  const filterItem = (_item, _query, side) => { calls[side]++; return true; };
  const props = { items, targetKeys: ['beta'], filterItem };
  let renderer;
  try {
    await act(() => { renderer = create(h(Transfer, props)); });
    assert.deepEqual(calls, { source: 0, target: 0 });
    await act(() => renderer.root.findAllByType(Input)[0].props.onValueChange('a'));
    assert.deepEqual(calls, { source: 2, target: 0 });
    await act(() => checkbox(renderer, 'Select all visible available items').props.onCheckedChange(true));
    await act(() => renderer.update(h(Transfer, { ...props, className: 'updated' })));
    assert.deepEqual(calls, { source: 2, target: 0 });
    await act(() => renderer.root.findAllByType(Input)[1].props.onValueChange('b'));
    assert.deepEqual(calls, { source: 2, target: 1 });
    await act(() => renderer.update(h(Transfer, { ...props, items: [...items] })));
    assert.deepEqual(calls, { source: 4, target: 2 }, 'new data invalidates both active filters');
  } finally {
    if (renderer) await act(() => renderer.unmount());
  }
});

test('Transfer clears selection across controlled key changes that collide when joined', async () => {
  const records = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'a\u0000b', label: 'Combined' }];
  const separate = ['a', 'b'];
  const combined = ['a\u0000b'];
  assert.equal(separate.join('\u0000'), combined.join('\u0000'));
  let renderer;
  try {
    await act(() => { renderer = create(h(Transfer, { items: records, targetKeys: separate })); });
    await act(() => checkbox(renderer, 'Select all visible selected items').props.onCheckedChange(true));
    assert.equal(checkbox(renderer, 'Select all visible selected items').props.checked, true);
    await act(() => renderer.update(h(Transfer, { items: records, targetKeys: combined })));
    await act(() => renderer.update(h(Transfer, { items: records, targetKeys: separate })));
    assert.equal(checkbox(renderer, 'Select all visible selected items').props.checked, false);
  } finally {
    if (renderer) await act(() => renderer.unmount());
  }
});

test('Transfer batch changes retain ordered item identities and disabled guards', async () => {
  const disabled = { id: 'locked', label: 'Locked', disabled: true };
  let change;
  let renderer;
  try {
    await act(() => { renderer = create(h(Transfer, {
      items: [...items, disabled],
      defaultTargetKeys: ['beta'],
      onTargetKeysChange: (keys, details) => { change = { keys, details }; },
    })); });
    await act(() => checkbox(renderer, 'Select all visible available items').props.onCheckedChange(true));
    const action = renderer.root.findAllByType(Button).find(node => node.props['aria-label'] === 'Move selected visible items to selected');
    const ownerDocument = {};
    const origin = { ownerDocument, isConnected: true, matches: () => false };
    ownerDocument.activeElement = origin;
    await act(() => action.props.onClick({ currentTarget: origin }));
    assert.deepEqual(change.keys, ['alpha', 'beta', 'gamma']);
    assert.deepEqual(change.details.movedKeys, ['alpha', 'gamma']);
    assert.equal(change.details.movedItems[0], items[0]);
    assert.equal(change.details.movedItems[1], items[2]);
    assert.equal(change.details.direction, 'to-target');
    assert.equal(change.details.action, 'batch');
  } finally {
    if (renderer) await act(() => renderer.unmount());
  }
});

test('TreeSelect retains controlled selection identity until its value changes', async () => {
  const value = ['alpha'];
  const observed = [];
  const renderValue = (nodes, ids) => { observed.push({ nodes, ids }); return nodes.map(node => node.label).join(', '); };
  const props = { items, value, multiple: true, renderValue };
  let renderer;
  try {
    await act(() => { renderer = create(h(TreeSelect, props)); });
    const initial = observed.at(-1);
    await act(() => renderer.update(h(TreeSelect, { ...props, className: 'updated' })));
    assert.equal(observed.at(-1).ids, initial.ids);
    assert.deepEqual(observed.at(-1).nodes.map(node => node.id), ['alpha']);
    await act(() => renderer.update(h(TreeSelect, { ...props, value: ['beta'] })));
    assert.notEqual(observed.at(-1).ids, initial.ids);
    assert.deepEqual(observed.at(-1).ids, ['beta']);
    assert.deepEqual(observed.at(-1).nodes.map(node => node.id), ['beta']);
  } finally {
    if (renderer) await act(() => renderer.unmount());
  }
});
