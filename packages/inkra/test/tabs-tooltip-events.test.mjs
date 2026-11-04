import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { act, create } from 'react-test-renderer';
import { Tabs } from '../dist/tabs/index.js';

const icon = h('span', { 'data-synthetic-icon': true }, 'I');

async function withEventModel(run) {
  // Invoke actual rendered Radix/Slot handler props without creating a DOM.
  // This model cannot verify browser focus movement, layout or native bubbling.
  const keys = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'];
  const before = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  globalThis.window = { setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {} };
  globalThis.document = new EventTarget();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try { await run(); } finally {
    for (const key of keys) { const descriptor = before.get(key); if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
}
const eventFor = key => {
  const target = {};
  return { key, target, currentTarget: target, defaultPrevented: false, shiftKey: false, ctrlKey: false,
    preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} };
};

test('native Enter and Space handlers, disabled behavior and controlled rejection retain tab-owned state', async () => withEventModel(async () => {
  const requested = [], keys = []; let view;
  const tree = (value = 'one') => h(Tabs.Root, { value, onValueChange: value => requested.push(value) },
    h(Tabs.List, null, h(Tabs.Trigger, { value: 'one' }, 'One'),
      h(Tabs.Trigger, { value: 'two', onKeyDown: event => keys.push(event.key) }, 'Two'),
      h(Tabs.Trigger, { value: 'disabled', disabled: true }, 'Disabled')));
  try {
    act(() => { view = create(tree()); });
    const button = value => view.root.findAllByType('button').find(node => node.props['data-tabs-value'] === value);
    for (const key of ['Enter', ' ']) await act(async () => { button('two').props.onKeyDown(eventFor(key)); await Promise.resolve(); });
    assert.deepEqual(requested, ['two', 'two']); assert.deepEqual(keys, ['Enter', ' ']);
    assert.equal(button('one').props['aria-selected'], true); assert.equal(button('one').props['data-state'], 'active');
    assert.equal(button('two').props['data-state'], 'inactive', 'rejected controlled requests never commit a fake selection');
    const arrow = eventFor('ArrowRight');
    await act(async () => { button('two').props.onKeyDown(arrow); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(arrow.defaultPrevented, true, 'Radix still handles the horizontal roving-focus key');
    assert.deepEqual(requested, ['two', 'two'], 'the model has no DOM focus target to activate');
    await act(async () => { button('disabled').props.onKeyDown(eventFor('Enter')); await Promise.resolve(); });
    assert.deepEqual(requested, ['two', 'two']);
    act(() => view.update(tree('two')));
    assert.equal(button('two').props['aria-selected'], true); assert.equal(button('two').props['data-state'], 'active');
  } finally { if (view) act(() => view.unmount()); }
}));

test('uncontrolled keyboard activation commits both native and visual tab state', async () => withEventModel(async () => {
  let view;
  try {
    act(() => { view = create(h(Tabs.Root, { defaultValue: 'one' }, h(Tabs.List, null,
      h(Tabs.Trigger, { value: 'one' }, 'One'), h(Tabs.Trigger, { value: 'two' }, 'Two')))); });
    const button = value => view.root.findAllByType('button').find(node => node.props['data-tabs-value'] === value);
    for (const [value, key] of [['two', 'Enter'], ['one', ' ']]) {
      await act(async () => { button(value).props.onKeyDown(eventFor(key)); await Promise.resolve(); });
      assert.equal(button(value).props['aria-selected'], true); assert.equal(button(value).props['data-state'], 'active');
    }
  } finally { if (view) act(() => view.unmount()); }
}));

test('focus opens the collapsed-label tooltip and expanding labels clears eligibility without replacing the tab', async () => withEventModel(async () => {
  let view;
  const tree = mode => h(Tabs.Root, { defaultValue: 'one' }, h(Tabs.List, { labelVisibility: mode },
    h(Tabs.Trigger, { value: 'one', startIcon: icon }, 'One')));
  try {
    act(() => { view = create(tree('hidden')); });
    const button = () => view.root.findAllByType('button').find(node => node.props['data-tabs-value'] === 'one');
    const first = button();
    await act(async () => { first.props.onFocus(eventFor('Focus')); await Promise.resolve(); });
    assert.ok(button().props['aria-describedby']); assert.equal(button().props['data-state'], 'active');
    await act(async () => { button().props.onBlur(eventFor('Blur')); await Promise.resolve(); });
    assert.equal(button().props['aria-describedby'], undefined);
    await act(async () => { button().props.onFocus(eventFor('Focus')); await Promise.resolve(); });
    assert.ok(button().props['aria-describedby']);
    act(() => view.update(tree('always')));
    assert.equal(button(), first); assert.equal(button().props['aria-describedby'], undefined);
    act(() => view.update(tree('hidden')));
    assert.equal(button(), first); assert.equal(button().props['aria-describedby'], undefined, 'a stale open flag must not reopen without a new focus/hover request');
  } finally { if (view) act(() => view.unmount()); }
}));
