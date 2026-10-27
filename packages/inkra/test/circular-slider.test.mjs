import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create } from 'react-test-renderer';
import { CircularSlider } from '../dist/slider/circular.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount(props) {
  const handlers = new Map();
  const captures = new Set();
  const form = {};
  const input = { form, value: '', ownerDocument: { addEventListener: (type, handler) => handlers.set(type, handler), removeEventListener: type => handlers.delete(type) } };
  const element = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 160, height: 160 }), focus() {}, setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id) };
  let renderer;
  await act(() => { renderer = create(h(CircularSlider, props), { createNodeMock: node => node.props.role === 'slider' ? element : node.type === 'input' ? input : null }); });
  const slider = () => renderer.root.findByProps({ role: 'slider' });
  const event = (angle, extra = {}) => ({ button: 0, isPrimary: true, pointerId: 7, currentTarget: element,
    clientX: 80 + Math.sin(angle * Math.PI / 180) * 54, clientY: 80 - Math.cos(angle * Math.PI / 180) * 54,
    defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra });
  return { renderer, slider, event, input, form, handlers, captures,
    dispatch: async (handler, value) => { await act(() => slider().props[handler](value)); },
    close: async () => { await act(() => renderer.unmount()); assert.equal(handlers.size, 0); assert.equal(captures.size, 0); } };
}

test('CircularSlider has scalar semantics, formatted value and a native successful form control', () => {
  const html = renderToStaticMarkup(h(CircularSlider, { defaultValue: 42, min: 10, max: 90, name: 'volume', form: 'settings', 'aria-label': 'Volume', getValueLabel: value => `${value}%` }));
  assert.match(html, /role="slider"/);
  assert.match(html, /aria-label="Volume"/);
  assert.match(html, /aria-valuenow="42"/);
  assert.match(html, /aria-valuetext="42%"/);
  const input = html.match(/<input\b[^>]*>/)?.[0] ?? '';
  for (const [attribute, expected] of Object.entries({ type: 'hidden', name: 'volume', form: 'settings', value: '42' })) {
    assert.match(input, new RegExp(`\\b${attribute}="${expected}"`));
  }
  assert.match(html, /inkra-circular-slider__thumb-surface/);
});

test('CircularSlider separates full-circle track clicks from thumb grabs, retaining thumb press offset', async () => {
  const changes = []; const commits = [];
  const mounted = await mount({ defaultValue: 100, startAngle: 0, sweepAngle: 360, onValueChange: value => changes.push(value), onValueCommit: value => commits.push(value) });
  try {
    await mounted.dispatch('onPointerDown', mounted.event(90));
    assert.equal(mounted.slider().props['aria-valuenow'], 25, 'max -> right-side track click reaches 25%');
    assert.deepEqual(commits, []);
    await mounted.dispatch('onPointerUp', mounted.event(90));
    assert.deepEqual(commits, [25]);
    changes.length = 0;
    await mounted.dispatch('onPointerDown', mounted.event(100));
    assert.deepEqual(changes, [], 'pressing inside the 44px thumb target does not jump');
    await mounted.dispatch('onPointerMove', mounted.event(110));
    assert.equal(mounted.slider().props['aria-valuenow'], 28, 'drag is relative to the thumb press offset');
    await mounted.dispatch('onPointerCancel', mounted.event(110));
    assert.deepEqual(commits, [25], 'cancel does not commit the in-progress drag');
    const previous = mounted.slider().props['aria-valuenow'];
    await mounted.dispatch('onPointerDown', mounted.event(0, { clientX: 80, clientY: 80 }));
    assert.equal(mounted.slider().props['aria-valuenow'], previous, 'center is not a track press');
  } finally { await mounted.close(); }
});

test('CircularSlider keeps controlled value authoritative while committing the final proposal', async () => {
  const changes = []; const commits = [];
  const mounted = await mount({ value: 40, startAngle: 0, sweepAngle: 360, onValueChange: value => changes.push(value), onValueCommit: value => commits.push(value) });
  try {
    await mounted.dispatch('onPointerDown', mounted.event(270));
    await mounted.dispatch('onPointerUp', mounted.event(270));
    assert.equal(mounted.slider().props['aria-valuenow'], 40);
    assert.equal(mounted.renderer.root.findByType('input').props.value, 40);
    assert.deepEqual(changes, [75]);
    assert.deepEqual(commits, [75]);
  } finally { await mounted.close(); }
});

test('CircularSlider keyboard reaches nondivisible max and steps down onto the anchored grid', async () => {
  const mounted = await mount({ min: 3, max: 14, step: 2, defaultValue: 3 });
  try {
    const key = async key => mounted.dispatch('onKeyDown', { key, preventDefault() {}, defaultPrevented: false });
    await key('End'); assert.equal(mounted.slider().props['aria-valuenow'], 14);
    await key('ArrowDown'); assert.equal(mounted.slider().props['aria-valuenow'], 13);
    await key('PageDown'); assert.equal(mounted.slider().props['aria-valuenow'], 3);
    await key('ArrowRight'); assert.equal(mounted.slider().props['aria-valuenow'], 5);
    await key('PageUp'); assert.equal(mounted.slider().props['aria-valuenow'], 14);
    await key('Home'); assert.equal(mounted.slider().props['aria-valuenow'], 3);
  } finally { await mounted.close(); }
});

test('CircularSlider native reset follows current form, honors cancellation and emits no change callbacks', async () => {
  const changes = [];
  const mounted = await mount({ defaultValue: 20, startAngle: 0, sweepAngle: 360, name: 'amount', onValueChange: value => changes.push(value) });
  try {
    await mounted.dispatch('onKeyDown', { key: 'End', preventDefault() {}, defaultPrevented: false });
    assert.deepEqual(changes, [100]);
    const cancelled = { target: mounted.form, defaultPrevented: false };
    await act(async () => { mounted.handlers.get('reset')(cancelled); cancelled.defaultPrevented = true; await new Promise(resolve => setTimeout(resolve, 5)); });
    assert.equal(mounted.slider().props['aria-valuenow'], 100);
    const replacement = {};
    mounted.input.form = replacement;
    await act(async () => { mounted.handlers.get('reset')({ target: replacement, defaultPrevented: false }); await new Promise(resolve => setTimeout(resolve, 5)); });
    assert.equal(mounted.slider().props['aria-valuenow'], 20);
    assert.equal(mounted.input.value, '20');
    assert.deepEqual(changes, [100]);
  } finally { await mounted.close(); }
});

test('CircularSlider disabled and readOnly suppress pointer and keyboard mutation', async () => {
  for (const state of ['disabled', 'readOnly']) {
    const changes = []; const mounted = await mount({ [state]: true, defaultValue: 20, onValueChange: value => changes.push(value) });
    try {
      await mounted.dispatch('onPointerDown', mounted.event(0));
      await mounted.dispatch('onPointerUp', mounted.event(0));
      await mounted.dispatch('onKeyDown', { key: 'End', preventDefault() {}, defaultPrevented: false });
      assert.equal(mounted.slider().props['aria-valuenow'], 20);
      assert.deepEqual(changes, []);
      assert.equal(mounted.renderer.root.findByType('input').props.disabled, state === 'disabled');
    } finally { await mounted.close(); }
  }
});

test('CircularSlider center slots preserve default numeric display and independent value semantics', () => {
  const icon = h('span', { 'data-test-icon': 'volume' }, 'icon');
  const render = props => renderToStaticMarkup(h(CircularSlider, { value: 42, 'aria-label': 'Volume', getValueLabel: value => `${value} percent`, ...props }));
  const plain = render({});
  assert.match(plain, /inkra-circular-slider__value/);
  assert.match(plain, /42 percent/);
  const iconOnly = render({ centerIcon: icon, showValue: false });
  assert.match(iconOnly, /data-test-icon="volume"/);
  assert.doesNotMatch(iconOnly, /inkra-circular-slider__value/);
  assert.match(iconOnly, /aria-valuetext="42 percent"/);
  const combined = render({ centerIcon: icon, centerContent: '音量' });
  assert.match(combined, /data-test-icon="volume"/);
  assert.match(combined, /音量/);
  assert.match(combined, /aria-valuenow="42"/);
  assert.match(combined, /aria-valuetext="42 percent"/);
  assert.match(combined, /class="inkra-circular-slider__center"[^>]*aria-hidden="true"[^>]*inert=""/);
  const zero = render({ centerContent: 0, showValue: false });
  assert.match(zero, /inkra-circular-slider__value/);
  assert.match(zero, />0</);
  for (const centerContent of [null, false]) {
    assert.doesNotMatch(render({ centerContent }), /class="inkra-circular-slider__center"/);
    assert.match(render({ centerIcon: icon, centerContent }), /data-test-icon="volume"/);
  }
});

test('CircularSlider passes normalized live value to custom center renderers without changing pointer behavior', async () => {
  const rendered = []; const changes = [];
  const mounted = await mount({ min: 3, max: 14, step: 2, defaultValue: 7.6,
    centerContent: value => { rendered.push(value); return h('span', { 'data-center-value': value }, `${value} / 14`); },
    onValueChange: value => changes.push(value),
  });
  try {
    assert.equal(rendered.at(-1), 7);
    assert.equal(mounted.renderer.root.findByProps({ 'data-center-value': 7 }).children[0], '7 / 14');
    await mounted.dispatch('onKeyDown', { key: 'ArrowRight', preventDefault() {}, defaultPrevented: false });
    assert.equal(rendered.at(-1), 9);
    assert.equal(mounted.renderer.root.findByProps({ 'data-center-value': 9 }).children[0], '9 / 14');
    await mounted.dispatch('onPointerDown', mounted.event(0, { clientX: 80, clientY: 80 }));
    await mounted.dispatch('onPointerUp', mounted.event(0, { clientX: 80, clientY: 80 }));
    assert.deepEqual(changes, [9]);
  } finally { await mounted.close(); }
});
