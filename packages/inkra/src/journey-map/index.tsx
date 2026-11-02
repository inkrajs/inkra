import { useInkraLocale, type InkraTranslate } from '../i18n/index.js';
import { useEffect, useMemo, useRef, useState, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import type * as Leaflet from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import { Button } from '../Button.js';
import { Popover } from '../overlay/index.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { pencilStroke } from '../internal/stroke.js';
import { TravelIcon } from '../internal/travelIcons.js';
import { paintTerrain, paintStop, paintSea } from './terrain.js';
import { MapScale } from './MapScale.js';
import { seedToNumber } from '../internal/random.js';
import { createJourneyLeafletMap } from './lifecycle.js';
import { PENCIL_RENDERER_VERSION } from '../internal/cache.js';
import { JourneyBaseBitmap, journeyAnimationMs, journeyCanvasSize, journeyFocusZoom, journeyPanRegions, prepareJourneyCanvas, resolveJourneyMapRendering, type JourneyMapRendering } from './rendering.js';

export type { JourneyMapRendering, JourneyMapRenderingOptions } from './rendering.js';

import { attachJourneyTrackpad } from './trackpad.js';
import { areaPolygons, journeyAreaLabel, paintJourneyArea, validJourneyArea, type JourneyArea, type JourneyPlace, type JourneyRoute } from './annotations.js';
export type { JourneyArea, JourneyPlace, JourneyRoute } from './annotations.js';
export interface JourneyMapProps extends HTMLAttributes<HTMLDivElement> {
  places: readonly JourneyPlace[];
  /** [latitude, longitude]. Supplied geometry only; no routing or travel-time inference. */
  routes?: readonly JourneyRoute[];
  areas?: readonly JourneyArea[];
  selectedRoute?: string;
  onRouteSelect?: (route: JourneyRoute) => void;
  selectedArea?: string;
  onAreaSelect?: (area: JourneyArea) => void;
  showFeatureList?: boolean;
  geography?: GeoJsonObject;
  landCover?: GeoJsonObject;
  water?: GeoJsonObject;
  selectedPlace?: string;
  onPlaceSelect?: (place: JourneyPlace) => void;
  attribution: string;
  attributionDisplay?: 'inline' | 'popover';
  /** Viewport height in CSS px; minimum 240, default 480. Nonfinite values use the default. */
  height?: number;
  /** Maximum zoom used by fit/reset; 0..20, default 12. Use 18 for street-scale data. */
  maxFitZoom?: number;
  /** Paper suits street diagrams without an ocean layer; default sea. */
  background?: 'sea' | 'paper';
  /** Controls viewport gestures, not place selection or explicit zoom buttons. */
  interactive?: boolean;
  /** Ordinary wheel scrolling only; trackpad pinch remains enabled while interactive. */
  scrollWheelZoom?: boolean;
  showControls?: boolean;
  showPlaceList?: boolean;
  /** Focus pin/list clicks and later selectedPlace changes; initial view stays fitted. */
  focusSelectedPlace?: boolean;
  /** Magnification relative to the initial overview, 1..64; default 2. */
  focusZoomScale?: number;
  /** Animate programmatic view changes; reduced-motion preference always wins. */
  animate?: boolean;
  /** View transition duration in milliseconds, 0..5000; default 420. */
  animationDuration?: number;
  /** Auto uses bounded base caching, backing-store reuse and offscreen stroke rejection. */
  rendering?: JourneyMapRendering;
  labels?: { zoomIn: string; zoomOut: string; reset: string; unavailable: string; attribution?: string; features?: string };
}
const defaults = (t: InkraTranslate) => ({ zoomIn: t('common.zoomIn'), zoomOut: t('common.zoomOut'), reset: t('common.resetView'), unavailable: t('map.unavailable'), features: t('map.features') });
const noRoutes: readonly JourneyRoute[] = [];
const noAreas: readonly JourneyArea[] = [];
const valid = (place: JourneyPlace) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude) && Math.abs(place.latitude) <= 85 && Math.abs(place.longitude) <= 180;

export function JourneyMap({ places, routes = noRoutes, areas = noAreas, selectedRoute, onRouteSelect, selectedArea, onAreaSelect, showFeatureList = false, geography, landCover, water, selectedPlace, onPlaceSelect, attribution, attributionDisplay = 'inline', height = 480, maxFitZoom = 12, background = 'sea', interactive = true, scrollWheelZoom = false, showControls = true, showPlaceList = false, focusSelectedPlace = true, focusZoomScale = 2, animate = true, animationDuration = 420, rendering = 'auto', labels: labelOverrides, className, ...props }: JourneyMapProps) {
  const { t } = useInkraLocale();
  const defaultLabels = defaults(t);
  const labels = { ...defaultLabels, ...labelOverrides, features: labelOverrides?.features ?? defaultLabels.features };
  const usableAreas = useMemo(() => areas.filter(validJourneyArea), [areas]);
  const annotationSelection = useRef({ selectedRoute, onRouteSelect, selectedArea, onAreaSelect });
  annotationSelection.current = { selectedRoute, onRouteSelect, selectedArea, onAreaSelect };
  const featureHits = useRef<{ kind: 'route' | 'area'; id: string; label: string; path: Element }[]>([]);
  const [featureLabels, setFeatureLabels] = useState<{ kind: 'route' | 'area'; id: string; label: string; node: HTMLElement }[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const fitRef = useRef<() => void>(() => {});
  const paintRef = useRef<() => void>(() => {});
  const viewRef = useRef<(center: Leaflet.LatLngExpression, zoom: number) => void>(() => {});
  const zoomRef = useRef<(delta: number) => void>(() => {});
  const focusRef = useRef<(place: JourneyPlace) => void>(() => {});
  const fitZoomRef = useRef(2);
  const selectionRef = useRef(onPlaceSelect);
  selectionRef.current = onPlaceSelect;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [placeLabels, setPlaceLabels] = useState<{ place: JourneyPlace; node: HTMLElement; icon: HTMLElement }[]>([]);
  const selectedRef = useRef(selectedPlace);
  selectedRef.current = selectedPlace;
  const previousSelection = useRef({ place: selectedPlace, scale: focusZoomScale });
  const viewOptions = useRef({ animate, animationDuration, focusSelectedPlace, focusZoomScale });
  viewOptions.current = { animate, animationDuration, focusSelectedPlace, focusZoomScale };
  const selectPlace = (place: JourneyPlace, fromList = false) => {
    const selectionMap = mapRef.current;
    if (viewOptions.current.focusSelectedPlace) focusRef.current(place);
    else if (fromList && mapRef.current) viewRef.current([place.latitude, place.longitude], mapRef.current.getZoom());
    if (selectionMap && (mapRef.current !== selectionMap || !selectionMap.getPane('mapPane'))) return;
    selectionRef.current?.(place);
  };
  const markersRef = useRef<{ place: JourneyPlace; marker: Leaflet.Marker }[]>([]);
  const renderingOptions = resolveJourneyMapRendering(rendering);
  const renderingRef = useRef(renderingOptions);
  renderingRef.current = renderingOptions;
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    setReady(false);
    setFailed(false);
    setPlaceLabels([]); setFeatureLabels([]); featureHits.current = [];
    void import('leaflet').then(L => {
      if (cancelled || !host.current) return;
      let disposed = false;
      const map = createJourneyLeafletMap(L.Map, host.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, zoomSnap: .1, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([0, 0], 2);
      const alive = () => !disposed && !cancelled && Boolean(map.getPane('mapPane'));
      mapRef.current = map;
      cleanup = () => { disposed = true; map.remove(); mapRef.current = null; markersRef.current = []; };
      const points = places.filter(valid);
      const boundaries: Leaflet.LatLng[][] = [];
      if (geography) {
        const layer = L.geoJSON(geography);
        const collect = (item: Leaflet.Layer) => {
          if (item instanceof L.Polyline) {
            const flatten = (values: unknown[]) => {
              if (values[0] instanceof L.LatLng) {
                const ring = values as Leaflet.LatLng[];
                boundaries.push(item instanceof L.Polygon ? [...ring, ring[0]] : ring);
              }
              else values.forEach(value => { if (Array.isArray(value)) flatten(value); });
            };
            flatten(item.getLatLngs());
          } else if (item instanceof L.LayerGroup) item.eachLayer(collect);
        };
        layer.eachLayer(collect);
      }
      const routePoints = routes.map(route => route.coordinates.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 85 && Math.abs(lng) <= 180).map(([lat, lng]) => L.latLng(lat, lng)));
      const all = [...points.map(place => L.latLng(place.latitude, place.longitude)), ...boundaries.flat(), ...routePoints.flat(), ...usableAreas.flatMap(area => areaPolygons(area.geometry).flat(2).map(([lng, lat]) => L.latLng(lat, lng)))];
      const areaLayers = usableAreas.map(area => L.geoJSON(area.geometry, { style: { color: area.color || 'var(--inkra-accent)', weight: 1, opacity: 0, fillOpacity: 0 }, bubblingMouseEvents: false }));
      const routeLayers = routePoints.map((line, i) => L.polyline(line, { color: routes[i].color || 'var(--inkra-accent)', weight: 18, opacity: 0, bubblingMouseEvents: false }));
      const captions: { kind: 'route' | 'area'; id: string; label: string; node: HTMLElement }[] = [];
      const caption = (kind: 'route' | 'area', id: string, label: string, position: Leaflet.LatLngExpression) => {
        const node = document.createElement('span'); node.className = 'inkra-journey-map__caption';
        const marker = L.marker(position, { interactive: false, keyboard: false, icon: L.divIcon({ html: node, className: 'inkra-journey-map__caption-marker', iconSize: [0, 0] }) }).addTo(map);
        marker.getElement()?.setAttribute('aria-hidden', 'true'); captions.push({ kind, id, label, node });
      };
      const hit = (layer: Leaflet.Path, kind: 'route' | 'area', id: string, label: string, select: () => void) => {
        const path = layer.getElement(); if (!path) return;
        path.classList.add('inkra-journey-map__feature-hit');
        featureHits.current.push({ kind, id, label, path });
        const pick = () => { if (alive()) select(); };
        layer.on('click', pick);
        path.addEventListener('keydown', event => {
          const key = (event as KeyboardEvent).key;
          if (key === 'Enter' || key === ' ') { event.preventDefault(); event.stopPropagation(); pick(); }
        });
      };
      areaLayers.forEach((group, i) => {
        const area = usableAreas[i]; group.addTo(map);
        group.eachLayer(layer => { if (layer instanceof L.Path) hit(layer, 'area', area.id, area.label, () => annotationSelection.current.onAreaSelect?.(area)); });
        const [lng, lat] = journeyAreaLabel(area); caption('area', area.id, area.label, [lat, lng]);
      });
      routeLayers.forEach((layer, i) => {
        const route = routes[i]; layer.addTo(map);
        if (routePoints[i].length < 2) return;
        hit(layer, 'route', route.id, route.label || route.id, () => annotationSelection.current.onRouteSelect?.(route));
        if (route.label) caption('route', route.id, route.label, routePoints[i][Math.floor((routePoints[i].length - 1) / 2)]);
      });
      setFeatureLabels(captions);
      let fitted = false;
      const fit = (animated = false) => {
        if (!alive()) return;
        map.invalidateSize();
        if (!alive()) return;
        const size = map.getSize();
        if (size.x <= 0 || size.y <= 0) return;
        if (all.length) {
          const bounds = L.latLngBounds(all);
          const zoom = Math.min(map.getBoundsZoom(bounds, false, L.point(88, 88)), Number.isFinite(maxFitZoom) ? Math.max(0, Math.min(20, maxFitZoom)) : 12);
          const center = map.unproject(map.project(bounds.getSouthWest(), zoom).add(map.project(bounds.getNorthEast(), zoom)).divideBy(2), zoom);
          fitZoomRef.current = zoom;
          if (animated) viewRef.current(center, zoom);
          else map.setView(center, zoom, { animate: false });
        } else fitZoomRef.current = map.getZoom();
        fitted = true;
      };
      fitRef.current = () => fit(true);
      const canvas = document.createElement('canvas');
      canvas.className = 'inkra-journey-map__ink';
      canvas.setAttribute('aria-hidden', 'true');
      host.current.append(canvas);
      const base = new JourneyBaseBitmap();
      const pinSurfaces: { place: JourneyPlace; canvas: HTMLCanvasElement; key: string; restore: () => void }[] = [];
      const paintPins = () => {
        if (!alive()) return;
        const style = getComputedStyle(host.current!);
        const defaultInk = style.getPropertyValue('--inkra-accent-strong').trim();
        const paper = style.getPropertyValue('--inkra-paper').trim();
        const size = journeyCanvasSize(44, 44, window.devicePixelRatio || 1)!;
        for (const pin of pinSurfaces) {
          if (pin.place.icon !== undefined && pin.place.icon !== null && pin.place.icon !== false) continue;
          const selected = selectedRef.current === pin.place.id;
          pin.canvas.style.color = defaultInk;
          if (pin.place.color) pin.canvas.style.color = pin.place.color;
          const ink = getComputedStyle(pin.canvas).color;
          const key = JSON.stringify([PENCIL_RENDERER_VERSION, ink, paper, size.dpr, selected]);
          if (pin.key === key) continue;
          const context = prepareJourneyCanvas(pin.canvas, size, true);
          if (!context) continue;
          paintStop(context, 22, 22, seedToNumber(pin.place.id), ink, paper, selected);
          pin.key = key;
        }
      };
      let frame = 0;
      let animating = false, preparingView = false;
      let activeView: { center: Leaflet.LatLng; zoom: number } | undefined;
      let paintOrigin = map.containerPointToLatLng([0, 0]), paintZoom = map.getZoom();
      let paintWidth = 0, paintHeight = 0, previousSignature = '', previousKey = '';
      const paint = () => {
        frame = 0;
        if (!alive()) return;
        const viewport = map.getSize();
        if (!viewport.x || !viewport.y) return;
        // A small reserve keeps ordinary pans on the compositor. Larger pans
        // replenish only exposed strips, within the same backing-store budgets.
        let padding = 64;
        let size = journeyCanvasSize(viewport.x + padding * 2, viewport.y + padding * 2, window.devicePixelRatio || 1);
        if (!size) { padding = 0; size = journeyCanvasSize(viewport.x, viewport.y, window.devicePixelRatio || 1, true); }
        if (!size) { base.clear(); canvas.width = canvas.height = 0; return; }
        const { width, height } = size;
        const options = renderingRef.current;
        // Release the old snapshot before resizing the main canvas so the two
        // live backing stores stay within the combined six-Mi-pixel budget.
        if (!options.cacheBase || canvas.width !== size.pixelWidth || canvas.height !== size.pixelHeight) base.clear();
        const context = prepareJourneyCanvas(canvas, size, options.reuseCanvas);
        if (!context) return;
        const zoom = map.getZoom();
        const style = getComputedStyle(host.current!);
        const paper = style.getPropertyValue('--inkra-paper').trim();
        const dark = Number.parseInt(paper.replace('#', '').slice(0, 2), 16) < 100;
        const border = style.getPropertyValue('--inkra-border-strong').trim();
        const accent = style.getPropertyValue('--inkra-accent').trim();
        const colors = featureHits.current.map(item => getComputedStyle(item.path).stroke || accent);
        const colorLookup = new Map(featureHits.current.map((item, i) => [`${item.kind}:${item.id}`, colors[i]]));
        const featureColor = (kind: 'route' | 'area', id: string) => {
          const color = colorLookup.get(`${kind}:${id}`);
          return color && color !== 'none' ? color : accent;
        };
        const selection = annotationSelection.current;
        const project = (position: number[]): [number, number] => { const point = map.latLngToContainerPoint([position[1], position[0]]); return [point.x + padding, point.y + padding]; };
        const origin = project([0, 0]);
        // Data belongs to this effect instance. Its cleanup releases the bitmap;
        // the remaining key covers every base-pixel input that can change in it.
        const signature = JSON.stringify([PENCIL_RENDERER_VERSION, 'journey-base-v2', background, width, height, size.pixelWidth, size.pixelHeight, size.dpr,
          zoom, paper, dark, border, accent, colors, selection.selectedRoute, selection.selectedArea, options.boundaryViewport, options.terrainViewport]);
        const baseKey = signature + JSON.stringify(origin);
        const draw = (line: Leaflet.LatLng[], color: string, seed: number, weight: number, x: number, y: number, w: number, h: number) => {
          const projected = line.map(point => { const p = map.latLngToContainerPoint(point); return [p.x + padding - x, p.y + padding - y] as [number, number]; });
          pencilStroke(context, projected, color, weight, seed, .3, 3, false, { grain: .7, breaks: .15, variation: .8, gain: 2.5, step: .8,
            ...(options.boundaryViewport ? { viewport: [w, h] as const, viewportTop: -8 } : {}) });
        };
        if (!options.cacheBase || !base.restore(context, baseKey)) {
          const oldOrigin = map.latLngToContainerPoint(paintOrigin);
          const offsetX = (oldOrigin.x + padding) * size.dpr, offsetY = (oldOrigin.y + padding) * size.dpr;
          const pixelX = Math.round(offsetX), pixelY = Math.round(offsetY);
          const dx = pixelX / size.dpr, dy = pixelY / size.dpr;
          // Fractional backing-pixel copies would repeatedly blur pencil ink.
          // Geographic round trips can add tiny floating-point residue.
          const aligned = Math.abs(offsetX - pixelX) < 1e-6 && Math.abs(offsetY - pixelY) < 1e-6;
          const shifted = options.cacheBase && previousSignature === signature && aligned
            && Math.abs(dx) < width && Math.abs(dy) < height
            && base.restore(context, previousKey, [pixelX, pixelY]);
          const regions = shifted ? journeyPanRegions(width, height, dx, dy) : [[0, 0, width, height] as const];
          for (const [x, y, w, h] of regions) {
            context.save(); context.translate(x, y);
            context.beginPath(); context.rect(0, 0, w, h); context.clip();
            const localProject = (position: number[]): [number, number] => { const p = project(position); return [p[0] - x, p[1] - y]; };
            if (background === 'sea') paintSea(context, w, h, localProject([0, 0]));
            if (geography) paintTerrain(context, geography, localProject, w, h, dark, 'land', options.terrainViewport);
            if (landCover) paintTerrain(context, landCover, localProject, w, h, dark, 'land', options.terrainViewport);
            if (water) paintTerrain(context, water, localProject, w, h, dark, 'water', options.terrainViewport);
            boundaries.forEach((line, i) => draw(line, border, i + 137, 1.2, x, y, w, h));
            [...usableAreas].sort((a, b) => Number(a.id === selection.selectedArea) - Number(b.id === selection.selectedArea)).forEach(area => paintJourneyArea(context, area, localProject, w, h, featureColor('area', area.id), selection.selectedArea === area.id));
            routePoints.map((line, i) => ({ line, route: routes[i] })).sort((a, b) => Number(a.route.id === selection.selectedRoute) - Number(b.route.id === selection.selectedRoute)).forEach(({ line, route }) => {
              const width = Number.isFinite(route.width) ? Math.max(.5, Math.min(8, route.width!)) : 2;
              draw(line, featureColor('route', route.id), seedToNumber(route.id), width + (route.id === selection.selectedRoute ? 1 : 0), x, y, w, h);
            });
            context.restore();
          }
          if (options.cacheBase) base.capture(canvas, size, baseKey);
        }
        previousSignature = signature; previousKey = baseKey;
        paintOrigin = map.containerPointToLatLng([-padding, -padding]); paintZoom = zoom;
        paintWidth = width; paintHeight = height;
        canvas.style.transformOrigin = '0 0';
        canvas.style.transform = `translate(${-padding}px, ${-padding}px)`;
      };
      const schedule = () => { if (!alive()) return; paintPins(); if (!animating && !frame) frame = requestAnimationFrame(paint); };
      paintRef.current = schedule;
      viewRef.current = (center, targetZoom) => {
        if (!alive()) return;
        const target = L.latLng(center);
        const zoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), targetZoom));
        if (activeView?.center.equals(target) && activeView.zoom === zoom) return;
        map.stop();
        if (!alive()) return;
        animating = false; activeView = undefined;
        const settings = viewOptions.current;
        const duration = journeyAnimationMs(settings.animate, settings.animationDuration, matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (!duration || (map.getCenter().equals(target) && map.getZoom() === zoom)) {
          map.setView(target, zoom, { animate: false });
          if (frame) cancelAnimationFrame(frame);
          paint();
          return;
        }
        const start = map.getCenter(), startZoom = map.getZoom(), viewport = map.getSize();
        const from = map.project(start, startZoom), to = map.project(target, startZoom);
        const extent = Math.max(viewport.x, viewport.y);
        // Bound Leaflet's flyTo camera envelope (rho² < 2.1), including its
        // temporary zoom-out. Rasterize it once, then transform that bitmap.
        const span = extent * (1 + map.getZoomScale(startZoom, zoom)) + 2.1 * from.distanceTo(to);
        const scale = Math.max((Math.abs(to.x - from.x) + viewport.x * span / extent) / viewport.x,
          (Math.abs(to.y - from.y) + viewport.y * span / extent) / viewport.y);
        const overview = map.unproject(from.add(to).divideBy(2), startZoom);
        animating = true; preparingView = true;
        if (frame) cancelAnimationFrame(frame); frame = 0;
        try {
          map.setView(overview, startZoom - Math.log2(scale), { animate: false });
          if (!alive()) return;
          paint();
          map.setView(start, startZoom, { animate: false });
        } finally { preparingView = false; }
        if (!alive()) return;
        activeView = { center: target, zoom };
        map.flyTo(target, zoom, { animate: true, duration: duration / 1000 });
      };
      zoomRef.current = delta => viewRef.current(activeView?.center ?? map.getCenter(), (activeView?.zoom ?? map.getZoom()) + delta);
      focusRef.current = place => viewRef.current([place.latitude, place.longitude], journeyFocusZoom(fitZoomRef.current, viewOptions.current.focusZoomScale));
      const restore = () => { base.clear(); schedule(); };
      canvas.addEventListener('contextrestored', restore);
      // Reuse the existing raster during a pan; repaint geographical detail on rest.
      const translate = () => {
        if (!alive()) return;
        const point = map.latLngToContainerPoint(paintOrigin);
        const scale = map.getZoomScale(map.getZoom(), paintZoom);
        canvas.style.transformOrigin = '0 0';
        canvas.style.transform = `translate(${point.x}px, ${point.y}px) scale(${scale})`;
        const viewport = map.getSize();
        if (!animating && (point.x > 0 || point.y > 0 || point.x + paintWidth * scale < viewport.x || point.y + paintHeight * scale < viewport.y)) schedule();
      };
      const settle = () => { if (!alive() || preparingView) return; animating = false; activeView = undefined; schedule(); };
      map.on('move', translate);
      map.on('moveend zoomend resize', settle);
      const stopDrag = () => { if (!alive()) return; map.stop(); animating = false; activeView = undefined; };
      map.on('dragstart', stopDrag);
      const labelNodes: { place: JourneyPlace; node: HTMLElement; icon: HTMLElement }[] = [];
      markersRef.current = points.map(place => {
        const symbol = document.createElement('span');
        symbol.className = 'inkra-journey-map__symbol';
        const ink = document.createElement('canvas');
        ink.className = 'inkra-journey-map__stop';
        ink.setAttribute('aria-hidden', 'true');
        const node = document.createElement('span');
        node.className = 'inkra-journey-map__pin';
        const icon = document.createElement('span'); icon.className = 'inkra-journey-map__custom-icon'; if (place.color) icon.style.color = place.color;
        const custom = place.icon !== undefined && place.icon !== null && place.icon !== false;
        ink.hidden = custom; icon.hidden = !custom;
        symbol.append(ink, icon, node);
        const pin = { place, canvas: ink, key: '', restore: () => { pin.key = ''; paintPins(); } };
        ink.addEventListener('contextrestored', pin.restore);
        pinSurfaces.push(pin);
        labelNodes.push({ place, node, icon });
        const marker = L.marker([place.latitude, place.longitude], { icon: L.divIcon({ html: symbol, className: 'inkra-journey-map__marker', iconSize: [44, 44], iconAnchor: [22, 22] }), keyboard: true, title: place.label, alt: place.label }).addTo(map);
        marker.on('click', () => { if (alive()) selectPlace(place); });
        marker.getElement()?.setAttribute('aria-pressed', String(selectedRef.current === place.id));
        return { place, marker };
      });
      setPlaceLabels(labelNodes);
      const observer = new ResizeObserver(() => { if (!alive()) return; map.invalidateSize(); if (!alive()) return; if (!fitted) fit(); schedule(); });
      observer.observe(host.current);
      const appearance = new MutationObserver(schedule);
      for (let element: HTMLElement | null = host.current; element; element = element.parentElement) {
        appearance.observe(element, { attributes: true, attributeFilter: ['data-theme', 'data-inkra-theme', 'style', 'class'] });
      }
      const scheme = matchMedia('(prefers-color-scheme: dark)');
      scheme.addEventListener('change', schedule);
      let resolution: MediaQueryList;
      const watchResolution = () => {
        resolution?.removeEventListener('change', resolutionChanged);
        resolution = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        resolution.addEventListener('change', resolutionChanged);
      };
      const resolutionChanged = () => { if (!alive()) return; watchResolution(); schedule(); };
      watchResolution();
      cleanup = () => { disposed = true; map.off('move', translate); map.off('moveend zoomend resize', settle); map.off('dragstart', stopDrag); cancelAnimationFrame(frame); observer.disconnect(); appearance.disconnect(); scheme.removeEventListener('change', schedule); resolution.removeEventListener('change', resolutionChanged); canvas.removeEventListener('contextrestored', restore); base.clear(); pinSurfaces.forEach(pin => { pin.canvas.removeEventListener('contextrestored', pin.restore); pin.canvas.width = pin.canvas.height = 0; }); map.remove(); canvas.width = canvas.height = 0; canvas.remove(); mapRef.current = null; markersRef.current = []; featureHits.current = []; paintRef.current = () => {}; viewRef.current = () => {}; zoomRef.current = () => {}; focusRef.current = () => {}; fitRef.current = () => {}; };
      fit();
      if (!alive()) return;
      schedule(); setReady(true);
    }).catch(() => { if (!cancelled) { setFailed(true); cleanup?.(); cleanup = undefined; } });
    return () => { cancelled = true; cleanup?.(); };
  }, [places, routes, areas, geography, landCover, water, maxFitZoom, background]);
  useEffect(() => {
    markersRef.current.forEach(({ place, marker }) => marker.getElement()?.setAttribute('aria-pressed', String(selectedPlace === place.id)));
    paintRef.current();
    const changed = previousSelection.current.place !== selectedPlace || previousSelection.current.scale !== focusZoomScale;
    previousSelection.current = { place: selectedPlace, scale: focusZoomScale };
    const place = markersRef.current.find(item => item.place.id === selectedPlace)?.place;
    if (focusSelectedPlace && changed && place) focusRef.current(place);
  }, [selectedPlace, focusSelectedPlace, focusZoomScale, ready]);
  useEffect(() => {
    for (const item of featureHits.current) {
      const enabled = item.kind === 'route' ? Boolean(onRouteSelect) : Boolean(onAreaSelect);
      const selected = item.id === (item.kind === 'route' ? selectedRoute : selectedArea);
      (item.path as HTMLElement).style.pointerEvents = enabled ? 'auto' : 'none';
      item.path.setAttribute('role', enabled ? 'button' : 'img');
      item.path.setAttribute('tabindex', enabled ? '0' : '-1');
      item.path.setAttribute('aria-label', item.label);
      if (enabled) item.path.setAttribute('aria-pressed', String(selected)); else item.path.removeAttribute('aria-pressed');
    }
    // Keep native hit order consistent with the painted selected-on-top order.
    const order = [...featureHits.current].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'area' ? -1 : 1;
      const selected = a.kind === 'area' ? selectedArea : selectedRoute;
      return Number(a.id === selected) - Number(b.id === selected);
    });
    for (const item of order) item.path.parentNode?.appendChild(item.path);
    paintRef.current();
  }, [selectedRoute, selectedArea, Boolean(onRouteSelect), Boolean(onAreaSelect), ready]);
  useEffect(() => { paintRef.current(); }, [renderingOptions.boundaryViewport, renderingOptions.terrainViewport, renderingOptions.reuseCanvas, renderingOptions.cacheBase]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const handler of [map.dragging, map.touchZoom, map.doubleClickZoom, map.boxZoom, map.keyboard]) {
      if (interactive) handler.enable(); else handler.disable();
    }
    if (interactive && scrollWheelZoom) map.scrollWheelZoom.enable(); else map.scrollWheelZoom.disable();
    if (interactive && host.current) return attachJourneyTrackpad(host.current, map);
  }, [interactive, scrollWheelZoom, ready]);
  return <div {...props} ref={root} className={['inkra-journey-map', className].filter(Boolean).join(' ')}>
    {placeLabels.map(({ place, node, icon }) => <span key={place.id} className="inkra-journey-map__portal-owner">
      {createPortal(<PencilText>{place.label}</PencilText>, node)}
      {createPortal(place.icon, icon)}
    </span>)}
    {featureLabels.map(({ kind, id, label, node }) => createPortal(<PencilSurface variant="paper" radius={4} className="inkra-journey-map__feature-label" data-selected={id === (kind === 'area' ? selectedArea : selectedRoute)}><PencilText>{label}</PencilText></PencilSurface>, node, `${kind}:${id}`))}
    <div className="inkra-journey-map__viewport" style={{ height: Number.isFinite(height) ? Math.max(240, height) : 480 }}>
      {attributionDisplay === 'popover' && <div className="inkra-journey-map__credits"><Popover.Root>
        <Popover.Trigger asChild><Button size="icon" variant="ghost" aria-label={labels.attribution ?? t('map.credits')} title={labels.attribution ?? t('map.credits')}><TravelIcon name="info" /></Button></Popover.Trigger>
        <Popover.Portal><Popover.Content align="end" sideOffset={8} collisionPadding={20} className="inkra-journey-map__credits-content">
          <Popover.Title>{labels.attribution ?? t('map.credits')}</Popover.Title>
          <Popover.Description>{attribution}</Popover.Description>
        </Popover.Content></Popover.Portal>
      </Popover.Root></div>}
      <div ref={host} className="inkra-journey-map__host" aria-label={props['aria-label'] ?? t('map.label')} />
      {showControls && <div className="inkra-journey-map__tools">
        <Button size="icon" variant="ghost" disabled={!ready} aria-label={labels.zoomIn} title={labels.zoomIn} onClick={() => zoomRef.current(1)}><TravelIcon name="plus" /></Button>
        <Button size="icon" variant="ghost" disabled={!ready} aria-label={labels.zoomOut} title={labels.zoomOut} onClick={() => zoomRef.current(-1)}><TravelIcon name="minus" /></Button>
        <Button size="icon" variant="ghost" disabled={!ready} aria-label={labels.reset} title={labels.reset} onClick={() => { mapRef.current?.stop(); fitRef.current(); }}><TravelIcon name="reset" /></Button>
      </div>}
      {ready && <MapScale map={mapRef.current} />}
      {failed && <p role="status">{labels.unavailable}</p>}
    </div>
    {attributionDisplay === 'inline' && <p className="inkra-journey-map__attribution">{attribution}</p>}
    {(showPlaceList || !ready || failed) && <ol className="inkra-journey-map__places">{places.filter(valid).map((place, index) => <li key={place.id}><button type="button" aria-pressed={selectedPlace === place.id} onClick={() => selectPlace(place, true)}><span aria-hidden="true">{index + 1}</span><PencilText>{place.label}</PencilText></button></li>)}</ol>}
    {(showFeatureList || !ready || failed) && (routes.length > 0 || usableAreas.length > 0) && <ol className="inkra-journey-map__features" aria-label={labels.features}>
      {routes.map(route => <li key={`route:${route.id}`}>{onRouteSelect ? <button type="button" aria-pressed={selectedRoute === route.id} onClick={() => onRouteSelect(route)}><PencilText>{route.label || route.id}</PencilText></button> : <PencilText>{route.label || route.id}</PencilText>}</li>)}
      {usableAreas.map(area => <li key={`area:${area.id}`}>{onAreaSelect ? <button type="button" aria-pressed={selectedArea === area.id} onClick={() => onAreaSelect(area)}><PencilText>{area.label}</PencilText></button> : <PencilText>{area.label}</PencilText>}</li>)}
    </ol>}
  </div>;
}
