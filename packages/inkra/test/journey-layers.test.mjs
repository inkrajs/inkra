import assert from 'node:assert/strict';
import test from 'node:test';
import { createJourneyLayers } from '../dist/journey-map/layers.js';

// Synthetic coordinator models only. These counts are native-model objects and
// input vertices, not measured Leaflet projection calls or browser DOM/layout.
class ElementModel {
  constructor(document, tag) {
    this.ownerDocument = document; this.tagName = tag; this.parentNode = null;
    this.children = []; this.attributes = new Map(); this.events = new Map(); this.style = {};
    const classes = new Set();
    this.classList = { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) };
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  appendChild(child) {
    if (child.parentNode === this) this.children.splice(this.children.indexOf(child), 1);
    else child.remove();
    child.parentNode = this; this.children.push(child); return child;
  }
  removeChild(child) {
    const index = this.children.indexOf(child); if (index < 0) return child;
    if (child.contains(this.ownerDocument.activeElement)) this.ownerDocument.activeElement = this.ownerDocument.body;
    this.children.splice(index, 1); child.parentNode = null;
    this.ownerDocument.onRemoval?.(child); return child;
  }
  remove() { this.parentNode?.removeChild(this); }
  contains(node) { for (let next = node; next; next = next.parentNode) if (next === this) return true; return false; }
  get isConnected() { return this === this.ownerDocument.body || this.ownerDocument.body.contains(this); }
  addEventListener(type, listener) { if (!this.events.has(type)) this.events.set(type, new Set()); this.events.get(type).add(listener); }
  removeEventListener(type, listener) { this.events.get(type)?.delete(listener); }
  listenerCount(type) { return this.events.get(type)?.size ?? 0; }
  dispatch(type, details = {}) {
    const event = { type, target: this, currentTarget: this, defaultPrevented: false, propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.propagationStopped = true; }, ...details };
    for (const listener of [...(this.events.get(type) ?? [])]) listener(event);
    return event;
  }
  focus() { this.ownerDocument.activeElement = this; }
}

class DocumentModel {
  constructor() { this.body = new ElementModel(this, 'body'); this.activeElement = this.body; }
  createElement(tag) { return new ElementModel(this, tag); }
}

function leafModel(document) {
  const stats = { nativeWrites: 0, polylineConstructs: 0, polygonConstructs: 0, groupConstructs: 0, markerConstructs: 0 };
  class LatLng {
    constructor(lat, lng) { this.lat = lat; this.lng = lng; }
  }
  const latLng = (a, b) => a instanceof LatLng ? a : Array.isArray(a) ? new LatLng(a[0], a[1]) : typeof a === 'object' ? new LatLng(a.lat, a.lng) : new LatLng(a, b);
  const normalize = values => values.map(value => Array.isArray(value) && typeof value[0] !== 'number' ? normalize(value) : latLng(value));
  const unclose = values => {
    if (!values.length) return values;
    if (values[0] instanceof LatLng) {
      const first = values[0], last = values.at(-1);
      return values.length > 1 && first.lat === last.lat && first.lng === last.lng ? values.slice(0, -1) : values;
    }
    return values.map(unclose);
  };
  class Evented {
    constructor() { this.events = new Map(); }
    on(type, callback) { if (!this.events.has(type)) this.events.set(type, new Set()); this.events.get(type).add(callback); return this; }
    off(type, callback) { this.events.get(type)?.delete(callback); return this; }
    fire(type) { for (const callback of [...(this.events.get(type) ?? [])]) callback({ type, target: this }); return this; }
    listenerCount(type) { return this.events.get(type)?.size ?? 0; }
  }
  class Layer extends Evented {
    addTo(map) { map.addLayer(this); return this; }
    remove() { this.mapModel?.removeLayer(this); return this; }
  }
  class Path extends Layer {
    constructor(options = {}) { super(); this.options = { ...options }; this.element = document.createElement('path'); }
    getElement() { return this.mapModel ? this.element : undefined; }
    setStyle(style) { stats.nativeWrites++; Object.assign(this.options, style); this.element.style.stroke = this.options.color; return this; }
    attach(map) { map.svg.appendChild(this.element); }
    detach() { this.element.remove(); }
  }
  class Polyline extends Path {
    constructor(points, options = {}) { super(options); this.points = normalize(points); stats.polylineConstructs++; }
    getLatLngs() { return this.points; }
    setLatLngs(points) { stats.nativeWrites++; this.points = normalize(points); return this; }
  }
  class Polygon extends Polyline {
    constructor(points, options = {}) { super(points, options); this.points = unclose(this.points); stats.polygonConstructs++; }
    setLatLngs(points) { super.setLatLngs(points); this.points = unclose(this.points); return this; }
  }
  class LayerGroup extends Layer {
    constructor(children = []) { super(); this.children = children; }
    eachLayer(callback) { for (const child of [...this.children]) callback(child); return this; }
    attach(map) { this.eachLayer(child => child.addTo(map)); }
    detach() { this.eachLayer(child => child.remove()); }
    clearLayers() { stats.nativeWrites++; this.eachLayer(child => child.remove()); this.children = []; return this; }
    setStyle(style) { this.eachLayer(child => child.setStyle?.(style)); return this; }
  }
  const geoPoints = values => values.map(value => Array.isArray(value[0]) ? geoPoints(value) : latLng(value[1], value[0]));
  function parse(data, options) {
    if (!data) return [];
    if (data.type === 'FeatureCollection') return data.features.flatMap(feature => parse(feature, options));
    if (data.type === 'Feature') {
      const children = parse(data.geometry, options); for (const child of children) child.feature = data; return children;
    }
    let child;
    if (data.type === 'Polygon' || data.type === 'MultiPolygon') child = new Polygon(geoPoints(data.coordinates), options.style ?? {});
    else if (data.type === 'LineString' || data.type === 'MultiLineString') child = new Polyline(geoPoints(data.coordinates), options.style ?? {});
    else if (data.type === 'GeometryCollection') child = new LayerGroup(data.geometries.flatMap(geometry => parse(geometry, options)));
    return child ? [child] : [];
  }
  class GeoJSON extends LayerGroup {
    constructor(data, options = {}) { super(); this.options = options; this.lastData = data; stats.groupConstructs++; this.addData(data); }
    addData(data) {
      stats.nativeWrites++; this.lastData = data;
      const added = parse(data, this.options); this.children.push(...added);
      if (this.mapModel) for (const child of added) child.addTo(this.mapModel);
      return this;
    }
    setStyle(style) { this.options.style = style; return super.setStyle(style); }
  }
  class Marker extends Layer {
    constructor(position, options) { super(); stats.markerConstructs++; this.position = latLng(position); this.options = options; this.element = document.createElement('div'); }
    attach(map) {
      const html = this.options.icon?.options?.html ?? this.options.icon?.html;
      if (html) this.element.appendChild(html);
      map.markerPane.appendChild(this.element);
    }
    detach() { this.element.remove(); }
    setLatLng(position) { stats.nativeWrites++; this.position = latLng(position); return this; }
    getLatLng() { return this.position; }
    getElement() { return this.mapModel ? this.element : undefined; }
  }
  class MapModel {
    constructor() { this.layers = new Set(); this.alive = true; this.svg = document.createElement('svg'); this.markerPane = document.createElement('div'); document.body.appendChild(this.svg); document.body.appendChild(this.markerPane); }
    addLayer(layer) {
      if (!this.alive) throw Error('native add after removal');
      if (this.layers.has(layer)) return this;
      stats.nativeWrites++; this.layers.add(layer); layer.mapModel = this; layer.attach(this); this.onAdd?.(layer); return this;
    }
    removeLayer(layer) { if (!this.layers.has(layer)) return this; stats.nativeWrites++; this.layers.delete(layer); layer.detach(); layer.mapModel = undefined; return this; }
    remove() { this.alive = false; for (const layer of [...this.layers]) this.removeLayer(layer); this.svg.remove(); this.markerPane.remove(); }
    fitBounds() { throw Error('coordinator must not fit'); }
    setView() { throw Error('coordinator must not change view'); }
    setZoom() { throw Error('coordinator must not change zoom'); }
    panTo() { throw Error('coordinator must not pan'); }
    flyTo() { throw Error('coordinator must not animate the camera'); }
  }
  return { stats, MapModel, GeoJSON, Polygon, Polyline, L: { LatLng, Path, Polyline, Polygon, LayerGroup,
    latLng, geoJSON: (data, options) => new GeoJSON(data, options), polyline: (points, options) => new Polyline(points, options),
    marker: (position, options) => new Marker(position, options), divIcon: options => ({ options }) } };
}

function fixture() {
  const document = new DocumentModel(), before = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: document, writable: true, configurable: true });
  const model = leafModel(document), map = new model.MapModel(), selectedRoutes = new Set(), selectedAreas = new Set();
  const state = { selection: { selectedRoutes, selectedAreas, routesEnabled: true, areasEnabled: true }, routeSelections: [], areaSelections: [], hitPublications: [], labelPublications: [] };
  const coordinator = createJourneyLayers(model.L, map, { alive: () => map.alive, getSelection: () => state.selection,
    onSelectRoute: value => state.routeSelections.push(value), onSelectArea: value => state.areaSelections.push(value),
    onHits: value => { state.hitPublications.push(value); state.onHits?.(value); },
    onLabels: value => { state.labelPublications.push(value); state.onLabels?.(value); } });
  const cleanup = () => {
    coordinator.dispose(); map.remove();
    if (before) Object.defineProperty(globalThis, 'document', before); else delete globalThis.document;
  };
  return { ...model, document, map, state, coordinator, cleanup };
}

const ring = (x = 0, y = 0, size = .04) => [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]];
const polygon = (x = 0) => ({ type: 'Polygon', coordinates: [ring(x)] });
const route = (id, offset = 0, points = 2) => ({ id, label: `Route ${id}`, coordinates: Array.from({ length: points }, (_, i) => [offset + i * .001, offset + i * .002]) });
const area = (id, geometry = polygon()) => ({ id, label: `Area ${id}`, geometry });
const input = values => ({ routes: [], areas: [], ...values });
const hit = (coordinator, kind, id) => coordinator.hits().find(value => value.kind === kind && value.id === id);
const nativeFor = (map, path) => [...map.layers].find(layer => layer.getElement?.() === path);

test('same route ID reuses its native path and caption while selection reads the latest data', () => {
  const f = fixture();
  try {
    const first = route('main'), initial = input({ routes: [first] });
    assert.equal(f.coordinator.sync(initial), true);
    const firstHit = hit(f.coordinator, 'route', 'main'), native = nativeFor(f.map, firstHit.path), caption = f.coordinator.labels()[0].node;
    assert.equal(firstHit.path.getAttribute('role'), 'button'); assert.equal(firstHit.path.getAttribute('tabindex'), '0');
    const next = { ...route('main', .1, 4), label: 'Changed main road', color: '#884422', width: 7 };
    assert.equal(f.coordinator.sync(input({ routes: [next] })), true);
    assert.equal(nativeFor(f.map, hit(f.coordinator, 'route', 'main').path), native);
    assert.equal(f.coordinator.labels()[0].node, caption);
    assert.equal(native.options.color, '#884422'); assert.equal(native.getLatLngs().length, 4);
    assert.equal(hit(f.coordinator, 'route', 'main').path.getAttribute('aria-label'), next.label);
    native.fire('click'); assert.equal(f.state.routeSelections.at(-1), next);
    firstHit.path.dispatch('keydown', { key: ' ' }); assert.equal(f.state.routeSelections.at(-1), next);
    assert.equal(native.listenerCount('click'), 1); assert.equal(firstHit.path.listenerCount('keydown'), 1);
    f.state.selection.routesEnabled = false; f.coordinator.refreshSelection();
    native.fire('click'); firstHit.path.dispatch('keydown', { key: 'Enter' });
    assert.equal(f.state.routeSelections.length, 2); assert.equal(firstHit.path.getAttribute('role'), 'img');
    assert.equal(firstHit.path.getAttribute('tabindex'), '-1'); assert.equal(firstHit.path.style.pointerEvents, 'none');
  } finally { f.cleanup(); }
});

test('area geometry replacement preserves its group, cleans the old path and restores only same-entity model focus', () => {
  const f = fixture();
  try {
    const initial = area('courtyard'); f.coordinator.sync(input({ areas: [initial] }));
    const oldPath = hit(f.coordinator, 'area', initial.id).path, oldNative = nativeFor(f.map, oldPath);
    const group = [...f.map.layers].find(layer => layer instanceof f.GeoJSON);
    oldPath.focus();
    const donut = { type: 'MultiPolygon', coordinates: [[ring(), ring(.01, .01, .01)], [ring(.1, .1, .02)]] };
    const next = { ...area(initial.id, donut), label: 'Updated courtyard', color: '#226644' };
    f.coordinator.sync(input({ areas: [next] }));
    const current = hit(f.coordinator, 'area', initial.id).path;
    assert.equal([...f.map.layers].find(layer => layer instanceof f.GeoJSON), group);
    assert.notEqual(current, oldPath); assert.equal(f.document.activeElement, current);
    assert.equal(group.lastData, donut); assert.equal(f.coordinator.snapshot().areas[0].geometry, donut);
    assert.equal(donut.coordinates[0].length, 2, 'the hole remains supplied geometry, never a filled bbox');
    assert.equal(oldPath.listenerCount('keydown'), 0); assert.equal(oldNative.listenerCount('click'), 0);
    oldPath.dispatch('keydown', { key: 'Enter' }); oldNative.fire('click'); assert.equal(f.state.areaSelections.length, 0);
    current.dispatch('keydown', { key: 'Enter' }); assert.equal(f.state.areaSelections.at(-1), next);
  } finally { f.cleanup(); }
});

test('same area geometry updates metadata and selection without replacing its native group, path or caption', () => {
  const f = fixture();
  try {
    const initial = area('zone'); f.coordinator.sync(input({ areas: [initial] }));
    const path = hit(f.coordinator, 'area', 'zone').path, native = nativeFor(f.map, path);
    const group = [...f.map.layers].find(layer => layer instanceof f.GeoJSON), caption = f.coordinator.labels()[0].node;
    const next = { ...initial, label: 'Updated shared area', color: '#664488', labelPosition: { latitude: .015, longitude: .018 } };
    f.coordinator.sync(input({ areas: [next] }));
    assert.equal([...f.map.layers].find(layer => layer instanceof f.GeoJSON), group);
    assert.equal(hit(f.coordinator, 'area', 'zone').path, path); assert.equal(f.coordinator.labels()[0].node, caption);
    assert.equal(native.options.color, next.color); assert.equal(path.getAttribute('aria-label'), next.label);
    assert.equal(native.listenerCount('click'), 1); assert.equal(path.listenerCount('keydown'), 1);
    const captionMarker = [...f.map.layers].find(layer => layer.options?.icon?.options?.html === caption);
    assert.deepEqual([captionMarker.getLatLng().lat, captionMarker.getLatLng().lng], [.015, .018]);
    assert.equal(captionMarker.options.interactive, false); assert.equal(captionMarker.options.keyboard, false);
    assert.equal(captionMarker.getElement().getAttribute('aria-hidden'), 'true');
    native.fire('click'); path.dispatch('keydown', { key: 'Enter' });
    assert.deepEqual(f.state.areaSelections, [next, next]);
    f.state.selection.areasEnabled = false; f.coordinator.refreshSelection();
    native.fire('click'); path.dispatch('keydown', { key: ' ' });
    assert.equal(f.state.areaSelections.length, 2); assert.equal(path.getAttribute('aria-pressed'), null);
    assert.equal(path.getAttribute('role'), 'img'); assert.equal(path.getAttribute('tabindex'), '-1');
  } finally { f.cleanup(); }
});

test('selected-on-top hit order, absent selected IDs and restoration do not choose another entity', () => {
  const f = fixture();
  try {
    const a = route('a'), b = route('b'), zone = area('zone');
    f.coordinator.sync(input({ routes: [a, b], areas: [zone] }));
    f.state.selection.selectedRoutes = new Set(['a']); f.state.selection.selectedAreas = new Set(['zone']); f.coordinator.refreshSelection();
    assert.deepEqual(f.map.svg.children, [hit(f.coordinator, 'area', 'zone').path, hit(f.coordinator, 'route', 'b').path, hit(f.coordinator, 'route', 'a').path]);
    assert.equal(hit(f.coordinator, 'route', 'a').path.getAttribute('aria-pressed'), 'true');
    f.coordinator.sync(input({ routes: [b] }));
    assert.equal(hit(f.coordinator, 'route', 'b').path.getAttribute('aria-pressed'), 'false');
    assert.deepEqual([...f.state.selection.selectedRoutes], ['a']); assert.deepEqual([...f.state.selection.selectedAreas], ['zone']);
    f.coordinator.sync(input({ routes: [a, b], areas: [zone] }));
    assert.equal(hit(f.coordinator, 'route', 'a').path.getAttribute('aria-pressed'), 'true');
    assert.equal(hit(f.coordinator, 'area', 'zone').path.getAttribute('aria-pressed'), 'true');
    assert.equal(f.state.routeSelections.length + f.state.areaSelections.length, 0);
  } finally { f.cleanup(); }
});

test('far-near-far uses only active inputs before native-model hit and caption creation', () => {
  const f = fixture();
  try {
    const geography = { type: 'Feature', properties: { mapRole: 'boundary' }, geometry: { type: 'Polygon', coordinates: [ring(-.01, -.01, .07)] } };
    const main = route('main'), far = input({ routes: [main], geography });
    const [start, end] = main.coordinates;
    const fullRoad = { ...main, coordinates: Array.from({ length: 18 }, (_, i) => i === 0 ? start : i === 17 ? end : start.map((value, axis) => value + (end[axis] - value) * i / 17)) };
    const lane = route('lane', .02, 12), courtyard = area('court', { type: 'Polygon', coordinates: [ring(), ring(.01, .01, .01)] });
    const near = input({ routes: [fullRoad, lane], areas: [courtyard], geography }), original = JSON.stringify(near);
    assert.deepEqual([fullRoad.coordinates[0], fullRoad.coordinates.at(-1)], main.coordinates, 'near geometry only subdivides the same main-road endpoints');
    const contained = point => point.every(value => value >= -.01 && value <= .06);
    assert.ok([...fullRoad.coordinates, ...lane.coordinates, ...courtyard.geometry.coordinates.flat()].every(contained), 'both levels use the same fixed synthetic coverage');
    // Counts below describe supplied vertices and fake native objects only, not
    // measured projection calls, browser layout, or performance improvement.
    const measurements = [];
    let originalMain;
    for (const active of [far, near, far]) {
      f.coordinator.sync(active);
      const snapshot = f.coordinator.snapshot();
      measurements.push({ suppliedRoutes: active.routes.length, derivedRouteVertices: snapshot.routePoints.reduce((sum, points) => sum + points.length, 0), modelHits: f.coordinator.hits().length, modelLabels: f.coordinator.labels().length, modelPaths: f.map.svg.children.length, modelCaptionNodes: f.map.markerPane.children.length });
      const currentMain = nativeFor(f.map, hit(f.coordinator, 'route', 'main').path);
      if (!originalMain) originalMain = currentMain; else assert.equal(currentMain, originalMain);
    }
    assert.deepEqual(measurements, [
      { suppliedRoutes: 1, derivedRouteVertices: 2, modelHits: 1, modelLabels: 1, modelPaths: 1, modelCaptionNodes: 1 },
      { suppliedRoutes: 2, derivedRouteVertices: 30, modelHits: 3, modelLabels: 3, modelPaths: 3, modelCaptionNodes: 3 },
      { suppliedRoutes: 1, derivedRouteVertices: 2, modelHits: 1, modelLabels: 1, modelPaths: 1, modelCaptionNodes: 1 },
    ]);
    f.coordinator.sync(near); assert.equal(f.coordinator.snapshot().areas[0].geometry.coordinates.length, 2);
    assert.equal(JSON.stringify(near), original, 'original recoverable level data is never mutated');
  } finally { f.cleanup(); }
});

test('same references skip derivation and decorative fills never enlarge fit bounds', () => {
  const f = fixture();
  try {
    const geography = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { mapRole: 'boundary' }, geometry: polygon() }] };
    const landCover = { type: 'Feature', properties: { id: 'forest' }, geometry: polygon(.2) };
    const water = { type: 'Feature', properties: { id: 'water' }, geometry: polygon(.4) };
    const initial = input({ geography, landCover, water }); f.coordinator.sync(initial);
    const snapshot = f.coordinator.snapshot(), before = { ...f.stats };
    assert.equal(snapshot.boundaries.length, 1); assert.equal(snapshot.boundaries[0].role, 'boundary');
    assert.equal(snapshot.bounds.length, 5); assert.equal(f.coordinator.hits().length, 0);
    assert.equal(f.coordinator.sync({ ...initial }), false); assert.equal(f.coordinator.snapshot(), snapshot); assert.deepEqual(f.stats, before);
    const replacement = { ...water, geometry: polygon(.6) }; f.coordinator.sync({ ...initial, water: replacement });
    assert.equal(f.coordinator.snapshot().water, replacement); assert.equal(f.coordinator.snapshot().bounds, snapshot.bounds);
    assert.equal(f.coordinator.snapshot().revision, snapshot.revision + 1); assert.deepEqual(f.stats, before);
  } finally { f.cleanup(); }
});

test('invalid identities, invalid coordinates and invalid areas cannot create duplicate or unnamed hit controls', () => {
  const f = fixture();
  try {
    const good = route('valid'), zone = area('valid-area');
    const bad = { id: 'bad-coordinates', label: 'Invalid coordinates', coordinates: [[NaN, 0], [0, 181]] };
    f.coordinator.sync(input({ routes: [good, { ...route('valid'), label: 'Duplicate' }, route(''), bad], areas: [zone, { ...zone }, area(''), { ...area('broken'), geometry: { type: 'Polygon', coordinates: [] } }] }));
    assert.deepEqual(f.coordinator.hits().map(value => [value.kind, value.id]), [['area', 'valid-area'], ['route', 'valid']]);
    assert.equal(f.coordinator.snapshot().routes.filter(value => value.id === 'valid').length, 1);
    assert.ok(f.coordinator.snapshot().routePoints.flat().every(point => Number.isFinite(point.lat) && Number.isFinite(point.lng)));
  } finally { f.cleanup(); }
});

test('a one-point route remains fit-eligible without a native hit or caption and reconciles back safely', () => {
  const f = fixture();
  try {
    const single = route('one', .1, 1); f.coordinator.sync(input({ routes: [single] }));
    assert.equal(f.coordinator.snapshot().bounds.length, 1); assert.equal(f.coordinator.hits().length, 0); assert.equal(f.coordinator.labels().length, 0);
    assert.equal(f.map.layers.size, 0);
    f.coordinator.sync(input({ routes: [route('one', .1, 2)] }));
    const path = hit(f.coordinator, 'route', 'one').path, native = nativeFor(f.map, path);
    f.coordinator.sync(input({ routes: [single] }));
    assert.equal(f.coordinator.snapshot().bounds.length, 1); assert.equal(f.map.layers.size, 0);
    assert.equal(path.listenerCount('keydown'), 0); assert.equal(native.listenerCount('click'), 0);
    path.dispatch('keydown', { key: 'Enter' }); native.fire('click'); assert.equal(f.state.routeSelections.length, 0);
  } finally { f.cleanup(); }
});

test('deleted and disposed records release both listener kinds and every retained node becomes inert', () => {
  const f = fixture();
  try {
    const data = input({ routes: [route('road')], areas: [area('plot')] }); f.coordinator.sync(data);
    const previous = f.coordinator.hits().map(value => ({ path: value.path, layer: nativeFor(f.map, value.path) }));
    f.coordinator.sync(input({}));
    for (const value of previous) {
      assert.equal(value.path.listenerCount('keydown'), 0); assert.equal(value.layer.listenerCount('click'), 0);
      value.path.dispatch('keydown', { key: 'Enter' }); value.layer.fire('click');
    }
    assert.equal(f.state.routeSelections.length + f.state.areaSelections.length, 0);
    assert.equal(f.map.svg.children.length, 0); assert.equal(f.map.markerPane.children.length, 0);
    f.coordinator.sync(data); const retained = f.coordinator.hits().map(value => ({ path: value.path, layer: nativeFor(f.map, value.path) }));
    f.coordinator.dispose(); const writes = f.stats.nativeWrites;
    assert.equal(f.coordinator.sync(data), false); f.coordinator.refreshSelection();
    for (const value of retained) { value.path.dispatch('keydown', { key: ' ' }); value.layer.fire('click'); }
    assert.equal(f.stats.nativeWrites, writes); assert.equal(f.coordinator.hits().length, 0); assert.equal(f.coordinator.labels().length, 0);
  } finally { f.cleanup(); }
});

test('same-area geometry replacement never steals externally moved model focus', () => {
  const f = fixture();
  try {
    f.coordinator.sync(input({ areas: [area('zone')] }));
    const old = hit(f.coordinator, 'area', 'zone').path, external = f.document.createElement('button'); f.document.body.appendChild(external); old.focus();
    f.document.onRemoval = node => { if (node === old) external.focus(); };
    f.coordinator.sync(input({ areas: [area('zone', polygon(.1))] }));
    assert.equal(f.document.activeElement, external);
  } finally { f.cleanup(); }
});

test('synchronous removal while adding a native path stops remaining native writes and publications', () => {
  const f = fixture();
  try {
    let stoppedAt;
    f.map.onAdd = layer => {
      if (layer instanceof f.Polyline) { f.map.remove(); f.coordinator.dispose(); stoppedAt = f.stats.nativeWrites; }
    };
    assert.doesNotThrow(() => f.coordinator.sync(input({ routes: [route('road'), route('later', .1)] })));
    assert.notEqual(stoppedAt, undefined); assert.equal(f.stats.nativeWrites, stoppedAt);
    assert.equal(f.coordinator.hits().length, 0); assert.equal(f.coordinator.labels().length, 0);
    assert.equal(f.state.hitPublications.length + f.state.labelPublications.length, 0);
  } finally { f.cleanup(); }
});

test('synchronous disposal from hit publication prevents subsequent labels and native work', () => {
  const f = fixture();
  try {
    let stoppedAt;
    f.state.onHits = () => { f.coordinator.dispose(); stoppedAt = f.stats.nativeWrites; };
    assert.equal(f.coordinator.sync(input({ routes: [route('road')], areas: [area('zone')] })), false);
    assert.equal(f.state.hitPublications.length, 1); assert.equal(f.state.labelPublications.length, 0);
    assert.equal(f.stats.nativeWrites, stoppedAt); assert.equal(f.coordinator.hits().length, 0); assert.equal(f.coordinator.labels().length, 0);
  } finally { f.cleanup(); }
});
