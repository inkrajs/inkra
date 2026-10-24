import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { act, create } from 'react-test-renderer';
import { ProgressRing } from '../dist/display/ProgressRing.js';

function environment() {
  const keys = ['document', 'window', 'CSS', 'getComputedStyle', 'matchMedia', 'ResizeObserver', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = Object.fromEntries(keys.map(key => [key, globalThis[key]]));
  const listeners = new Map();
  const events = prefix => ({ addEventListener: (type, callback) => { const key = `${prefix}:${type}`; if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key).add(callback); }, removeEventListener: (type, callback) => listeners.get(`${prefix}:${type}`)?.delete(callback) });
  const resize = new Set(); const mutations = new Set(); const frames = new Map(); const images = [];
  let sequence = 0;
  const canvas = () => {
    const eventHandlers = new Map();
    const ctx = new Proxy({ globalAlpha: 1, draws: 0, isContextLost: () => false, drawImage() { this.draws++; } }, { get(target, key) { return key in target ? target[key] : () => {}; } });
    return { width: 300, height: 150, clientWidth: 96, dataset: {}, parentElement: null, ctx, eventHandlers, getContext: () => ctx, addEventListener: (type, callback) => eventHandlers.set(type, callback), removeEventListener: type => eventHandlers.delete(type) };
  };
  const target = canvas();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.CSS = { supports: () => true };
  globalThis.document = { visibilityState: 'visible', createElement: () => { const value = canvas(); images.push(value); return value; }, ...events('document') };
  globalThis.matchMedia = () => ({ matches: false, ...events('media') });
  globalThis.window = { devicePixelRatio: 2, matchMedia: globalThis.matchMedia, ...events('window') };
  globalThis.getComputedStyle = () => ({ color: 'black', getPropertyValue: () => '' });
  globalThis.ResizeObserver = class { constructor(callback) { this.callback = callback; resize.add(callback); } observe() {} disconnect() { resize.delete(this.callback); } };
  globalThis.MutationObserver = class { constructor(callback) { this.callback = callback; mutations.add(callback); } observe() {} disconnect() { mutations.delete(this.callback); } };
  globalThis.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  return { target, images, resize, mutations, listeners, frames, recover() { for (const callback of listeners.get('document:resume') ?? []) callback(); const pending = [...frames]; frames.clear(); for (const [, callback] of pending) callback(); }, restore() { for (const key of keys) { if (previous[key] === undefined) delete globalThis[key]; else globalThis[key] = previous[key]; } } };
}

test('ring updates use clipping, bounded allocation, recovery, and balanced listener cleanup', async () => {
  const env = environment();
  let renderer;
  const props = { diameter: 96, thickness: 6, percent: 20, seed: 'ring-lifecycle-regression' };
  try {
    await act(() => { renderer = create(h(ProgressRing, props), { createNodeMock: () => env.target }); });
    assert.equal(env.target.dataset.ready, 'true');
    assert.equal(env.images.length, 1);
    assert.equal(env.target.ctx.draws, 1);
    for (let percent = 21; percent < 41; percent++) await act(() => renderer.update(h(ProgressRing, { ...props, percent })));
    assert.equal(env.images.length, 1);
    assert.equal(env.target.ctx.draws, 1, 'percent changes must not repaint the stable ring');
    env.recover();
    assert.equal(env.target.ctx.draws, 2, 'restoration must copy the pixels again even when appearance is unchanged');
    env.images[0].eventHandlers.get('contextlost')();
    env.recover();
    assert.equal(env.images.length, 2, 'a restored detached cache canvas cannot be reused with lost pixels');
    env.target.clientWidth = 100000;
    for (const callback of env.resize) callback();
    assert.equal(env.images.length, 2, 'over-budget dimensions must not allocate a temporary image');
    assert.equal(env.target.width, 0); assert.equal(env.target.height, 0);
    assert.equal(env.target.dataset.ready, undefined);
    env.target.clientWidth = 96;
    for (const callback of env.resize) callback();
    assert.equal(env.target.dataset.ready, 'true');
  } finally {
    if (renderer) await act(() => renderer.unmount());
    assert.equal(env.resize.size, 0); assert.equal(env.mutations.size, 0); assert.equal(env.frames.size, 0);
    for (const callbacks of env.listeners.values()) assert.equal(callbacks.size, 0);
    assert.equal(env.target.eventHandlers.size, 0);
    env.restore();
  }
});


test('oversized ring CSS never allocates its backing image', async () => {
  const env = environment();
  env.target.clientWidth = 100000;
  let renderer;
  try {
    await act(() => { renderer = create(h(ProgressRing, { diameter: 96, thickness: 6, percent: 50, seed: 'oversized-ring-regression' }), { createNodeMock: () => env.target }); });
    assert.equal(env.images.length, 0);
    assert.equal(env.target.width, 0);
    assert.equal(env.target.dataset.ready, undefined);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    env.restore();
  }
});
