import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h, memo, StrictMode } from 'react';
import { act, create } from 'react-test-renderer';
import { PortalThemeProvider, usePortalThemeProps, usePortalTriggerRef } from '../dist/overlay/themeBridge.js';

function environment() {
  const keys = ['window', 'MutationObserver', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = Object.fromEntries(keys.map(key => [key, globalThis[key]]));
  const observers = new Set();
  const media = new Set();
  const properties = { '--inkra-ink': 'black', '--inkra-paper': 'white' };
  const attributes = { 'data-theme': 'light', 'data-inkra-theme': 'paper' };
  const state = { direction: 'ltr', fontFamily: 'serif', colorScheme: 'light', forced: false, lang: 'en' };
  const node = { parentElement: null, get lang() { return state.lang; }, closest: () => node, getAttribute: key => attributes[key] ?? null };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = {
    getComputedStyle: () => ({ ...state, length: Object.keys(properties).length, item: index => Object.keys(properties)[index], getPropertyValue: key => properties[key] }),
    matchMedia: query => ({ matches: query.includes('forced-colors') && state.forced, addEventListener: (_, callback) => media.add({ query, callback }), removeEventListener: (_, callback) => { for (const entry of media) if (entry.query === query && entry.callback === callback) media.delete(entry); } }),
  };
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; observers.add(this); }
    observe() {}
    disconnect() { observers.delete(this); }
  };
  return { node, properties, attributes, state, observers, media, refresh: () => { for (const observer of observers) observer.callback(); }, restore() { for (const key of keys) { if (previous[key] === undefined) delete globalThis[key]; else globalThis[key] = previous[key]; } } };
}

test('portal theme ignores equivalent ancestor mutations but propagates every effective theme field', async () => {
  const env = environment();
  let renderer;
  let renders = 0;
  let snapshot;
  const Trigger = memo(() => h('button', { ref: usePortalTriggerRef(null) }));
  const Consumer = memo(() => { renders++; snapshot = usePortalThemeProps({}); return null; });
  try {
    await act(() => { renderer = create(h(PortalThemeProvider, null, h(Trigger), h(Consumer)), { createNodeMock: () => env.node }); });
    const before = renders;
    for (let index = 0; index < 100; index++) await act(env.refresh);
    assert.equal(renders, before, 'unrelated ancestor mutations must not update portal consumers');
    const ink = env.properties['--inkra-ink'];
    delete env.properties['--inkra-ink']; env.properties['--inkra-ink'] = ink;
    await act(env.refresh);
    assert.equal(renders, before, 'computed property enumeration order is not a visual change');
    for (const change of [
      () => { env.properties['--inkra-ink'] = 'red'; },
      () => { delete env.properties['--inkra-paper']; },
      () => { env.attributes['data-theme'] = 'dark'; },
      () => { env.attributes['data-inkra-theme'] = 'ink'; },
      () => { env.state.direction = 'rtl'; },
      () => { env.state.lang = 'zh'; },
      () => { env.state.fontFamily = 'sans-serif'; },
      () => { env.state.colorScheme = 'dark'; },
      () => { env.state.forced = true; },
    ]) {
      const count = renders; change(); await act(env.refresh); assert.equal(renders, count + 1);
    }
    assert.equal(snapshot.dir, 'rtl'); assert.equal(snapshot.lang, 'zh');
    assert.equal(snapshot.style['--inkra-ink'], undefined);
    assert.equal(snapshot.style.fontFamily, 'sans-serif');
  } finally {
    if (renderer) await act(() => renderer.unmount());
    assert.equal(env.observers.size, 0); assert.equal(env.media.size, 0); env.restore();
  }
});

test('StrictMode batches of portal roots release observers and media listeners on unmount', async () => {
  const env = environment();
  const Trigger = () => h('button', { ref: usePortalTriggerRef(null) });
  try {
    for (let round = 0; round < 3; round++) {
      let renderer;
      await act(() => { renderer = create(h(StrictMode, null, Array.from({ length: 100 }, (_, key) => h(PortalThemeProvider, { key }, h(Trigger)))), { createNodeMock: () => env.node }); });
      assert.equal(env.observers.size, 100);
      assert.equal(env.media.size, 200);
      await act(() => renderer.unmount());
      assert.equal(env.observers.size, 0);
      assert.equal(env.media.size, 0);
    }
  } finally { env.restore(); }
});
