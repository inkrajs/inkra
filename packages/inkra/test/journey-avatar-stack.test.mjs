import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { JourneyMap } from '../dist/journey-map/index.js';
import { AvatarSlot, AvatarPlaceholder } from '../dist/journey-map/AvatarStack.js';
import { avatarStackLayout, clusterJourneyMarkers, normalizeAvatarFeather, resolveJourneyMarkerLabels } from '../dist/journey-map/markers.js';
import { MarkerLayer } from '../dist/journey-map/MarkerLayer.js';

const person = (id, longitude = 0, latitude = 0) => ({ id, label: `Person ${id}`, latitude, longitude });
const project = marker => ({ x: marker.longitude, y: marker.latitude });
const group = (items, proximity = false) => clusterJourneyMarkers(items, project, proximity, 'avatar-stack');

test('avatar preview occupies exactly one, two or three centred slots and reports the total', () => {
  for (const [total, visible, width, count] of [[1, 1, 44, null], [2, 2, 64, null], [3, 3, 84, null], [4, 3, 84, '4'], [10, 3, 84, '10'], [1000, 3, 84, '1000']]) {
    assert.deepEqual(avatarStackLayout(total), { visible, width, height: 44, size: 40, step: 20, count });
    assert.equal(2 + (visible - 1) * 20 / 2 + 20, width / 2, 'visible portrait centre equals the hit-box centre');
  }
  assert.equal(avatarStackLayout(Number.MAX_SAFE_INTEGER).count, '9007199254740991');
});

test('same-place stacking uses geographic equality and preserves old nonclustered pencil calls', () => {
  const people = [person('c'), person('a'), person('b'), person('near', .01)];
  const quantized = () => ({ x: 100, y: 100 });
  assert.deepEqual(clusterJourneyMarkers(people, quantized, false).map(row => row.markers.length), [1, 1, 1, 1]);
  const actual = clusterJourneyMarkers(people, quantized, false, 'avatar-stack');
  assert.deepEqual(actual.map(row => row.markers.map(marker => marker.id)), [['a', 'b', 'c'], ['near']]);
  assert.deepEqual(actual, clusterJourneyMarkers([...people].reverse(), quantized, false, 'avatar-stack'));
});

test('proximity mode merges actual stack footprints even beyond the old 44px centre distance', () => {
  const people = [person('a'), person('b'), person('c'), person('d', 60)];
  assert.equal(group(people).length, 2);
  const merged = group(people, true);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].markers.length, 4);
  assert.equal(merged[0].x, 15, 'anchor is weighted over all members, not over the two base groups');
  assert.equal(group([person('a'), person('b', 90)], true).length, 2);
});

test('many coincident people retain all selectable members and stable identity without caller mutation', () => {
  const people = Array.from({ length: 1000 }, (_, index) => person(String(index).padStart(4, '0')));
  const result = group(people, true);
  assert.equal(result.length, 1); assert.equal(result[0].markers.length, 1000);
  assert.equal(result[0].markers[0].id, '0000'); assert.equal(result[0].markers.at(-1).id, '0999');
  assert.deepEqual(people.map(marker => marker.id), result[0].markers.map(marker => marker.id));
});

test('transparent portrait slot contains no old pencil canvas, paper or visible name', () => {
  const marker = person('a');
  const html = render(h(AvatarSlot, { marker, selected: false }, h('img', { src: 'fictional.svg', alt: '' })));
  assert.match(html, /data-avatar-slot="0"/);
  assert.doesNotMatch(html, /<canvas|inkra-pencil|marker-frame|Person a|data-avatar-count/);
  const fallback = render(h(AvatarPlaceholder));
  assert.match(fallback, /data-avatar-fallback="true"/);
  assert.doesNotMatch(fallback, /<canvas|inkra-pencil|Person|>a</);
});

test('only totals over three appear and remain the full total on the third portrait', () => {
  for (const total of [1, 2, 3, 4, 10, 1000]) {
    const html = render(h(AvatarSlot, { marker: person('c'), index: 2, selected: false, total }, h('img', { src: 'fictional.svg', alt: '' })));
    if (total <= 3) assert.doesNotMatch(html, /data-avatar-count/);
    else { assert.match(html, new RegExp(`data-avatar-count="${total}"`)); assert.doesNotMatch(html, />\+/); }
  }
});

test('new opt-in props do not leak into SSR or alter independent place selection', () => {
  const html = render(h(JourneyMap, { places: [person('place')], markers: [person('a')], selectedPlace: 'place', selectedMarker: 'a', markerPresentation: 'avatar-stack', markerAvatarFeather: { width: 6, strength: .8 }, maxFitZoom: 20, attribution: 'Fictional' }));
  assert.doesNotMatch(html, /markerPresentation=|markerAvatarFeather=|maxFitZoom=/);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 2);
});

test('portrait alpha feather is opt-in, bounded and keeps a fully preserved central region', () => {
  assert.equal(normalizeAvatarFeather(), null);
  assert.deepEqual(normalizeAvatarFeather({}), { width: 4, strength: 1 });
  assert.deepEqual(normalizeAvatarFeather({ width: .5, strength: .25 }), { width: .5, strength: .25 });
  assert.deepEqual(normalizeAvatarFeather({ width: 100, strength: 10 }), { width: 12, strength: 1 });
  for (const value of [NaN, Infinity, -Infinity]) assert.deepEqual(normalizeAvatarFeather({ width: value, strength: value }), { width: 4, strength: 1 });
  for (const feather of [{ width: 0 }, { width: -1 }, { strength: 0 }, { strength: -1 }]) assert.equal(normalizeAvatarFeather(feather), null);
  assert.ok(20 - normalizeAvatarFeather({ width: Number.MAX_VALUE }).width >= 8, 'the 40px portrait always retains an unmasked central radius');
});

test('omitted or zero feather leaves the original portrait markup unchanged', () => {
  const slot = feather => render(h(AvatarSlot, { marker: person('a'), selected: false, feather }, h('img', { src: 'fictional.svg', alt: '' })));
  const original = slot(undefined);
  for (const feather of [{ width: 0 }, { strength: 0 }, { width: -10 }, { strength: -10 }]) assert.equal(slot(feather), original);
  assert.doesNotMatch(original, /mask|opacity|filter/);
});

test('feather decorates only the portrait pixels while total and selected slot remain independent siblings', () => {
  const html = render(h(AvatarSlot, { marker: person('c'), index: 2, selected: true, total: 1000, feather: { width: 6, strength: .75 } }, h('img', { src: 'fictional.svg', alt: '' })));
  const tags = html.match(/<span[^>]*>/g);
  const slot = tags.find(tag => tag.includes('class="inkra-journey-map__avatar-slot"'));
  const image = tags.find(tag => tag.includes('class="inkra-journey-map__avatar-image"'));
  const count = tags.find(tag => tag.includes('class="inkra-journey-map__avatar-count"'));
  assert.match(image, /mask-image:radial-gradient\(circle closest-side/);
  assert.match(image, /mask-mode:alpha/);
  assert.doesNotMatch(slot, /mask|opacity|filter/);
  assert.doesNotMatch(count, /mask|opacity|filter/);
  assert.match(slot, /data-selected="true"/);
  assert.match(count, /data-avatar-count="1000"/);
  assert.doesNotMatch(html, /<canvas|marker-frame|filter:|opacity:/);
});

const fakeMap = { getPane: () => ({}), getSize: () => ({ x: 800, y: 500 }), latLngToContainerPoint: ([latitude, longitude]) => ({ x: 400 + longitude, y: 250 + latitude }) };
const markerLabels = { cluster: n => `Group ${n}`, more: n => `More ${n}`, collapse: 'Collapse', list: 'People' };
test('explicit undefined optional labels retain every default and real pencil aggregation stays renderable', () => {
  const input = { cluster: undefined, more: undefined, collapse: undefined, list: undefined };
  const labels = resolveJourneyMarkerLabels(input, markerLabels);
  assert.deepEqual(labels, markerLabels); assert.equal(input.cluster, undefined);
  const html = render(h(MarkerLayer, { map: fakeMap, markers: [person('a'), person('b')], clustering: true, presentation: 'pencil', selected: null, onSelect() {}, labels }));
  assert.match(html, /aria-label="Group 2"/);
  assert.deepEqual(resolveJourneyMarkerLabels({ collapse: '', list: '', cluster: n => `Custom ${n}` }, markerLabels).list, '');
  assert.equal(resolveJourneyMarkerLabels(undefined, markerLabels).more(4), 'More 4');
});
test('avatar-stack exposes an individual native selection button for each of one to three people', () => {
  for (const count of [1, 2, 3]) {
    const markers = Array.from({ length: count }, (_, index) => person(`m${index}`));
    const html = render(h(MarkerLayer, { map: fakeMap, markers, clustering: false, presentation: 'avatar-stack', selected: 'm1', onSelect() {}, labels: markerLabels }));
    const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map(match => match[0]);
    assert.equal(buttons.length, count);
    for (const [index, button] of buttons.entries()) {
      assert.match(button, new RegExp(`aria-label="Person m${index}"`));
      assert.match(button, new RegExp(`data-marker-id="m${index}"`));
      assert.doesNotMatch(button, /aria-expanded|data-marker-more/);
    }
    assert.doesNotMatch(html, /marker-panel|>Collapse</);
    assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, count > 1 ? 1 : 0);
  }
});

test('only the third slot above three people is a more control, with total and hidden selected description', () => {
  for (const count of [4, 5, 10]) {
    const markers = Array.from({ length: count }, (_, index) => person(`m${index}`));
    const html = render(h(MarkerLayer, { map: fakeMap, markers, clustering: false, presentation: 'avatar-stack', selected: 'm3', onSelect() {}, labels: markerLabels }));
    const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map(match => match[0]);
    assert.equal(buttons.length, 3);
    assert.match(buttons[0], /data-marker-id="m0"/); assert.match(buttons[1], /data-marker-id="m1"/);
    assert.match(buttons[2], /data-marker-more="true"/);
    assert.match(buttons[2], new RegExp(`aria-label="More ${count}"`));
    assert.match(buttons[2], /aria-haspopup="dialog"/);
    assert.doesNotMatch(buttons[2], /data-marker-id=|aria-pressed=/);
    assert.match(html, new RegExp(`data-avatar-count="${count}"`));
    assert.match(html, /hidden="">Selected: Person m3/);
  }
});
