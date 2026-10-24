import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement as h, createRef, forwardRef } from 'react';
import { act, create } from 'react-test-renderer';

const dist = new URL(process.env.INKRA_COLLECTION_DIST ?? '../dist/', import.meta.url);
const { ChoiceGrid, ChoiceGridOption } = await import(new URL('choice-grid/index.js', dist));
const { Field } = await import(new URL('form/Field.js', dist));
const { TagInput } = await import(new URL('tag-input/index.js', dist));
const { TreeSelect } = await import(new URL('tree-select/index.js', dist));
const { Tree } = await import(new URL('tree/index.js', dist));
const { Popover } = await import(new URL('overlay/index.js', dist));

// Small callback/context/ref regressions. Null decoration refs intentionally do
// not simulate layout, native browser reset, portal animation or real focus.
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
const hostClass = (renderer, name) => renderer.root.findAll(node => typeof node.type === 'string' && node.props.className?.split(' ').includes(name));
const popupContent = renderer => renderer.root.findByType(Popover.Portal).props.children;
const popupTree = renderer => popupContent(renderer).props.children[1];
const popupSearch = renderer => popupContent(renderer).props.children[0].props.children;

function dispatchTagEvent(renderer, index, handler, overrides = {}) {
  const node = hostClass(renderer, 'inkra-tag-input__remove')[index];
  const button = {
    direction: overrides.direction ?? 'ltr',
    getAttribute: name => node.props[name] == null ? null : String(node.props[name]),
  };
  const event = {
    target: { closest: () => button }, // A nested icon bubbles through its button.
    currentTarget: { contains: candidate => candidate === button },
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    ...overrides,
  };
  if (node.props[handler]) {
    event.currentTarget = button;
    node.props[handler](event);
  } else hostClass(renderer, 'inkra-tag-input__list')[0].props[handler](event);
}

test('ChoiceGrid multiple option refreshes caller callbacks and refs without losing group overrides', async () => {
  let renderer;
  const events = [];
  const firstRef = createRef(), nextRef = createRef();
  const hosts = new Map();
  const values = ['a'];
  const props = { type: 'multiple', label: 'Letters', name: 'first-name', form: 'group-first', values };
  const children = (onChange, ref) => [
    h(ChoiceGridOption, { key: 'a', id: 'option-a', value: 'a', label: 'A', onChange, ref }),
    h(ChoiceGridOption, { key: 'b', id: 'option-b', value: 'b', label: 'B', form: 'option-form', disabled: true }),
  ];
  const root = { querySelectorAll: () => renderer.root.findAllByType('input').map(node => node.props) };
  const options = { createNodeMock(element) {
    if (element.type === 'fieldset') return root;
    if (element.type !== 'input') return null;
    if (!hosts.has(element.props.id)) hosts.set(element.props.id, { id: element.props.id });
    return hosts.get(element.props.id);
  } };
  try {
    await act(() => { renderer = create(h(ChoiceGrid, { ...props, onValuesChange: next => events.push(['old-group', next]) }, children(() => events.push(['old-option']), firstRef)), options); });
    const originalInput = firstRef.current;
    assert.equal(originalInput.id, 'option-a');
    await act(() => renderer.update(h(ChoiceGrid, {
      ...props, name: 'new-name', form: 'group-next', onValuesChange: next => events.push(['new-group', next]),
    }, children(() => events.push(['new-option']), nextRef))));
    assert.equal(firstRef.current, null);
    assert.equal(nextRef.current, originalInput, 'ref replacement retains the native input identity');
    let inputs = renderer.root.findAllByType('input');
    assert.deepEqual(inputs.map(node => [node.props.name, node.props.form, node.props.disabled]), [
      ['new-name', 'group-next', false], ['new-name', 'option-form', true],
    ]);
    await act(() => inputs[0].props.onChange({ currentTarget: { checked: false } }));
    assert.deepEqual(events, [['new-option'], ['new-group', []]]);
    assert.equal(renderer.root.findAllByType('input')[0].props.checked, true, 'controlled requests do not change ownership');
    await act(() => renderer.update(h(ChoiceGrid, { ...props, disabled: true }, children(undefined, nextRef))));
    inputs = renderer.root.findAllByType('input');
    assert.ok(inputs.every(node => node.props.disabled));
  } finally { if (renderer) await act(() => renderer.unmount()); }
  assert.equal(nextRef.current, null);
});

test('ChoiceGrid single selection and latest group callback cross a memoized option subtree', async () => {
  const events = [];
  const children = ['a', 'b'].map(value => h(ChoiceGridOption, { key: value, value, label: value.toUpperCase(), onChange: () => events.push(['option', value]) }));
  const props = { name: 'letters', label: 'Letters', value: 'a', onValueChange: value => events.push(['old', value]) };
  await withRenderer(h(ChoiceGrid, props, children), async renderer => {
    await act(() => renderer.update(h(ChoiceGrid, { ...props, value: 'b', onValueChange: value => events.push(['new', value]) }, children)));
    const inputs = renderer.root.findAllByType('input');
    assert.deepEqual(inputs.map(node => [node.props.value, node.props.checked]), [['a', false], ['b', true]]);
    assert.deepEqual(hostClass(renderer, 'inkra-radio-group__item').map(node => Boolean(node.props['data-checked'])), [false, true]);
    await act(() => inputs[0].props.onChange({ currentTarget: { checked: true, value: 'a' } }));
    assert.deepEqual(events, [['option', 'a'], ['new', 'a']]);
    assert.equal(renderer.root.findAllByType('input')[1].props.checked, true);
  });
});

test('ChoiceGrid child state and cancel-aware form reset remain live across root bailouts', async () => {
  for (const mode of ['single', 'multiple']) {
    const firstForm = new EventTarget(), secondForm = new EventTarget();
    const events = [];
    const hosts = new Map();
    const root = { form: firstForm, querySelectorAll: () => [...hosts.values()] };
    const props = {
      type: mode, name: 'letters', label: 'Letters', form: 'first-form',
      ...(mode === 'multiple'
        ? { defaultValues: ['a'], onValuesChange: next => events.push(next) }
        : { defaultValue: 'a', onValueChange: next => events.push(next) }),
    };
    const children = ['a', 'b'].map(value => h(ChoiceGridOption, { key: value, id: `reset-${mode}-${value}`, value, label: value.toUpperCase(), ref: createRef() }));
    const render = (extra = {}) => h(ChoiceGrid, { ...props, ...extra }, children);
    const options = { createNodeMock(element) {
      if (element.type === 'fieldset') return root;
      if (element.type !== 'input') return null;
      if (!hosts.has(element.props.value)) hosts.set(element.props.value, {
        form: root.form, name: element.props.name, value: element.props.value,
        checked: Boolean(element.props.checked ?? element.props.defaultChecked),
      });
      return hosts.get(element.props.value);
    } };
    const reset = async (form, canceled = false) => {
      const event = new Event('reset', { cancelable: true });
      if (canceled) event.preventDefault();
      await act(async () => { form.dispatchEvent(event); await new Promise(resolve => setTimeout(resolve, 5)); });
    };
    await withRenderer(render(), async renderer => {
      await act(() => renderer.update(render()));
      const inputs = renderer.root.findAllByType('input');
      if (mode === 'single') hosts.get('a').checked = false;
      hosts.get('b').checked = true;
      await act(() => inputs[1].props.onChange({ currentTarget: hosts.get('b') }));
      const visual = () => hostClass(renderer, mode === 'single' ? 'inkra-radio-group__item' : 'inkra-checkbox').map(node => Boolean(node.props['data-checked']));
      const changed = mode === 'single' ? [false, true] : [true, true];
      assert.deepEqual(visual(), changed, `${mode} child state renders through memoized ancestors`);
      await act(() => renderer.update(render()));
      await reset(firstForm, true);
      assert.deepEqual(visual(), changed);
      root.form = secondForm;
      for (const host of hosts.values()) host.form = secondForm;
      await act(() => renderer.update(render({ form: 'second-form' })));
      await reset(firstForm);
      assert.deepEqual(visual(), changed, `${mode} old form no longer owns reset`);
      await reset(secondForm);
      assert.deepEqual(visual(), [true, false]);
      assert.deepEqual([...hosts.values()].map(node => node.checked), [true, false]);
      assert.equal(events.length, 1, `${mode} reset does not emit another change`);
    }, options);
  }
});

test('TagInput cached subtrees refresh labels, scalar class overrides, callback and Field guards', async () => {
  const events = [];
  const value = [{ id: 'a', value: 'alpha', label: 'Alpha' }, { id: 'b', value: 'beta', label: 'Beta' }];
  const classNames = { list: 'old-list', tag: 'old-tag' };
  const props = { value, name: 'tags', classNames, labels: { removeTag: tag => `Old ${tag.label}` }, onValueChange: next => events.push(['old', next]) };
  const render = (tagProps, fieldProps = {}) => h(Field, { id: 'tag-field', label: 'Tags', ...fieldProps }, h(TagInput, tagProps));
  await withRenderer(render(props), async renderer => {
    await act(() => renderer.update(render({ ...props, validationMessage: 'Unrelated validation' })));
    classNames.list = 'new-list';
    classNames.tag = 'new-tag';
    const nextProps = { ...props, labels: { tagList: 'Updated tags', removeTag: tag => `Delete ${tag.label}` }, onValueChange: next => events.push(['new', next]) };
    await act(() => renderer.update(render(nextProps)));
    assert.equal(hostClass(renderer, 'inkra-tag-input__list')[0].props['aria-label'], 'Updated tags');
    assert.equal(hostClass(renderer, 'new-list').length, 1);
    assert.equal(hostClass(renderer, 'new-tag').length, 2);
    assert.deepEqual(hostClass(renderer, 'inkra-tag-input__remove').map(node => [node.props['aria-label'], node.props.title]), [['Delete Alpha', 'Delete Alpha'], ['Delete Beta', 'Delete Beta']]);
    await act(() => dispatchTagEvent(renderer, 0, 'onClick'));
    assert.deepEqual(events, [['new', [value[1]]]]);
    await act(() => renderer.update(render(nextProps, { disabled: true })));
    const disabledButtons = hostClass(renderer, 'inkra-tag-input__remove');
    assert.ok(disabledButtons.every(node => node.props.disabled));
    await act(() => dispatchTagEvent(renderer, 1, 'onClick'));
    assert.equal(events.length, 1, 'cached remove handler observes current disabled context');
    assert.ok(renderer.root.findAllByType('input').every(node => node.props.disabled));
    await act(() => renderer.update(render(nextProps, { readOnly: true })));
    assert.equal(hostClass(renderer, 'inkra-tag-input__remove').length, 0);
    assert.equal(renderer.root.findAllByType('input').find(node => node.props.type === 'text').props.readOnly, true);
    const reordered = [{ id: 'b', value: 'changed-beta', label: 'New Beta' }, value[0]];
    await act(() => renderer.update(render({ ...nextProps, value: reordered })));
    assert.deepEqual(hostClass(renderer, 'inkra-tag-input__remove').map(node => node.props['aria-label']), ['Delete New Beta', 'Delete Alpha']);
    assert.deepEqual(renderer.root.findAllByType('input').filter(node => node.props.type === 'hidden').map(node => node.props.value), ['changed-beta', 'alpha']);
    await act(() => dispatchTagEvent(renderer, 0, 'onClick'));
    assert.deepEqual(events.at(-1), ['new', [value[0]]]);
  });
});

test('TagInput keyboard removal and focus refs use current positions after immutable reordering', async () => {
  const previousGetComputedStyle = globalThis.getComputedStyle;
  globalThis.getComputedStyle = element => ({ direction: element.direction ?? 'ltr' });
  const focus = [];
  const changes = [];
  const a = { id: 'a', value: 'alpha' }, b = { id: 'b', value: 'beta' }, c = { id: 'c', value: 'gamma' };
  const props = { value: [a, b, c], onValueChange: next => changes.push(['old', next]) };
  const options = { createNodeMock: element => element.type === 'button' && element.props.className === 'inkra-tag-input__remove'
    ? { focus: () => focus.push(element.props['aria-label']) }
    : element.type === 'input' && element.props.type === 'text' ? { focus: () => focus.push('input') } : null };
  try {
    await withRenderer(h(TagInput, props), async renderer => {
      await act(() => dispatchTagEvent(renderer, 1, 'onKeyDown', { key: 'ArrowRight' }));
      assert.equal(focus.at(-1), 'Remove gamma');
      await act(() => dispatchTagEvent(renderer, 1, 'onKeyDown', { key: 'ArrowRight', direction: 'rtl' }));
      assert.equal(focus.at(-1), 'Remove alpha', 'direction belongs to the remove button, not the delegating list');
      const focusCount = focus.length;
      await act(() => dispatchTagEvent(renderer, 1, 'onKeyDown', { key: 'Delete', defaultPrevented: true }));
      assert.equal(changes.length, 0);
      assert.equal(focus.length, focusCount);
      await act(() => renderer.update(h(TagInput, { ...props, value: [c, a, b], onValueChange: next => changes.push(['new', next]) })));
      await act(() => dispatchTagEvent(renderer, 2, 'onKeyDown', { key: 'ArrowLeft' }));
      assert.equal(focus.at(-1), 'Remove alpha');
      await act(() => dispatchTagEvent(renderer, 2, 'onKeyDown', { key: 'Delete' }));
      assert.deepEqual(changes, [['new', [c, a]]]);
      assert.equal(focus.at(-1), 'Remove alpha');
      await act(() => dispatchTagEvent(renderer, 2, 'onKeyDown', { key: 'End' }));
      assert.equal(focus.at(-1), 'input');
    }, options);
  } finally {
    if (previousGetComputedStyle === undefined) delete globalThis.getComputedStyle;
    else globalThis.getComputedStyle = previousGetComputedStyle;
  }
});

test('TagInput delegated removal ignores non-button, foreign-list and invalid-index targets', async () => {
  const changes = [];
  const props = { value: [{ id: 'a', value: 'alpha' }, { id: 'b', value: 'beta' }], onValueChange: next => changes.push(next) };
  await withRenderer(h(TagInput, props), async renderer => {
    const click = (target, contains = () => true) => hostClass(renderer, 'inkra-tag-input__list')[0].props.onClick({ target, currentTarget: { contains } });
    await act(() => click({}));
    await act(() => click({ closest: () => null }));
    const button = { getAttribute: () => '0' };
    await act(() => click({ closest: () => button }, () => false));
    for (const index of ['NaN', '-1', '0.5', '2', 'Infinity']) {
      await act(() => click({ closest: () => ({ getAttribute: () => index }) }));
    }
    assert.deepEqual(changes, []);
    await act(() => renderer.update(h(TagInput, { ...props, readOnly: true })));
    await act(() => click({ closest: () => button }));
    assert.deepEqual(changes, [], 'current readOnly state also guards delegated events');
  });
});

test('TagInput cached tags preserve canceled reset, external form reassociation and controlled ownership', async () => {
  const firstForm = new EventTarget(), secondForm = new EventTarget();
  const focus = [];
  const input = { form: firstForm, focus: () => focus.push('input') };
  const defaultValue = [{ id: 'a', value: 'alpha' }, { id: 'b', value: 'beta' }];
  const changes = [];
  const props = { defaultValue, form: 'first-form', name: 'tags', onValueChange: next => changes.push(next) };
  const options = { createNodeMock: element => element.type === 'input' && element.props.type === 'text' ? input : null };
  const values = renderer => renderer.root.findAllByType('input').filter(node => node.props.type === 'hidden').map(node => node.props.value);
  const reset = async (form, canceled = false) => {
    const event = new Event('reset', { cancelable: true });
    if (canceled) event.preventDefault();
    await act(async () => { form.dispatchEvent(event); await new Promise(resolve => setTimeout(resolve, 5)); });
  };
  await withRenderer(h(TagInput, props), async renderer => {
    await act(() => dispatchTagEvent(renderer, 0, 'onClick'));
    assert.deepEqual(values(renderer), ['beta']);
    const focusCount = focus.length;
    await reset(firstForm, true);
    assert.deepEqual(values(renderer), ['beta']);
    input.form = secondForm;
    await act(() => renderer.update(h(TagInput, { ...props, form: 'second-form' })));
    await reset(firstForm);
    assert.deepEqual(values(renderer), ['beta'], 'old form listener is detached');
    await reset(secondForm);
    assert.deepEqual(values(renderer), ['alpha', 'beta']);
    assert.equal(changes.length, 1, 'reset does not emit a user change');
    assert.equal(focus.length, focusCount, 'reset does not request focus');
    await act(() => renderer.update(h(TagInput, { ...props, form: 'second-form', value: [defaultValue[1]] })));
    await reset(secondForm);
    assert.deepEqual(values(renderer), ['beta'], 'controlled tags remain owned by the caller');
    assert.equal(changes.length, 1);
  }, options);
});

test('TreeSelect deferred wrapper forwards fresh callbacks and a live mount/unmount ref', async () => {
  const originalRoot = Tree.Root;
  let observed;
  let treeRenderer;
  const focusCalls = [];
  const events = [];
  // Probe only the Inkra forwarding boundary. React Aria collection semantics
  // remain covered by real SSR in collection-selection-subtrees-runtime.test.
  Tree.Root = forwardRef(function TreeRootForwardingProbe(props, ref) {
    observed = props;
    return h('div', { ref, 'data-tree-forwarding-probe': true });
  });
  const items = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }];
  const props = { items, multiple: true, value: ['a'], onValueChange: next => events.push(['old', next]) };
  try {
    await withRenderer(h(TreeSelect, props), async renderer => {
      const search = () => popupSearch(renderer);
      const down = () => ({ key: 'ArrowDown', preventDefault() {} });
      search().props.onKeyDown(down());
      assert.equal(focusCalls.length, 0);
      await act(() => { treeRenderer = create(popupTree(renderer), { createNodeMock: element => element.props['data-tree-forwarding-probe'] ? { focus: () => focusCalls.push('tree') } : null }); });
      const originalItems = observed.children;
      search().props.onKeyDown(down());
      assert.deepEqual(focusCalls, ['tree']);
      const nextProps = { ...props, value: ['b'], onValueChange: next => events.push(['new', next]) };
      await act(() => renderer.update(h(TreeSelect, nextProps)));
      await act(() => treeRenderer.update(popupTree(renderer)));
      assert.equal(observed.children, originalItems, 'default labels do not depend on selection');
      assert.deepEqual([...observed.selectedKeys], ['b']);
      await act(() => observed.onSelectionChange(new Set(['b', 'a'])));
      assert.deepEqual(events, [['new', ['a', 'b']]], 'selection callback retains indexed tree order');
      const labels = [];
      const renderLabel = (node, state) => { labels.push([node.id, state.selected]); return `${node.label}:${state.selected}`; };
      await act(() => renderer.update(h(TreeSelect, { ...nextProps, renderLabel })));
      await act(() => treeRenderer.update(popupTree(renderer)));
      assert.deepEqual(labels, [['a', false], ['b', true]]);
      await act(() => renderer.update(h(TreeSelect, { ...nextProps, value: ['a'], renderLabel, readOnly: true })));
      await act(() => treeRenderer.update(popupTree(renderer)));
      assert.deepEqual(labels.slice(-2), [['a', true], ['b', false]]);
      await act(() => observed.onSelectionChange(new Set(['a', 'b'])));
      assert.equal(events.length, 1, 'latest readOnly guard applies to the deferred callback');
      await act(() => treeRenderer.unmount());
      treeRenderer = undefined;
      search().props.onKeyDown(down());
      assert.deepEqual(focusCalls, ['tree'], 'unmount clears the parent tree ref');
      await act(() => { treeRenderer = create(popupTree(renderer), { createNodeMock: element => element.props['data-tree-forwarding-probe'] ? { focus: () => focusCalls.push('remounted-tree') } : null }); });
      search().props.onKeyDown(down());
      assert.deepEqual(focusCalls, ['tree', 'remounted-tree']);
    });
  } finally {
    if (treeRenderer) await act(() => treeRenderer.unmount());
    Tree.Root = originalRoot;
  }
});
