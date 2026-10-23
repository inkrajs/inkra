// Use the actual React/Embla hook with a deterministic engine adapter. This
// exercises option equality/reInit and cleanup, not browser drag/layout behavior.
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { createElement as h, createRef } from 'react';
import { act, create } from 'react-test-renderer';

let engine;
mock.module('embla-carousel', { defaultExport: function EmblaCarousel(_viewport, options) {
  let selected = options.startIndex;
  const listeners = new Map();
  engine = {
    reinits: 0, destroyed: false, reinitSelections: [],
    on(name, callback) { const callbacks = listeners.get(name) ?? new Set(); callbacks.add(callback); listeners.set(name, callbacks); return this; },
    off(name, callback) { listeners.get(name)?.delete(callback); return this; },
    emit(name) { listeners.get(name)?.forEach(callback => callback(this)); },
    reInit(next) { this.reinits++; selected = next.startIndex; this.reinitSelections.push(selected); this.emit('reInit'); },
    selectedScrollSnap: () => selected,
    scrollSnapList: () => [0, 0.5, 1], canScrollPrev: () => selected > 0, canScrollNext: () => selected < 2,
    scrollTo(index) { selected = index; this.emit('select'); },
    scrollPrev() { this.scrollTo(Math.max(0, selected - 1)); },
    scrollNext() { this.scrollTo(Math.min(2, selected + 1)); },
    destroy() { this.destroyed = true; listeners.clear(); },
  };
  return engine;
} });
mock.module('embla-carousel-autoplay', { defaultExport: options => ({
  name: 'autoplay', options, init() {}, destroy() {}, play() {}, stop() {}, isPlaying: () => false,
}) });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = { document: { createElement() {} }, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const { Carousel } = await import('../../dist/carousel/index.js');
const ref = createRef();
const children = [h('p', { key: 'one' }, 'One'), h('p', { key: 'two' }, 'Two'), h('p', { key: 'three' }, 'Three')];
const props = { ref, dir: 'ltr', currentIndex: 0, children };
let renderer;
try {
  await act(() => { renderer = create(h(Carousel, props), { createNodeMock: node => node.props.className === 'inkra-carousel__viewport' ? {} : null }); });
  assert.ok(engine);
  assert.equal(engine.reinits, 0);
  for (const currentIndex of [1, 2, 0]) {
    await act(() => renderer.update(h(Carousel, { ...props, currentIndex })));
    assert.equal(engine.selectedScrollSnap(), currentIndex);
  }
  assert.equal(engine.reinits, 0, 'controlled selection must scroll, not rebuild the engine');
  await act(() => renderer.update(h(Carousel, { ...props, gap: 24 })));
  assert.equal(engine.reinits, 0);
  const selected = { ...props, currentIndex: 2 };
  await act(() => renderer.update(h(Carousel, selected)));
  assert.equal(engine.reinits, 0);
  await act(() => renderer.update(h(Carousel, { ...selected, align: 'center' })));
  assert.equal(engine.reinits, 1, 'actual engine option changes still reinitialize');
  assert.equal(engine.selectedScrollSnap(), 2);
  await act(() => renderer.update(h(Carousel, { ...selected, align: 'center', loop: true })));
  assert.equal(engine.reinits, 2);
  await act(() => renderer.update(h(Carousel, { ...selected, align: 'center', loop: true, autoplay: { delay: 3000 } })));
  await act(() => renderer.update(h(Carousel, { ...selected, align: 'center', loop: true, autoplay: { delay: 4000 } })));
  assert.equal(engine.reinits, 4, 'plugin options still invalidate the engine');
  assert.deepEqual(engine.reinitSelections, [2, 2, 2, 2], 'real option and plugin changes never reset to the mount selection');
  assert.equal(engine.selectedScrollSnap(), 2);
} finally { if (renderer) await act(() => renderer.unmount()); }
assert.equal(engine.destroyed, true);
