import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create } from 'react-test-renderer';

const dist = new URL(process.env.INKRA_COLLECTION_DIST ?? '../dist/', import.meta.url);
const { ChoiceGrid, ChoiceGridOption } = await import(new URL('choice-grid/index.js', dist));
const { TagInput } = await import(new URL('tag-input/index.js', dist));
const { TreeSelect } = await import(new URL('tree-select/index.js', dist));
const { Popover } = await import(new URL('overlay/index.js', dist));
const { PencilSurface } = await import(new URL('PencilSurface.js', dist));

// Deterministic wrapper/reconciliation checks, not timing or browser acceptance.
// Decoration refs remain null; the collection boundary is also rendered through
// React Aria's real server renderer rather than a fake collection implementation.
let previousActEnvironment;
before(() => { previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT; globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
after(() => {
  if (previousActEnvironment === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  else globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});
async function withRenderer(element, check, options) {
  let renderer;
  try { await act(() => { renderer = create(element, options); }); await check(renderer); }
  finally { if (renderer) await act(() => renderer.unmount()); }
}
const popupContent = renderer => renderer.root.findByType(Popover.Portal).props.children;
const popupTree = renderer => popupContent(renderer).props.children[1];
const hostClass = (renderer, name) => renderer.root.findAll(node => typeof node.type === 'string' && node.props.className?.split(' ').includes(name));
const nativeValues = renderer => renderer.root.findAllByType('input').filter(node => node.props.type === 'hidden' && node.props.name);
function clickTagRemove(renderer, position) {
  const remove = hostClass(renderer, 'inkra-tag-input__remove')[position];
  const button = { getAttribute: name => remove.props[name] };
  return hostClass(renderer, 'inkra-tag-input__list')[0].props.onClick({
    target: { closest: () => button }, currentTarget: { contains: target => target === button },
  });
}

test('TreeSelect keeps all 5,000 indexed options and current selections without rendering a closed popup', async () => {
  let labels = 0;
  const items = Array.from({ length: 5000 }, (_, index) => ({ id: String(index), label: `Item ${index}` }));
  const props = { items, multiple: true, name: 'choices', value: ['0', '4999', 'external'], renderLabel: node => { labels++; return node.label; } };
  await withRenderer(h(TreeSelect, props), async renderer => {
    assert.equal(labels, 0);
    assert.equal(popupTree(renderer).props.nodes.length, 5000);
    assert.deepEqual(nativeValues(renderer).map(node => node.props.value), ['0', '4999', 'external']);
    for (let version = 0; version < 8; version++) await act(() => renderer.update(h(TreeSelect, { ...props, value: [String(version), '4999'], title: String(version) })));
    assert.equal(labels, 0);
    assert.deepEqual([...popupTree(renderer).props.selectedSet], ['7', '4999']);
    assert.deepEqual(nativeValues(renderer).map(node => node.props.value), ['7', '4999']);
    const replacement = [...items];
    replacement[4999] = { id: '4999', label: 'Updated last item' };
    await act(() => renderer.update(h(TreeSelect, { ...props, items: replacement, value: ['4999'] })));
    assert.equal(labels, 0);
    assert.equal(popupTree(renderer).props.nodes.at(-1).label, 'Updated last item');
    assert.ok(JSON.stringify(renderer.toJSON()).includes('Updated last item'));
  });
});

test('TreeSelect mounted collection retains depth-first labels, selection, disabled nodes and filtered expansion', async () => {
  const calls = [];
  const items = [{ id: 'a', label: 'A', children: [
    { id: 'a1', label: 'First leaf', keywords: 'needle' },
    { id: 'a2', label: 'Locked leaf', disabled: true },
  ] }, { id: 'b', label: 'B' }];
  const props = { items, multiple: true, value: ['a1'], defaultExpandedIds: ['a'], renderLabel: (node, state) => { calls.push([node.id, state]); return h('strong', null, node.label); } };
  await withRenderer(h(TreeSelect, props), async renderer => {
    assert.equal(calls.length, 0);
    const html = renderToStaticMarkup(popupTree(renderer));
    assert.deepEqual(calls.map(([id]) => id), ['a', 'a1', 'a2', 'b']);
    assert.deepEqual(calls[1][1], { branch: false, disabled: false, selected: true, query: '' });
    assert.deepEqual(calls[2][1], { branch: false, disabled: true, selected: false, query: '' });
    assert.match(html, /role="treegrid"/);
    assert.match(html, /<strong>First leaf<\/strong>/);
    assert.match(html, /data-key="a1"[^>]*aria-selected="true"/);
    assert.match(html, /data-key="a2"[^>]*aria-disabled="true"/);
    await act(() => popupContent(renderer).props.children[0].props.children.props.onValueChange('needle'));
    const filteredTree = popupTree(renderer);
    assert.deepEqual([...filteredTree.props.effectiveExpanded], ['a']);
    assert.deepEqual(filteredTree.props.nodes[0].children.map(node => node.id), ['a1']);
    calls.length = 0;
    renderToStaticMarkup(filteredTree);
    assert.deepEqual(calls.map(([id]) => id), ['a', 'a1']);
    assert.ok(calls.every(([, state]) => state.query === 'needle'));
    await act(() => renderer.update(h(TreeSelect, { ...props, value: ['b'] })));
    calls.length = 0;
    renderToStaticMarkup(popupTree(renderer));
    assert.equal(calls[1][1].selected, false, 'deferred content receives the latest controlled selection');
    assert.deepEqual(nativeValues(renderer), [], 'unnamed controls do not add submitted values');
  });
});

test('TagInput reuses all tag subtrees for draft, focus and validation updates, then refreshes callbacks and form values', async () => {
  let labels = 0;
  const value = Array.from({ length: 256 }, (_, index) => ({ id: String(index), value: `value-${index}`, label: `Tag ${index}` }));
  const copy = { removeTag: tag => { labels++; return `Remove ${tag.label}`; } };
  const calls = [];
  const props = { value, name: 'tags', labels: copy, onValueChange: next => calls.push(['old', next]) };
  await withRenderer(h(TagInput, props), async renderer => {
    const initialLabels = labels;
    assert.equal(initialLabels, 256);
    const initialTagProps = hostClass(renderer, 'inkra-tag-input__tag').map(node => node.props);
    const initialHiddenProps = nativeValues(renderer).map(node => node.props);
    for (let version = 0; version < 5; version++) await act(() => renderer.update(h(TagInput, { ...props, title: String(version), validationMessage: version % 2 ? 'Check value' : undefined })));
    const input = () => renderer.root.findAllByType('input').find(node => node.props.type === 'text');
    await act(() => input().props.onChange({ defaultPrevented: false, currentTarget: { value: 'draft' } }));
    await act(() => hostClass(renderer, 'inkra-tag-input')[0].props.onFocusCapture({}));
    assert.equal(input().props.value, 'draft');
    assert.equal(labels, initialLabels);
    assert.deepEqual(hostClass(renderer, 'inkra-tag-input__tag').map(node => node.props), initialTagProps);
    assert.ok(hostClass(renderer, 'inkra-tag-input__tag').every((node, index) => node.props === initialTagProps[index]));
    assert.ok(nativeValues(renderer).every((node, index) => node.props === initialHiddenProps[index]));
    assert.deepEqual(nativeValues(renderer).map(node => node.props.value), value.map(tag => tag.value));
    const changed = [...value];
    changed[255] = { ...value[255], label: 'Updated tag' };
    await act(() => renderer.update(h(TagInput, { ...props, value: changed })));
    assert.equal(labels, initialLabels + 1, 'one immutable record change only redraws that tag');
    assert.ok(hostClass(renderer, 'inkra-tag-input__tag').slice(0, -1).every((node, index) => node.props === initialTagProps[index]));
    assert.equal(hostClass(renderer, 'inkra-tag-input__remove')[255].props['aria-label'], 'Remove Updated tag');
    await act(() => renderer.update(h(TagInput, { ...props, form: 'other-form', onValueChange: next => calls.push(['new', next]) })));
    await act(() => clickTagRemove(renderer, 255));
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'new');
    assert.deepEqual(calls[0][1], value.slice(0, -1));
    assert.equal(hostClass(renderer, 'inkra-tag-input__tag').length, 256, 'controlled removal waits for the owner');
    assert.ok(nativeValues(renderer).every(node => node.props.form === 'other-form'));
    await act(() => renderer.update(h(TagInput, { ...props, value: value.slice(1), readOnly: true, disabled: true })));
    assert.equal(hostClass(renderer, 'inkra-tag-input__tag').length, 255);
    assert.equal(hostClass(renderer, 'inkra-tag-input__remove').length, 0);
    assert.equal(nativeValues(renderer).length, 255);
    assert.ok(nativeValues(renderer).every(node => node.props.disabled));
  });
});

test('ChoiceGrid changes only affected option subtrees while retaining every native checkbox and latest callbacks', async () => {
  let renderer;
  const changes = [];
  const children = Array.from({ length: 256 }, (_, index) => h(ChoiceGridOption, {
    key: index, value: String(index), label: `Option ${index}`, form: index === 255 ? 'override-form' : undefined,
  }));
  const props = { type: 'multiple', name: 'choices', label: 'Choices', values: ['0', '1'], onValuesChange: next => changes.push(['old', next]) };
  const fieldset = { querySelectorAll: () => renderer.root.findAllByType('input').map(node => node.props) };
  const surfaces = () => renderer.root.findAllByType(PencilSurface).filter(node => node.props.className === 'inkra-choice-grid__option');
  try {
    await act(() => { renderer = create(h(ChoiceGrid, props, children), { createNodeMock: element => element.type === 'fieldset' ? fieldset : null }); });
    const before = surfaces().map(node => node.props);
    await act(() => renderer.update(h(ChoiceGrid, { ...props, values: ['0', '255'] }, children)));
    assert.equal(renderer.root.findAllByType('input').length, 256);
    assert.deepEqual(renderer.root.findAllByType('input').filter(node => node.props.checked).map(node => node.props.value), ['0', '255']);
    assert.deepEqual(surfaces().flatMap((node, index) => node.props === before[index] ? [] : [index]), [1, 255]);
    assert.equal(hostClass(renderer, 'inkra-choice-grid__focus').length, 256);
    await act(() => renderer.update(h(ChoiceGrid, { ...props, form: 'group-form', onValuesChange: next => changes.push(['new', next]) }, children)));
    const inputs = renderer.root.findAllByType('input');
    assert.equal(inputs[0].props.form, 'group-form');
    assert.equal(inputs[255].props.form, 'override-form');
    await act(() => inputs[2].props.onChange({ currentTarget: { value: '2', checked: true } }));
    assert.deepEqual(changes, [['new', ['0', '1', '2']]]);
    await act(() => renderer.update(h(ChoiceGrid, { ...props, disabled: true }, children)));
    assert.ok(renderer.root.findAllByType('input').every(node => node.props.disabled));
  } finally { if (renderer) await act(() => renderer.unmount()); }
});
