import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { act, create } from 'react-test-renderer';
import { JourneyMap } from '../dist/journey-map/index.js';
import { InkraProvider, createInkraTranslator } from '../dist/i18n/index.js';
import { clusterJourneyMarkers, validJourneyMarkers } from '../dist/journey-map/markers.js';

const marker = (id, longitude = 0, latitude = 0) => ({ id, label: `Person ${id}`, longitude, latitude });
const project = item => ({ x: item.longitude, y: item.latitude });
const members = clusters => clusters.map(group => group.markers.map(item => item.id));

test('marker clustering is opt in and groups transitive screen-space overlaps', () => {
  const points = [marker('a', 0), marker('b', 35), marker('c', 70), marker('d', 150)];
  assert.deepEqual(members(clusterJourneyMarkers(points, project)), [['a'], ['b'], ['c'], ['d']]);
  const clustered = clusterJourneyMarkers(points, project, true);
  assert.deepEqual(members(clustered), [['a', 'b', 'c'], ['d']]);
  assert.equal(clustered[0].x, 35, 'the group stays at the projected member centroid');
  assert.equal(clustered[0].y, 0);
  assert.deepEqual(members(clusterJourneyMarkers(points, item => ({ x: item.longitude * 2, y: 0 }), true)), [['a'], ['b'], ['c'], ['d']], 'the same geographic data separates when projected farther apart');
});

test('clusters have deterministic identity and member order across caller reordering', () => {
  const points = [marker('z', 12), marker('a', 0), marker('lonely', 170), marker('m', 24)];
  const forward = clusterJourneyMarkers(points, project, true);
  const reverse = clusterJourneyMarkers([...points].reverse(), project, true);
  const normalized = groups => groups.map(({ id, markers, x, y }) => ({ id, ids: markers.map(item => item.id), x, y })).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(normalized(forward), normalized(reverse));
  assert.deepEqual(points.map(item => item.id), ['z', 'a', 'lonely', 'm'], 'caller arrays remain unchanged');
});

test('coincident markers stay enumerable at every projected zoom and invalid projections are ignored', () => {
  const points = [marker('a'), marker('b'), marker('c')];
  for (const scale of [1, 1024, 2 ** 30]) {
    assert.deepEqual(members(clusterJourneyMarkers(points, item => ({ x: item.longitude * scale, y: item.latitude * scale }), true)), [['a', 'b', 'c']]);
  }
  assert.deepEqual(members(clusterJourneyMarkers(points, item => item.id === 'b' ? { x: Infinity, y: 0 } : project(item), true)), [['a', 'c']]);
});

test('clustering uses a minimum 44px target and allows a larger radius', () => {
  const points = [marker('a', 0), marker('b', 40), marker('c', 100)];
  for (const radius of [1, 0, -1, NaN, Infinity]) {
    assert.deepEqual(members(clusterJourneyMarkers(points, project, { radius })), [['a', 'b'], ['c']]);
  }
  assert.deepEqual(members(clusterJourneyMarkers(points, project, { radius: 65 })), [['a', 'b', 'c']]);
});

test('invalid marker coordinates and duplicate IDs cannot create duplicate controls', () => {
  const first = marker('duplicate', 1);
  const points = [first, marker('duplicate', 2), marker('bad-lat', 0, 86), marker('bad-long', 181), marker('bad-number', NaN), marker('edge', 180, -85)];
  assert.deepEqual(validJourneyMarkers(points), [first, points.at(-1)]);
  assert.equal(points.length, 6);
});

test('empty marker identifiers and unreadable labels cannot produce unnamed controls', () => {
  const valid = marker('valid');
  assert.deepEqual(validJourneyMarkers([null, { ...valid, id: '' }, { ...valid, id: '  ' }, { ...valid, label: '' }, { ...valid, label: '  ' }, valid]), [valid]);
});

test('default marker labels use the shared locale catalog and preserve count substitution', () => {
  for (const locale of ['en', 'zh-CN', 'ja', 'ko', 'fr']) {
    const t = createInkraTranslator(locale);
    assert.match(t('map.showMarkers', { count: 10 }), /10/);
    assert.doesNotMatch(t('map.showMarkers', { count: 10 }), /\{count\}|map\.showMarkers/);
    const html = render(h(InkraProvider, { locale }, h(JourneyMap, { places: [], markers: [marker('one')], attribution: 'Synthetic' })));
    assert.ok(html.includes(`aria-label="${t('map.markers')}"`));
  }
});

test('SSR keeps independent place and marker selection and filters invalid markers', () => {
  const html = render(h(JourneyMap, {
    places: [{ id: 'town', label: 'Town', latitude: 0, longitude: 0 }],
    selectedPlace: 'town',
    markers: [marker('a'), marker('b'), marker('invalid', Infinity)],
    defaultSelectedMarker: 'b',
    attribution: 'Fictional example',
    markerLabels: { list: 'People on the map' },
  }));
  assert.match(html, /Fictional example/);
  assert.match(html, /inkra-journey-map__places/);
  assert.match(html, /inkra-journey-map__markers-list/);
  assert.match(html, /People on the map/);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Person invalid/);
  assert.doesNotMatch(html, /defaultSelectedMarker=|markerLabels=|markerClustering=/);
  const none = render(h(JourneyMap, { places: [], markers: [marker('a')], selectedMarker: null, defaultSelectedMarker: 'a', attribution: 'Fictional' }));
  assert.doesNotMatch(none, /aria-pressed="true"/);
});

let previousActEnvironment;
before(() => { previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT; globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
after(() => { if (previousActEnvironment === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT; else globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment; });

const markerButtons = renderer => renderer.root.findAll(node => node.type === 'ol' && node.props.className === 'inkra-journey-map__markers-list')[0].findAllByType('button');

test('uncontrolled marker clicks commit once and default selection is only an initial value', async () => {
  const points = [marker('a'), marker('b')];
  const selected = [];
  const props = { places: [], markers: points, attribution: 'Fictional', defaultSelectedMarker: 'a', onMarkerSelect: item => selected.push(item.id) };
  let renderer;
  try {
    await act(() => { renderer = create(h(JourneyMap, props)); });
    assert.equal(markerButtons(renderer)[0].props['aria-pressed'], true);
    await act(() => markerButtons(renderer)[1].props.onClick());
    assert.deepEqual(selected, ['b']);
    assert.equal(markerButtons(renderer)[1].props['aria-pressed'], true);
    await act(() => renderer.update(h(JourneyMap, { ...props, defaultSelectedMarker: null, markers: [...points] })));
    assert.equal(markerButtons(renderer)[1].props['aria-pressed'], true);
    assert.deepEqual(selected, ['b'], 'prop rerenders do not invent user callbacks');
  } finally { if (renderer) await act(() => renderer.unmount()); }
});

test('controlled null requests selection without committing until the parent accepts', async () => {
  const points = [marker('a'), marker('b')];
  const selected = [];
  const props = { places: [], markers: points, attribution: 'Fictional', selectedMarker: null, defaultSelectedMarker: 'a', onMarkerSelect: item => selected.push(item.id) };
  let renderer;
  try {
    await act(() => { renderer = create(h(JourneyMap, props)); });
    assert(markerButtons(renderer).every(button => button.props['aria-pressed'] === false));
    await act(() => markerButtons(renderer)[1].props.onClick());
    assert.deepEqual(selected, ['b']);
    assert(markerButtons(renderer).every(button => button.props['aria-pressed'] === false));
    await act(() => renderer.update(h(JourneyMap, { ...props, selectedMarker: 'b' })));
    assert.equal(markerButtons(renderer)[1].props['aria-pressed'], true);
    assert.deepEqual(selected, ['b']);
  } finally { if (renderer) await act(() => renderer.unmount()); }
});
