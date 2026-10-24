import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement as h, createRef } from 'react';
import { act, create } from 'react-test-renderer';
import { AudioPlayer } from '../dist/audio-player/index.js';
import { ImageViewer } from '../dist/image-viewer/index.js';
import { OverlayPortal } from '../dist/overlay/index.js';
import { PanZoom } from '../dist/pan-zoom/index.js';
import { drawPencilSurface } from '../dist/internal/surfaceRenderer.js';
import { MAX_SURFACE_TOTAL_PIXELS, resolveSurfaceAllocation } from '../dist/internal/surfaceBudget.js';

let previousActEnvironment;
before(() => { previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT; globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
after(() => { if (previousActEnvironment === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT; else globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment; });

function bitmap(initialWidth = 0, initialHeight = 0) {
  let width = initialWidth;
  let height = initialHeight;
  const dimensions = [];
  const context = new Proxy({ globalAlpha: 1, isContextLost: () => false }, {
    get: (target, key) => key in target ? target[key] : () => {},
  });
  return {
    get width() { return width; },
    set width(value) { width = value; dimensions.push([width, height]); },
    get height() { return height; },
    set height(value) { height = value; dimensions.push([width, height]); },
    dimensions,
    getContext: () => context,
  };
}

const theme = { paper: 'white', dark: false, ink: 'black', wash: 'green' };

test('surface rendering adapts DPR without losing the combined-layer budget or fallback release', () => {
  const canvas = bitmap();
  const border = bitmap();
  const allocation = resolveSurfaceAllocation(1440, 720, 2, 0, 2);
  const points = drawPencilSurface(canvas, border, 1440, 720, 'outline', 56001, 2, theme);
  assert.equal(allocation.ok, true);
  assert.equal(canvas.width, allocation.width);
  assert.equal(canvas.height, allocation.height);
  assert.equal(border.width, canvas.width);
  assert.equal(border.height, canvas.height);
  assert.ok(canvas.width * canvas.height * 2 <= MAX_SURFACE_TOTAL_PIXELS);
  assert.equal(points.length, 28);
  assert.throws(() => drawPencilSurface(canvas, border, 2500, 1300, 'outline', 56001, 2, theme), RangeError);
  for (const target of [canvas, border]) assert.deepEqual([target.width, target.height], [0, 0]);
});

test('warm surface cache copies release old dimensions before swapping bitmap orientation', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => bitmap() };
  try {
    for (let index = 0; index < 2; index++) drawPencilSurface(bitmap(), null, 4096, 64, 'outline', 56002, 1, theme);
    const target = bitmap(64, 4096);
    drawPencilSurface(target, null, 4096, 64, 'outline', 56002, 1, theme);
    assert.deepEqual(target.dimensions, [[0, 4096], [0, 0], [4096, 0], [4096, 64]]);
    assert.ok(target.dimensions.every(([width, height]) => width * height <= 4 * 1024 * 1024));
  } finally { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; }
});

function mediaMock() {
  const listeners = new Map();
  return {
    currentTime: 0, duration: 60, buffered: { length: 0 }, readyState: 4,
    volume: 1, muted: false, playbackRate: 1, defaultPlaybackRate: 1,
    paused: true, ended: false, loads: 0, adds: 0, source: 'one.mp3',
    pause() {}, load() { this.loads++; },
    getAttribute(name) { return name === 'src' ? this.source : null; },
    removeAttribute(name) { if (name === 'src') this.source = null; },
    addEventListener(name, listener) { this.adds++; listeners.set(name, listener); },
    removeEventListener(name) { listeners.delete(name); },
    emit(name) { listeners.get(name)?.(); },
  };
}

test('AudioPlayer preserves controlled proposals, stable listeners and no-op event rendering together', async () => {
  const audio = mediaMock();
  const ref = createRef();
  const requests = [];
  let renders = 0;
  let notifications = 0;
  let renderer;
  const props = {
    ref, src: 'one.mp3', volume: 0.4, muted: false, playbackRate: 1.25,
    renderControls: () => { renders++; return null; },
    onVolumeChange: value => requests.push(['volume', value]),
    onMutedChange: value => requests.push(['muted', value]),
    onPlaybackRateChange: value => requests.push(['rate', value]),
    onStateChange: () => notifications++,
  };
  try {
    await act(() => { renderer = create(h(AudioPlayer, props), { createNodeMock: node => node.type === 'audio' ? audio : null }); });
    const loads = audio.loads;
    const adds = audio.adds;
    await act(() => { ref.current.setVolume(0.8); ref.current.setMuted(true); ref.current.setPlaybackRate(2); });
    assert.deepEqual(requests, [['volume', 0.8], ['muted', true], ['rate', 2]]);
    assert.deepEqual([audio.volume, audio.muted, audio.playbackRate], [0.4, false, 1.25]);
    const rendered = renders;
    const notified = notifications;
    for (let index = 0; index < 3; index++) await act(() => audio.emit('progress'));
    assert.equal(renders, rendered);
    assert.equal(notifications, notified + 3);
    await act(() => renderer.update(h(AudioPlayer, { ...props, volume: 0.8, muted: true, playbackRate: 2, onStateChange: () => notifications++ })));
    assert.deepEqual([audio.volume, audio.muted, audio.playbackRate], [0.8, true, 2]);
    assert.equal(audio.loads, loads);
    assert.equal(audio.adds, adds);
    audio.volume = 0.1;
    audio.muted = false;
    audio.playbackRate = 0.5;
    await act(() => { audio.emit('volumechange'); audio.emit('ratechange'); });
    assert.deepEqual([audio.volume, audio.muted, audio.playbackRate], [0.8, true, 2]);
    assert.equal(requests.length, 3, 'restoring controlled values must not emit duplicate proposals');
  } finally { if (renderer) await act(() => renderer.unmount()); }
});

test('AudioPlayer clearing a source preserves uncontrolled user settings and ignores stale play rejection', async () => {
  const audio = mediaMock();
  let rejectPlay;
  audio.play = () => new Promise((_resolve, reject) => { rejectPlay = reject; });
  const ref = createRef();
  const errors = [];
  let renderer;
  const props = { ref, src: 'one.mp3', defaultVolume: 0.6, defaultPlaybackRate: 1.25, renderControls: () => null, onError: error => errors.push(error) };
  try {
    await act(() => { renderer = create(h(AudioPlayer, props), { createNodeMock: node => node.type === 'audio' ? audio : null }); });
    await act(() => { ref.current.setVolume(0.3); ref.current.setMuted(true); ref.current.setPlaybackRate(1.5); });
    const pending = ref.current.play();
    await act(() => renderer.update(h(AudioPlayer, { ...props, src: undefined, defaultVolume: 1, defaultPlaybackRate: 2 })));
    assert.equal(audio.source, null);
    assert.equal(ref.current.state.status, 'idle');
    assert.deepEqual([audio.volume, audio.muted, audio.playbackRate], [0.3, true, 1.5]);
    await act(() => { audio.emit('loadstart'); audio.emit('pause'); audio.emit('error'); audio.emit('emptied'); });
    await act(async () => { rejectPlay(new DOMException('Old request', 'AbortError')); await pending; });
    assert.equal(ref.current.state.status, 'idle');
    assert.equal(errors.length, 0);
  } finally { if (renderer) await act(() => renderer.unmount()); }
});

function descendants(value, result = []) {
  if (Array.isArray(value)) value.forEach(child => descendants(child, result));
  else if (value?.props) { result.push(value); descendants(value.props.children, result); }
  return result;
}

test('ImageViewer resource replacement preserves stable rerenders but cannot inherit a stale rotation fit', async () => {
  const previous = ['requestAnimationFrame', 'cancelAnimationFrame'].map(name => [name, globalThis[name]]);
  const frames = new Map();
  let sequence = 0;
  globalThis.requestAnimationFrame = callback => { const id = ++sequence; frames.set(id, callback); return id; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  let renderer;
  let fits = 0;
  const item = { id: 'same-id', src: 'first.jpg', alt: 'Photo' };
  const render = items => h(ImageViewer.Root, { items }, h(ImageViewer.Content, { rotatable: true }));
  const elements = () => descendants(renderer.root.findByType(OverlayPortal).props.children);
  const panZoom = () => elements().find(element => element.type === PanZoom);
  const rotation = () => elements().find(element => element.props.className === 'inkra-image-viewer__image-transform').props.style.transform;
  try {
    await act(() => { renderer = create(render([item])); });
    const key = panZoom().key;
    await act(() => elements().find(element => element.props['aria-label'] === 'Rotate clockwise').props.onClick());
    assert.equal(rotation(), 'rotate(90deg)');
    await act(() => renderer.update(render([{ ...item }])));
    assert.equal(rotation(), 'rotate(90deg)');
    assert.equal(panZoom().key, key);
    await act(() => renderer.update(render([{ ...item, src: 'replacement.jpg' }])));
    assert.equal(rotation(), 'rotate(0deg)');
    assert.notEqual(panZoom().key, key);
    panZoom().props.ref.current = { fit() { fits++; } };
    await act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); });
    assert.equal(fits, 0, 'a fit scheduled for the old src cannot affect its same-id replacement');
    await act(() => elements().find(element => element.type === 'img').props.onError());
    assert.equal(panZoom(), undefined);
    await act(() => renderer.update(render([{ ...item, src: 'recovered.jpg' }])));
    assert.ok(panZoom(), 'failure identity follows the resource, not only its id');
  } finally {
    if (renderer) await act(() => renderer.unmount());
    for (const [name, value] of previous) { if (value === undefined) delete globalThis[name]; else globalThis[name] = value; }
  }
  assert.equal(frames.size, 0);
});
