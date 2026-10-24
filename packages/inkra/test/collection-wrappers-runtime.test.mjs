import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement as h, useEffect } from 'react';
import { act, create } from 'react-test-renderer';
const dist = new URL(process.env.INKRA_COLLECTION_DIST ?? '../dist/', import.meta.url);
const { Alert, Avatar, Card, Table } = await import(new URL('content/index.js', dist));
const { Command } = await import(new URL('command/index.js', dist));
const { OverflowList } = await import(new URL('overflow-list/index.js', dist));
const { calculateOverflowListLayout } = await import(new URL('overflow-list/layout.js', dist));
const { Tree } = await import(new URL('tree/index.js', dist));
const { PencilSurface } = await import(new URL('PencilSurface.js', dist));

// These are React reconciliation/contract tests, not browser acceptance or paint benchmarks.
// Decoration host refs stay null. OverflowList uses explicitly synthetic geometry and observers.
let previousActEnvironment;
before(() => {
  previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});
after(() => {
  if (previousActEnvironment === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  else globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});
const hostWith = (renderer, name, value) => renderer.root.findAll(node => typeof node.type === 'string' && node.props[name] === value);
const hostClass = (renderer, name) => renderer.root.findAll(node => typeof node.type === 'string' && node.props.className?.split(' ').includes(name));

function mountCounter() {
  const counts = { mounts: 0, unmounts: 0 };
  function Probe({ children }) {
    useEffect(() => { counts.mounts++; return () => { counts.unmounts++; }; }, []);
    return h('span', { 'data-probe': true }, children);
  }
  return { counts, Probe };
}

function setGlobals(values) {
  const prior = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  return () => {
    for (const [key, descriptor] of prior) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  };
}

test('Card: 128 composed cards keep child identity and propagate divider context across 12 updates', async () => {
  const { Probe, counts } = mountCounter();
  const view = version => h('main', null, Array.from({ length: 128 }, (_, id) => h(Card.Root, { key: id, divided: version % 2 === 0, 'data-card': id },
    h(Card.Header, { action: h('button', { type: 'button' }, 'Edit') }, h(Card.Title, { as: 'h2' }, `Card ${id}`), h(Card.Description, null, `Version ${version}`)),
    h(Card.Content, { padding: 'none' }, h(Probe, null, `Body ${version}`)),
    h(Card.Footer, { divided: true, orientation: 'vertical' }, 'Footer'))));
  let renderer;
  try {
    await act(() => { renderer = create(view(0)); });
    const seeds = renderer.root.findAllByType(PencilSurface).map(node => node.props.seed);
    for (let version = 1; version <= 12; version++) {
      await act(() => renderer.update(view(version)));
      assert.equal(hostClass(renderer, 'inkra-card__divider').length, version % 2 ? 128 : 256);
      assert.equal(hostClass(renderer, 'inkra-card__content')[0].props['data-padding'], 'none');
      assert.equal(renderer.root.findAllByType('h2').length, 128);
    }
    assert.deepEqual(renderer.root.findAllByType(PencilSurface).map(node => node.props.seed), seeds);
    assert.deepEqual(counts, { mounts: 128, unmounts: 0 });
  } finally { if (renderer) await act(() => renderer.unmount()); }
  assert.equal(counts.unmounts, 128);
});

test('Alert: repeated controlled updates retain current close handler; uncontrolled close unmounts content', async () => {
  const calls = [];
  const view = (version, open = true) => h('main', null, Array.from({ length: 128 }, (_, id) => h(Alert.Root, {
    key: id, open, closable: true, onOpenChange: value => calls.push([version, id, value]),
    variant: version % 2 ? 'warning' : 'info', actions: h('button', { type: 'button' }, 'Retry'),
  }, h(Alert.Title, null, `Alert ${id}`), h(Alert.Description, null, `Details ${version}`))));
  let renderer;
  try {
    await act(() => { renderer = create(view(0)); });
    for (let version = 1; version <= 8; version++) await act(() => renderer.update(view(version)));
    await act(() => hostClass(renderer, 'inkra-alert__close')[0].props.onClick());
    assert.deepEqual(calls, [[8, 0, false]]);
    assert.equal(hostClass(renderer, 'inkra-alert').length, 128, 'controlled close waits for parent');
    await act(() => renderer.update(view(9, false)));
    assert.equal(hostClass(renderer, 'inkra-alert').length, 0);
    await act(() => renderer.update(view(10)));
    assert.equal(hostClass(renderer, 'inkra-alert__description').length, 128);
    await act(() => renderer.update(h(Alert.Root, { closable: true, defaultOpen: true }, h(Alert.Title, null, 'Uncontrolled'))));
    await act(() => hostClass(renderer, 'inkra-alert__close')[0].props.onClick());
    assert.equal(renderer.toJSON(), null);
  } finally { if (renderer) await act(() => renderer.unmount()); }
});

test('Avatar: 128 image/fallback pairs preserve fallback identity and border/radius options across 12 updates', async () => {
  const { Probe, counts } = mountCounter();
  const view = version => h('main', null, Array.from({ length: 128 }, (_, id) => h(Avatar.Root, {
    key: id, radius: version % 2 ? 99 : -1, bordered: version % 2 === 0, size: 'lg',
  }, h(Avatar.Image, { src: `/avatar-${id}-${version}.png`, alt: `Person ${id}`, fit: 'contain' }),
  h(Avatar.Fallback, { role: 'img', 'aria-label': `Person ${id}` }, h(Probe, null, `P${id}`)))));
  let renderer;
  try {
    await act(() => { renderer = create(view(0)); });
    for (let version = 1; version <= 12; version++) {
      await act(() => renderer.update(view(version)));
      assert.equal(hostClass(renderer, 'inkra-avatar__fallback').length, 128);
      assert.equal(hostClass(renderer, 'inkra-avatar__outline').length, version % 2 ? 0 : 128);
      assert.equal(hostClass(renderer, 'inkra-avatar')[0].props.style['--inkra-avatar-radius'], version % 2 ? '8px' : '0px');
    }
    assert.deepEqual(counts, { mounts: 128, unmounts: 0 });
    assert.equal(renderer.root.findAllByType('img').length, 0, 'image loading is not emulated by this DOM-less renderer');
  } finally { if (renderer) await act(() => renderer.unmount()); }
});

test('Avatar.Fallback: repeated delay updates cancel prior timers and unmount cancels the final timer', async () => {
  let id = 0;
  const timers = new Map();
  const restore = setGlobals({ window: { setTimeout: callback => { timers.set(++id, callback); return id; }, clearTimeout: key => timers.delete(key) } });
  let renderer;
  try {
    const view = delayMs => h(Avatar.Root, { bordered: false }, h(Avatar.Fallback, { delayMs }, 'AB'));
    await act(() => { renderer = create(view(100)); });
    for (let delay = 101; delay <= 120; delay++) {
      await act(() => renderer.update(view(delay)));
      assert.equal(timers.size, 1);
      assert.equal(hostClass(renderer, 'inkra-avatar__fallback').length, 0);
    }
    await act(() => { const callback = [...timers.values()][0]; timers.clear(); callback(); });
    assert.equal(hostClass(renderer, 'inkra-avatar__fallback').length, 1);
    await act(() => renderer.update(view(500)));
    assert.equal(timers.size, 1);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    restore();
  }
  assert.equal(timers.size, 0);
});

test('Table: 512 rows and 2048 cells retain keyed children through repeated selection/text changes', async () => {
  const { Probe, counts } = mountCounter();
  const view = version => h(Table.Container, { 'aria-label': 'Records' }, h(Table.Root, { stickyHeader: true, striped: true },
    h(Table.Caption, null, `Records ${version}`),
    h(Table.Header, null, h(Table.Row, null, Array.from({ length: 4 }, (_, id) => h(Table.Head, { key: id, align: 'end', wrap: false }, `Column ${id}`)))),
    h(Table.Body, null, Array.from({ length: 512 }, (_, id) => h(Table.Row, { key: id, selected: id === version, 'data-row': id },
      Array.from({ length: 4 }, (_, column) => h(Table.Cell, { key: column, wrap: column !== 0, verticalAlign: 'top' }, column ? `Cell ${id}:${column}:${version}` : h(Probe, null, `Row ${id}`)))))),
    h(Table.Footer, null, h(Table.Row, null, h(Table.Cell, { colSpan: 4 }, 'End')))));
  let renderer;
  try {
    await act(() => { renderer = create(view(0)); });
    for (let version = 1; version <= 8; version++) {
      await act(() => renderer.update(view(version)));
      assert.equal(renderer.root.findAllByType('td').length, 2049);
      assert.equal(hostWith(renderer, 'data-selected', true).length, 1);
      assert.equal(hostWith(renderer, 'data-selected', true)[0].props['data-row'], version);
      assert.equal(renderer.root.findAllByType('th')[0].props.scope, 'col');
    }
    assert.deepEqual(counts, { mounts: 512, unmounts: 0 });
    assert.equal(renderer.root.findAllByType('tfoot').length, 1);
    assert.equal(hostWith(renderer, 'role', 'grid').length, 0);
  } finally { if (renderer) await act(() => renderer.unmount()); }
});

test('Command: 512 items do not rerun filters for 12 unrelated updates; queries invalidate once per item', async () => {
  const restore = setGlobals({ document: { activeElement: { hasAttribute: () => false } } });
  let filterCalls = 0;
  const selected = [];
  const filter = (value, search) => { filterCalls++; return value.includes(search) ? 1 : 0; };
  const view = version => h(Command.Root, { filter, surface: version % 2 === 0, 'data-version': version },
    h(Command.Input, { placeholder: `Search ${version}` }),
    h(Command.List, null,
      h(Command.Group, { heading: 'Records' }, Array.from({ length: 512 }, (_, id) => h(Command.Item, {
        key: id, value: `item-${id}`, icon: h('span', null, '*'), shortcut: 'Enter', disabled: id === 511,
        onSelect: value => selected.push([version, value]),
      }, `Item ${id}`))),
      h(Command.Separator, { alwaysRender: true }), h(Command.Empty, null, 'No matches')));
  let renderer;
  try {
    // Keep structure stable: changing surface deliberately reparents/remounts the list.
    await act(() => { renderer = create(view(0)); });
    const initialCalls = filterCalls;
    assert.equal(initialCalls, 512);
    for (let version = 2; version <= 24; version += 2) await act(() => renderer.update(view(version)));
    assert.equal(filterCalls, initialCalls);
    assert.equal(hostWith(renderer, 'cmdk-item', '').length, 512);
    assert.equal(renderer.root.findAllByType('kbd').length, 512);
    const input = () => renderer.root.findByType('input');
    await act(() => input().props.onChange({ target: { value: 'item-51' } }));
    assert.equal(filterCalls, initialCalls + 512);
    assert.equal(hostWith(renderer, 'cmdk-item', '').length, 3);
    await act(() => hostWith(renderer, 'cmdk-item', '')[0].props.onClick());
    assert.deepEqual(selected, [[24, 'item-51']]);
    assert.equal(hostWith(renderer, 'cmdk-item', '').at(-1).props.onClick, undefined, 'disabled item has no click selection handler');
    await act(() => input().props.onChange({ target: { value: 'missing' } }));
    assert.equal(filterCalls, initialCalls + 1024);
    assert.equal(hostWith(renderer, 'cmdk-item', '').length, 0);
    assert.equal(hostWith(renderer, 'cmdk-empty', '').length, 1);
    assert.equal(hostWith(renderer, 'cmdk-separator', '').length, 1);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    restore();
  }
});

test('Command.Root: repeated composition events preserve caller handlers and prevent IME Enter', async () => {
  const observed = [];
  let renderer;
  const view = version => h(Command.Root, { surface: false,
    onCompositionStartCapture: () => observed.push(['start', version]),
    onCompositionEndCapture: () => observed.push(['end', version]),
    onKeyDown: event => observed.push(['key', version, event.defaultPrevented]),
  }, h(Command.Shortcut, null, 'K'));
  const event = (key, extra = {}) => ({ key, nativeEvent: {}, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra });
  try {
    await act(() => { renderer = create(view(0)); });
    for (let version = 1; version <= 20; version++) {
      await act(() => renderer.update(view(version)));
      const root = hostWith(renderer, 'cmdk-root', '')[0];
      root.props.onCompositionStartCapture({});
      const composingEnter = event('Enter');
      root.props.onKeyDown(composingEnter);
      assert.equal(composingEnter.defaultPrevented, true);
      root.props.onCompositionEndCapture({});
      const ordinaryKey = event('a');
      root.props.onKeyDown(ordinaryKey);
      assert.equal(ordinaryKey.defaultPrevented, false);
    }
    assert.deepEqual(observed.slice(-4), [['start', 20], ['key', 20, true], ['end', 20], ['key', 20, false]]);
  } finally { if (renderer) await act(() => renderer.unmount()); }
});

test('Tree wrappers: 10000 pure delegation/state callbacks retain live state and only active decorations', () => {
  // React Aria's complete Tree uses a ReactDOM collection portal unsupported by react-test-renderer.
  // Exercise the pure Inkra wrapper boundary without pretending this mounts a Tree or tests navigation.
  const items = [{ id: 'alpha' }];
  const ref = { current: null };
  const root = Tree.Root.render({ items, 'aria-label': 'Tree', indent: Number.NaN, emptyState: 'Nothing' }, ref);
  assert.equal(root.props.items, items);
  assert.equal(root.props.ref, ref);
  assert.equal(root.props.selectionMode, 'single');
  assert.equal(root.props.style['--inkra-tree-indent'], '24px');
  assert.equal(root.props.renderEmptyState().props.children, 'Nothing');
  assert.equal(Tree.Root.render({ indent: -10 }, ref).props.style['--inkra-tree-indent'], '0px');
  const item = Tree.Item.render({ id: 'alpha', textValue: 'Alpha', className: 'custom' }, ref);
  assert.equal(item.props.id, 'alpha');
  assert.equal(item.props.ref, ref);
  let callbackCalls = 0;
  const wrapped = Tree.ItemContent.render({
    children: state => { callbackCalls++; return `Selected ${state.isSelected}`; },
    icon: state => { callbackCalls++; return state.isDisabled ? 'locked' : null; },
    disclosureIcon: state => { callbackCalls++; return state.isExpanded ? 'expanded' : 'collapsed'; },
  }, ref);
  for (let version = 0; version < 10000; version++) {
    const selected = version % 2 === 0;
    const result = wrapped.props.children({ id: 'alpha', level: 2, hasChildItems: true, isExpanded: selected, isSelected: selected, isFocusVisible: false, isDisabled: !selected });
    assert.equal(result.props['data-selected'], selected || undefined);
    assert.equal(result.props['data-has-icon'], !selected || undefined);
    assert.equal(result.props.children.filter(child => child?.type === PencilSurface).length, Number(selected));
    assert.equal(result.props.children.at(-1).props.children, `Selected ${selected}`);
    const disclosure = result.props.children[2];
    assert.equal(disclosure.props['aria-label'], selected ? 'Collapse item' : 'Expand item');
  }
  assert.equal(callbackCalls, 30000);
  assert.equal(Tree.ItemTitle.render({ children: 'Title' }, ref).props.className, 'inkra-tree__title');
  const description = h('em', null, 'Description');
  assert.equal(Tree.ItemDescription.render({ children: description }, ref).props.children, description);
});

function overflowHarness() {
  let frameId = 0;
  const frames = new Map();
  const observers = [];
  const nodes = new Map();
  const geometry = { width: 90, itemWidth: 20, triggerWidth: 10, itemWidths: new Map() };
  let reads = 0;
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
    observe(node) { this.targets.add(node); }
    unobserve(node) { this.targets.delete(node); }
    disconnect() { this.targets.clear(); }
  }
  const getComputedStyle = () => ({ columnGap: '0', length: 0, direction: 'ltr' });
  const restore = setGlobals({
    document: { activeElement: { hasAttribute: () => false }, addEventListener() {}, removeEventListener() {} },
    window: { requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; }, cancelAnimationFrame: id => frames.delete(id), addEventListener() {}, removeEventListener() {}, getComputedStyle },
    ResizeObserver: Observer, getComputedStyle,
  });
  function createNodeMock(element) {
    let key = element.props['data-overflow-list-item'];
    if (element.props.className === 'inkra-overflow-list') key = 'root';
    if (element.type === 'button') key = 'button';
    if (key === undefined) return null;
    key = String(key);
    // A real host element retains identity across callback-ref replacements.
    if (!nodes.has(key)) nodes.set(key, { key,
      getBoundingClientRect: () => { reads++; return { width: key === 'root' ? geometry.width : key === 'button' ? geometry.triggerWidth : geometry.itemWidths.get(key) ?? geometry.itemWidth }; },
      contains: () => false, focus() {}, closest: () => null,
    });
    return nodes.get(key);
  }
  async function flush() {
    let rounds = 0;
    while (frames.size) {
      assert.ok(rounds++ < 12, 'layout should settle rather than schedule an endless frame loop');
      await act(() => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); });
    }
  }
  return { createNodeMock, flush, frames, geometry, nodes, observers, restore, reads: () => reads, active: () => observers.filter(observer => observer.targets.size) };
}

test('OverflowList: 2000 items coalesce resize storms, skip unrelated measurements, and clean up', async () => {
  const harness = overflowHarness();
  const items = Array.from({ length: 2000 }, (_, id) => ({ id, label: `Item ${id}` }));
  const changes = [];
  const props = { items, onOverflowChange: value => changes.push(value) };
  let renderer;
  try {
    await act(() => { renderer = create(h(OverflowList, props), { createNodeMock: harness.createNodeMock }); });
    await harness.flush();
    assert.equal(hostClass(renderer, 'inkra-overflow-list__item').length, 4);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].overflowItems.length, 1996);
    const initialReads = harness.reads();
    const initialObservers = harness.observers.length;
    for (let version = 1; version <= 12; version++) await act(() => renderer.update(h(OverflowList, { ...props, title: `Version ${version}` })));
    assert.equal(harness.reads(), initialReads);
    assert.equal(harness.observers.length, initialObservers);
    assert.equal(changes.length, 1);
    await act(() => { for (let index = 0; index < 100; index++) harness.active()[0].callback(); });
    assert.equal(harness.frames.size, 1);
    await harness.flush();
    assert.equal(harness.reads() - initialReads, 6, 'one root + four items + one trigger read');
    assert.equal(changes.length, 1, 'unchanged layout does not repeat the notification');
    await act(() => harness.active()[0].callback());
    assert.equal(harness.frames.size, 1);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    harness.restore();
  }
  assert.equal(harness.frames.size, 0);
  assert.equal(harness.active().length, 0);
});

test('OverflowList observes newly revealed items and releases hidden items while overflow remains active', async () => {
  const harness = overflowHarness();
  const items = Array.from({ length: 20 }, (_, id) => ({ id, label: `Item ${id}` }));
  let renderer;
  try {
    await act(() => { renderer = create(h(OverflowList, { items }), { createNodeMock: harness.createNodeMock }); });
    await harness.flush();
    assert.equal(hostClass(renderer, 'inkra-overflow-list__item').length, 4);
    harness.geometry.width = 150;
    await act(() => harness.active()[0].callback());
    await harness.flush();
    assert.equal(hostClass(renderer, 'inkra-overflow-list__item').length, 7);
    const observed = new Set(harness.active().flatMap(observer => [...observer.targets].map(node => node.key)));
    for (const key of ['0', '1', '2', '3', '4', '5', '6']) assert.ok(observed.has(key), `visible item ${key} must be observed`);
    harness.geometry.width = 50;
    await act(() => harness.active()[0].callback());
    await harness.flush();
    const remaining = new Set(harness.active().flatMap(observer => [...observer.targets].map(node => node.key)));
    assert.deepEqual([...remaining].sort(), ['0', '1', 'button', 'root']);
    assert.equal(harness.active().length, 1);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    harness.restore();
  }
});


test('OverflowList reports priority partition changes even when delimiter-containing ids collide', async () => {
  const harness = overflowHarness();
  const changes = [];
  const items = [
    { id: 'a|string:b', label: 'Wide high-priority action', priority: 10 },
    { id: 'a', label: 'Small action A', priority: 1 },
    { id: 'b', label: 'Small action B', priority: 1 },
  ];
  assert.equal(['string:a', 'string:b'].join('|'), ['string:a|string:b'].join('|'));
  harness.geometry.width = 50;
  harness.geometry.itemWidths.set('a|string:b', 50);
  let renderer;
  try {
    await act(() => { renderer = create(h(OverflowList, { items, strategy: 'priority', onOverflowChange: change => changes.push(change) }), { createNodeMock: harness.createNodeMock }); });
    await harness.flush();
    assert.deepEqual(changes.at(-1).visibleItems.map(item => item.id), ['a', 'b']);
    harness.geometry.width = 60;
    await act(() => harness.active()[0].callback());
    await harness.flush();
    assert.equal(hostClass(renderer, 'inkra-overflow-list__item').length, 1);
    assert.equal(changes.length, 2, 'a different visible partition must emit a new change');
    assert.deepEqual(changes.at(-1).visibleItems.map(item => item.id), ['a|string:b']);
    assert.deepEqual(changes.at(-1).overflowItems.map(item => item.id), ['a', 'b']);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    harness.restore();
  }
});

test('OverflowList helper: 20000 items preserve ordered partitions across all strategies and width changes', () => {
  const items = Array.from({ length: 20000 }, (_, index) => ({ key: `item-${index}`, width: 10, priority: index % 7 }));
  for (const strategy of ['start', 'end', 'priority']) {
    for (const containerWidth of [0, 10, 110, 1010, 500000]) {
      const result = calculateOverflowListLayout({ items, containerWidth, gap: 0, triggerWidth: 10, strategy });
      const allVisible = containerWidth >= 200000;
      const expectedCount = allVisible ? items.length : Math.max(0, Math.floor((containerWidth - 10) / 10));
      assert.equal(result.visibleKeys.length, expectedCount);
      assert.equal(result.overflowKeys.length, items.length - expectedCount);
      const visible = new Set(result.visibleKeys);
      assert.equal(visible.size, expectedCount);
      assert.equal(result.overflowKeys.some(key => visible.has(key)), false);
      assert.deepEqual(result.visibleKeys, items.filter(item => visible.has(item.key)).map(item => item.key));
      if (strategy === 'end') assert.deepEqual(result.visibleKeys, items.slice(0, expectedCount).map(item => item.key));
      if (strategy === 'start') assert.deepEqual(result.visibleKeys, items.slice(items.length - expectedCount).map(item => item.key));
      assert.equal(result.needsTriggerMeasurement, false);
    }
  }
  const provisional = calculateOverflowListLayout({ items, containerWidth: 100, gap: 0, strategy: 'end' });
  assert.equal(provisional.needsTriggerMeasurement, true);
  assert.equal(provisional.visibleKeys.length, items.length);
  assert.equal(items[0].key, 'item-0', 'priority sorting does not mutate input order');
});
