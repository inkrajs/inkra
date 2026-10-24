import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement as h, memo, useContext } from 'react';
import { act, create } from 'react-test-renderer';
import { Combobox } from '@base-ui/react/combobox';
import { DndContext } from '@dnd-kit/core';

// A separate baseline build can exercise exactly the same deterministic scenarios.
const dist = new URL(process.env.INKRA_COLLECTION_DIST ?? '../dist/', import.meta.url);
const { ChoiceGrid, ChoiceGridOption } = await import(new URL('choice-grid/index.js', dist));
const { DataTable } = await import(new URL('data-table/index.js', dist));
const { Log } = await import(new URL('log/index.js', dist));
const { MultipleSelectContext, MultipleSelectRoot } = await import(new URL('select/MultipleSelect.js', dist));
const { SearchableSelect } = await import(new URL('select/SearchableSelect.js', dist));
const { Sortable } = await import(new URL('sortable/index.js', dist));
const { TagInput } = await import(new URL('tag-input/index.js', dist));
const { TreeSelect } = await import(new URL('tree-select/index.js', dist));
const { VirtualList } = await import(new URL('virtual-list/index.js', dist));

let previousActEnvironment;
before(() => { previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT; globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
after(() => { if (previousActEnvironment === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT; else globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment; });
async function withRenderer(element, check, options) {
  let renderer;
  try { await act(async () => { renderer = create(element, options); }); await check(renderer); }
  finally { if (renderer) await act(async () => renderer.unmount()); }
}
function viewportHarness() {
  const listeners = new Map();
  const ownerWindow = { setTimeout, clearTimeout, requestAnimationFrame: () => 1, cancelAnimationFrame() {} };
  const viewport = {
    clientHeight: 100, clientWidth: 200, scrollTop: 0, scrollLeft: 0, scrollHeight: 400000, style: {},
    ownerDocument: { defaultView: ownerWindow },
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name),
    scrollTo({ top }) { this.scrollTop = top ?? 0; },
    getBoundingClientRect: () => ({ width: 200, height: 100 }),
  };
  return { viewport, listeners, getScrollElement: () => viewport };
}

test('VirtualList invalidates keys and estimates on same-length data and estimate updates', async () => {
  const harness = viewportHarness();
  const items = [{ id: 'a', size: 40 }, { id: 'b', size: 60 }, { id: 'c', size: 80 }];
  const props = { items, itemKey: item => item.id, estimateSize: item => item.size, renderItem: ({ item, key }) => `${item.id}:${key}`, getScrollElement: harness.getScrollElement };
  await withRenderer(h(VirtualList, props), async renderer => {
    const rows = () => renderer.root.findAllByType('li').map(node => [node.props['data-item-key'], node.props.children.at(-1), node.props.style.transform]);
    await act(async () => renderer.update(h(VirtualList, { ...props, items: [...items].reverse() })));
    assert.deepEqual(rows(), [['c', 'c:c', 'translateY(0px)'], ['b', 'b:b', 'translateY(80px)'], ['a', 'a:a', 'translateY(140px)']]);
    await act(async () => renderer.update(h(VirtualList, { ...props, estimateSize: 20 })));
    assert.deepEqual(rows().map(row => row[2]), ['translateY(0px)', 'translateY(20px)', 'translateY(40px)']);
    await act(async () => renderer.update(h(VirtualList, { ...props, items: items.map(item => ({ ...item, id: `${item.id}-new` })) })));
    assert.deepEqual(rows().map(row => row[0]), ['a-new', 'b-new', 'c-new']);
  });
  assert.equal(harness.listeners.size, 0, 'external scroll observers detach on unmount');
});

test('VirtualList keeps 10,000 records bounded through repeated scroll and replacement', async () => {
  const harness = viewportHarness();
  const items = Array.from({ length: 10000 }, (_, id) => ({ id }));
  const props = { items, estimateSize: 40, itemKey: item => item.id, renderItem: ({ item }) => String(item.id), getScrollElement: harness.getScrollElement, overscan: 2 };
  await withRenderer(h(VirtualList, props), async renderer => {
    for (let index = 0; index < 12; index++) {
      await act(async () => { harness.viewport.scrollTop = index * 4000; harness.listeners.get('scroll')?.(); });
      const rows = renderer.root.findAllByType('li');
      assert.ok(rows.length > 0 && rows.length <= 8, `bounded rows: ${rows.length}`);
      assert.ok(rows.every(row => row.props['aria-setsize'] === 10000));
    }
    await act(async () => renderer.update(h(VirtualList, { ...props, items: [] })));
    assert.equal(renderer.root.findAllByType('li').length, 0);
  });
  assert.equal(harness.listeners.size, 0);
});

test('TagInput bulk paste performs linear normalized-key work and preserves ordered values', async t => {
  const publicApi = await import(new URL('index.js', dist));
  assert.equal(typeof publicApi.hasTagValue, 'function', 'retain public helper export');
  assert.equal(publicApi.hasTagValue([{ id: 'old', value: 'OLD' }], 'old', value => value.toLowerCase()), true);
  let keyCalls = 0, change;
  const candidates = Array.from({ length: 2000 }, (_, index) => `tag-${index}`);
  const props = { value: [], getTagValueKey: value => { keyCalls++; return value.toLowerCase(); }, onValueChange: (tags, details) => { change = { tags, details }; } };
  await withRenderer(h(TagInput, props), async renderer => {
    let prevented = false;
    await act(async () => renderer.root.findByType('input').props.onPaste({ defaultPrevented: false, preventDefault() { prevented = true; }, currentTarget: { selectionStart: 0, selectionEnd: 0 }, clipboardData: { getData: () => candidates.join(',') } }));
    assert.equal(prevented, true);
    assert.deepEqual(change.tags.map(tag => tag.value), candidates);
    assert.equal(change.details.inputReason, 'paste');
    assert.equal(change.details.tags.length, 2000);
    t.diagnostic(JSON.stringify({ scenario: '2000-tag paste', normalizedKeyCalls: keyCalls }));
    assert.ok(keyCalls <= 6000, `normalized-key callbacks: ${keyCalls}`);
  });
});

test('TagInput preserves transformed-value and ID duplicate rejection with partial commits', async () => {
  for (const collision of ['value', 'id', 'limit', 'invalid']) {
    let change, error, draft;
    const props = {
      value: [{ id: 'existing', value: 'OLD' }], getTagValueKey: value => value.toLowerCase(),
      maxTags: collision === 'limit' ? 2 : undefined,
      validateTag: candidate => collision === 'invalid' && candidate === 'reject' ? 'Rejected' : true,
      createTag: candidate => ({ id: collision === 'id' && candidate === 'reject' ? 'existing' : candidate, value: collision === 'value' && candidate === 'reject' ? 'old' : candidate }),
      onValueChange: tags => { change = tags; }, onValidationError: (_text, details) => { error = details; }, onInputValueChange: value => { draft = value; },
    };
    await withRenderer(h(TagInput, props), async renderer => {
      const input = renderer.root.findAllByType('input').find(node => node.props.type !== 'hidden');
      await act(async () => input.props.onPaste({ defaultPrevented: false, preventDefault() {}, currentTarget: {}, clipboardData: { getData: () => 'first,reject,unreached' } }));
      assert.deepEqual(change.map(tag => tag.value), ['OLD', 'first']);
      assert.equal(error.code, collision === 'limit' ? 'max-tags' : collision === 'invalid' ? 'invalid' : 'duplicate');
      assert.equal(draft, 'reject');
    });
  }
});

test('MultipleSelect context stays stable for unrelated root updates and responds to current guards', async t => {
  let observed, renders = 0, change;
  const Probe = memo(() => { observed = useContext(MultipleSelectContext); renders++; return null; });
  const props = { multiple: true, open: false, defaultValue: ['a'], items: [{ value: 'a', label: 'Alpha' }], onValueChange: next => { change = next; } };
  const child = h(Probe);
  await withRenderer(h(MultipleSelectRoot, props, child), async renderer => {
    const initial = observed, initialRenders = renders;
    for (let index = 0; index < 8; index++) await act(async () => renderer.update(h(MultipleSelectRoot, { ...props, name: `name-${index}` }, child)));
    t.diagnostic(JSON.stringify({ scenario: 'multiple selection 8 unrelated updates', consumerRenders: renders - initialRenders }));
    assert.equal(observed, initial);
    assert.equal(renders, initialRenders);
    await act(async () => observed.change(['b']));
    assert.deepEqual(observed.values, ['b']);
    assert.deepEqual(change, ['b']);
    await act(async () => renderer.update(h(MultipleSelectRoot, { ...props, readOnly: true }, child)));
    change = undefined;
    await act(async () => observed.change(['c']));
    assert.equal(change, undefined);
    assert.deepEqual(observed.values, ['b']);
    await act(async () => renderer.update(h(MultipleSelectRoot, { ...props, items: [{ value: 'a', label: 'Updated' }] }, child)));
    assert.equal(observed.labels.get('a'), 'Updated');
    assert.deepEqual(observed.values, ['b']);
  });
});

test('SearchableSelect retains filter inputs across unrelated updates and refreshes changed options', async () => {
  const items = Array.from({ length: 5000 }, (_, index) => ({ value: `${index}`, label: `Option ${index}`, keywords: index === 20 ? 'special' : '' }));
  const props = { items, 'aria-label': 'Options' };
  await withRenderer(h(SearchableSelect, props), async renderer => {
    const getEngine = () => renderer.root.findByType(Combobox.Root).props;
    const initial = getEngine();
    assert.equal(initial.filter('20', 'special'), true);
    assert.equal(initial.filter('21', 'special'), false);
    for (let index = 0; index < 8; index++) await act(async () => renderer.update(h(SearchableSelect, { ...props, className: `update-${index}` })));
    assert.equal(getEngine().filter, initial.filter);
    assert.equal(getEngine().itemToStringLabel, initial.itemToStringLabel);
    assert.equal(getEngine().items, initial.items);
    await act(async () => renderer.update(h(SearchableSelect, { ...props, items: [{ value: '20', label: 'Changed', keywords: 'fresh' }] })));
    assert.notEqual(getEngine().filter, initial.filter);
    assert.equal(getEngine().filter('20', 'fresh'), true);
    assert.equal(getEngine().itemToStringLabel('20'), 'Changed');
  });
});

test('ChoiceGrid builds selected membership once for many options and refreshes controlled selection', async t => {
  let reads = 0;
  const values = new Proxy(Array.from({ length: 64 }, (_, index) => String(index)), { get(target, key, receiver) { if (/^\d+$/.test(String(key))) reads++; return Reflect.get(target, key, receiver); } });
  const children = Array.from({ length: 128 }, (_, index) => h(ChoiceGridOption, { key: index, value: String(index), label: `Option ${index}` }));
  const props = { type: 'multiple', name: 'choices', label: 'Choices', values };
  await withRenderer(h(ChoiceGrid, props, children), async renderer => {
    t.diagnostic(JSON.stringify({ scenario: '128 options, 64 selected', selectedArrayReads: reads }));
    assert.ok(reads <= 64, `selected array indexed reads: ${reads}`);
    const initialReads = reads;
    for (let index = 0; index < 5; index++) await act(async () => renderer.update(h(ChoiceGrid, { ...props, className: `update-${index}` }, children)));
    assert.equal(reads, initialReads);
    assert.equal(renderer.root.findAllByType('input').filter(node => node.props.checked).length, 64);
    await act(async () => renderer.update(h(ChoiceGrid, { ...props, values: ['127'], disabled: true }, children)));
    const checked = renderer.root.findAllByType('input').filter(node => node.props.checked);
    assert.equal(checked.length, 1);
    assert.equal(checked[0].props.value, '127');
    assert.equal(checked[0].props.disabled, true);
  });
});

test('Log reuses derived arrays while scrolling and pausing but invalidates changed records', async t => {
  let filters = 0, maps = 0;
  const raw = Array.from({ length: 300 }, (_, index) => ({ id: String(index), level: index % 2 ? 'info' : 'error', content: `Record ${index}` }));
  const items = new Proxy(raw, { get(target, key, receiver) { if (key === 'filter') filters++; if (key === 'map') maps++; return Reflect.get(target, key, receiver); } });
  const props = { items, levels: [{ value: 'info', label: 'Info' }, { value: 'error', label: 'Error' }], filteredLevels: ['info'] };
  await withRenderer(h(Log, props), async renderer => {
    assert.equal(renderer.root.findAllByType('li').length, 150);
    const counts = { filters, maps };
    for (let index = 0; index < 8; index++) {
      const viewport = renderer.root.findAllByType('div').find(node => node.props.className === 'inkra-log__viewport');
      await act(async () => viewport.props.onScroll({ currentTarget: { scrollHeight: 1000, clientHeight: 100, scrollTop: index % 2 ? 900 : 0 } }));
    }
    await act(async () => renderer.update(h(Log, { ...props, paused: true })));
    t.diagnostic(JSON.stringify({ scenario: '300 log records, 8 scroll changes + pause', extraFilters: filters - counts.filters, extraIdMaps: maps - counts.maps }));
    assert.deepEqual({ filters, maps }, counts);
    await act(async () => renderer.update(h(Log, { ...props, items: [...raw, { id: 'new', level: 'info', content: 'New record' }] })));
    assert.equal(renderer.root.findAllByType('li').length, 151);
    await act(async () => renderer.update(h(Log, { ...props, filteredLevels: ['error'] })));
    assert.equal(renderer.root.findAllByType('li').length, 150);
    assert.ok(renderer.root.findAllByType('li').every(node => node.props['data-level'] === 'error'));
  });
  const scrolls = [];
  const viewport = { scrollHeight: 1000, clientHeight: 100, scrollTop: 900, scrollTo: options => scrolls.push(options) };
  const records = ids => ids.map(id => ({ id, content: id }));
  const view = (ids, paused = false) => h(Log, { items: records(ids), paused });
  await withRenderer(view(['a', 'b']), async renderer => {
    assert.equal(scrolls.length, 1);
    await act(async () => renderer.update(view(['a\u0000b'])));
    assert.equal(scrolls.length, 1, 'replacement does not count as append');
    await act(async () => renderer.update(view(['a\u0000b', 'c'])));
    assert.equal(scrolls.length, 2, 'colliding joined IDs still update the previous snapshot');
    await act(async () => renderer.update(view(['a\u0000b', 'c'], true)));
    await act(async () => renderer.update(view(['a\u0000b', 'c', 'd'], true)));
    assert.equal(scrolls.length, 2, 'paused append does not follow');
    await act(async () => renderer.update(view(['a\u0000b', 'c', 'd'])));
    assert.equal(scrolls.length, 3, 'resume follows latest once');
    const host = renderer.root.findAllByType('div').find(node => node.props.className === 'inkra-log__viewport');
    await act(async () => host.props.onScroll({ currentTarget: { ...viewport, scrollTop: 0 } }));
    await act(async () => renderer.update(view(['a\u0000b', 'c', 'd', 'e'])));
    assert.equal(scrolls.length, 3, 'scrolling away suspends append follow');
  }, { createNodeMock: element => element.type === 'div' && element.props.className === 'inkra-log__viewport' ? viewport : null });
});

test('DataTable malformed pagination cannot enter the NaN correction update loop', async () => {
  const data = [], columns = [{ accessorKey: 'id', header: 'ID' }];
  for (const pageSize of [0, -1, NaN, Infinity]) {
    let corrections = 0;
    await withRenderer(h(DataTable, { data, columns, getRowId: row => row.id, pagination: true, defaultPagination: { pageIndex: NaN, pageSize }, onPaginationChange() { if (++corrections > 4) throw new Error('Unbounded pagination correction'); } }), async renderer => {
      assert.equal(corrections, 1);
      assert.ok(JSON.stringify(renderer.toJSON()).includes('Page 0 of 0'));
    });
  }
});

test('DataTable caches 10,000-row core model on unrelated updates and clamps a shrinking page', async () => {
  let rowIds = 0;
  const data = Array.from({ length: 10000 }, (_, id) => ({ id: String(id), label: `Row ${id}` }));
  const props = { data, columns: [{ accessorKey: 'label', header: 'Label' }], getRowId: row => { rowIds++; return row.id; }, pagination: true, defaultPagination: { pageIndex: 3, pageSize: 20 } };
  await withRenderer(h(DataTable, props), async renderer => {
    assert.equal(renderer.root.findAllByType('tbody')[0].findAllByType('tr').length, 20);
    const initial = rowIds;
    for (let index = 0; index < 6; index++) await act(async () => renderer.update(h(DataTable, { ...props, className: `update-${index}` })));
    assert.equal(rowIds, initial);
    await act(async () => renderer.update(h(DataTable, { ...props, data: data.slice(0, 5) })));
    assert.equal(renderer.root.findAllByType('tbody')[0].findAllByType('tr').length, 5);
    assert.ok(JSON.stringify(renderer.toJSON()).includes('Page 1 of 1'));
  });
});

test('TreeSelect defers collection labels to its mounted popup and keeps its inputs current', async t => {
  const calls = [];
  const items = [{ id: 'a', label: 'A', children: [{ id: 'a1', label: 'A1' }] }, { id: 'b', label: 'B' }];
  const props = { items, value: ['a1'], multiple: true, renderLabel: (node, state) => { calls.push([node.id, state.selected]); return node.label; } };
  await withRenderer(h(TreeSelect, props), async renderer => {
    assert.deepEqual(calls, [], 'closed popup does not construct its collection');
    const { Popover } = await import(new URL('overlay/index.js', dist));
    const tree = () => renderer.root.findByType(Popover.Portal).props.children.props.children[1];
    assert.deepEqual(tree().props.nodes.map(node => node.id), ['a', 'b']);
    assert.deepEqual(tree().props.nodes[0].children.map(node => node.id), ['a1']);
    assert.deepEqual([...tree().props.selectedSet], ['a1']);
    for (let index = 0; index < 8; index++) await act(async () => renderer.update(h(TreeSelect, { ...props, className: `update-${index}` })));
    t.diagnostic(JSON.stringify({ scenario: '3-node tree, 8 unrelated updates', labelCalls: calls.length }));
    assert.equal(calls.length, 0);
    await act(async () => renderer.update(h(TreeSelect, { ...props, value: ['b'] })));
    assert.equal(calls.length, 0);
    assert.deepEqual([...tree().props.selectedSet], ['b']);
  });
});

test('Sortable avoids repeated no-op drag projections and preserves cancel/move callbacks', async t => {
  const containers = [{ id: 'left', items: [{ id: 'a' }, { id: 'b' }] }, { id: 'right', items: [{ id: 'c' }] }];
  let renders = 0, change;
  const props = { containers, getItemId: item => item.id, renderItem: ({ item }) => { renders++; return item.id; }, onChange: (next, details) => { change = { next, details }; } };
  const active = { id: 'inkra-sortable-item:string:a', data: { current: { type: 'inkra-sortable-item', containerId: 'left', itemId: 'a' } }, rect: { current: { initial: { width: 100 }, translated: null } } };
  const target = { id: 'inkra-sortable-container:string:right', data: { current: { type: 'inkra-sortable-container', containerId: 'right' } }, rect: { top: 0, left: 0, width: 100, height: 100 } };
  await withRenderer(h(Sortable, props), async renderer => {
    const engine = () => renderer.root.findByType(DndContext.type ?? DndContext).props;
    await act(async () => engine().onDragStart({ active }));
    const initialRenders = renders;
    for (let index = 0; index < 10; index++) await act(async () => engine().onDragOver({ active, over: null }));
    t.diagnostic(JSON.stringify({ scenario: '3 sortable items, 10 no-target drag updates', extraItemRenders: renders - initialRenders }));
    assert.equal(renders, initialRenders);
    await act(async () => engine().onDragOver({ active, over: target }));
    const movedRenders = renders;
    for (let index = 0; index < 10; index++) await act(async () => engine().onDragOver({ active, over: target }));
    assert.equal(renders, movedRenders);
    await act(async () => engine().onDragEnd({ active, over: target }));
    assert.equal(change.details.type, 'move');
    assert.deepEqual(change.next.map(container => container.items.map(item => item.id)), [['b'], ['c', 'a']]);
    assert.deepEqual(containers.map(container => container.items.map(item => item.id)), [['a', 'b'], ['c']]);
    change = undefined;
    await act(async () => engine().onDragStart({ active }));
    await act(async () => engine().onDragCancel({ active }));
    assert.equal(change, undefined);
  });
});

test('Select multiple closed controls preserve clear and readonly updates', async () => {
  const { Select } = await import(new URL('select/Select.js', dist));
  for (const multiple of [true]) {
    let change;
    const items = Array.from({ length: 1000 }, (_, index) => ({ value: String(index), label: `Option ${index}` }));
    const props = { open: false, multiple, value: multiple ? ['0'] : '0', items: multiple ? items : undefined, onValueChange: next => { change = next; } };
    const content = [h(Select.Trigger, { key: 'trigger', 'aria-label': 'Selection' }, h(Select.Value, null, 'Selected')), multiple ? h(Select.Clear, { key: 'clear', 'aria-label': 'Clear' }) : null];
    await withRenderer(h(Select.Root, props, content), async renderer => {
      for (let index = 0; index < 10; index++) await act(async () => renderer.update(h(Select.Root, { ...props, value: multiple ? [String(index)] : String(index) }, content)));
      if (multiple) {
        const clear = () => renderer.root.findAllByType('button').find(node => node.props['aria-label'] === 'Clear');
        await act(async () => clear().props.onClick({ defaultPrevented: false }));
        assert.deepEqual(change, []);
        await act(async () => renderer.update(h(Select.Root, { ...props, readOnly: true }, content)));
        assert.equal(clear().props.disabled, true);
      }
      const trigger = renderer.root.findAllByType('button').find(node => node.props['aria-label'] === 'Selection');
      assert.equal(trigger.props.role, 'combobox');
      assert.equal(trigger.props['aria-expanded'], false);
    });
  }
});

test('Transfer reuses active filtering for a 512-record selection update', async () => {
  const { Transfer } = await import(new URL('transfer/index.js', dist));
  const { Input } = await import(new URL('form/Input.js', dist));
  const { Checkbox } = await import(new URL('selection/Checkbox.js', dist));
  const items = Array.from({ length: 512 }, (_, index) => ({ id: String(index), label: `Record ${index}` }));
  let filters = 0;
  const props = { items, targetKeys: items.slice(0, 128).map(item => item.id), filterItem: item => { filters++; return Number(item.id) % 2 === 0; } };
  await withRenderer(h(Transfer, props), async renderer => {
    await act(async () => renderer.root.findAllByType(Input)[0].props.onValueChange('query'));
    assert.equal(filters, 384);
    const select = renderer.root.findAllByType(Checkbox).find(node => node.props.label === 'Select all visible available items');
    await act(async () => select.props.onCheckedChange(true));
    for (let index = 0; index < 5; index++) await act(async () => renderer.update(h(Transfer, { ...props, className: `update-${index}` })));
    assert.equal(filters, 384);
    await act(async () => renderer.update(h(Transfer, { ...props, items: [...items] })));
    assert.equal(filters, 768);
  });
});

test('Sortable model preserves all identities through repeated moves in 5,000 records', async () => {
  const { projectSortableMove } = await import(new URL('sortable/model.js', dist));
  const original = Array.from({ length: 10 }, (_, index) => ({ id: `group-${index}`, items: Array.from({ length: 500 }, (_, offset) => ({ id: index * 500 + offset })) }));
  let current = original;
  for (let index = 0; index < 20; index++) current = projectSortableMove(current, index, item => item.id, { overContainerId: `group-${index % 9 + 1}` });
  assert.equal(new Set(current.flatMap(container => container.items.map(item => item.id))).size, 5000);
  assert.equal(current.reduce((total, container) => total + container.items.length, 0), 5000);
  assert.equal(original[0].items.length, 500);
  assert.deepEqual(original[0].items.slice(0, 20).map(item => item.id), Array.from({ length: 20 }, (_, index) => index));
});
