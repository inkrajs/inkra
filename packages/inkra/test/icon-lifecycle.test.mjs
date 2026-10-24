import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, StrictMode } from 'react';
import { act, create } from 'react-test-renderer';
import { PencilIcon } from '../dist/PencilIcon.js';

function installEnvironment() {
  const previous = Object.fromEntries(['document', 'window', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, globalThis[key]]));
  const stats = { created: 0, active: 0, media: 0, document: 0, window: 0, canvas: 0 };
  const context = () => new Proxy({ globalAlpha: 1, isContextLost: () => false }, {
    get(target, key) { return key in target ? target[key] : () => {}; },
  });
  const canvas = () => {
    const ctx = context();
    return { width: 0, height: 0, dataset: {}, parentElement: null, getContext: () => ctx,
      addEventListener() { stats.canvas++; }, removeEventListener() { stats.canvas--; } };
  };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.document = {
    visibilityState: 'visible',
    createElement: canvas,
    createElementNS: () => ({ setAttribute() {}, getTotalLength: () => 1, getPointAtLength: at => ({ x: at, y: 0 }) }),
    addEventListener() { stats.document++; }, removeEventListener() { stats.document--; },
  };
  globalThis.window = {
    devicePixelRatio: 1,
    matchMedia: () => ({ addEventListener() { stats.media++; }, removeEventListener() { stats.media--; } }),
    addEventListener() { stats.window++; }, removeEventListener() { stats.window--; },
  };
  globalThis.MutationObserver = class {
    constructor() { stats.created++; stats.active++; }
    observe() {}
    disconnect() { stats.active--; }
  };
  globalThis.getComputedStyle = () => ({ color: 'black', direction: 'ltr', getPropertyValue: () => '' });
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  return { stats, canvas, restore() { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } } };
}

test('same-value icon props do not recreate observers, and mutated values still repaint', async () => {
  const env = installEnvironment();
  let renderer;
  try {
    const paths = [];
    await act(() => { renderer = create(createElement(PencilIcon, { paths, badge: { paths: [] } }), { createNodeMock: env.canvas }); });
    const initial = env.stats.created;
    for (let index = 0; index < 20; index++) {
      await act(() => renderer.update(createElement(PencilIcon, { paths: [], badge: { paths: [] } })));
    }
    assert.equal(env.stats.created, initial);
    assert.equal(env.stats.active, 1);
    paths.push({ d: 'M0 0L1 0' });
    await act(() => renderer.update(createElement(PencilIcon, { paths, badge: { paths: [] } })));
    assert.equal(env.stats.created, initial + 1);
    paths[0].d = 'M0 0L2 0';
    await act(() => renderer.update(createElement(PencilIcon, { paths, badge: { paths: [] } })));
    assert.equal(env.stats.created, initial + 2);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    assert.equal(env.stats.active, 0);
    assert.equal(env.stats.media, 0);
    assert.equal(env.stats.document, 0);
    assert.equal(env.stats.window, 0);
    assert.equal(env.stats.canvas, 0);
    env.restore();
  }
});

test('StrictMode batches of icons leave no observer or recovery listeners after repeated unmount', async () => {
  const env = installEnvironment();
  try {
    for (let round = 0; round < 3; round++) {
      let renderer;
      await act(() => { renderer = create(createElement(StrictMode, null, Array.from({ length: 100 }, (_, key) => createElement(PencilIcon, { key, paths: [] }))), { createNodeMock: env.canvas }); });
      assert.equal(env.stats.active, 100);
      await act(() => renderer.unmount());
      assert.equal(env.stats.active, 0);
      assert.equal(env.stats.media, 0);
      assert.equal(env.stats.document, 0);
      assert.equal(env.stats.window, 0);
      assert.equal(env.stats.canvas, 0);
    }
  } finally { env.restore(); }
});
