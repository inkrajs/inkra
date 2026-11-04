import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JourneyMap } from '../dist/journey-map/index.js';
import { createJourneyInitialFit, createJourneyZoomNotifier, resolveJourneyFitZoom } from '../dist/journey-map/zoom.js';
import { validJourneyMarkers } from '../dist/journey-map/markers.js';
import { buildingPositions } from '../dist/journey-map/buildings.js';

const validBuilding = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: {
  type: 'Polygon', coordinates: [[[0, 0], [.01, 0], [.01, .01], [0, .01], [0, 0]]],
} }] };
const marker = { id: 'person', label: 'Synthetic person', latitude: 0, longitude: 0 };

function independentStartup() {
  const state = { markers: [], buildings: undefined, width: 800, height: 600, alive: true, cameraFits: 0, notifications: [] };
  const events = createJourneyZoomNotifier(() => zoom => state.notifications.push(zoom), () => state.alive, true);
  const fit = createJourneyInitialFit(() => {
    const points = [...validJourneyMarkers(state.markers), ...buildingPositions(state.buildings)];
    if (!points.length || state.width <= 0 || state.height <= 0) return false;
    state.cameraFits++;
    fit.markFitted(); events.markFitted(); events.notify(17);
    return state.alive;
  }, () => state.alive);
  return { state, fit, events };
}

test('empty and invalid independent layers do not fit, and valid markers wait for a usable viewport', () => {
  const { state, fit } = independentStartup();
  assert.equal(fit.tryFit(), false);
  state.markers = [{ ...marker, latitude: NaN }, { ...marker, id: 'outside', longitude: 181 }];
  state.buildings = { type: 'FeatureCollection', features: [{ ...validBuilding.features[0], geometry: { type: 'Polygon', coordinates: [] } }] };
  assert.equal(fit.tryFit(), false);
  assert.equal(state.cameraFits, 0); assert.deepEqual(state.notifications, []);
  state.markers = [marker]; state.width = 0;
  assert.equal(fit.tryFit(), false);
  state.width = 800;
  assert.equal(fit.tryFit(), true);
  assert.equal(fit.tryFit(), false, 'the ready effect and layer update share one fit');
  assert.equal(state.cameraFits, 1); assert.deepEqual(state.notifications, [17]);
});

test('building-only asynchronous startup fits once and later building LOD or marker changes preserve the camera', () => {
  const { state, fit } = independentStartup();
  assert.equal(fit.tryFit(), false);
  state.buildings = validBuilding;
  assert.equal(fit.tryFit(), true);
  state.buildings = { ...validBuilding, features: [...validBuilding.features, { ...validBuilding.features[0], id: 'second' }] };
  state.markers = [marker]; assert.equal(fit.tryFit(), false);
  state.markers = []; state.buildings = undefined; assert.equal(fit.tryFit(), false);
  state.markers = [{ ...marker, longitude: .02 }]; assert.equal(fit.tryFit(), false);
  assert.equal(state.cameraFits, 1); assert.deepEqual(state.notifications, [17]);
});

test('native completion and reentrant layer requests cannot duplicate the shared initial fit', () => {
  let calls = 0;
  const fit = createJourneyInitialFit(() => { calls++; assert.equal(fit.tryFit(), false); return true; });
  assert.equal(fit.tryFit(), true); assert.equal(fit.tryFit(), false); assert.equal(calls, 1);
  const completedByNative = createJourneyInitialFit(() => { calls++; return true; });
  completedByNative.markFitted(); assert.equal(completedByNative.tryFit(), false); assert.equal(calls, 1);
});

test('synchronous unmount during initial zoom notification prevents follow-up and later fit requests', () => {
  let alive = true, attempts = 0, notices = 0;
  const events = createJourneyZoomNotifier(() => () => { notices++; alive = false; fit.dispose(); events.dispose(); }, () => alive, true);
  const fit = createJourneyInitialFit(() => {
    attempts++; fit.markFitted(); events.markFitted(); events.notify(17); return alive;
  }, () => alive);
  assert.equal(fit.tryFit(), false, 'the caller must not schedule against the removed map');
  fit.markFitted(); events.markFitted(); events.notify(18);
  assert.equal(fit.tryFit(), false); assert.equal(attempts, 1); assert.equal(notices, 1);
});

test('official maxFitZoom wins over the compatibility alias while each range is retained', () => {
  assert.equal(resolveJourneyFitZoom(), 12);
  assert.equal(resolveJourneyFitZoom(undefined, 24), 24);
  assert.equal(resolveJourneyFitZoom(undefined, 99), 24);
  assert.equal(resolveJourneyFitZoom(99, 24), 20);
  assert.equal(resolveJourneyFitZoom(15, 24), 15);
  assert.equal(resolveJourneyFitZoom(NaN, 24), 12);
  assert.equal(resolveJourneyFitZoom(undefined, Infinity), 12);
  assert.equal(resolveJourneyFitZoom(-1, 18), 0);
});

test('zoom notification readiness survives empty data and filters preparation until disposal', () => {
  const calls = []; let preparing = false;
  const events = createJourneyZoomNotifier(() => zoom => calls.push(zoom), () => !preparing, true);
  events.notify(2); events.notify(12);
  assert.deepEqual(calls, [], 'No initial native view is reported as a successful fit');
  events.markFitted(); events.notify(12);
  // Clearing all render data does not revoke the completed fit. A later user
  // zoom still notifies; the separate map late-data fit flag can change freely.
  events.notify(13);
  preparing = true; events.notify(6); events.notify(14);
  preparing = false; events.notify(14); events.notify(14);
  events.dispose(); events.markFitted(); events.notify(15);
  assert.deepEqual(calls, [12, 13, 14]);
});

test('initial readiness and internal camera preparation suppress events without consuming the public dedup state', () => {
  const calls = []; let fitted = false, preparingView = false;
  const events = createJourneyZoomNotifier(() => zoom => calls.push(zoom), () => fitted && !preparingView);
  events.notify(2); fitted = true; events.notify(14);
  preparingView = true; events.notify(8); events.notify(14);
  preparingView = false; events.notify(14); events.notify(15);
  preparingView = true; events.notify(10); events.notify(15);
  preparingView = false; events.notify(15); events.notify(14);
  events.dispose(); events.notify(16);
  assert.deepEqual(calls, [14, 15, 14]);
});

test('viewport height retains ordinary full-window sizes and legacy defaults while rejecting invalid runtime values', () => {
  for (const [height, expected] of [[undefined, 480], [240, 240], [480, 480], [800, 800], [900, 900], [1080, 1080], [1440, 1440], [2160, 2160], [480.5, 480.5], [0, 240], [-1, 240], [NaN, 480], [Infinity, 480], [-Infinity, 480], ['900', 480], [null, 480]]) {
    const html = renderToStaticMarkup(createElement(JourneyMap, { places: [], attribution: 'Height regression', height }));
    const viewport = html.match(/class="inkra-journey-map__viewport" style="([^"]*)"/);
    assert.ok(viewport, 'The actual rendered map viewport has inline sizing');
    assert.equal(viewport[1], `height:${expected}px`, `height input ${String(height)}`);
  }
});

test('zoom notifications use the latest callback, preserve real changes, reject nonfinite values and stop on dispose', () => {
  const calls = [];
  let callback = zoom => calls.push(['first', zoom]);
  const events = createJourneyZoomNotifier(() => callback);
  events.notify(NaN); events.notify(Infinity);
  events.notify(12); events.notify(12);
  callback = zoom => calls.push(['latest', zoom]);
  events.notify(12); events.notify(13); events.notify(12);
  events.notify(-Infinity); events.notify(12);
  events.dispose(); events.notify(14);
  assert.deepEqual(calls, [['first', 12], ['latest', 13], ['latest', 12]]);
  let added;
  const absent = createJourneyZoomNotifier(() => added);
  absent.notify(10);
  added = zoom => calls.push(['added', zoom]);
  absent.notify(10); absent.notify(11); absent.dispose();
  assert.deepEqual(calls.at(-1), ['added', 11]);
});
