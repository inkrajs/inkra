import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement as h, createRef, Profiler } from 'react';
import { act, create } from 'react-test-renderer';
import { TransformWrapper } from 'react-zoom-pan-pinch';
import { AudioPlayer } from '../dist/audio-player/index.js';
import { PanZoom } from '../dist/pan-zoom/index.js';
import { Radar } from '../dist/radar/index.js';
import { Button } from '../dist/Button.js';
import { sparklineDomain, normalizeSparklineData } from '../dist/sparkline/model.js';

let previousActEnvironment;
before(() => { previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT; globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
after(() => { if (previousActEnvironment === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT; else globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment; });

function mediaMock() {
  const listeners = new Map();
  const audio = {
    currentTime: 0, duration: 60, volume: 1, muted: false, playbackRate: 1, readyState: 4,
    paused: true, ended: false, buffered: { length: 0 }, loads: 0, pauses: 0, adds: 0, removes: 0,
    pause() { this.pauses++; }, load() { this.loads++; },
    addEventListener(name, listener) { this.adds++; listeners.set(name, listener); },
    removeEventListener(name, listener) { this.removes++; if (listeners.get(name) === listener) listeners.delete(name); },
    emit(name) { listeners.get(name)?.(); },
  };
  return { audio, listeners };
}

test('AudioPlayer callback updates do not reload the current source or resubscribe media events', async () => {
  const { audio, listeners } = mediaMock();
  const states = [];
  const times = [];
  let renderer;
  const props = { src: 'one.mp3', renderControls: () => null };
  try {
    await act(() => { renderer = create(h(AudioPlayer, { ...props, onStateChange: state => states.push(['old', state]) }), { createNodeMock: node => node.type === 'audio' ? audio : null }); });
    const loads = audio.loads;
    const adds = audio.adds;
    audio.currentTime = 25;
    await act(() => renderer.update(h(AudioPlayer, { ...props, onStateChange: state => states.push(['new', state]), onTimeChange: time => times.push(time) })));
    assert.equal(audio.loads, loads, 'a callback rerender must not restart the source');
    assert.equal(audio.currentTime, 25);
    assert.equal(audio.adds, adds, 'callbacks are read by stable event listeners');
    await act(() => audio.emit('timeupdate'));
    assert.equal(states.at(-1)[0], 'new');
    assert.deepEqual(times, [25]);
    await act(() => renderer.update(h(AudioPlayer, { ...props, src: 'two.mp3' })));
    assert.equal(audio.loads, loads + 1, 'real source changes still load');
    assert.equal(audio.currentTime, 0);
  } finally { if (renderer) await act(() => renderer.unmount()); }
  assert.equal(listeners.size, 0);
});

test('AudioPlayer unchanged progress events notify consumers without rerendering controls', async () => {
  const { audio } = mediaMock();
  let renders = 0;
  let notifications = 0;
  let renderer;
  try {
    await act(() => { renderer = create(h(AudioPlayer, { src: 'one.mp3', renderControls: () => { renders++; return null; }, onStateChange: () => notifications++ }), { createNodeMock: node => node.type === 'audio' ? audio : null }); });
    await act(() => audio.emit('progress'));
    const baseline = renders;
    const notified = notifications;
    for (let i = 0; i < 5; i++) await act(() => audio.emit('progress'));
    assert.equal(renders, baseline);
    assert.equal(notifications, notified + 5, 'the public event callback remains observable');
    audio.currentTime = 1;
    await act(() => audio.emit('timeupdate'));
    assert.equal(renders, baseline + 1);
  } finally { if (renderer) await act(() => renderer.unmount()); }
});

test('PanZoom engine frames update imperative state and callbacks without React commits', async () => {
  const ref = createRef();
  const changes = [];
  let commits = 0;
  let renderer;
  try {
    await act(() => { renderer = create(h(Profiler, { id: 'pan-zoom', onRender: () => commits++ }, h(PanZoom, { ref, onTransformChange: (value, details) => changes.push({ value, details }) }, 'Content'))); });
    const baseline = commits;
    assert.ok(baseline > 0, 'the Profiler must observe mount commits');
    const engineProps = renderer.root.findByType(TransformWrapper).props;
    for (let index = 1; index <= 10; index++) await act(() => renderer.root.findByType(TransformWrapper).props.onTransform(null, { positionX: index, positionY: index * 2, scale: 2 }));
    assert.equal(commits, baseline);
    assert.equal(renderer.root.findByType(TransformWrapper).props, engineProps, 'engine props remain referentially stable without wrapper renders');
    assert.deepEqual(ref.current.getTransform(), { x: 10, y: 20, scale: 2 });
    assert.equal(changes.length, 10);
    assert.equal(changes.at(-1).details.reason, 'gesture');
  } finally { if (renderer) await act(() => renderer.unmount()); }
});

test('Radar selection and unrelated renders reuse domain and geometry derivation', async () => {
  let reads = 0;
  const axes = ['a', 'b', 'c'].map(id => ({ id, label: id }));
  const series = [{ id: 'one', label: 'One', data: axes.map(axis => ({ axisId: axis.id, get value() { reads++; return 4; } })) }];
  const props = { axes, series, label: 'Measurements', showTable: false };
  let renderer;
  try {
    await act(() => { renderer = create(h(Radar, props)); });
    const baseline = reads;
    const ink = renderer.root.find(node => node.type?.name === 'RadarInk');
    const geometry = ink.props.seriesPoints;
    await act(() => renderer.root.findAllByType(Button)[0].props.onClick());
    await act(() => renderer.update(h(Radar, { ...props, className: 'updated' })));
    assert.equal(reads, baseline);
    assert.equal(renderer.root.find(node => node.type?.name === 'RadarInk').props.seriesPoints, geometry);
    await act(() => renderer.update(h(Radar, { ...props, series: [{ ...series[0], data: [{ axisId: 'a', value: 9 }] }] })));
    assert.notEqual(renderer.root.find(node => node.type?.name === 'RadarInk').props.seriesPoints, geometry);
  } finally { if (renderer) await act(() => renderer.unmount()); }
});

test('Sparkline domain supports datasets above JavaScript argument-count limits', () => {
  const points = normalizeSparklineData(Array.from({ length: 200_000 }, (_, index) => index - 100_000));
  assert.deepEqual(sparklineDomain(points), [-115999.92, 115998.92]);
});

test('NodeGraph retains unchanged node and edge wrappers during immutable edits', async () => {
  const { NodeGraph } = await import('../dist/node-graph/index.js');
  const { ReactFlow } = await import('@xyflow/react');
  const previousWindow = globalThis.window;
  const previousCancel = globalThis.cancelAnimationFrame;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.cancelAnimationFrame = () => {};
  const nodes = [
    { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } },
    { id: 'b', position: { x: 100, y: 100 }, data: { label: 'B' } },
  ];
  const edges = [{ id: 'ab', source: 'a', target: 'b' }, { id: 'ba', source: 'b', target: 'a' }];
  const props = { nodes, edges, controls: false };
  let renderer;
  try {
    await act(() => { renderer = create(h(NodeGraph.Root, props)); });
    const initial = renderer.root.findByType(ReactFlow).props;
    await act(() => renderer.update(h(NodeGraph.Root, { ...props, nodes: [{ ...nodes[0], position: { x: 20, y: 20 } }, nodes[1]], edges: [{ ...edges[0], selected: true }, edges[1]] })));
    const changed = renderer.root.findByType(ReactFlow).props;
    assert.notEqual(changed.nodes[0], initial.nodes[0]);
    assert.equal(changed.nodes[1], initial.nodes[1]);
    assert.notEqual(changed.edges[0], initial.edges[0]);
    assert.equal(changed.edges[1], initial.edges[1]);
    await act(() => renderer.update(h(NodeGraph.Root, { ...props, readOnly: true })));
    const readOnly = renderer.root.findByType(ReactFlow).props;
    assert.notEqual(readOnly.nodes[1], initial.nodes[1]);
    assert.equal(readOnly.nodes[1].data.__inkraReadOnly, true);
    const renderNode = () => 'Custom node';
    const renderEdge = () => 'Custom edge';
    const renderEdgeLabel = () => 'Custom label';
    await act(() => renderer.update(h(NodeGraph.Root, { ...props, renderNode, renderEdge, renderEdgeLabel })));
    const custom = renderer.root.findByType(ReactFlow).props;
    assert.equal(custom.nodes[1].data.__inkraRenderNode, renderNode);
    assert.equal(custom.edges[1].data.__inkraRenderEdge, renderEdge);
    assert.equal(custom.edges[1].data.__inkraRenderEdgeLabel, renderEdgeLabel);
    assert.notEqual(custom.edges[1], changed.edges[1]);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousCancel === undefined) delete globalThis.cancelAnimationFrame; else globalThis.cancelAnimationFrame = previousCancel;
  }
});

test('DayAgenda selection reuses interval sorting, layout and time formatters', async () => {
  const { DayAgenda } = await import('../dist/day-agenda/index.js');
  let intervalReads = 0;
  const events = Array.from({ length: 20 }, (_, index) => ({ id: String(index), title: `Event ${index}`, get startMinute() { intervalReads++; return index * 30; }, endMinute: index * 30 + 25 }));
  const OriginalFormatter = Intl.DateTimeFormat;
  let formatters = 0;
  Intl.DateTimeFormat = function (...args) { formatters++; return new OriginalFormatter(...args); };
  const props = { date: '2026-10-23', events, hourCycle: 'h12' };
  let renderer;
  try {
    await act(() => { renderer = create(h(DayAgenda, props)); });
    assert.equal(formatters, 2, 'one date and one time formatter, not one per label');
    const reads = intervalReads;
    await act(() => renderer.update(h(DayAgenda, { ...props, selectedEvent: '2' })));
    assert.equal(formatters, 2);
    assert.equal(intervalReads, reads);
    await act(() => renderer.update(h(DayAgenda, { ...props, events: [...events, { id: 'later', title: 'Later', startMinute: 1100 }] })));
    assert.ok(intervalReads > reads);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    Intl.DateTimeFormat = OriginalFormatter;
  }
});

function animationEnvironment() {
  const names = ['window', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const previous = names.map(name => [name, globalThis[name]]);
  const frames = new Map();
  const motionListeners = new Set();
  let sequence = 0;
  let mediaSubscriptions = 0;
  const query = { matches: false, addEventListener(_name, listener) { mediaSubscriptions++; motionListeners.add(listener); }, removeEventListener(_name, listener) { motionListeners.delete(listener); } };
  globalThis.window = { matchMedia: () => query };
  globalThis.requestAnimationFrame = callback => { const id = ++sequence; frames.set(id, callback); return id; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  return {
    frames, query, motionListeners, get mediaSubscriptions() { return mediaSubscriptions; },
    flush(time = 0) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)); },
    restore() { for (const [name, value] of previous) { if (value === undefined) delete globalThis[name]; else globalThis[name] = value; } },
  };
}

test('Tilt coalesces pointer reads and writes, retaining the latest point and cancelling interrupted motion', async () => {
  const { Tilt } = await import('../dist/flip/index.js');
  const environment = animationEnvironment();
  let reads = 0;
  let pointerCalls = 0;
  const properties = new Map();
  const root = { getBoundingClientRect() { reads++; return { left: 0, top: 0, width: 100, height: 100 }; }, style: { setProperty: (name, value) => properties.set(name, value) }, setAttribute() {}, removeAttribute() {} };
  const move = (renderer, x = 100) => renderer.root.findByType('div').props.onPointerMove({ currentTarget: root, clientX: x, clientY: 0, pointerType: 'mouse', isPrimary: true });
  let renderer;
  try {
    await act(() => { renderer = create(h(Tilt, { onPointerMove: () => pointerCalls++ }), { createNodeMock: () => root }); });
    for (let i = 0; i <= 100; i++) move(renderer, i);
    assert.equal(pointerCalls, 101, 'consumer pointer events are not throttled');
    assert.equal(reads, 0, 'layout reads wait until the shared frame');
    assert.equal(environment.frames.size, 1);
    await act(() => environment.flush());
    assert.equal(reads, 1);
    assert.equal(properties.get('--inkra-tilt-rotate-x'), '-8deg');
    assert.equal(properties.get('--inkra-tilt-rotate-y'), '-8deg');
    const subscriptions = environment.mediaSubscriptions;
    await act(() => renderer.update(h(Tilt, { className: 'changed' })));
    assert.equal(environment.mediaSubscriptions, subscriptions, 'unrelated rerenders retain the reduced-motion listener');
    move(renderer);
    renderer.root.findByType('div').props.onPointerLeave({});
    assert.equal(environment.frames.size, 0);
    assert.equal(properties.get('--inkra-tilt-rotate-x'), '0deg');
    move(renderer);
    await act(() => renderer.update(h(Tilt, { disabled: true })));
    assert.equal(environment.frames.size, 0);
    await act(() => renderer.update(h(Tilt, {})));
    move(renderer);
    environment.query.matches = true;
    await act(() => environment.motionListeners.forEach(listener => listener()));
    assert.equal(environment.frames.size, 0);
    environment.query.matches = false;
    environment.motionListeners.forEach(listener => listener());
    move(renderer);
  } finally { if (renderer) await act(() => renderer.unmount()); environment.restore(); }
  assert.equal(environment.frames.size, 0);
  assert.equal(environment.motionListeners.size, 0);
});

test('Typewriter does not rerender unchanged graphemes and cancels paused, replaced and unmounted timers', async () => {
  const { Typewriter } = await import('../dist/typewriter/index.js');
  const { PencilText } = await import('../dist/PencilText.js');
  const environment = animationEnvironment();
  const timers = new Map();
  let sequence = 0;
  window.setTimeout = callback => { const id = ++sequence; timers.set(id, callback); return id; };
  window.clearTimeout = id => timers.delete(id);
  const ref = createRef();
  let renderer;
  try {
    await act(() => { renderer = create(h(Typewriter, { ref }, 'abcdef')); });
    const before = renderer.root.findAllByType(PencilText).map(node => node.props);
    assert.equal(timers.size, 1);
    const callback = [...timers.values()][0]; timers.clear();
    await act(() => callback());
    const after = renderer.root.findAllByType(PencilText).map(node => node.props);
    assert.notEqual(after[0], before[0]);
    for (let index = 1; index < before.length; index++) assert.equal(after[index], before[index]);
    await act(() => ref.current.pause());
    assert.equal(timers.size, 0);
    await act(() => ref.current.resume());
    assert.equal(timers.size, 1);
    await act(() => renderer.update(h(Typewriter, { ref }, 'replacement')));
    assert.equal(timers.size, 1, 'replacement owns exactly one timer');
    await act(() => ref.current.complete());
    assert.equal(timers.size, 0);
    await act(() => ref.current.restart());
    assert.equal(timers.size, 1);
  } finally { if (renderer) await act(() => renderer.unmount()); environment.restore(); }
  assert.equal(timers.size, 0);
});

test('NumberTicker owns one frame, retargets the visible value, and cancels on reduced motion and unmount', async () => {
  const { NumberTicker } = await import('../dist/number-ticker/index.js');
  const environment = animationEnvironment();
  const values = [];
  const renderValue = value => { values.push(value); return String(value); };
  let renderer;
  try {
    await act(() => { renderer = create(h(NumberTicker, { value: 0, duration: 100, renderValue })); });
    assert.equal(environment.frames.size, 0);
    await act(() => renderer.update(h(NumberTicker, { value: 100, duration: 100, renderValue })));
    assert.equal(environment.frames.size, 1);
    await act(() => environment.flush(0));
    await act(() => environment.flush(50));
    const visible = values.at(-1);
    assert.ok(visible > 0 && visible < 100);
    await act(() => renderer.update(h(NumberTicker, { value: 200, duration: 100, renderValue })));
    assert.equal(environment.frames.size, 1);
    await act(() => environment.flush(60));
    assert.equal(values.at(-1), visible, 'new target continues from the visible frame');
    environment.query.matches = true;
    await act(() => environment.motionListeners.forEach(listener => listener()));
    assert.equal(environment.frames.size, 0);
    assert.equal(values.at(-1), 200);
    const announcement = renderer.root.findByProps({ className: 'inkra-number-ticker__announcement' });
    assert.equal(announcement.children.join(''), '200');
    environment.query.matches = false;
    await act(() => environment.motionListeners.forEach(listener => listener()));
    await act(() => renderer.update(h(NumberTicker, { value: 300, duration: 100, renderValue })));
    assert.equal(environment.frames.size, 1);
  } finally { if (renderer) await act(() => renderer.unmount()); environment.restore(); }
  assert.equal(environment.frames.size, 0);
  assert.equal(environment.motionListeners.size, 0);
});

test('ImageCropper ignores repeated measurements of the same stage size', async () => {
  const { ImageCropper } = await import('../dist/image-cropper/index.js');
  const previousResize = globalThis.ResizeObserver;
  let observer;
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; observer = this; }
    observe() {} disconnect() { this.disconnected = true; }
  };
  let width = 640;
  const stage = { getBoundingClientRect: () => ({ width, height: 400 }) };
  let commits = 0;
  let renderer;
  try {
    await act(() => { renderer = create(h(Profiler, { id: 'cropper', onRender: () => commits++ }, h(ImageCropper, { source: '', alt: '', showControls: false })), { createNodeMock: node => node.props.className === 'inkra-image-cropper__stage' ? stage : null }); });
    const baseline = commits;
    assert.ok(baseline > 0, 'the Profiler must observe mount commits');
    const stageProps = renderer.root.findByProps({ className: 'inkra-image-cropper__stage' }).props;
    for (let index = 0; index < 5; index++) await act(() => observer.callback([]));
    assert.equal(commits, baseline);
    assert.equal(renderer.root.findByProps({ className: 'inkra-image-cropper__stage' }).props, stageProps);
    width = 500;
    await act(() => observer.callback([]));
    assert.equal(commits, baseline + 1);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    if (previousResize === undefined) delete globalThis.ResizeObserver; else globalThis.ResizeObserver = previousResize;
  }
  assert.equal(observer.disconnected, true);
});

test('JourneyMap terrain bounds do not spread large polygon datasets into function arguments', async () => {
  const { paintTerrain } = await import('../dist/journey-map/terrain.js');
  const coordinates = [Array.from({ length: 200_000 }, (_, index) => [200 + index % 2, 200])];
  let projected = 0;
  assert.doesNotThrow(() => paintTerrain({}, { type: 'Polygon', coordinates }, point => { projected++; return point; }, 100, 100, false));
  assert.equal(projected, 200_000, 'offscreen polygons still determine bounds without drawing');
});

function descendants(value, result = []) {
  if (Array.isArray(value)) value.forEach(child => descendants(child, result));
  else if (value?.props) { result.push(value); descendants(value.props.children, result); }
  return result;
}

test('ImageViewer coalesces pending focus/fit work and cancels it on unmount', async () => {
  const { ImageViewer } = await import('../dist/image-viewer/index.js');
  const { OverlayPortal } = await import('../dist/overlay/index.js');
  const environment = animationEnvironment();
  const previousStyle = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ direction: 'ltr' });
  const items = [{ id: 'a', src: 'a.jpg', alt: 'A' }, { id: 'b', src: 'b.jpg', alt: 'B' }];
  let renderer;
  const elements = () => descendants(renderer.root.findByType(OverlayPortal).props.children);
  try {
    await act(() => { renderer = create(h(ImageViewer.Root, { items }, h(ImageViewer.Content, { rotatable: true }))); });
    for (let index = 0; index < 10; index++) {
      const rotate = elements().find(element => element.props['aria-label'] === 'Rotate clockwise');
      await act(() => rotate.props.onClick());
    }
    assert.equal(environment.frames.size, 1, 'only the latest fit should run after repeated rotations');
    const thumbnail = elements().find(element => element.props.role === 'option');
    for (let index = 0; index < 5; index++) await act(() => thumbnail.props.onKeyDown({ key: 'End', currentTarget: {}, preventDefault() {} }));
    assert.equal(environment.frames.size, 2, 'focus and fit each own at most one pending frame');
  } finally {
    if (renderer) await act(() => renderer.unmount());
    if (previousStyle === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = previousStyle;
    environment.restore();
  }
  assert.equal(environment.frames.size, 0);
});

test('Radar domain supports a long series without function-argument overflow', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const axes = ['a', 'b', 'c'].map(id => ({ id, label: id }));
  const data = Array.from({ length: 200_000 }, (_, index) => ({ axisId: 'a', value: index }));
  const markup = renderToStaticMarkup(h(Radar, { axes, series: [{ id: 'large', label: 'Large', data }], label: 'Large series' }));
  assert.match(markup, /Large series/);
  assert.doesNotMatch(markup, /NaN/);
});

test('AudioPlayer ignores stale play rejection after source replacement or unmount', async () => {
  const { audio } = mediaMock();
  const pending = [];
  audio.play = () => new Promise((resolve, reject) => pending.push({ resolve, reject }));
  const errors = [];
  const ref = createRef();
  const props = { ref, src: 'one.mp3', renderControls: () => null, onError: error => errors.push(error) };
  let renderer;
  try {
    await act(() => { renderer = create(h(AudioPlayer, props), { createNodeMock: node => node.type === 'audio' ? audio : null }); });
    const stale = ref.current.play();
    await act(() => renderer.update(h(AudioPlayer, { ...props, src: 'two.mp3' })));
    await act(async () => { pending[0].reject(new DOMException('Old request', 'AbortError')); await stale; });
    assert.equal(errors.length, 0);
    assert.equal(ref.current.state.status, 'loading');
    const current = ref.current.play();
    await act(async () => { pending[1].reject(new DOMException('Current request', 'NotAllowedError')); await current; });
    assert.equal(errors.length, 1);
    assert.equal(ref.current.state.status, 'blocked');
    const detached = ref.current.play();
    await act(() => renderer.unmount()); renderer = null;
    await act(async () => { pending[2].reject(new DOMException('Unmounted request', 'AbortError')); await detached; });
    assert.equal(errors.length, 1);
  } finally { if (renderer) await act(() => renderer.unmount()); }
});

test('NodeGraph.Edge skips SVG sampling on unchanged paints and cached remounts', async () => {
  const { NodeGraph } = await import('../dist/node-graph/index.js');
  const environment = animationEnvironment();
  const names = ['document', 'getComputedStyle', 'MutationObserver', 'matchMedia'];
  const previous = names.map(name => [name, globalThis[name]]);
  const observers = new Set();
  let samples = 0;
  let pointReads = 0;
  const context = () => new Proxy({ globalAlpha: 1, isContextLost: () => false }, { get: (target, key) => key in target ? target[key] : () => {} });
  const canvas = () => { const ctx = context(); return { width: 0, height: 0, parentElement: null, style: {}, getContext: () => ctx }; };
  const path = { getBBox: () => ({ x: 0, y: 0, width: 100, height: 10 }), getTotalLength() { samples++; return 100; }, getPointAtLength(value) { pointReads++; return { x: value, y: 0 }; } };
  globalThis.document = { visibilityState: 'visible', createElement: canvas, addEventListener() {}, removeEventListener() {} };
  globalThis.window.addEventListener = () => {};
  globalThis.window.removeEventListener = () => {};
  globalThis.matchMedia = window.matchMedia;
  globalThis.getComputedStyle = () => ({ color: 'black', getPropertyValue: () => '' });
  globalThis.MutationObserver = class { constructor(callback) { this.callback = callback; observers.add(this); } observe() {} disconnect() { observers.delete(this); } };
  const props = { id: 'cache-regression-edge', path: 'M0 0L100 0' };
  const options = { createNodeMock: node => node.type === 'path' ? path : node.type === 'canvas' ? canvas() : null };
  let renderer;
  try {
    await act(() => { renderer = create(h(NodeGraph.Edge, props), options); });
    assert.equal(samples, 1);
    const initialReads = pointReads;
    for (const observer of observers) observer.callback();
    await act(() => environment.flush());
    assert.equal(samples, 1);
    assert.equal(pointReads, initialReads);
    await act(() => renderer.unmount()); renderer = null;
    await act(() => { renderer = create(h(NodeGraph.Edge, props), options); });
    assert.equal(samples, 1, 'global bounded raster cache avoids re-sampling on remount');
    await act(() => renderer.update(h(NodeGraph.Edge, { ...props, selected: true })));
    assert.equal(samples, 2, 'new stroke appearance still builds a valid raster');
    for (const observer of observers) observer.callback();
    assert.equal(environment.frames.size, 1);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    for (const [name, value] of previous) { if (value === undefined) delete globalThis[name]; else globalThis[name] = value; }
    environment.restore();
  }
  assert.equal(observers.size, 0);
  assert.equal(environment.frames.size, 0);
});

test('NumberTicker decimal animation formatting reuses the Intl exact-string capability probe', async () => {
  const { formatExactParts } = await import('../dist/number-ticker/precision.js');
  const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });
  assert.equal(formatExactParts(formatter, '1.25').map(part => part.value).join(''), '1.25');
  const OriginalFormatter = Intl.NumberFormat;
  let constructors = 0;
  Intl.NumberFormat = function (...args) { constructors++; return new OriginalFormatter(...args); };
  try {
    for (let index = 0; index < 10; index++) assert.equal(formatExactParts(formatter, `${index}.25`).map(part => part.value).join(''), `${index}.25`);
    assert.equal(constructors, 0, 'runtime feature detection must not allocate a formatter for every frame');
  } finally { Intl.NumberFormat = OriginalFormatter; }
});

test('PanZoom controlled values reconcile rejected gestures and retain fresh callbacks', async () => {
  const ref = createRef(), calls = [], notices = [];
  let renderer;
  let props = { ref, value: { x: 2, y: 3, scale: 2 }, onTransformChange: (value, details) => notices.push(['old', value, details]) };
  try {
    await act(() => { renderer = create(h(PanZoom, props, 'Content')); });
    const engineRef = renderer.root.findByType(TransformWrapper).props.ref;
    engineRef.current.setTransform = (x, y, scale, duration) => {
      calls.push({ x, y, scale, duration });
      renderer.root.findByType(TransformWrapper).props.onTransform(null, { positionX: x, positionY: y, scale });
      return Promise.resolve();
    };
    await act(() => renderer.root.findByType(TransformWrapper).props.onTransform(null, { positionX: 10, positionY: 20, scale: 3 }));
    assert.deepEqual(ref.current.getTransform(), { x: 10, y: 20, scale: 3 });
    assert.equal(calls.length, 0);
    await act(() => renderer.root.findByType(TransformWrapper).props.onPanningStop());
    assert.deepEqual(calls.at(-1), { x: 2, y: 3, scale: 2, duration: 100 });
    assert.deepEqual(ref.current.getTransform(), props.value);
    assert.equal(notices.at(-1)[2].reason, 'programmatic');
    props = { ...props, value: { x: 7, y: 8, scale: 4 }, onTransformChange: (value, details) => notices.push(['new', value, details]) };
    await act(() => renderer.update(h(PanZoom, props, 'Content')));
    assert.deepEqual(calls.at(-1), { x: 7, y: 8, scale: 4, duration: 0 });
    assert.deepEqual(ref.current.getTransform(), props.value);
    assert.equal(notices.at(-1)[0], 'new');
    props = { ...props, maxScale: 3 };
    await act(() => renderer.update(h(PanZoom, props, 'Content')));
    assert.deepEqual(calls.at(-1), { x: 7, y: 8, scale: 3, duration: 0 });
    for (const stop of ['onPanningStop', 'onPinchStop', 'onWheelStop', 'onZoomStop']) {
      await act(() => renderer.root.findByType(TransformWrapper).props.onTransform(null, { positionX: 99, positionY: 99, scale: 2 }));
      await act(() => renderer.root.findByType(TransformWrapper).props[stop]());
      assert.deepEqual(ref.current.getTransform(), { x: 7, y: 8, scale: 3 });
    }
  } finally {
    if (renderer) await act(() => renderer.unmount());
  }
});
