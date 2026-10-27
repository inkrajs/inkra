import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create } from 'react-test-renderer';
import { Switch } from '../dist/selection/Switch.js';
import { InkraProvider } from '../dist/i18n/index.js';
import { ProgressRing } from '../dist/display/ProgressRing.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('circular Switch retains native form, labels, input type and optional center slots', () => {
  const markup = renderToStaticMarkup(h(Switch, { label: 'Pencil effect', variant: 'circular', diameter: 120, defaultChecked: true, name: 'effect', value: 'enabled', form: 'theme', centerIcon: h('span', { 'data-test-icon': true }), centerContent: checked => checked ? 'Enabled' : 'Disabled' }));
  const input = markup.match(/<input\b[^>]*>/)?.[0] ?? '';
  for (const [key, value] of Object.entries({ type: 'checkbox', role: 'switch', name: 'effect', form: 'theme', value: 'enabled' })) assert.match(input, new RegExp(`\\b${key}="${value}"`));
  assert.match(input, /checked=""/);
  assert.match(input, /aria-labelledby="[^"]+-label"/);
  assert.match(markup, /inkra-switch--circular/);
  assert.match(markup, /inkra-switch__circular-center[^>]*inert=""/);
  assert.match(markup, /data-test-icon="true"/);
  assert.match(markup, />Enabled</);
  const standard = renderToStaticMarkup(h(Switch, { label: 'Standard' }));
  assert.doesNotMatch(standard, /inkra-switch__circular/);
  assert.match(standard, /inkra-switch__track/);
  const iconOnly = renderToStaticMarkup(h(Switch, { label: 'Quiet', variant: 'circular', centerIcon: h('span', { 'data-icon-only': true }), centerContent: null }));
  assert.match(iconOnly, /data-icon-only="true"/);
  assert.doesNotMatch(iconOnly, /inkra-switch__circular-value/);
});

test('circular Switch defaults to localized on/off text', () => {
  for (const [locale, off, on] of [['en', 'Off', 'On'], ['zh-CN', '关', '开'], ['ja', 'オフ', 'オン'], ['ko', '꺼짐', '켜짐'], ['fr', 'Non', 'Oui']]) {
    for (const checked of [false, true]) {
      const html = renderToStaticMarkup(h(InkraProvider, { locale }, h(Switch, { label: 'State', variant: 'circular', checked, onChange() {} })));
      assert(html.includes(`>${checked ? on : off}<`));
    }
  }
});

async function mount(props = {}) {
  let renderer;
  const resetHandlers = new Map();
  const form = { addEventListener: (type, handler) => resetHandlers.set(type, handler), removeEventListener: type => resetHandlers.delete(type) };
  const input = { checked: Boolean(props.checked ?? props.defaultChecked), form };
  const inputNode = () => renderer.root.findByType('input');
  function activate(detail) {
    if (inputNode().props.disabled) return;
    const before = input.checked;
    input.checked = !before;
    const nativeEvent = { defaultPrevented: false };
    const event = { currentTarget: input, detail, nativeEvent, preventDefault() { nativeEvent.defaultPrevented = true; }, stopPropagation() {} };
    inputNode().props.onClick(event);
    // React dispatches the checkbox change plugin for the click even when canceled.
    inputNode().props.onChange(event);
    if (nativeEvent.defaultPrevented) input.checked = before;
    if (inputNode().props.checked !== undefined) input.checked = inputNode().props.checked;
  }
  await act(() => { renderer = create(h(Switch, { label: 'Effect', variant: 'circular', diameter: 120, ...props }), { createNodeMock: node => node.type === 'input' ? input : null }); });
  return { input, renderer, inputNode, resetHandlers,
    click: async detail => { await act(() => activate(detail)); },
    async close() { await act(() => renderer.unmount()); assert.equal(resetHandlers.size, 0); },
  };
}

test('circular Switch retains a subdued track and fills the arc only when enabled', () => {
  for (const checked of [false, true]) {
    const html = renderToStaticMarkup(h(Switch, { label: 'State', variant: 'circular', checked, onChange() {} }));
    assert.doesNotMatch(html, /inkra-switch__circular-thumb|data-dragging/);
    assert.match(html, /inkra-switch__circular-track/);
    assert.match(html, /inkra-switch__circular-range/);
    assert.match(html, /inkra-switch__circular-arc/);
    assert.match(html, /inkra-switch__circular-focus/);
    const rangeMarkup = html.split('class="inkra-switch__circular-range"')[1];
    assert.match(rangeMarkup, new RegExp(`stroke-dashoffset="${checked ? 25 : 100}"`));
  }
});

test('circular Switch native activation changes both callbacks and the arc exactly once', async () => {
  const changes = []; const nativeChanges = [];
  const view = await mount({ onCheckedChange: value => changes.push(value), onChange: event => nativeChanges.push(event.currentTarget.checked) });
  try {
    assert.equal(view.renderer.root.findByProps({ className: 'inkra-switch__circular-range' }).findByType(ProgressRing).props.percent, 0);
    await view.click(1);
    assert.equal(view.input.checked, true);
    assert.deepEqual(changes, [true]);
    assert.deepEqual(nativeChanges, [true]);
    assert.equal(view.renderer.root.findByProps({ className: 'inkra-switch__circular-range' }).findByType(ProgressRing).props.percent, 75);
    await view.click(0);
    assert.equal(view.input.checked, false);
    assert.deepEqual(changes, [true, false]);
    assert.deepEqual(nativeChanges, [true, false]);
    assert.equal(view.renderer.root.findByProps({ className: 'inkra-switch__circular-range' }).findByType(ProgressRing).props.percent, 0);
    assert.equal(view.inputNode().props.onPointerDown, undefined);
    assert.equal(view.inputNode().props.onPointerMove, undefined);
    assert.equal(view.inputNode().props.onPointerUp, undefined);
  } finally { await view.close(); }
});

test('circular Switch controlled rejection keeps the original state and permits a later proposal', async () => {
  const changes = [];
  const view = await mount({ checked: false, onCheckedChange: value => changes.push(value) });
  try {
    await view.click(1);
    assert.equal(view.input.checked, false);
    assert.deepEqual(changes, [true]);
    assert.equal(view.renderer.root.findByProps({ className: 'inkra-switch__circular-range' }).findByType(ProgressRing).props.percent, 0);
    await view.click(0);
    assert.equal(view.input.checked, false);
    assert.deepEqual(changes, [true, true]);
  } finally { await view.close(); }
});

test('circular Switch readonly and disabled controls do not activate', async () => {
  for (const state of ['readOnly', 'disabled']) {
    const changes = [];
    const view = await mount({ [state]: true, defaultChecked: true, onCheckedChange: value => changes.push(value) });
    try {
      await view.click(1); await view.click(0);
      assert.equal(view.input.checked, true);
      assert.deepEqual(changes, []);
      assert.equal(view.inputNode().props[state], true);
    } finally { await view.close(); }
  }
});

test('circular Switch reuses native canceled reset and restores the default without callbacks', async () => {
  const changes = [];
  const view = await mount({ defaultChecked: true, onCheckedChange: value => changes.push(value) });
  try {
    await view.click(1);
    assert.equal(view.input.checked, false);
    const canceled = { defaultPrevented: false };
    await act(async () => { view.resetHandlers.get('reset')(canceled); canceled.defaultPrevented = true; await new Promise(resolve => setTimeout(resolve, 5)); });
    assert.equal(view.input.checked, false);
    await act(async () => { view.resetHandlers.get('reset')({ defaultPrevented: false }); await new Promise(resolve => setTimeout(resolve, 5)); });
    assert.equal(view.input.checked, true);
    assert.equal(view.renderer.root.findByProps({ className: 'inkra-switch__circular-range' }).findByType(ProgressRing).props.percent, 75);
    assert.deepEqual(changes, [false]);
  } finally { await view.close(); }
});


test('circular Switch animates only state changes, reverses continuously and honors reduced motion', async () => {
  const keys = ['window', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const before = Object.fromEntries(keys.map(key => [key, globalThis[key]]));
  const frames = new Map(); const listeners = new Set(); let sequence = 0;
  const media = { matches: false, addEventListener: (_type, listener) => listeners.add(listener), removeEventListener: (_type, listener) => listeners.delete(listener) };
  globalThis.window = { matchMedia: () => media };
  globalThis.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  let view;
  const tick = async time => { await act(() => { const current = [...frames.values()]; frames.clear(); current.forEach(callback => callback(time)); }); };
  try {
    view = await mount({ checked: true, onChange() {} });
    const percent = () => view.renderer.root.findByProps({ className: 'inkra-switch__circular-range' }).findByType(ProgressRing).props.percent;
    const update = async checked => { await act(() => view.renderer.update(h(Switch, { label: 'Effect', variant: 'circular', diameter: 120, checked, onChange() {} }))); };
    assert.equal(percent(), 75);
    assert.equal(frames.size, 0, 'initial checked render does not animate from zero');
    await update(false); await tick(0); await tick(100);
    assert.equal(percent(), 37.5);
    await update(true);
    assert.equal(percent(), 37.5, 'reversal starts at the current visual progress');
    await tick(110); await tick(210);
    assert.equal(percent(), 56.25);
    await tick(310);
    assert.equal(percent(), 75);
    assert.equal(frames.size, 0);
    await update(false); await tick(400); await tick(450);
    assert(percent() > 0 && percent() < 75);
    await act(() => { media.matches = true; listeners.forEach(listener => listener()); });
    assert.equal(percent(), 0);
    assert.equal(frames.size, 0, 'reduced motion cancels a running frame immediately');
    await update(true);
    assert.equal(percent(), 75);
    assert.equal(frames.size, 0, 'reduced-motion transitions are immediate');
    await act(() => { media.matches = false; listeners.forEach(listener => listener()); });
    await update(false);
    assert.equal(frames.size, 1);
  } finally {
    if (view) await view.close();
    assert.equal(frames.size, 0, 'unmount cancels pending frames');
    assert.equal(listeners.size, 0);
    for (const key of keys) { if (before[key] === undefined) delete globalThis[key]; else globalThis[key] = before[key]; }
  }
});
