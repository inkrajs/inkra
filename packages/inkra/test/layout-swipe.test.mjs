import assert from 'node:assert/strict';
import test from 'node:test';
import { createLayoutSwipeNavigation } from '../dist/layout/swipeNavigation.js';

function fixture(t, initial = {}, { rtl = false, scale = 1 } = {}) {
  const requests = [];
  let options = { open: false, onOpenChange: value => requests.push(value), ...initial };
  const view = Object.assign(new EventTarget(), { setTimeout, clearTimeout,
    getComputedStyle: node => ({ direction: rtl ? 'rtl' : 'ltr', overflowX: node.overflowX ?? 'visible' }) });
  const doc = Object.assign(new EventTarget(), { defaultView: view });
  const root = Object.assign(new EventTarget(), { ownerDocument: doc, clientWidth: 390,
    isConnected: true, getBoundingClientRect: () => ({ left: 0, width: 390 * scale }),
    closest: selector => selector === '.inkra-layout' ? root : null });
  const controller = createLayoutSwipeNavigation(() => options);
  t.after(controller.dispose);
  const point = (x, y = 100, identifier = 1) => ({ clientX: x * scale, clientY: y * scale, identifier });
  const dispatch = (type, touches, changedTouches = touches, extra = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { touches, changedTouches, ...extra });
    doc.dispatchEvent(event);
    return event;
  };
  const start = (x, y = 100, target = root) => controller.start({ target, touches: [point(x, y)], defaultPrevented: false }, root);
  const move = (x, y = 100) => dispatch('touchmove', [point(x, y)]);
  const end = (x, y = 100) => dispatch('touchend', [], [point(x, y)]);
  return { root, doc, view, requests, point, dispatch, start, move, end, controller,
    configure: next => { options = { ...options, ...next }; } };
}

test('swipes use logical start/end sides, RTL and inverse close directions', t => {
  for (const side of ['start', 'end']) for (const rtl of [false, true]) for (const open of [false, true]) {
    const f = fixture(t, { side, open }, { rtl });
    const right = (side === 'end') !== rtl;
    const x = open ? 195 : right ? 380 : 10;
    const destination = x + (right ? -1 : 1) * (open ? -1 : 1) * 80;
    f.start(x);
    assert(f.move(destination).defaultPrevented);
    f.end(destination);
    assert.deepEqual(f.requests, [!open]);
  }
});

test('closed navigation only starts at its edge and respects custom distances', t => {
  const f = fixture(t, { edgeWidth: 16, threshold: 64 });
  f.start(30); f.move(150); f.end(150);
  f.start(10); f.move(60); f.end(60);
  assert.deepEqual(f.requests, []);
  f.start(10); f.move(80); f.end(80);
  assert.deepEqual(f.requests, [true]);
});

test('vertical, diagonal, reversed, short and noncancelable movement never commits', t => {
  for (const [x, y] of [[12, 200], [90, 200], [0, 100], [35, 100]]) {
    const f = fixture(t);
    f.start(10); f.move(x, y); f.end(x, y);
    assert.deepEqual(f.requests, []);
  }
  const f = fixture(t);
  f.start(10);
  assert.equal(f.move(12, 200).defaultPrevented, false);
  f.move(100); f.end(100);
  assert.deepEqual(f.requests, [], 'vertical ownership stays canceled even after turning');
  f.start(10); f.move(100); f.move(20); f.end(20);
  assert.deepEqual(f.requests, [], 'returning below the threshold cancels');
  f.start(10);
  f.doc.dispatchEvent(Object.assign(new Event('touchmove', { cancelable: false }), { touches: [f.point(100)] }));
  f.end(100);
  assert.deepEqual(f.requests, []);
});

test('multitouch, touchcancel, blur and removal cancel pending gestures', t => {
  for (const reason of ['multi', 'cancel', 'blur', 'remove']) {
    const f = fixture(t);
    f.start(10); f.move(100);
    if (reason === 'multi') f.dispatch('touchstart', [f.point(100), f.point(120, 100, 2)]);
    if (reason === 'cancel') f.dispatch('touchcancel', []);
    if (reason === 'blur') f.view.dispatchEvent(new Event('blur'));
    if (reason === 'remove') f.root.isConnected = false;
    f.end(100);
    assert.deepEqual(f.requests, []);
    assert.equal(f.move(120).defaultPrevented, false, 'document listener was removed');
  }
});

test('editable controls, ignored tools, nested layouts and horizontal scroll own their touches', t => {
  for (const reason of ['ignored', 'nested', 'scroll']) {
    const f = fixture(t, { open: true });
    const target = { parentElement: f.root, clientWidth: 20, scrollWidth: 100, overflowX: reason === 'scroll' ? 'auto' : 'visible',
      closest: selector => selector === '.inkra-layout' ? (reason === 'nested' ? {} : f.root) : (reason === 'ignored' ? {} : null) };
    f.start(200, 100, target);
    assert.equal(f.move(100).defaultPrevented, false);
    f.end(100);
    assert.deepEqual(f.requests, []);
  }
});

test('controlled rejection allows retry, while disabled or changed ownership cancels', t => {
  const f = fixture(t);
  for (let i = 0; i < 2; i++) { f.start(10); f.move(100); f.end(100); }
  assert.deepEqual(f.requests, [true, true]);
  for (const next of [{ enabled: false }, { side: 'end' }, { open: true }]) {
    const g = fixture(t);
    g.start(10); g.move(100); g.configure(next); g.end(100);
    assert.deepEqual(g.requests, []);
  }
  f.configure({ enabled: false });
  f.start(10); assert.equal(f.move(100).defaultPrevented, false); f.end(100);
  assert.equal(f.requests.length, 2);
});

test('local CSS distance stays consistent under scale and invalid config falls back', t => {
  const f = fixture(t, { edgeWidth: NaN, threshold: -1 }, { scale: 0.5 });
  f.start(10); f.move(70); f.end(70);
  assert.deepEqual(f.requests, [true]);
});

test('swipes suppress the resulting touch click, not taps, mouse or keyboard clicks', t => {
  const f = fixture(t, { open: true });
  const click = (detail, pointerType) => {
    const event = Object.assign(new Event('click', { cancelable: true }), { detail, pointerType });
    f.root.dispatchEvent(event);
    return event.defaultPrevented;
  };
  f.start(200); f.end(200);
  assert.equal(click(1, 'touch'), false);
  f.start(200); f.move(100); f.end(100);
  assert.equal(click(0, ''), false);
  assert.equal(click(1, 'mouse'), false);
  assert.equal(click(1, 'touch'), true);
  assert.equal(click(1, 'touch'), false);
  f.start(200); f.move(100); f.end(100);
  f.start(200); f.end(200);
  assert.equal(click(1, 'touch'), false, 'a fresh tap after a swipe is never suppressed');
  f.controller.dispose();
  assert.equal(f.move(50).defaultPrevented, false);
});
