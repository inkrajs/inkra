import type * as Leaflet from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import { areaPolygons, journeyAreaLabel, validJourneyArea, type JourneyArea, type JourneyRoute } from './annotations.js';

export interface JourneyLayerInputs {
  routes: readonly JourneyRoute[];
  areas: readonly JourneyArea[];
  geography?: GeoJsonObject;
  landCover?: GeoJsonObject;
  water?: GeoJsonObject;
}

export interface JourneyLayerHit {
  kind: 'route' | 'area';
  id: string;
  label: string;
  path: Element;
}

export interface JourneyLayerLabel {
  kind: 'route' | 'area';
  id: string;
  label: string;
  node: HTMLElement;
}

export interface JourneyLayerSelection {
  selectedRoutes: ReadonlySet<string>;
  selectedAreas: ReadonlySet<string>;
  routesEnabled: boolean;
  areasEnabled: boolean;
}

export interface JourneyLayerSnapshot {
  revision: number;
  routes: readonly JourneyRoute[];
  routePoints: Leaflet.LatLng[][];
  areas: readonly JourneyArea[];
  boundaries: { points: Leaflet.LatLng[]; role: string }[];
  geography?: GeoJsonObject;
  landCover?: GeoJsonObject;
  water?: GeoJsonObject;
  /** Existing fit eligibility: geography, routes and areas, never decorative fills. */
  bounds: Leaflet.LatLng[];
}

export interface JourneyLayerOptions {
  alive: () => boolean;
  getSelection: () => JourneyLayerSelection;
  onSelectRoute: (route: JourneyRoute) => void;
  onSelectArea: (area: JourneyArea) => void;
  onHits?: (hits: JourneyLayerHit[]) => void;
  onLabels?: (labels: JourneyLayerLabel[]) => void;
}

interface Binding {
  hit: JourneyLayerHit;
  dispose: () => void;
}
interface Caption {
  value: JourneyLayerLabel;
  marker: Leaflet.Marker;
  position: Leaflet.LatLng;
}
interface RecordBase {
  kind: 'route' | 'area';
  id: string;
  active: boolean;
  bindings: Binding[];
  caption?: Caption;
}
interface RouteRecord extends RecordBase {
  kind: 'route';
  data: JourneyRoute;
  points: Leaflet.LatLng[];
  layer?: Leaflet.Polyline;
}
interface AreaRecord extends RecordBase {
  kind: 'area';
  data: JourneyArea;
  layer?: Leaflet.GeoJSON;
}
interface FocusRequest { id: string; previous: Element; document: Document }

const validId = (id: unknown): id is string => typeof id === 'string' && id.trim().length > 0;
const emptySnapshot = (revision = 0): JourneyLayerSnapshot => ({ revision, routes: [], routePoints: [], areas: [], boundaries: [], bounds: [] });
const sameInputs = (a: JourneyLayerInputs | undefined, b: JourneyLayerInputs) => a !== undefined &&
  a.routes === b.routes && a.areas === b.areas && a.geography === b.geography && a.landCover === b.landCover && a.water === b.water;

/** Keep native hit order identical to area-then-route, selected-on-top paint order. */
export function applyJourneyLayerSelection(hits: readonly JourneyLayerHit[], selection: JourneyLayerSelection): void {
  for (const hit of hits) {
    const enabled = hit.kind === 'route' ? selection.routesEnabled : selection.areasEnabled;
    const selected = (hit.kind === 'route' ? selection.selectedRoutes : selection.selectedAreas).has(hit.id);
    (hit.path as HTMLElement).style.pointerEvents = enabled ? 'auto' : 'none';
    hit.path.setAttribute('role', enabled ? 'button' : 'img');
    hit.path.setAttribute('tabindex', enabled ? '0' : '-1');
    hit.path.setAttribute('aria-label', hit.label);
    if (enabled) hit.path.setAttribute('aria-pressed', String(selected)); else hit.path.removeAttribute('aria-pressed');
  }
  const order = [...hits].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'area' ? -1 : 1;
    const ids = a.kind === 'area' ? selection.selectedAreas : selection.selectedRoutes;
    return Number(ids.has(a.id)) - Number(ids.has(b.id));
  });
  for (const hit of order) hit.path.parentNode?.appendChild(hit.path);
}

/** Reconcile only the currently supplied immutable collections. No camera APIs. */
export function createJourneyLayers(L: typeof import('leaflet'), map: Leaflet.Map, options: JourneyLayerOptions) {
  let active = true, syncing = false;
  let previous: JourneyLayerInputs | undefined;
  let current = emptySnapshot();
  let currentHits: JourneyLayerHit[] = [], currentLabels: JourneyLayerLabel[] = [];
  const routes = new Map<string, RouteRecord>();
  const areas = new Map<string, AreaRecord>();
  const live = () => active && options.alive();
  const isCurrent = (record: RecordBase) => record.active && (record.kind === 'route' ? routes.get(record.id) : areas.get(record.id)) === record;

  const clearBindings = (record: RecordBase) => {
    for (const binding of record.bindings) binding.dispose();
    record.bindings = [];
  };
  const removeCaption = (record: RecordBase) => {
    const caption = record.caption; record.caption = undefined;
    if (!caption) return;
    if (options.alive()) caption.marker.remove();
    caption.value.node.remove();
  };
  const removeRecord = (record: RouteRecord | AreaRecord) => {
    record.active = false;
    clearBindings(record); removeCaption(record);
    const layer = record.layer; record.layer = undefined;
    if (layer && options.alive()) layer.remove();
  };
  const bind = (record: RouteRecord | AreaRecord, layer: Leaflet.Path, label: string) => {
    if (!live() || !isCurrent(record)) return;
    const path = layer.getElement(); if (!path) return;
    path.classList.add('inkra-journey-map__feature-hit');
    let enabled = true;
    const hit: JourneyLayerHit = { kind: record.kind, id: record.id, label, path };
    const pick = () => {
      if (!enabled || !live() || !isCurrent(record)) return;
      const selection = options.getSelection();
      if (record.kind === 'route') { if (selection.routesEnabled) options.onSelectRoute(record.data); }
      else if (selection.areasEnabled) options.onSelectArea(record.data);
    };
    const keydown = (event: Event) => {
      const key = (event as KeyboardEvent).key;
      if (key === 'Enter' || key === ' ') { event.preventDefault(); event.stopPropagation(); pick(); }
    };
    layer.on('click', pick); path.addEventListener('keydown', keydown);
    record.bindings.push({ hit, dispose: () => {
      enabled = false; layer.off('click', pick); path.removeEventListener('keydown', keydown);
    } });
  };
  const caption = (record: RecordBase, label: string | undefined, position: Leaflet.LatLng | undefined) => {
    if (!live() || !record.active) return;
    if (!label || !position) { removeCaption(record); return; }
    if (!record.caption) {
      const node = document.createElement('span'); node.className = 'inkra-journey-map__caption';
      const marker = L.marker(position, { interactive: false, keyboard: false, icon: L.divIcon({ html: node, className: 'inkra-journey-map__caption-marker', iconSize: [0, 0] }) });
      record.caption = { value: { kind: record.kind, id: record.id, label, node }, marker, position };
      marker.addTo(map);
      if (!live()) return;
      marker.getElement()?.setAttribute('aria-hidden', 'true');
    } else {
      record.caption.value.label = label;
      if (record.caption.position.lat !== position.lat || record.caption.position.lng !== position.lng) {
        record.caption.position = position; record.caption.marker.setLatLng(position);
      }
    }
  };

  const boundaryPoints = (geography: GeoJsonObject | undefined) => {
    const boundaries: JourneyLayerSnapshot['boundaries'] = [];
    if (!geography) return boundaries;
    const layer = L.geoJSON(geography);
    const collect = (item: Leaflet.Layer, inheritedRole?: string) => {
      const roleValue = (item as Leaflet.Layer & { feature?: { properties?: Record<string, unknown> | null } }).feature?.properties?.mapRole;
      const role = typeof roleValue === 'string' ? roleValue : inheritedRole;
      if (item instanceof L.Polyline) {
        const flatten = (values: unknown[]) => {
          if (values[0] instanceof L.LatLng) {
            const ring = values as Leaflet.LatLng[];
            if (ring.length) boundaries.push({ points: item instanceof L.Polygon ? [...ring, ring[0]] : ring, role: role ?? (item instanceof L.Polygon ? 'boundary' : 'road') });
          } else for (const value of values) if (Array.isArray(value)) flatten(value);
        };
        flatten(item.getLatLngs());
      } else if (item instanceof L.LayerGroup) item.eachLayer(child => collect(child, role));
    };
    layer.eachLayer(collect);
    return boundaries;
  };

  const refreshSelection = () => { if (live()) applyJourneyLayerSelection(currentHits, options.getSelection()); };
  const restoreFocus = (request: FocusRequest | undefined) => {
    if (!request || !live() || !options.getSelection().areasEnabled) return;
    const focused = request.document.activeElement;
    if (focused && focused !== request.document.body && !(focused === request.previous && !request.previous.isConnected)) return;
    const target = currentHits.find(hit => hit.kind === 'area' && hit.id === request.id)?.path as HTMLElement | undefined;
    if (target?.isConnected && typeof target.focus === 'function') target.focus({ preventScroll: true });
  };

  const sync = (input: JourneyLayerInputs): boolean => {
    if (!live() || syncing || sameInputs(previous, input)) return false;
    syncing = true;
    try {
      const routeChanged = !previous || previous.routes !== input.routes;
      const areaChanged = !previous || previous.areas !== input.areas;
      const geographyChanged = !previous || previous.geography !== input.geography;
      const seenRoutes = new Set<string>(), seenAreas = new Set<string>();
      const nextRoutes = routeChanged ? input.routes.filter(route => {
        if (!route || !validId(route.id) || seenRoutes.has(route.id)) return false;
        seenRoutes.add(route.id); return true;
      }) : current.routes;
      const nextPoints = routeChanged ? nextRoutes.map(route => {
        const record = routes.get(route.id);
        if (record?.data.coordinates === route.coordinates) return record.points;
        return route.coordinates.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 85 && Math.abs(lng) <= 180).map(([lat, lng]) => L.latLng(lat, lng));
      }) : current.routePoints;
      const nextAreas = areaChanged ? input.areas.filter(area => {
        if (!area || !validId(area.id) || seenAreas.has(area.id) || !validJourneyArea(area)) return false;
        seenAreas.add(area.id); return true;
      }) : current.areas;
      const boundaries = geographyChanged ? boundaryPoints(input.geography) : current.boundaries;
      if (!live()) return false;
      const nextBounds = routeChanged || areaChanged || geographyChanged ? [
        ...boundaries.flatMap(boundary => boundary.points), ...nextPoints.flat(),
        ...nextAreas.flatMap(area => areaPolygons(area.geometry).flat(2).map(([lng, lat]) => L.latLng(lat, lng))),
      ] : current.bounds;
      let focus: FocusRequest | undefined;

      if (routeChanged) {
        const ids = new Set(nextRoutes.map(route => route.id));
        for (const [id, record] of routes) if (!ids.has(id)) { removeRecord(record); routes.delete(id); if (!live()) return false; }
        for (let index = 0; index < nextRoutes.length; index++) {
          if (!live()) return false;
          const data = nextRoutes[index], points = nextPoints[index];
          let record = routes.get(data.id);
          const geometryChanged = !record || record.data.coordinates !== data.coordinates;
          if (!record) { record = { kind: 'route', id: data.id, active: true, data, points, bindings: [] }; routes.set(data.id, record); }
          record.data = data; record.points = points;
          if (points.length < 2) {
            clearBindings(record); removeCaption(record);
            const layer = record.layer; record.layer = undefined;
            if (layer && options.alive()) layer.remove();
            continue;
          }
          if (!record.layer) {
            record.layer = L.polyline(points, { color: data.color || 'var(--inkra-accent)', weight: 18, opacity: 0, bubblingMouseEvents: false });
            record.layer.addTo(map);
            if (!live()) return false;
            bind(record, record.layer, data.label || data.id);
          } else {
            if (geometryChanged) record.layer.setLatLngs(points);
            if (!live()) return false;
            record.layer.setStyle({ color: data.color || 'var(--inkra-accent)', weight: 18, opacity: 0 });
          }
          if (!live()) return false;
          for (const binding of record.bindings) binding.hit.label = data.label || data.id;
          caption(record, data.label, points[Math.floor((points.length - 1) / 2)]);
        }
      }

      if (areaChanged) {
        const ids = new Set(nextAreas.map(area => area.id));
        for (const [id, record] of areas) if (!ids.has(id)) { removeRecord(record); areas.delete(id); if (!live()) return false; }
        for (const data of nextAreas) {
          if (!live()) return false;
          let record = areas.get(data.id);
          const geometryChanged = !record || record.data.geometry !== data.geometry;
          if (!record) { record = { kind: 'area', id: data.id, active: true, data, bindings: [] }; areas.set(data.id, record); }
          record.data = data;
          if (geometryChanged && record.layer) {
            const focused = record.bindings.find(binding => binding.hit.path.ownerDocument.activeElement === binding.hit.path)?.hit.path;
            if (focused) focus = { id: record.id, previous: focused, document: focused.ownerDocument };
            clearBindings(record); record.layer.clearLayers();
            if (!live()) return false;
            record.layer.addData(data.geometry);
            if (!live()) return false;
          }
          const style = { color: data.color || 'var(--inkra-accent)', weight: 1, opacity: 0, fillOpacity: 0 };
          if (!record.layer) {
            record.layer = L.geoJSON(data.geometry, { style, bubblingMouseEvents: false }); record.layer.addTo(map);
          } else record.layer.setStyle(style);
          if (!live()) return false;
          if (geometryChanged) {
            record.layer.eachLayer(layer => { if (live() && layer instanceof L.Path) bind(record!, layer, data.label); });
          }
          for (const binding of record.bindings) binding.hit.label = data.label;
          const [lng, lat] = journeyAreaLabel(data); caption(record, data.label, L.latLng(lat, lng));
        }
      }

      if (!live()) return false;
      previous = { ...input };
      current = { revision: current.revision + 1, routes: nextRoutes, routePoints: nextPoints, areas: nextAreas, boundaries,
        geography: input.geography, landCover: input.landCover, water: input.water, bounds: nextBounds };
      currentHits = [...nextAreas.flatMap(area => areas.get(area.id)?.bindings.map(binding => ({ ...binding.hit })) ?? []),
        ...nextRoutes.flatMap(route => routes.get(route.id)?.bindings.map(binding => ({ ...binding.hit })) ?? [])];
      currentLabels = [...nextAreas.flatMap(area => areas.get(area.id)?.caption?.value ? [{ ...areas.get(area.id)!.caption!.value }] : []),
        ...nextRoutes.flatMap(route => routes.get(route.id)?.caption?.value ? [{ ...routes.get(route.id)!.caption!.value }] : [])];
      refreshSelection();
      options.onHits?.(currentHits);
      if (!live()) return false;
      options.onLabels?.(currentLabels);
      if (!live()) return false;
      restoreFocus(focus);
      return live();
    } finally { syncing = false; }
  };

  return {
    sync,
    snapshot: () => current,
    hits: () => currentHits,
    labels: () => currentLabels,
    refreshSelection,
    dispose() {
      if (!active) return;
      active = false;
      for (const record of routes.values()) removeRecord(record);
      for (const record of areas.values()) removeRecord(record);
      routes.clear(); areas.clear(); previous = undefined;
      currentHits = []; currentLabels = []; current = emptySnapshot(current.revision + 1);
    },
  };
}
