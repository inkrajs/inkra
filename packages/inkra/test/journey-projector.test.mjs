import assert from 'node:assert/strict';
import test from 'node:test';
import { captureJourneyPaintPose, projectJourneyPaintPose } from '../dist/journey-map/projector.js';

// Public-method model of Leaflet's rounded world pixels plus container translation.
// These tests do not construct a real Leaflet map, canvas, DOM or browser.
function publicMap() {
  const state = { zoom: 3.5, origin: [513, -127], pane: [.25, -.75] };
  const calls = { zoomReads: 0, projects: [], containerReads: 0, cameraWrites: 0 };
  const map = {
    getZoom() { calls.zoomReads++; return state.zoom; },
    project(position, zoom = state.zoom) {
      calls.projects.push({ position, zoom });
      const [lat, lng] = Array.isArray(position) ? position : [position.lat, position.lng];
      const scale = 2 ** zoom;
      // Deliberately use an arbitrary projection rather than a Web Mercator formula.
      return { x: (lng * 7 + lat * 2 + 17.3) * scale, y: (lat * -11 + lng * 3 - 4.7) * scale };
    },
    latLngToContainerPoint(position) {
      calls.containerReads++;
      const world = this.project(position, state.zoom);
      return { x: Math.round(world.x) - state.origin[0] + state.pane[0], y: Math.round(world.y) - state.origin[1] + state.pane[1] };
    },
    setView() { calls.cameraWrites++; },
    flyTo() { calls.cameraWrites++; },
    panTo() { calls.cameraWrites++; },
    stop() { calls.cameraWrites++; },
  };
  for (const name of ['_zoom', '_pixelOrigin', '_getMapPanePos']) Object.defineProperty(map, name, {
    get() { throw new Error(`Private map member accessed: ${name}`); },
  });
  return { map, state, calls };
}

test('captured poses match the public container projection for negative, fractional and large coordinates', () => {
  const { map, state, calls } = publicMap();
  const positions = [[0, 0], [-.125, .375], [-43.3, 170.25], [80.75, -179.5], { lat: 12.125, lng: -77.25 }];
  for (const zoom of [-2.25, 0, 3.5, 17.8]) for (const padding of [0, 64, -.125]) {
    state.zoom = zoom;
    const pose = captureJourneyPaintPose(map, padding);
    assert.ok(pose); assert.equal(pose.zoom, zoom);
    for (const position of positions) {
      const expected = map.latLngToContainerPoint(position);
      assert.deepEqual(projectJourneyPaintPose(map, pose, position), [expected.x + padding, expected.y + padding]);
    }
  }
  assert.equal(calls.cameraWrites, 0);
});

test('repainting the captured view ignores later camera changes and preserves fractional translation', () => {
  const { map, state, calls } = publicMap();
  const pose = captureJourneyPaintPose(map, 64);
  assert.ok(pose); assert.equal(pose.offset[0] % 1, -.75);
  const position = [-.25, .625];
  const before = projectJourneyPaintPose(map, pose, position);
  const saved = { zoom: pose.zoom, offset: [...pose.offset] };
  state.zoom += 3; state.origin = [-2047, 4095]; state.pane = [-.5, .125];
  const current = map.latLngToContainerPoint(position);
  const zoomReads = calls.zoomReads, containerReads = calls.containerReads;
  calls.projects.length = 0;
  assert.deepEqual(projectJourneyPaintPose(map, pose, position), before);
  assert.notDeepEqual(before, [current.x + 64, current.y + 64]);
  assert.deepEqual(pose, saved);
  assert.equal(calls.zoomReads, zoomReads);
  assert.equal(calls.containerReads, containerReads);
  assert.deepEqual(calls.projects.map(call => call.zoom), [saved.zoom]);
  assert.equal(calls.cameraWrites, 0);
});

test('each fixed-pose point uses one public projection and no container or camera operation', () => {
  const { map, calls } = publicMap();
  const pose = captureJourneyPaintPose(map, 0); assert.ok(pose);
  const reads = { zoom: calls.zoomReads, container: calls.containerReads };
  calls.projects.length = 0;
  for (const position of [[1, 2], [3, 4], [-5, -6]]) projectJourneyPaintPose(map, pose, position);
  assert.equal(calls.projects.length, 3);
  assert.equal(calls.zoomReads, reads.zoom); assert.equal(calls.containerReads, reads.container);
  assert.equal(calls.cameraWrites, 0);
});

test('invalid capture inputs and nonfinite public samples cannot become reusable poses', () => {
  for (const padding of [NaN, Infinity, -Infinity]) {
    const { map, calls } = publicMap();
    assert.equal(captureJourneyPaintPose(map, padding), undefined);
    assert.equal(calls.zoomReads, 0); assert.equal(calls.projects.length, 0);
  }
  for (const zoom of [NaN, Infinity, -Infinity]) {
    const { map, state, calls } = publicMap(); state.zoom = zoom;
    assert.equal(captureJourneyPaintPose(map, 64), undefined);
    assert.equal(calls.projects.length, 0);
  }
  for (const [world, container] of [
    [{ x: NaN, y: 0 }, { x: 0, y: 0 }],
    [{ x: 0, y: Infinity }, { x: 0, y: 0 }],
    [{ x: 0, y: 0 }, { x: -Infinity, y: 0 }],
    [{ x: 0, y: 0 }, { x: 0, y: NaN }],
    [{ x: -Number.MAX_VALUE, y: 0 }, { x: Number.MAX_VALUE, y: 0 }],
  ]) {
    assert.equal(captureJourneyPaintPose({ getZoom: () => 1, project: () => world, latLngToContainerPoint: () => container }, 0), undefined);
  }
});

test('invalid world projections remain nonfinite instead of being clamped into visible data', () => {
  const result = projectJourneyPaintPose({ project: () => ({ x: Infinity, y: NaN }) }, { zoom: 3, offset: [0, 0] }, [0, 0]);
  assert.equal(Number.isFinite(result[0]), false); assert.equal(Number.isFinite(result[1]), false);
});
