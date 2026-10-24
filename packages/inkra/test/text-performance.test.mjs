import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { act, create } from 'react-test-renderer';
import { PencilText } from '../dist/PencilText.js';

test('unsupported text falls back once per appearance instead of retrying every ancestor mutation', async () => {
  const keys = ['document', 'window', 'getComputedStyle', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = Object.fromEntries(keys.map(key => [key, globalThis[key]]));
  let reads = 0;
  let color = 'black';
  let observer;
  const node = { dataset: {}, isConnected: true, parentElement: null, offsetWidth: 100, offsetHeight: 20, getBoundingClientRect: () => ({ width: 100, height: 20, left: 0, top: 0, right: 100, bottom: 20 }) };
  const source = { firstChild: {} };
  const canvas = { getContext() { throw Error('oversized text must not reach drawing'); } };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  globalThis.window = { innerWidth: 1000, innerHeight: 1000, devicePixelRatio: 1, matchMedia: () => ({ addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} };
  globalThis.getComputedStyle = () => { reads++; return { width: '100px', height: '20px', fontSize: '16px', fontFamily: 'serif', getPropertyValue: name => name === 'color' ? color : '' }; };
  globalThis.MutationObserver = class { constructor(callback) { observer = callback; } observe() {} disconnect() { observer = null; } };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  let renderer;
  try {
    const text = 'x'.repeat(5000);
    await act(() => { renderer = create(h(PencilText, null, text), { createNodeMock: element => element.type === 'canvas' ? canvas : element.props.className === 'inkra-pencil-text__source' ? source : node }); });
    const before = reads;
    for (let index = 0; index < 100; index++) observer();
    assert.equal(reads - before, 100, 'each mutation should only compare appearance, not repeat painting');
    color = 'red';
    const previousReads = reads;
    observer();
    assert.equal(reads - previousReads, 3, 'a changed effective appearance must still retry painting');
    assert.equal(renderer.root.findByProps({ className: 'inkra-pencil-text__source' }).children[0], text);
    assert.equal(node.dataset.pencilReady, undefined);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    assert.equal(observer, null);
    for (const key of keys) { if (previous[key] === undefined) delete globalThis[key]; else globalThis[key] = previous[key]; }
  }
});
