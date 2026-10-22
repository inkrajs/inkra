import { useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import type * as Leaflet from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import { Button } from '../Button.js';
import { Popover } from '../overlay/index.js';
import { PencilText } from '../PencilText.js';
import { pencilStroke } from '../internal/stroke.js';
import { TravelIcon } from '../internal/travelIcons.js';
import { paintTerrain, paintStop, paintSea } from './terrain.js';
import { MapScale } from './MapScale.js';
import { seedToNumber } from '../internal/random.js';

export interface JourneyPlace { id: string; label: string; latitude: number; longitude: number }
export interface JourneyRoute { id: string; coordinates: readonly (readonly [number, number])[] }
export interface JourneyMapProps extends HTMLAttributes<HTMLDivElement> {
  places: readonly JourneyPlace[];
  /** [latitude, longitude]. Supplied geometry only; no routing or travel-time inference. */
  routes?: readonly JourneyRoute[];
  geography?: GeoJsonObject;
  landCover?: GeoJsonObject;
  water?: GeoJsonObject;
  selectedPlace?: string;
  onPlaceSelect?: (place: JourneyPlace) => void;
  attribution: string;
  attributionDisplay?: 'inline' | 'popover';
  height?: number;
  /** Controls viewport gestures, not place selection or explicit zoom buttons. */
  interactive?: boolean;
  scrollWheelZoom?: boolean;
  showControls?: boolean;
  showPlaceList?: boolean;
  focusSelectedPlace?: boolean;
  labels?: { zoomIn: string; zoomOut: string; reset: string; unavailable: string; attribution?: string };
}
const defaults = { zoomIn: 'Zoom in', zoomOut: 'Zoom out', reset: 'Reset view', unavailable: 'Map unavailable. Choose a place below.' };
const noRoutes: readonly JourneyRoute[] = [];
const valid = (place: JourneyPlace) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude) && Math.abs(place.latitude) <= 85 && Math.abs(place.longitude) <= 180;

export function JourneyMap({ places, routes = noRoutes, geography, landCover, water, selectedPlace, onPlaceSelect, attribution, attributionDisplay = 'inline', height = 480, interactive = true, scrollWheelZoom = false, showControls = true, showPlaceList = false, focusSelectedPlace = false, labels = defaults, className, ...props }: JourneyMapProps) {
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const fitRef = useRef<() => void>(() => {});
  const paintRef = useRef<() => void>(() => {});
  const fitZoomRef = useRef(2);
  const selectionRef = useRef(onPlaceSelect);
  selectionRef.current = onPlaceSelect;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [placeLabels, setPlaceLabels] = useState<{ place: JourneyPlace; node: HTMLElement }[]>([]);
  const selectedRef = useRef(selectedPlace);
  selectedRef.current = selectedPlace;
  const markersRef = useRef<{ place: JourneyPlace; marker: Leaflet.Marker }[]>([]);
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    setReady(false);
    setFailed(false);
    setPlaceLabels([]);
    void import('leaflet').then(L => {
      if (cancelled || !host.current) return;
      const map = L.map(host.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, zoomSnap: .1, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([0, 0], 2);
      mapRef.current = map;
      cleanup = () => { map.remove(); mapRef.current = null; markersRef.current = []; };
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
      const all = [...points.map(place => L.latLng(place.latitude, place.longitude)), ...boundaries.flat(), ...routePoints.flat()];
      let fitted = false;
      const fit = () => {
        map.invalidateSize();
        const size = map.getSize();
        if (size.x <= 0 || size.y <= 0) return;
        if (all.length) map.fitBounds(L.latLngBounds(all), { padding: [44, 44], maxZoom: 12, animate: false });
        fitZoomRef.current = map.getZoom();
        fitted = true;
      };
      fitRef.current = fit;
      const canvas = document.createElement('canvas');
      canvas.className = 'inkra-journey-map__ink';
      canvas.setAttribute('aria-hidden', 'true');
      host.current.append(canvas);
      let frame = 0;
      let paintOrigin = map.containerPointToLatLng([0, 0]), paintZoom = map.getZoom();
      const paint = () => {
        frame = 0;
        const { x: width, y: height } = map.getSize();
        if (!width || !height) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
        const context = canvas.getContext('2d');
        if (!context) return;
        canvas.style.transform = '';
        paintOrigin = map.containerPointToLatLng([0, 0]);
        paintZoom = map.getZoom();
        context.scale(dpr, dpr);
        const style = getComputedStyle(host.current!);
        const paper = style.getPropertyValue('--inkra-paper').trim();
        const dark = Number.parseInt(paper.replace('#', '').slice(0, 2), 16) < 100;
        const project = (position: number[]): [number, number] => { const point = map.latLngToContainerPoint([position[1], position[0]]); return [point.x, point.y]; };
        paintSea(context, width, height, project([0, 0]));
        if (geography) paintTerrain(context, geography, project, width, height, dark);
        if (landCover) paintTerrain(context, landCover, project, width, height, dark);
        if (water) paintTerrain(context, water, project, width, height, dark, 'water');
        const draw = (line: Leaflet.LatLng[], color: string, seed: number, weight: number) => {
          const projected = line.map(point => { const p = map.latLngToContainerPoint(point); return [p.x, p.y] as [number, number]; });
          pencilStroke(context, projected, color, weight, seed, .3, 3, false, { grain: .7, breaks: .15, variation: .8, gain: 2.5, step: .8 });
        };
        boundaries.forEach((line, i) => draw(line, style.getPropertyValue('--inkra-border-strong').trim(), i + 137, 1.2));
        routePoints.forEach((line, i) => draw(line, style.getPropertyValue('--inkra-accent').trim(), i + 717, 2));
        points.forEach(place => {
          const p = map.latLngToContainerPoint([place.latitude, place.longitude]);
          paintStop(context, p.x, p.y, seedToNumber(place.id), style.getPropertyValue('--inkra-accent-strong').trim(), paper, selectedRef.current === place.id);
        });
      };
      const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
      paintRef.current = schedule;
      // Reuse the existing raster during a pan; repaint geographical detail on rest.
      const translate = () => {
        const point = map.latLngToContainerPoint(paintOrigin);
        canvas.style.transformOrigin = '0 0';
        canvas.style.transform = `translate(${point.x}px, ${point.y}px) scale(${map.getZoomScale(map.getZoom(), paintZoom)})`;
      };
      const settle = () => { canvas.style.transform = ''; paintOrigin = map.containerPointToLatLng([0, 0]); paintZoom = map.getZoom(); schedule(); };
      map.on('move', translate);
      map.on('moveend zoomend resize', settle);
      map.on('dragstart', () => map.stop());
      const labelNodes: { place: JourneyPlace; node: HTMLElement }[] = [];
      markersRef.current = points.map(place => {
        const node = document.createElement('span');
        node.className = 'inkra-journey-map__pin';
        labelNodes.push({ place, node });
        const marker = L.marker([place.latitude, place.longitude], { icon: L.divIcon({ html: node, className: 'inkra-journey-map__marker', iconSize: [44, 44], iconAnchor: [22, 22] }), keyboard: true, title: place.label, alt: place.label }).addTo(map);
        marker.on('click', () => selectionRef.current?.(place));
        marker.getElement()?.setAttribute('aria-pressed', String(selectedRef.current === place.id));
        return { place, marker };
      });
      setPlaceLabels(labelNodes);
      const observer = new ResizeObserver(() => { map.invalidateSize(); if (!fitted) fit(); schedule(); });
      observer.observe(host.current);
      const appearance = new MutationObserver(schedule);
      for (let element: HTMLElement | null = host.current; element; element = element.parentElement) {
        appearance.observe(element, { attributes: true, attributeFilter: ['data-theme', 'data-inkra-theme'] });
      }
      const scheme = matchMedia('(prefers-color-scheme: dark)');
      scheme.addEventListener('change', schedule);
      fit(); schedule(); setReady(true);
      cleanup = () => { cancelAnimationFrame(frame); observer.disconnect(); appearance.disconnect(); scheme.removeEventListener('change', schedule); map.remove(); canvas.remove(); mapRef.current = null; markersRef.current = []; paintRef.current = () => {}; };
    }).catch(() => { if (!cancelled) { setFailed(true); cleanup?.(); cleanup = undefined; } });
    return () => { cancelled = true; cleanup?.(); };
  }, [places, routes, geography, landCover, water]);
  useEffect(() => {
    markersRef.current.forEach(({ place, marker }) => marker.getElement()?.setAttribute('aria-pressed', String(selectedPlace === place.id)));
    paintRef.current();
    const place = markersRef.current.find(item => item.place.id === selectedPlace)?.place;
    if (focusSelectedPlace && place) {
      const map = mapRef.current;
      map?.stop();
      const targetZoom = fitZoomRef.current + Math.log2(10);
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) map?.setView([place.latitude, place.longitude], targetZoom, { animate: false });
      else map?.flyTo([place.latitude, place.longitude], targetZoom, { duration: .85 });
    }
  }, [selectedPlace, focusSelectedPlace, ready]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const handler of [map.dragging, map.touchZoom, map.doubleClickZoom, map.boxZoom, map.keyboard]) {
      if (interactive) handler.enable(); else handler.disable();
    }
    if (interactive && scrollWheelZoom) map.scrollWheelZoom.enable(); else map.scrollWheelZoom.disable();
  }, [interactive, scrollWheelZoom, ready]);
  return <div {...props} ref={root} className={['inkra-journey-map', className].filter(Boolean).join(' ')}>
    {placeLabels.map(({ place, node }) => createPortal(<PencilText>{place.label}</PencilText>, node, place.id))}
    <div className="inkra-journey-map__viewport" style={{ height: Math.max(240, Math.min(800, height)) }}>
      {attributionDisplay === 'popover' && <div className="inkra-journey-map__credits"><Popover.Root>
        <Popover.Trigger asChild><Button size="icon" variant="ghost" aria-label={labels.attribution ?? 'Map credits'} title={labels.attribution ?? 'Map credits'}><TravelIcon name="info" /></Button></Popover.Trigger>
        <Popover.Portal><Popover.Content align="end" sideOffset={8} collisionPadding={20} className="inkra-journey-map__credits-content">
          <Popover.Title>{labels.attribution ?? 'Map credits'}</Popover.Title>
          <Popover.Description>{attribution}</Popover.Description>
        </Popover.Content></Popover.Portal>
      </Popover.Root></div>}
      <div ref={host} className="inkra-journey-map__host" aria-label={props['aria-label'] ?? 'Map'} />
      {showControls && <div className="inkra-journey-map__tools">
        <Button size="icon" variant="ghost" disabled={!ready} aria-label={labels.zoomIn} title={labels.zoomIn} onClick={() => { mapRef.current?.stop(); mapRef.current?.zoomIn(); }}><TravelIcon name="plus" /></Button>
        <Button size="icon" variant="ghost" disabled={!ready} aria-label={labels.zoomOut} title={labels.zoomOut} onClick={() => { mapRef.current?.stop(); mapRef.current?.zoomOut(); }}><TravelIcon name="minus" /></Button>
        <Button size="icon" variant="ghost" disabled={!ready} aria-label={labels.reset} title={labels.reset} onClick={() => { mapRef.current?.stop(); fitRef.current(); }}><TravelIcon name="reset" /></Button>
      </div>}
      {ready && <MapScale map={mapRef.current} />}
      {failed && <p role="status">{labels.unavailable}</p>}
    </div>
    {attributionDisplay === 'inline' && <p className="inkra-journey-map__attribution">{attribution}</p>}
    {(showPlaceList || !ready || failed) && <ol className="inkra-journey-map__places">{places.filter(valid).map((place, index) => <li key={place.id}><button type="button" aria-pressed={selectedPlace === place.id} onClick={() => { mapRef.current?.panTo([place.latitude, place.longitude], { animate: false }); onPlaceSelect?.(place); }}><span aria-hidden="true">{index + 1}</span><PencilText>{place.label}</PencilText></button></li>)}</ol>}
  </div>;
}
