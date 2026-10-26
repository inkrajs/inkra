import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

import {
  boundaryDistance,
  completeDirectionalRecord,
  dampPullDistance,
  directionalValue,
  gestureStatusEnabled,
  indicatorVisible,
  localScrollDelta,
  normalizeDirections,
  physicalBoundaryDistance,
  physicalHorizontalBoundaryDistance,
  pullProgress,
  statusAfterCancellation,
} from '../src/infinite-scroll/model.ts';

const componentUrl = new URL('../src/infinite-scroll/index.tsx', import.meta.url);
const gestureUrl = new URL('../src/infinite-scroll/gesture.ts', import.meta.url);
const modelUrl = new URL('../src/infinite-scroll/model.ts', import.meta.url);
const stylesUrl = new URL('../src/infinite-scroll/styles.css', import.meta.url);

async function transpileCommonJs(url, requireModule = () => { throw new Error('Unexpected require'); }) {
  const source = await readFile(url, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: url.pathname,
  }).outputText;
  const module = { exports: {} };
  Function('require', 'module', 'exports', output)(requireModule, module, module.exports);
  return module.exports;
}

class FakeEmitter {
  listeners = new Map();
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type, event) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
}

class FakeView extends FakeEmitter {
  innerWidth = 390;
  setTimeout = setTimeout;
  clearTimeout = clearTimeout;
  getComputedStyle(node) {
    return {
      direction: node.direction ?? 'ltr',
      overflowX: node.overflowX ?? 'visible',
      overflowY: node.overflowY ?? 'visible',
    };
  }
}

class FakeDocument extends FakeEmitter {
  defaultView = new FakeView();
  documentElement = { clientWidth: 390 };
  body = {};
  scrollingElement = {};
}

class FakeHTMLElement extends FakeEmitter {
  constructor(ownerDocument, rect = { left: 0, top: 0, right: 300, bottom: 300, width: 300, height: 300 }) {
    super();
    this.ownerDocument = ownerDocument;
    this.rect = rect;
    this.clientWidth = rect.width;
    this.clientHeight = rect.height;
    this.clientLeft = 0;
    this.clientTop = 0;
    this.offsetWidth = rect.width;
    this.offsetHeight = rect.height;
    this.scrollLeft = 0;
    this.scrollTop = 0;
    this.scrollWidth = rect.width;
    this.scrollHeight = rect.height;
    this.isConnected = true;
    this.parentElement = null;
    this.ignored = false;
  }
  contains(node) {
    for (let current = node; current; current = current.parentElement) if (current === this) return true;
    return false;
  }
  closest() { return this.ignored ? this : null; }
  getBoundingClientRect() { return this.rect; }
}

globalThis.HTMLElement = FakeHTMLElement;

function touch(identifier, clientX, clientY) { return { identifier, clientX, clientY }; }
function touchEvent(target, touches, changedTouches = touches) {
  return {
    target,
    touches,
    changedTouches,
    cancelable: true,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() {},
  };
}

async function gestureHarness(overrides = {}) {
  const model = await transpileCommonJs(modelUrl);
  const gesture = await transpileCommonJs(gestureUrl, specifier => {
    if (specifier === './model.js') return model;
    throw new Error(`Unexpected require: ${specifier}`);
  });
  const document = new FakeDocument();
  const root = new FakeHTMLElement(document);
  const container = root;
  const target = new FakeHTMLElement(document, { left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40 });
  target.parentElement = root;
  const sentinel = new FakeHTMLElement(document, root.rect);
  const pulls = [];
  const commits = [];
  const options = {
    root,
    container,
    directions: ['top'],
    isEnabled: () => true,
    isExplicitlyEnabled: () => true,
    threshold: () => 48,
    sentinel: () => sentinel,
    systemGestureInset: 24,
    onPull: (...value) => pulls.push(value),
    onCommit: direction => commits.push(direction),
    ...overrides,
  };
  return { document, root, target, pulls, commits, controller: gesture.createInfiniteScrollGesture(() => options), options };
}

test('normalizes directions and directional options without duplicate work', () => {
  assert.deepEqual(normalizeDirections(['left', 'bottom', 'left']), ['bottom', 'left']);
  assert.deepEqual(normalizeDirections(undefined), ['bottom']);
  assert.equal(directionalValue({ top: 4 }, 'top', 2), 4);
  assert.equal(directionalValue({ top: 4 }, 'bottom', 2), 2);
  assert.equal(directionalValue(6, 'right', 2), 6);
  const completed = completeDirectionalRecord({ bottom: undefined }, () => ({ status: 'idle' }));
  assert.equal(completed.bottom.status, 'idle');
  assert.equal(completed.top.status, 'idle');
});

test('calculates boundaries and damped pull feedback', () => {
  const metrics = { scrollTop: 20, scrollLeft: 30, scrollHeight: 500, scrollWidth: 800, clientHeight: 100, clientWidth: 200 };
  assert.equal(boundaryDistance(metrics, 'top'), 20);
  assert.equal(boundaryDistance(metrics, 'bottom'), 380);
  assert.equal(boundaryDistance(metrics, 'left'), 30);
  assert.equal(boundaryDistance(metrics, 'right'), 570);
  assert.equal(physicalHorizontalBoundaryDistance(metrics, 'left'), 30);
  assert.equal(physicalHorizontalBoundaryDistance(metrics, 'right'), 570);
  assert.equal(physicalHorizontalBoundaryDistance({ ...metrics, scrollLeft: -600 }, 'left', true, 'negative'), 0);
  assert.equal(physicalHorizontalBoundaryDistance({ ...metrics, scrollLeft: 0 }, 'right', true, 'negative'), 0);
  assert.equal(physicalHorizontalBoundaryDistance({ ...metrics, scrollLeft: 0 }, 'left', true, 'default'), 0);
  assert.equal(physicalHorizontalBoundaryDistance({ ...metrics, scrollLeft: 600 }, 'right', true, 'default'), 0);
  assert.equal(physicalHorizontalBoundaryDistance({ ...metrics, scrollLeft: 600 }, 'left', true, 'reverse'), 0);
  assert.equal(physicalHorizontalBoundaryDistance({ ...metrics, scrollLeft: 0 }, 'right', true, 'reverse'), 0);
  assert.ok(dampPullDistance(30, 48) < 30);
  assert.ok(dampPullDistance(96, 48) < 96);
  assert.equal(pullProgress(24, 48), 0.5);
  assert.equal(pullProgress(96, 48), 1);
  assert.equal(localScrollDelta({ clientHeight: 300, clientWidth: 400, getBoundingClientRect: () => ({ height: 150, width: 100 }) }, 'top', 24), 48);
  assert.equal(localScrollDelta({ clientHeight: 300, clientWidth: 400, getBoundingClientRect: () => ({ height: 150, width: 100 }) }, 'left', 24), 96);
  assert.equal(gestureStatusEnabled('idle'), true);
  assert.equal(gestureStatusEnabled('loading'), false);
  assert.equal(gestureStatusEnabled('end'), false);
  assert.equal(indicatorVisible('idle', true), false);
  assert.equal(indicatorVisible('idle', false), true);
  assert.equal(indicatorVisible('idle', false, true), false);
  for (const status of ['pulling', 'ready', 'loading', 'error', 'end']) {
    assert.equal(indicatorVisible(status, true), true, `${status} remains visible in automatic mode`);
  }
  assert.equal(statusAfterCancellation('loading'), 'idle');
  assert.equal(statusAfterCancellation('ready'), 'idle');
  assert.equal(statusAfterCancellation('error'), 'error');
});

test('pull resistance increases continuously and progress reaches ready at the raw gesture threshold', () => {
  const threshold = 72;
  const distances = [0, 24, 48, 72, 96, 120].map(distance => dampPullDistance(distance, threshold));
  assert.equal(distances[0], 0);
  const increments = distances.slice(1).map((distance, index) => distance - distances[index]);
  assert(increments.every(increment => increment > 0));
  assert(increments.slice(1).every((increment, index) => increment < increments[index]));
  assert(dampPullDistance(10000, threshold) < threshold * 2);
  const visualThreshold = dampPullDistance(threshold, threshold);
  assert(pullProgress(dampPullDistance(71, threshold), visualThreshold) < 1);
  assert.equal(pullProgress(dampPullDistance(72, threshold), visualThreshold), 1);
  assert.equal(pullProgress(dampPullDistance(120, threshold), visualThreshold), 1);
  assert.equal(dampPullDistance(-1, threshold), 0);
  assert.equal(dampPullDistance(NaN, threshold), 0);
});

test('self-scrolling roots use scroll metrics instead of displaced sentinels', () => {
  const document = new FakeDocument();
  const root = new FakeHTMLElement(document);
  root.scrollHeight = 500;
  root.clientHeight = 100;
  root.scrollTop = 400;
  const displaced = new FakeHTMLElement(document, { left: 0, top: 0, right: 300, bottom: 180, width: 300, height: 180 });
  assert.equal(physicalBoundaryDistance(root, displaced, 'bottom', root), 0);
  root.scrollTop = 240;
  assert.equal(physicalBoundaryDistance(root, displaced, 'bottom', root), 160);
});

test('external containers convert sentinel geometry into local client coordinates', () => {
  const document = new FakeDocument();
  const root = new FakeHTMLElement(document);
  const container = new FakeHTMLElement(document, { left: 100, top: 50, right: 320, bottom: 270, width: 220, height: 220 });
  container.offsetWidth = 110;
  container.offsetHeight = 110;
  container.clientWidth = 100;
  container.clientHeight = 100;
  container.clientLeft = 5;
  container.clientTop = 5;
  const sentinel = new FakeHTMLElement(document, { left: 280, top: 220, right: 290, bottom: 240, width: 10, height: 20 });
  assert.equal(physicalBoundaryDistance(container, sentinel, 'right', root), 10);
  assert.equal(physicalBoundaryDistance(container, sentinel, 'bottom', root), 10);
});

test('real touch movement locks direction, reports readiness and commits on release', async () => {
  const harness = await gestureHarness();
  const start = touch(1, 120, 20);
  harness.controller.start(touchEvent(harness.target, [start]));
  const pulling = touchEvent(harness.target, [touch(1, 121, 45)]);
  harness.document.dispatch('touchmove', pulling);
  assert.equal(pulling.defaultPrevented, true);
  assert.equal(harness.pulls.at(-1)[0], 'top');
  assert.equal(harness.pulls.at(-1)[3], false);
  const ready = touchEvent(harness.target, [touch(1, 121, 90)]);
  harness.document.dispatch('touchmove', ready);
  assert.equal(harness.pulls.at(-1)[3], true);
  harness.document.dispatch('touchend', touchEvent(harness.target, [], [touch(1, 121, 90)]));
  assert.deepEqual(harness.commits, ['top']);
  assert.equal(harness.pulls.at(-1)[0], null);
  harness.controller.dispose();
});

test('multitouch, touch cancellation and cross-axis movement never commit', async () => {
  for (const reason of ['multi', 'cancel', 'cross-axis']) {
    const harness = await gestureHarness();
    const start = touch(1, 120, 20);
    harness.controller.start(touchEvent(harness.target, [start]));
    if (reason === 'multi') harness.document.dispatch('touchstart', touchEvent(harness.target, [start, touch(2, 140, 20)]));
    if (reason === 'cancel') harness.document.dispatch('touchcancel', touchEvent(harness.target, []));
    if (reason === 'cross-axis') harness.document.dispatch('touchmove', touchEvent(harness.target, [touch(1, 180, 22)]));
    harness.document.dispatch('touchend', touchEvent(harness.target, [], [touch(1, 180, 90)]));
    assert.deepEqual(harness.commits, [], reason);
    harness.controller.dispose();
  }
});

test('externally blocked loading and end states cannot begin a pull gesture', async () => {
  for (const status of ['loading', 'end']) {
    const harness = await gestureHarness({ isEnabled: () => gestureStatusEnabled(status) });
    harness.controller.start(touchEvent(harness.target, [touch(1, 120, 20)]));
    harness.document.dispatch('touchmove', touchEvent(harness.target, [touch(1, 120, 90)]));
    harness.document.dispatch('touchend', touchEvent(harness.target, []));
    assert.deepEqual(harness.commits, [], status);
    assert.deepEqual(harness.pulls, [], status);
  }
});

test('page scrolling is not captured by default and horizontal system edges remain reserved', async () => {
  const page = await gestureHarness({ isExplicitlyEnabled: () => false });
  page.options.container = page.document.scrollingElement;
  page.options.container.ownerDocument = page.document;
  page.options.container.getBoundingClientRect = () => page.root.rect;
  page.options.container.clientWidth = 300;
  page.options.container.clientHeight = 300;
  page.controller.start(touchEvent(page.target, [touch(1, 120, 20)]));
  page.document.dispatch('touchmove', touchEvent(page.target, [touch(1, 120, 90)]));
  page.document.dispatch('touchend', touchEvent(page.target, []));
  assert.deepEqual(page.commits, []);

  const edge = await gestureHarness({ directions: ['left'] });
  edge.controller.start(touchEvent(edge.target, [touch(1, 8, 100)]));
  edge.document.dispatch('touchmove', touchEvent(edge.target, [touch(1, 90, 100)]));
  edge.document.dispatch('touchend', touchEvent(edge.target, []));
  assert.deepEqual(edge.commits, []);

  const natural = await gestureHarness({ isExplicitlyEnabled: () => false });
  natural.controller.start(touchEvent(natural.target, [touch(1, 120, 20)]));
  natural.document.dispatch('touchmove', touchEvent(natural.target, [touch(1, 120, 90)]));
  natural.document.dispatch('touchend', touchEvent(natural.target, []));
  assert.deepEqual(natural.commits, [], 'a naturally sized root does not capture page pull by default');
});

test('wheel input must continue beyond each edge and respects cancellation and nested ownership', async () => {
  const wheel = (target, deltaX, deltaY, extra = {}) => ({
    target, deltaX, deltaY, deltaMode: 0, ctrlKey: false, shiftKey: false,
    cancelable: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; },
    stopPropagation() {}, ...extra,
  });
  for (const direction of ['top', 'bottom', 'left', 'right']) {
    const h = await gestureHarness({ directions: [direction] });
    h.root.scrollHeight = h.root.scrollWidth = 900;
    h.root.scrollTop = h.root.scrollLeft = 300;
    const horizontal = direction === 'left' || direction === 'right';
    const sign = direction === 'top' || direction === 'left' ? -1 : 1;
    const send = (amount, extra) => {
      const event = wheel(h.target, horizontal ? sign * amount : 0, horizontal ? 0 : sign * amount, extra);
      h.controller.wheel(event);
      return event;
    };
    assert.equal(send(48).defaultPrevented, false, 'ordinary scrolling is native');
    assert.equal(h.pulls.length, 0);
    h.root.scrollTop = direction === 'bottom' ? 600 : 0;
    h.root.scrollLeft = direction === 'right' ? 600 : 0;
    assert.equal(h.pulls.length, 0, 'reaching a boundary alone does nothing');
    assert.equal(send(24, { ctrlKey: true }).defaultPrevented, false, 'zoom is not captured');
    assert.equal(send(24).defaultPrevented, true);
    assert.equal(h.pulls.at(-1)[3], false);
    assert.equal(send(24).defaultPrevented, true);
    assert.equal(h.pulls.at(-1)[3], true);
    await new Promise(resolve => setTimeout(resolve, 190));
    assert.deepEqual(h.commits, [direction]);
    send(48);
    h.controller.cancel();
    await new Promise(resolve => setTimeout(resolve, 190));
    assert.equal(h.commits.length, 1, 'cancellation clears the release timer');
    h.target.scrollHeight = h.target.scrollWidth = 1000;
    h.target.overflowX = h.target.overflowY = 'auto';
    assert.equal(send(48).defaultPrevented, false, 'nested scrolling remains owned by the child');
    h.controller.dispose();
  }
});

test('source contract includes request suppression, abort cleanup and stable-anchor compensation', async () => {
  const [component, gesture, styles] = await Promise.all([
    readFile(componentUrl, 'utf8'),
    readFile(gestureUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ]);
  assert.match(component, /requests\.current\.has\(direction\)/);
  assert.match(component, /directionalValue\(latest\.automatic, direction, true\)/);
  assert.match(component, /indicatorVisible\(status, directionalValue\(automatic, direction, true\), directionalValue\(gesture, direction, true\)\)/);
  assert.match(component, /data-visible=\{visible \|\| undefined\}/);
  assert.match(component, /\>\{visible && <div className="inkra-infinite-scroll__indicator-surface">/);
  assert.match(component, /<Progress aria-label=\{label\} diameter=\{32\} shape="circular" size="sm" thickness=\{3\} value=\{null\} \/>/);
  assert.match(component, /<PencilText aria-hidden="true" as="span" className="inkra-infinite-scroll__loading-label">\{label\}<\/PencilText>/);
  assert.doesNotMatch(component, /PencilSurface|PencilLine/);
  assert.match(component, /automatic,\s*children,\s*className/);
  for (const prop of ['disabled', 'gesture', 'gestureThreshold', 'hasMore', 'triggerDistance']) {
    assert.match(component, new RegExp(`\\n\\s+${prop},`), `${prop} is consumed before DOM prop spreading`);
  }
  assert.match(component, /new AbortController\(\)/);
  assert.match(component, /request\?\.controller\.abort\(\)/);
  assert.match(component, /cancelDirection\(direction, 'container-changed'\)/);
  assert.match(component, /cancelDirection\(direction, directions\.includes\(direction\) \? 'disabled' : 'direction-removed'\)/);
  assert.match(component, /statusAfterCancellation\(status\)/);
  assert.match(component, /gestureStatusEnabled\(currentState\(direction\)\.status\)/);
  assert.match(component, /if \(controller\.signal\.aborted\) return undefined;\s*return latest\.onLoad/);
  assert.match(component, /createAnchorStabilizer/);
  assert.match(component, /localScrollDelta\(container, direction, delta\)/);
  assert.match(component, /let settling = false;/);
  assert.match(component, /if \(stopped \|\| !settling\) return;/);
  assert.match(component, /settling = true;\s*schedule\(\);/);
  assert.match(component, /await committed;\s*if \(controller\.signal\.aborted\) return;\s*await anchor\.settle\(\);/);
  assert.match(component, /transition\(direction, \{ status: 'loading' \}, \{ source \}\);\s*scheduleBoundaryRef\.current\(\);/);
  assert.match(component, /const loadingDirections = activeDirections\.filter\(direction => currentState\(direction\)\.status === 'loading'\);/);
  assert.match(component, /revealed: false,\s*revealPosition,/);
  assert.match(component, /--inkra-infinite-scroll-indicator-inline-offset/);
  assert.match(component, /--inkra-infinite-scroll-indicator-block-offset/);
  assert.match(component, /--inkra-infinite-scroll-indicator-viewport-inline-size/);
  assert.match(component, /--inkra-infinite-scroll-indicator-viewport-block-size/);
  assert.doesNotMatch(component, /scrollHeight\s*[-+]\s*/);
  assert.match(component, /MutationObserver/);
  assert.match(component, /ResizeObserver/);
  assert.match(component, /completeDirectionalRecord\(\s*defaultState,/);
  assert.doesNotMatch(component, /\.\.\.defaultState/);
  assert.match(gesture, /touchcancel/);
  assert.match(gesture, /touches\.length !== 1/);
  assert.match(gesture, /passive: false/);
  assert.doesNotMatch(styles, /touch-action\s*:/);
  assert.match(styles, /\[data-visible\]\[data-direction="top"\],[\s\S]*?min-block-size: 52px;/);
  assert.match(styles, /\[data-visible\]\[data-direction="left"\],[\s\S]*?min-inline-size: 112px;/);
  assert.doesNotMatch(styles, /\[data-direction="top"\],[\s\S]*?\[data-direction="bottom"\] \{\s*inline-size: 100%;\s*min-block-size:/);
  assert.match(styles, /\.inkra-infinite-scroll__loading\s*\{[\s\S]*?display: flex;[\s\S]*?gap: var\(--inkra-space-2\);/);
  assert.match(styles, /\.inkra-infinite-scroll__loading-label \{ min-inline-size: 0; white-space: nowrap; \}/);
  assert.match(styles, /\[data-direction="right"\] \.inkra-infinite-scroll__loading \{ flex-wrap: wrap; \}/);
  assert.match(component, /if \(status === 'loading' && request && !request\.revealed\) \{\s*request\.revealed = true;[\s\S]*?Math\.abs\(currentPosition - request\.revealPosition\) <= threshold \+ 4/);
  assert.match(component, /container\.scrollBy\(direction === 'top' \|\| direction === 'bottom'/);
  assert.match(styles, /block-size: var\(--inkra-infinite-scroll-indicator-viewport-block-size\);/);
  assert.match(styles, /inline-size: var\(--inkra-infinite-scroll-indicator-viewport-inline-size\);/);
  assert.match(styles, /\[data-status="loading"\]\[data-direction="top"\]/);
  assert.match(styles, /\[data-status="loading"\]\[data-direction="right"\]/);
  assert.doesNotMatch(styles, /\.inkra-infinite-scroll__indicator\[data-direction="top"\] \.inkra-infinite-scroll__indicator-surface \{[\s\S]*?transform:/);
  assert.doesNotMatch(styles, /inkra-infinite-scroll__indicator-line/);
  assert.match(styles, /\.inkra-infinite-scroll__body\s*\{[\s\S]*?grid-row: 2;/);
  assert.match(styles, /\.inkra-infinite-scroll\s*\{[\s\S]*?grid-template-rows: auto minmax\(min-content, 1fr\) auto;/);
  assert.match(styles, /\.inkra-infinite-scroll__body\s*\{[\s\S]*?grid-template-columns: auto minmax\(min-content, 1fr\) auto;/);
  assert.doesNotMatch(styles, /grid-template-(?:rows|columns):[^;]*minmax\(0, 1fr\)/);
  assert.match(styles, /\.inkra-infinite-scroll__content\s*\{\s*grid-column: 2;\s*grid-row: 1;/);
  assert.match(styles, /\[data-direction="top"\]\s*\{ grid-row: 1; \}/);
  assert.match(styles, /\[data-direction="bottom"\]\s*\{ grid-row: 3; \}/);
  assert.match(styles, /\[data-direction="left"\],[\s\S]*?\[data-direction="right"\]\s*\{[\s\S]*?grid-row: 1;/);
  assert.match(styles, /\[data-direction="left"\]\s*\{ grid-column: 1; \}/);
  assert.match(styles, /\[data-direction="right"\]\s*\{ grid-column: 3; \}/);
  assert.match(styles, /prefers-reduced-motion/);
});
