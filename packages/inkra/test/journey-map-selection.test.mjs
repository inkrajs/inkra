import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { act, create } from 'react-test-renderer';
import { useJourneySelection } from '../dist/journey-map/selection.js';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const points = [{ id: 'pin' }, { id: 'icon' }, { id: 'image' }];
function harness(initial) {
  let current, root;
  function Probe(props) { current = useJourneySelection(props.items ?? points, props.mode ?? 'multiple', props.single, props.onSelect, props.selected, props.onChange); return null; }
  act(() => { root = create(h(Probe, initial)); });
  return { get current() { return current; }, update(props) { act(() => root.update(h(Probe, props))); }, dispose() { act(() => root.unmount()); } };
}
test('uncontrolled multiple selection toggles distinct marker representations and retains rapid changes', () => {
  const changes = []; const view = harness({ onChange: ids => changes.push(ids) });
  try {
    act(() => { view.current.select(points[0]); view.current.select(points[1]); view.current.select(points[2]); });
    assert.deepEqual([...view.current.ids], ['pin', 'icon', 'image']);
    act(() => view.current.select(points[1]));
    assert.deepEqual([...view.current.ids], ['pin', 'image']);
    assert.deepEqual(changes.at(-1), ['pin', 'image']);
    view.update({ items: points.slice(1) });
    assert.deepEqual([...view.current.ids], ['image']);
  } finally { view.dispose(); }
});
test('controlled IDs stay controlled, reject absent data and use latest callbacks without stale handlers', () => {
  const changes = [], activated = []; const view = harness({ selected: ['pin', 'absent'], onChange: ids => changes.push(ids) });
  const nativeHandler = view.current.select;
  try {
    act(() => nativeHandler(points[1]));
    assert.deepEqual([...view.current.ids], ['pin']);
    assert.deepEqual(changes, [['pin', 'icon']]);
    view.update({ selected: ['pin', 'icon'], onChange: ids => changes.push(ids), onSelect: item => activated.push(item.id) });
    act(() => nativeHandler(points[0]));
    assert.deepEqual(changes.at(-1), ['icon']);
    assert.deepEqual(activated, ['pin']);
    view.update({ selected: [] });
    assert.equal(view.current.ids.size, 0);
  } finally { view.dispose(); }
});
test('single mode keeps the original single-item callback contract', () => {
  const selected = []; const changes = []; const view = harness({ mode: 'single', single: 'pin', selected: ['image'], onSelect: item => selected.push(item.id), onChange: ids => changes.push(ids) });
  try {
    act(() => view.current.select(points[1]));
    assert.deepEqual([...view.current.ids], ['pin']);
    assert.deepEqual(selected, ['icon']);
    assert.deepEqual(changes, []);
  } finally { view.dispose(); }
});
