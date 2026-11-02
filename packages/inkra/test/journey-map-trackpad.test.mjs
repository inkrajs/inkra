import assert from 'node:assert/strict';
import test from 'node:test';
import { attachJourneyTrackpad } from '../dist/journey-map/trackpad.js';

function fixture(run) {
  const before = { request: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame };
  const frames = new Map(); let serial = 0, zoom = 12, live = true;
  globalThis.requestAnimationFrame = fn => { frames.set(++serial, fn); return serial; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const handlers = new Map(), actions = [];
  const point = (x, y) => ({ x, y, divideBy: n => point(x / n, y / n) });
  const host = new EventTarget(); host.clientHeight = 900;
  const map = { options: { zoomSnap: .1 }, getPane: () => live ? {} : undefined,
    getMinZoom: () => 2, getMaxZoom: () => 20,
    getZoom() { assert.ok(live, 'No late access to a removed map'); return zoom; },
    getSize: () => point(640, 900), mouseEventToContainerPoint: e => point(e.clientX, e.clientY),
    setZoomAround(p, z) { actions.push({ point: [p.x, p.y], zoom: z }); zoom = z; map.afterZoom?.(); },
    stop() { map.afterStop?.(); }, on: (name, fn) => handlers.set(name, fn), off: name => handlers.delete(name) };
  const cleanup = attachJourneyTrackpad(host, map);
  const event = (name, fields) => { const e = new Event(name, { cancelable: true }); Object.assign(e, fields); host.dispatchEvent(e); return e; };
  const flush = () => { const work = [...frames.values()]; frames.clear(); work.forEach(fn => fn()); };
  const unload = () => { live = false; handlers.get('unload')?.(); };
  try { run({ map, actions, frames, event, flush, cleanup, unload }); }
  finally { cleanup(); globalThis.requestAnimationFrame = before.request; globalThis.cancelAnimationFrame = before.cancel; }
}

test('plain wheel remains scrolling while ctrl-wheel pinches at its actual public container point', () => fixture(({ actions, event, flush, cleanup }) => {
  assert.equal(event('wheel', { ctrlKey: false, deltaY: -40, deltaMode: 0, clientX: 90, clientY: 120 }).defaultPrevented, false);
  flush(); assert.deepEqual(actions, []);
  assert.equal(event('wheel', { ctrlKey: true, deltaY: -40, deltaMode: 0, clientX: 90, clientY: 120 }).defaultPrevented, true);
  flush(); assert.deepEqual(actions[0], { point: [90, 120], zoom: 12.600000000000001 });
  event('wheel', { ctrlKey: true, deltaY: Infinity, deltaMode: 0 }); flush(); assert.equal(actions.length, 1);
  cleanup(); event('wheel', { ctrlKey: true, deltaY: -100 }); flush(); assert.equal(actions.length, 1);
}));

test('gesture events preserve native touch ownership and queued work is inert after cleanup or synchronous removal', () => fixture(({ map, actions, frames, event, flush, cleanup, unload }) => {
  event('touchstart', { touches: [{}] }); event('gesturestart', { scale: 1 }); event('gesturechange', { scale: 2 }); flush(); assert.deepEqual(actions, []);
  event('touchend', { touches: [] }); event('gesturestart', { scale: 1, clientX: 100, clientY: 200 }); event('gesturechange', { scale: 2 }); flush();
  assert.deepEqual(actions[0], { point: [100, 200], zoom: 13 });
  event('gestureend', { scale: 2 }); flush();
  event('wheel', { ctrlKey: true, deltaY: -30, deltaMode: 0, clientX: 100, clientY: 200 });
  const late = [...frames.values()][0]; assert.ok(late); cleanup(); unload(); late(); assert.equal(actions.length, 1);
  map.afterZoom = unload;
}));

test('synchronous removal during setZoomAround or gesture stop has no follow-up map access', () => {
  fixture(({ map, actions, event, flush, unload }) => { map.afterZoom = unload; event('wheel', { ctrlKey: true, deltaY: -50, deltaMode: 0 }); assert.doesNotThrow(flush); assert.equal(actions.length, 1); });
  fixture(({ map, actions, event, flush, unload }) => { map.afterStop = unload; event('gesturestart', { scale: 1 }); event('gesturechange', { scale: 2 }); assert.doesNotThrow(flush); assert.deepEqual(actions, []); });
});
