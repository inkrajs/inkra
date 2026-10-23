import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { act, create } from 'react-test-renderer';
import { DockablePanel, DockablePanelWorkspace } from '../dist/dockable-panel/index.js';

test('repeatedly activating the frontmost dockable panel does not rerender the workspace panels', async () => {
  const previous = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let renderer;
  const changes = [];
  const panel = id => h(DockablePanel, { key: id, id, title: h('span', null, id), movable: false, collapsible: false });
  try {
    await act(() => { renderer = create(h(DockablePanelWorkspace, { onActiveChange: id => changes.push(id) }, panel('a'), panel('b'))); });
    const sections = () => renderer.root.findAllByType('section');
    await act(() => sections()[1].props.onPointerDown({ defaultPrevented: false }));
    // React can make one extra bailout render after a state change; settle it first.
    await act(() => sections()[1].props.onFocusCapture({ defaultPrevented: false }));
    const before = sections().map(section => section.props.style);
    for (let index = 0; index < 50; index++) await act(() => sections()[1].props.onPointerDown({ defaultPrevented: false }));
    sections().forEach((section, index) => assert.equal(section.props.style, before[index], 'panel render output should be retained'));
    assert.deepEqual(changes, ['b']);
    assert.equal(sections()[1].props.style.zIndex, 2);
    await act(() => sections()[0].props.onPointerDown({ defaultPrevented: false }));
    assert.deepEqual(changes, ['b', 'a']);
    assert.equal(sections()[0].props.style.zIndex, 2);
    assert.equal(sections()[1].props.style.zIndex, 0);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    if (previous === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT; else globalThis.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
