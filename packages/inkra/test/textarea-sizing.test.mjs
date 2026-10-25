import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create } from 'react-test-renderer';
import { Textarea } from '../dist/form/index.js';
import { measureTextareaSize, resolveTextareaRows, textareaResizeHeight, useTextareaSizing } from '../dist/form/textareaSizing.js';

let previousAct;
before(() => { previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT; globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
after(() => {
  if (previousAct === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  else globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
});

function eventTarget() {
  const events = new Map();
  return {
    addEventListener(type, callback) { const listeners = events.get(type) ?? new Set(); listeners.add(callback); events.set(type, listeners); },
    removeEventListener(type, callback) { events.get(type)?.delete(callback); },
    dispatch(type) { for (const callback of events.get(type) ?? []) callback(); },
    count() { return [...events.values()].reduce((sum, listeners) => sum + listeners.size, 0); },
  };
}

// Deterministic native-layout protocol fixture, not a simulated browser acceptance test.
function sizingHarness() {
  const frames = new Map();
  let frame = 0, contentRows = 1, visible = true, mirrors = 0, removed = 0;
  const computed = {
    boxSizing: 'border-box', width: '240px', lineHeight: '20px', fontSize: '15px',
    paddingTop: '8px', paddingBottom: '8px', borderTopWidth: '1px', borderBottomWidth: '1px',
    fontFamily: 'Fixture Font', letterSpacing: '0.5px', direction: 'rtl',
  };
  const fonts = { ...eventTarget(), ready: Promise.resolve() };
  const view = { ...eventTarget(), getComputedStyle: () => computed,
    requestAnimationFrame(callback) { frames.set(++frame, callback); return frame; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  const form = eventTarget();
  const document = { defaultView: view, fonts,
    body: { appendChild() { mirrors++; } },
    createElement(tag) {
      assert.equal(tag, 'textarea');
      return {
        style: {}, value: '', setAttribute(name, value) { assert.equal(name, 'aria-hidden'); assert.equal(value, 'true'); },
        get scrollHeight() {
          const padding = parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);
          const line = parseFloat(computed.lineHeight) || 24;
          return padding + (this.value === 'x' ? 1 : contentRows) * line;
        },
        remove() { removed++; },
      };
    },
  };
  const control = {
    ownerDocument: document, form, parentElement: {}, value: '', wrap: 'soft',
    scrollTop: 37, selectionStart: 2, selectionEnd: 3,
    getClientRects: () => visible ? [{}] : [],
    getBoundingClientRect: () => ({ width: parseFloat(computed.width) }),
  };
  return { control, computed, form, fonts, frames, view,
    setContentRows(rows) { contentRows = rows; }, setVisible(value) { visible = value; },
    flush() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); },
    checkCleanup() { assert.equal(mirrors, removed); assert.equal(frames.size, 0); assert.equal(fonts.count(), 0); assert.equal(form.count(), 0); assert.equal(view.count(), 0); },
  };
}

test('row options normalize invalid inputs and define rows/minRows/maxRows precedence', () => {
  assert.deepEqual(resolveTextareaRows(true), { minRows: 1, maxRows: Infinity });
  assert.deepEqual(resolveTextareaRows(true, 3), { minRows: 3, maxRows: Infinity });
  assert.deepEqual(resolveTextareaRows({ minRows: 2, maxRows: 6 }, 4), { minRows: 2, maxRows: 6 });
  assert.deepEqual(resolveTextareaRows({ minRows: 4, maxRows: 2 }), { minRows: 4, maxRows: 4 });
  for (const invalid of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.deepEqual(resolveTextareaRows({ minRows: invalid, maxRows: invalid }), { minRows: 1, maxRows: Infinity });
  }
});

test('native measurements grow, cap and shrink without touching editing state', () => {
  const fixture = sizingHarness();
  const measure = () => measureTextareaSize(fixture.control, 1, 3);
  assert.deepEqual(measure(), { minimumHeight: 38, boxAdjustment: 0, height: 38, overflowY: 'hidden' });
  fixture.setContentRows(2);
  assert.equal(measure().height, 58);
  fixture.setContentRows(8);
  assert.deepEqual(measure(), { minimumHeight: 38, boxAdjustment: 0, height: 78, overflowY: 'auto' });
  fixture.setContentRows(1);
  assert.equal(measure().height, 38);
  assert.equal(fixture.control.scrollTop, 37);
  assert.equal(fixture.control.selectionStart, 2);
  assert.equal(fixture.control.selectionEnd, 3);
  assert.equal(fixture.control.value, '');
  fixture.checkCleanup();
});

test('manual row-based resizing uses border-box ARIA bounds and converts content-box CSS height', () => {
  const fixture = sizingHarness();
  fixture.computed.boxSizing = 'content-box';
  const measured = measureTextareaSize(fixture.control, 1, Infinity);
  const minimum = measured.minimumHeight + measured.boxAdjustment;
  assert.equal(minimum, 38);
  assert.equal(textareaResizeHeight(58, minimum, 1200, measured.boxAdjustment), 40);
  assert.equal(textareaResizeHeight(0, minimum, 1200, measured.boxAdjustment), 20);
  assert.equal(textareaResizeHeight(1500, minimum, 1200, measured.boxAdjustment), 1182);
  fixture.checkCleanup();
});

test('measurement uses computed typography, padding, border and box sizing and waits for visibility', () => {
  const fixture = sizingHarness();
  fixture.computed.lineHeight = '27.5px';
  assert.equal(measureTextareaSize(fixture.control, 2, 4).minimumHeight, 73);
  fixture.computed.boxSizing = 'content-box';
  assert.equal(measureTextareaSize(fixture.control, 2, 4).minimumHeight, 55);
  fixture.computed.lineHeight = 'normal';
  assert.equal(measureTextareaSize(fixture.control, 1, 4).height, 24);
  fixture.setVisible(false);
  assert.equal(measureTextareaSize(fixture.control, 1, 4), undefined);
  fixture.checkCleanup();
});

async function withSizing(check) {
  const fixture = sizingHarness();
  const observers = [];
  const mutations = [];
  const previous = { ResizeObserver: globalThis.ResizeObserver, MutationObserver: globalThis.MutationObserver };
  globalThis.ResizeObserver = class { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } };
  globalThis.MutationObserver = class { constructor(callback) { this.callback = callback; mutations.push(this); } observe() {} disconnect() { this.disconnected = true; } };
  const ref = { current: fixture.control };
  let current, renderer;
  function Probe({ autoSize = { minRows: 1, maxRows: 3 }, rows, value, form }) {
    if (value !== undefined) fixture.control.value = value;
    current = useTextareaSizing(ref, autoSize, rows, form);
    return null;
  }
  try {
    await act(() => { renderer = create(h(Probe)); });
    await act(() => fixture.flush());
    await check({ fixture, observers, mutations, get current() { return current; },
      update: props => act(() => renderer.update(h(Probe, props))),
    });
  } finally {
    if (renderer) await act(() => renderer.unmount());
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
    assert.ok(observers.every(observer => observer.disconnected));
    assert.ok(mutations.every(observer => observer.disconnected));
    fixture.checkCleanup();
  }
}

test('sizing handles controlled rerenders, same-length inputs, native reset and disabling', async () => {
  await withSizing(async context => {
    const { fixture, update } = context;
    fixture.setContentRows(5);
    await update({ value: 'external' });
    assert.equal(context.current.style.height, 78);
    assert.equal(context.current.style.overflowY, 'auto');
    fixture.setContentRows(1);
    await update({ value: 'external' });
    assert.equal(context.current.style.height, 38);
    // A rejected controlled edit is restored before the queued measurement.
    fixture.setContentRows(5);
    context.current.schedule();
    fixture.setContentRows(1);
    await act(() => fixture.flush());
    assert.equal(context.current.style.height, 38);
    fixture.setContentRows(2);
    context.current.schedule();
    await act(() => fixture.flush());
    assert.equal(context.current.style.height, 58);
    fixture.form.dispatch('reset');
    fixture.setContentRows(1);
    await act(() => fixture.flush());
    assert.equal(context.current.style.height, 38);
    await update({ autoSize: false });
    assert.equal(context.current.style, undefined);
    assert.equal(context.current.rowSizing, false);
    const observerCount = context.observers.length;
    await update({ autoSize: false, rows: 1 });
    assert.equal(context.current.rowSizing, true);
    assert.equal(context.observers.length, observerCount, 'static rows do not attach measurement observers');
    context.current.schedule();
    assert.equal(fixture.frames.size, 0);
  });
});

test('container/font changes remeasure and height-only resize notifications do not loop', async () => {
  await withSizing(async context => {
    const { fixture, observers, mutations } = context;
    fixture.setContentRows(5);
    fixture.computed.width = '120px';
    observers[0].callback();
    observers[0].callback();
    assert.equal(fixture.frames.size, 1);
    await act(() => fixture.flush());
    assert.equal(context.current.style.height, 78);
    observers[0].callback();
    assert.equal(fixture.frames.size, 0);
    fixture.setContentRows(1);
    fixture.computed.width = '400px';
    observers[0].callback();
    await act(() => fixture.flush());
    assert.equal(context.current.style.height, 38);
    fixture.computed.lineHeight = '30px';
    fixture.fonts.dispatch('loadingdone');
    await act(() => fixture.flush());
    assert.equal(context.current.style.height, 48);
    fixture.computed.lineHeight = '40px';
    mutations[0].callback();
    await act(() => fixture.flush());
    assert.equal(context.current.style.height, 58);
  });
});

test('SSR preserves defaults and native rows while autoSize owns height and manual-resize precedence', () => {
  const render = props => renderToStaticMarkup(h(Textarea, props));
  const legacy = render({ resize: 'vertical' });
  assert.doesNotMatch(legacy, /data-row-sizing/);
  assert.match(legacy, /aria-valuemin="96"/);
  assert.match(render({ rows: 1 }), /data-row-sizing="true"/);
  assert.match(render({ rows: 1 }), /rows="1"/);
  const html = render({ autoSize: { minRows: 1, maxRows: 5 }, resize: 'vertical', defaultValue: 'notes' });
  assert.match(html, /rows="1"/);
  assert.match(html, />notes<\/textarea>/);
  assert.doesNotMatch(html, /inkra-textarea__footer|inkra-textarea__resize|autoSize=|minRows=|maxRows=/);
  const count = render({ autoSize: true, maxLength: 20, countDisplay: 'always', countMode: 'fraction', defaultValue: 'text' });
  assert.match(count, /inkra-textarea__footer/);
  assert.match(count, /4 \/ 20/);
});
