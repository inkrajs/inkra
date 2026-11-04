import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { JourneyMap } from '../dist/journey-map/index.js';

const places = Object.freeze([
  Object.freeze({ id: 'place-a', label: 'Workshop', latitude: 0, longitude: 0 }),
  Object.freeze({ id: 'place-b', label: 'Garden', latitude: .01, longitude: .01 }),
]);
const people = Object.freeze([
  Object.freeze({ id: 'person-a', label: 'Synthetic person A', latitude: 0, longitude: 0 }),
  Object.freeze({ id: 'person-b', label: 'Synthetic person B', latitude: 0, longitude: 0 }),
]);
const buildings = Object.freeze({ type: 'FeatureCollection', features: [] });

test('compatibility additions retain official 0.15 appearance defaults and SSR fallback', () => {
  const html = render(h(JourneyMap, { places, attribution: 'Synthetic map' }));
  assert.match(html, /data-label-halo="true"/);
  assert.match(html, /--inkra-map-label-font-size:12px/);
  assert.match(html, /--inkra-map-pin-size:18px/);
  assert.match(html, /--inkra-map-pin-color:#4c7952/);
  assert.match(html, /height:480px/);
  assert.match(html, /Workshop/);
  assert.doesNotMatch(html, /inkra-journey-map__markers-list/);
});

test('native multiple selection and independent controlled person selection coexist', () => {
  const html = render(h(JourneyMap, {
    places, attribution: 'Synthetic map', selectionMode: 'multiple', selectedPlaces: ['place-b'],
    markers: people, markerPresentation: 'avatar-stack', selectedMarker: 'person-a',
    markerLabels: { list: 'Authorized synthetic people' },
  }));
  const markerList = html.match(/<ol class="inkra-journey-map__markers-list"[\s\S]*?<\/ol>/)?.[0];
  const placeList = html.match(/<ol class="inkra-journey-map__places"[\s\S]*?<\/ol>/)?.[0];
  assert.ok(markerList); assert.ok(placeList);
  assert.match(markerList, /aria-label="Authorized synthetic people"/);
  assert.match(markerList, /aria-pressed="true"[^]*?Synthetic person A/);
  assert.match(markerList, /aria-pressed="false"[^]*?Synthetic person B/);
  assert.match(placeList, /aria-pressed="false"[^]*?Workshop/);
  assert.match(placeList, /aria-pressed="true"[^]*?Garden/);
});

test('new palette, labels and native motion props compose with data styles without leaking props or firing events in SSR', () => {
  let calls = 0;
  const html = render(h(JourneyMap, {
    places, attribution: 'Synthetic map', height: 1080, maxFitZoom: 20, fitMaxZoom: 24,
    labelHalo: { width: 2, color: '#f8f8f0' }, labelFontSize: 14, labelPosition: 'right', labelGap: 8,
    palette: { terrain: { forest: { fill: '#80aa80' } } }, placeTransition: { duration: 600, easing: 'ease-in-out' },
    buildings, buildingStyles: { workshop: { fill: '#ab7755' } },
    routes: [{ id: 'path', type: 'trail', coordinates: [[0, 0], [.01, .01]] }],
    routeStyles: { trail: { width: 1.5, dash: [6, 4] } }, landCoverBoundaryStyles: { crop: { dash: [4, 3] } },
    markers: people, markerAvatarFeather: { width: 4, strength: 1 },
    onZoomChange: () => calls++, onReady: () => calls++,
  }));
  assert.equal(calls, 0, 'server rendering cannot invent a native view or readiness event');
  assert.match(html, /height:1080px/);
  assert.match(html, /--inkra-map-label-halo-width:4px/);
  assert.match(html, /--inkra-map-label-font-size:14px/);
  assert.doesNotMatch(html, /(?:routeStyles|routestyles|buildingStyles|buildingstyles|buildings|fitMaxZoom|fitmaxzoom|markerAvatarFeather|markeravatarfeather|onZoomChange|onzoomchange)=/);
  assert.doesNotMatch(html, /\[object Object\]/);
});

test('data update mode is an opt-in map lifecycle contract and never leaks into SSR markup', () => {
  const options = { places, attribution: 'Synthetic map' };
  const original = render(h(JourneyMap, options));
  const explicitFit = render(h(JourneyMap, { ...options, dataUpdateMode: 'fit' }));
  const preserved = render(h(JourneyMap, { ...options, dataUpdateMode: 'preserve-view' }));
  assert.equal(explicitFit, original);
  assert.equal(preserved, original, 'SSR does not simulate a map, LOD transition or camera fit');
  assert.doesNotMatch(preserved, /dataUpdateMode|dataupdatemode|preserve-view/);
});
