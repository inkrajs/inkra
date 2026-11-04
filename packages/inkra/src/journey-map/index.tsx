import { useInkraLocale, type InkraTranslate } from '../i18n/index.js';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import type * as Leaflet from 'leaflet';
import type { Feature, GeoJsonObject } from 'geojson';
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
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import { createJourneyLayers, type JourneyLayerInputs } from './layers.js';
import { captureJourneyPaintPose, projectJourneyPaintPose, type JourneyPaintPose } from './projector.js';
import { createJourneyFeatureBoundsCache, journeyFeatureBoundsIntersect, journeyFeatureRootAllowsBounds, journeyFeatureViewportBounds, type JourneyFeatureBounds } from './featureViewport.js';
import { createJourneyMapSetup, nextJourneyMapSetup, journeyMapDataUpdateMode, type JourneyMapDataUpdateMode } from './dataUpdates.js';
export type { JourneyMapDataUpdateMode } from './dataUpdates.js';
import { MarkerLayer } from './MarkerLayer.js';
import { validJourneyMarkers, resolveJourneyMarkerLabels, type JourneyMarker, type JourneyMarkerClustering, type JourneyMarkerLabels, type JourneyMarkerRenderState, type JourneyMarkerPresentation, type JourneyMarkerAvatarFeather } from './markers.js';
export type { JourneyMarker, JourneyMarkerClustering, JourneyMarkerLabels, JourneyMarkerRenderState, JourneyMarkerPresentation, JourneyMarkerAvatarFeather } from './markers.js';
import { buildingPositions, paintBuildings, resolveBuildingStyle, type JourneyBuildingData, type JourneyBuildingStyles } from './buildings.js';
export type { JourneyBuildingData, JourneyBuildingProperties, JourneyBuildingStyle, JourneyBuildingStyles } from './buildings.js';
import { journeyLineStyleFor, paintJourneyLandCoverBoundaries, paintJourneyLine, resolveJourneyRouteStyle, type JourneyLineStyles } from './lines.js';
export type { JourneyLineStyle, JourneyLineStyles } from './lines.js';
import { createJourneyInitialFit, createJourneyZoomNotifier, resolveJourneyFitZoom } from './zoom.js';
import { PENCIL_RENDERER_VERSION } from '../internal/cache.js';
import { JourneyBaseBitmap, journeyAnimationMs, journeyCanvasSize, journeyFocusZoom, journeyPanRegions, prepareJourneyCanvas, resolveJourneyMapRendering, type JourneyMapRendering, type JourneyCanvasSize } from './rendering.js';

export type { JourneyMapRendering, JourneyMapRenderingOptions } from './rendering.js';

import { resolveJourneyMapPalette, type JourneyMapPalette } from './palette.js';
export { defaultJourneyMapPalette } from './palette.js';
export type { JourneyMapPalette, JourneyMapPaletteColors, JourneyMapPigment } from './palette.js';
import { JourneyPlaceMotion, type JourneyPlaceAnimation } from './motion.js';
export type { JourneyPlaceAnimation, JourneyPlaceTransition, JourneyPosition } from './motion.js';
import { useJourneySelection } from './selection.js';
import { attachJourneyTrackpad } from './trackpad.js';
import { paintJourneyArea, validJourneyArea, type JourneyArea, type JourneyPlace, type JourneyRoute, type JourneyPlaceLabelPosition } from './annotations.js';
export type { JourneyArea, JourneyPlace, JourneyRoute, JourneyPlaceLabelPosition } from './annotations.js';
export interface JourneyMapLabelHalo {
  /** CSS color or theme variable; defaults to var(--inkra-paper). */
  color?: string;
  /** Visible outline thickness in CSS pixels, nonnegative; default 3. */
  width?: number;
}
export interface JourneyMapProps extends HTMLAttributes<HTMLDivElement> {
  places: readonly JourneyPlace[];
  /** Fit by default. Opt in to reconcile geographic layers on the existing map.
   * Initial eligible bounds still fit once; Reset fits the latest active data.
   * Entering preservation keeps the view; leaving it explicitly restores a fit. */
  dataUpdateMode?: JourneyMapDataUpdateMode;
  /** [latitude, longitude]. Supplied geometry only; no routing or travel-time inference. */
  routes?: readonly JourneyRoute[];
  /** Caller-owned type keys; explicit route color/width override these defaults. Width/dash use CSS px. */
  routeStyles?: JourneyLineStyles;
  /** Exact landCover properties.id keys; only explicitly configured boundaries are drawn. */
  landCoverBoundaryStyles?: JourneyLineStyles;
  /** Caller-supplied GeoJSON buildings; replacing this layer preserves the camera. */
  buildings?: JourneyBuildingData;
  /** Exact purpose keys. Missing and unknown purposes retain the neutral style. */
  buildingStyles?: JourneyBuildingStyles;
  /** Independent points. Invalid coordinates and duplicate IDs are ignored. */
  markers?: readonly JourneyMarker[];
  /** Decorative content only; JourneyMap owns the accessible controls. */
  renderMarker?: (marker: JourneyMarker, state: JourneyMarkerRenderState) => ReactNode;
  /** undefined is uncontrolled; null explicitly clears the selection. */
  selectedMarker?: string | null;
  defaultSelectedMarker?: string | null;
  onMarkerSelect?: (marker: JourneyMarker) => void;
  /** Proximity merging is opt-in. The CSS-pixel radius is clamped to 44..256. */
  markerClustering?: JourneyMarkerClustering;
  /** Pencil by default; avatar-stack also groups exact coordinates. */
  markerPresentation?: JourneyMarkerPresentation;
  /** Optional inward alpha feather on avatar pixels; controls and focus stay opaque. */
  markerAvatarFeather?: JourneyMarkerAvatarFeather;
  markerLabels?: JourneyMarkerLabels;
  areas?: readonly JourneyArea[];
  selectedRoute?: string;
  onRouteSelect?: (route: JourneyRoute) => void;
  selectedArea?: string;
  onAreaSelect?: (area: JourneyArea) => void;
  showFeatureList?: boolean;
  /** Theme-contrasting text outline; true by default. Applies to map labels, not controls. */
  labelHalo?: boolean | JourneyMapLabelHalo;
  /** Map label font size in CSS pixels, 8..96; default 12. Excludes UI controls. */
  labelFontSize?: number;
  /** Following display position, bottom by default. Individual places may override it. */
  labelPosition?: JourneyPlaceLabelPosition;
  /** -32..128 CSS px, default 0; measured from the marker's display extent. */
  labelGap?: number;
  /** Custom following content; place.labelContent overrides it. Names remain accessible. */
  renderPlaceLabel?: (place: JourneyPlace) => ReactNode;
  /** Map label color, including selected labels; omitted follows theme/selection colors. */
  labelColor?: string;
  /** Default marker/icon pigment (#4c7952); per-place color overrides it. */
  pinColor?: string;
  /** Single by default. Multiple toggles each item independently without modifiers. */
  selectionMode?: 'single' | 'multiple';
  selectedPlaces?: readonly string[];
  onSelectedPlacesChange?: (ids: readonly string[]) => void;
  selectedRoutes?: readonly string[];
  onSelectedRoutesChange?: (ids: readonly string[]) => void;
  selectedAreas?: readonly string[];
  onSelectedAreasChange?: (ids: readonly string[]) => void;
  /** Pin artwork box in CSS pixels, 16..128; default 18. Hit target stays at least 44px. */
  pinSize?: number;
  /** Coordinate-only marker transitions, false by default; true uses 420ms linear motion. */
  placeTransition?: JourneyPlaceAnimation;
  /** Called after native marker reconciliation and initial camera fitting. */
  onReady?: () => void;
  /** Partial base-map pigment scheme; updates preserve markers and camera. */
  palette?: JourneyMapPalette;
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
  /** Compatibility alias, 0..24. Explicit maxFitZoom takes priority and retains its 0..20 range. */
  fitMaxZoom?: number;
  /** Initial valid fit and subsequent completed real zoom changes, deduplicated per map. */
  onZoomChange?: (zoom: number) => void;
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
function stopLabelInteraction(event: SyntheticEvent<HTMLElement>) {
  if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea, [role="button"], [contenteditable="true"]')) event.stopPropagation();
}
const noRoutes: readonly JourneyRoute[] = [];
const noAreas: readonly JourneyArea[] = [];
const noMarkers: readonly JourneyMarker[] = [];
const valid = (place: JourneyPlace) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude) && Math.abs(place.latitude) <= 85 && Math.abs(place.longitude) <= 180;

export function JourneyMap({ places, dataUpdateMode, routes = noRoutes, routeStyles, landCoverBoundaryStyles, buildings, buildingStyles, markers = noMarkers, renderMarker, selectedMarker, defaultSelectedMarker = null, onMarkerSelect, markerClustering = false, markerPresentation = 'pencil', markerAvatarFeather, markerLabels, areas = noAreas, selectedRoute, onRouteSelect, selectedArea, onAreaSelect, showFeatureList = false, labelHalo = true, labelFontSize = 12, labelPosition = 'bottom', labelGap = 0, renderPlaceLabel, labelColor, pinSize = 18, pinColor = '#4c7952', placeTransition = false, onReady, selectionMode = 'single', selectedPlaces, onSelectedPlacesChange, selectedRoutes, onSelectedRoutesChange, selectedAreas, onSelectedAreasChange, palette, geography, landCover, water, selectedPlace, onPlaceSelect, attribution, attributionDisplay = 'inline', height = 480, maxFitZoom, fitMaxZoom, onZoomChange, background = 'sea', interactive = true, scrollWheelZoom = false, showControls = true, showPlaceList = false, focusSelectedPlace = true, focusZoomScale = 2, animate = true, animationDuration = 420, rendering = 'auto', labels: labelOverrides, className, style, ...props }: JourneyMapProps) {
  const { t } = useInkraLocale();
  const defaultLabels = defaults(t);
  const labels = { ...defaultLabels, ...labelOverrides, features: labelOverrides?.features ?? defaultLabels.features };
  const fitLimit = resolveJourneyFitZoom(maxFitZoom, fitMaxZoom);
  const updateMode = journeyMapDataUpdateMode(dataUpdateMode);
  const layerInputs = useMemo<JourneyLayerInputs>(() => ({ routes, areas, geography, landCover, water }), [routes, areas, geography, landCover, water]);
  const layerData = useRef(layerInputs);
  const fitLimitRef = useRef(fitLimit);
  const backgroundRef = useRef(background);
  const updateModeRef = useRef(updateMode);
  const [setup, setSetup] = useState(() => createJourneyMapSetup(updateMode, layerInputs, fitLimit, background));
  const nextSetup = nextJourneyMapSetup(setup, updateMode, layerInputs, fitLimit, background);
  if (nextSetup !== setup) setSetup(nextSetup);
  const zoomCallback = useRef(onZoomChange); zoomCallback.current = onZoomChange;
  const markerData = useRef(markers); markerData.current = markers;
  const hasMarkers = markers.length > 0;
  const resolvedMarkerLabels = resolveJourneyMarkerLabels(markerLabels, { cluster: count => t('map.showMarkers', { count }), more: count => t('map.showMarkers', { count }), collapse: t('common.close'), list: t('map.markers') });
  const [uncontrolledMarker, setUncontrolledMarker] = useState(defaultSelectedMarker);
  const activeMarker = selectedMarker === undefined ? uncontrolledMarker : selectedMarker;
  const selectMarker = (marker: JourneyMarker) => { if (selectedMarker === undefined) setUncontrolledMarker(marker.id); onMarkerSelect?.(marker); };
  const buildingData = useRef(buildings);
  const buildingRevision = useRef(0);
  if (buildingData.current !== buildings) buildingRevision.current++;
  buildingData.current = buildings;
  const buildingStylesRef = useRef(buildingStyles); buildingStylesRef.current = buildingStyles;
  const routeStylesRef = useRef(routeStyles); routeStylesRef.current = routeStyles;
  const coverStylesRef = useRef(landCoverBoundaryStyles); coverStylesRef.current = landCoverBoundaryStyles;
  const halo = typeof labelHalo === 'object' && labelHalo ? labelHalo : {};
  const haloWidth = Number.isFinite(halo.width) ? Math.max(0, halo.width!) : 3;
  const fontSize = Number.isFinite(labelFontSize) ? Math.max(8, Math.min(96, labelFontSize)) : 12;
  const artworkSize = Number.isFinite(pinSize) ? Math.max(16, Math.min(128, pinSize)) : 18;
  const pinSizeRef = useRef(artworkSize);
  pinSizeRef.current = artworkSize;
  const paletteRef = useRef(palette);
  paletteRef.current = palette;
  const labelOptionsRef = useRef({ labelPosition, custom: Boolean(renderPlaceLabel) });
  labelOptionsRef.current = { labelPosition, custom: Boolean(renderPlaceLabel) };
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const placesRef = useRef(places);
  placesRef.current = places;
  const placeTransitionRef = useRef(placeTransition);
  placeTransitionRef.current = placeTransition;
  const syncPlacesRef = useRef<() => void>(() => {});
  const resizePinsRef = useRef<() => void>(() => {});
  const haloStyle = { '--inkra-map-label-halo-width': `${haloWidth * 2}px`,
    '--inkra-map-label-halo-color': halo.color,
    '--inkra-map-label-color': labelColor,
    '--inkra-map-pin-color': pinColor,
    '--inkra-map-label-font-size': `${fontSize}px`,
    '--inkra-map-label-gap': `${Number.isFinite(labelGap) ? Math.max(-32, Math.min(128, labelGap)) : 0}px`,
    '--inkra-map-pin-size': `${artworkSize}px`,
    '--inkra-map-pin-scale': artworkSize / 44,
    '--inkra-map-pin-hit-size': `${Math.max(44, artworkSize)}px`,
    '--inkra-map-pin-label-top': `${Math.max(44, artworkSize) / 2 + 15 * artworkSize / 44}px`, ...style } as CSSProperties;
  const usableAreas = useMemo(() => areas.filter(validJourneyArea), [areas]);
  const usablePlaces = useMemo(() => places.filter(valid), [places]);
  const displayPlaces = useMemo(() => new Map(usablePlaces.map(place => [place.id, place])), [usablePlaces]);
  const placeSelection = useJourneySelection(usablePlaces, selectionMode, selectedPlace, onPlaceSelect, selectedPlaces, onSelectedPlacesChange);
  const routeSelection = useJourneySelection(routes, selectionMode, selectedRoute, onRouteSelect, selectedRoutes, onSelectedRoutesChange);
  const areaSelection = useJourneySelection(usableAreas, selectionMode, selectedArea, onAreaSelect, selectedAreas, onSelectedAreasChange);
  const annotationSelection = useRef({ selectedRoutes: routeSelection.ids, selectedAreas: areaSelection.ids, routesEnabled: routeSelection.enabled, areasEnabled: areaSelection.enabled, onRouteSelect: routeSelection.select, onAreaSelect: areaSelection.select });
  annotationSelection.current = { selectedRoutes: routeSelection.ids, selectedAreas: areaSelection.ids, routesEnabled: routeSelection.enabled, areasEnabled: areaSelection.enabled, onRouteSelect: routeSelection.select, onAreaSelect: areaSelection.select };
  const featureHits = useRef<{ kind: 'route' | 'area'; id: string; label: string; path: Element }[]>([]);
  const [featureLabels, setFeatureLabels] = useState<{ kind: 'route' | 'area'; id: string; label: string; node: HTMLElement }[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const fitRef = useRef<() => void>(() => {});
  const initialFitRef = useRef<() => void>(() => {});
  const paintRef = useRef<() => void>(() => {});
  const refreshBaseRef = useRef<() => void>(() => {});
  const syncLayersRef = useRef<() => void>(() => {});
  const refreshFeaturesRef = useRef<() => void>(() => {});
  const viewRef = useRef<(center: Leaflet.LatLngExpression, zoom: number) => void>(() => {});
  const zoomRef = useRef<(delta: number) => void>(() => {});
  const focusRef = useRef<(place: JourneyPlace) => void>(() => {});
  const fitZoomRef = useRef(2);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [placeLabels, setPlaceLabels] = useState<{ place: JourneyPlace; node: HTMLElement; icon: HTMLElement }[]>([]);
  const selectedRef = useRef(placeSelection.ids);
  selectedRef.current = placeSelection.ids;
  const previousSelection = useRef({ place: selectedPlace, scale: focusZoomScale });
  const viewOptions = useRef({ animate, animationDuration, focusSelectedPlace, focusZoomScale });
  viewOptions.current = { animate, animationDuration, focusSelectedPlace, focusZoomScale };
  const selectPlace = (place: JourneyPlace, fromList = false) => {
    const selectionMap = mapRef.current;
    const active = placeSelection.select(place);
    if (selectionMap && (mapRef.current !== selectionMap || !selectionMap.getPane('mapPane'))) return;
    if (active && viewOptions.current.focusSelectedPlace) focusRef.current(place);
    else if (active && fromList && mapRef.current) viewRef.current([place.latitude, place.longitude], mapRef.current.getZoom());
  };
  const markersRef = useRef<{ place: JourneyPlace; marker: Leaflet.Marker; canvas: HTMLCanvasElement; node: HTMLElement; icon: HTMLElement; symbol: HTMLElement; key: string; restore: () => void; release: () => void }[]>([]);
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
      let fitted = false;
      const zoomEvents = createJourneyZoomNotifier(() => zoomCallback.current, () => alive() && !preparingView, true);
      const initialFit = createJourneyInitialFit(() => fit(), () => alive() && !preparingView && (updateModeRef.current !== 'preserve-view' || !animating));
      const notifyZoom = () => { if (alive()) zoomEvents.notify(map.getZoom()); };
      mapRef.current = map;
      let releaseLayers = () => {};
      cleanup = () => { disposed = true; initialFit.dispose(); zoomEvents.dispose(); releaseLayers(); map.remove(); mapRef.current = null; markersRef.current = []; initialFitRef.current = () => {}; syncLayersRef.current = () => {}; refreshFeaturesRef.current = () => {}; refreshBaseRef.current = () => {}; };
      const layers = createJourneyLayers(L, map, {
        alive,
        getSelection: () => annotationSelection.current,
        onSelectRoute: route => annotationSelection.current.onRouteSelect(route),
        onSelectArea: area => annotationSelection.current.onAreaSelect(area),
        onHits: hits => { featureHits.current = hits; },
        onLabels: labels => setFeatureLabels(labels),
      });
      releaseLayers = () => layers.dispose();
      refreshFeaturesRef.current = () => layers.refreshSelection();
      layers.sync(layerData.current);
      if (!alive()) return;

      let markersInitialized = false;
      const fit = (animated = false): boolean => {
        if (!alive()) return false;
        const all = [...placesRef.current.filter(valid).map(place => L.latLng(place.latitude, place.longitude)), ...layers.snapshot().bounds,
          ...validJourneyMarkers(markerData.current).map(marker => L.latLng(marker.latitude, marker.longitude)),
          ...buildingPositions(buildingData.current).map(([lng, lat]) => L.latLng(lat, lng))];
        if (!all.length) { fitted = false; fitZoomRef.current = map.getZoom(); return false; }
        map.invalidateSize();
        if (!alive()) return false;
        const size = map.getSize();
        if (size.x <= 0 || size.y <= 0) return false;
        if (all.length) {
          const bounds = L.latLngBounds(all);
          const zoom = Math.min(map.getBoundsZoom(bounds, false, L.point(88, 88)), fitLimitRef.current);
          const center = map.unproject(map.project(bounds.getSouthWest(), zoom).add(map.project(bounds.getNorthEast(), zoom)).divideBy(2), zoom);
          fitZoomRef.current = zoom;
          if (animated) viewRef.current(center, zoom);
          else map.setView(center, zoom, { animate: false });
        } else fitZoomRef.current = map.getZoom();
        fitted = all.length > 0;
        if (fitted) { initialFit.markFitted(); zoomEvents.markFitted(); }
        if (fitted && !animating) notifyZoom();
        return fitted && alive();
      };
      fitRef.current = () => fit(true);
      const canvas = document.createElement('canvas');
      canvas.className = 'inkra-journey-map__ink';
      canvas.setAttribute('aria-hidden', 'true');
      const lines = document.createElement('canvas');
      lines.width = lines.height = 0;
      lines.className = 'inkra-journey-map__lines'; lines.setAttribute('aria-hidden', 'true');
      host.current.append(canvas, lines);
      const requestedScreenLines = () => routeStylesRef.current !== undefined || coverStylesRef.current !== undefined;
      // Transfer ownership with the base bitmap so a frozen flight cannot draw routes twice.
      let paintedScreenLines = requestedScreenLines();
      let featureBounds: ReturnType<typeof createJourneyFeatureBoundsCache> | undefined;
      const featureCache = () => featureBounds ??= createJourneyFeatureBoundsCache();
      // Current map strokes use at most 12px typed width + 1px selection. The
      // existing 3x line envelope plus the query helper's rounding pixel covers
      // their pencil drift, filaments and caps. All dimensions remain CSS px.
      const featureQuery = (pose: JourneyPaintPose | undefined, width: number, height: number, dpr: number) =>
        // Downsampled backings can bleed a physical pixel across more than one
        // CSS pixel; keep all rather than assume our normal raster margin.
        renderingRef.current.featureViewport && dpr >= 1 && map.options.crs === L.CRS.EPSG3857
          ? journeyFeatureViewportBounds(map, pose, { x: 0, y: 0, width, height }, 39, true) : undefined;
      const keepRoute = (route: JourneyRoute, query: JourneyFeatureBounds | undefined) =>
        !query || journeyFeatureBoundsIntersect(featureCache().route(route.coordinates), query);
      const keepFeatures = (data: GeoJsonObject | undefined, query: JourneyFeatureBounds | undefined): ((feature: Feature) => boolean) | undefined =>
        query && journeyFeatureRootAllowsBounds(data)
          ? feature => journeyFeatureBoundsIntersect(featureCache().feature(feature), query) : undefined;
      const paintLines = () => {
        if (!alive()) return;
        const { routes, routePoints, landCover } = layers.snapshot();
        if (!paintedScreenLines) {
          if (lines.width || lines.height) lines.width = lines.height = 0;
          return;
        }
        const viewport = map.getSize();
        const size = journeyCanvasSize(viewport.x, viewport.y, window.devicePixelRatio || 1, true);
        if (!size) { lines.width = lines.height = 0; return; }
        const context = prepareJourneyCanvas(lines, size, true);
        if (!context) return;
        const query = renderingRef.current.featureViewport ? featureQuery(captureJourneyPaintPose(map, 0), size.width, size.height, size.dpr) : undefined;
        const style = getComputedStyle(host.current!);
        const project = (position: number[]): [number, number] => { const p = map.latLngToContainerPoint([position[1], position[0]]); return [p.x, p.y]; };
        if (landCover) paintJourneyLandCoverBoundaries(context, landCover, project, coverStylesRef.current, style, size.width, size.height, keepFeatures(landCover, query));
        const selection = annotationSelection.current;
        routePoints.map((line, index) => ({ line, route: routes[index] }))
          .sort((a, b) => Number(selection.selectedRoutes.has(a.route.id)) - Number(selection.selectedRoutes.has(b.route.id)))
          .forEach(({ line, route }) => {
            if (!keepRoute(route, query)) return;
            const resolved = resolveJourneyRouteStyle(route, journeyLineStyleFor(routeStylesRef.current, route.type), style,
              style.getPropertyValue('--inkra-accent').trim() || '#557f86', selection.selectedRoutes.has(route.id));
            const projected = line.map(point => { const p = map.latLngToContainerPoint(point); return [p.x, p.y] as [number, number]; });
            paintJourneyLine(context, projected, resolved, seedToNumber(route.id), size.width, size.height);
          });
      };
      const base = new JourneyBaseBitmap();
      const colorProbe = document.createElement('span'); colorProbe.hidden = true; colorProbe.setAttribute('aria-hidden', 'true'); host.current.append(colorProbe);
      const resolveColor = (value: string | undefined, fallback: string) => {
        if (!value || !CSS.supports('color', value)) return fallback;
        if (!/var\(|currentColor|inherit|initial|unset/i.test(value)) return value;
        colorProbe.style.setProperty('--inkra-map-palette-probe', value);
        colorProbe.style.color = `var(--inkra-map-palette-probe, ${fallback})`;
        return getComputedStyle(colorProbe).color || fallback;
      };
      const pinSurfaces = markersRef.current;
      const pinsById = new Map<string, typeof pinSurfaces[number]>();
      const motion = new JourneyPlaceMotion((id, position) => { if (alive()) pinsById.get(id)?.marker.setLatLng([position.latitude, position.longitude]); });
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      const paintPins = () => {
        if (!alive()) return;
        const style = getComputedStyle(host.current!);
        const defaultInk = style.getPropertyValue('--inkra-map-pin-color').trim() || style.getPropertyValue('--inkra-accent-strong').trim();
        const paper = style.getPropertyValue('--inkra-paper').trim();
        const size = journeyCanvasSize(pinSizeRef.current, pinSizeRef.current, window.devicePixelRatio || 1)!;
        for (const pin of pinSurfaces) {
          if (pin.place.icon !== undefined && pin.place.icon !== null && pin.place.icon !== false) continue;
          const selected = selectedRef.current.has(pin.place.id);
          pin.canvas.style.color = defaultInk;
          if (pin.place.color) pin.canvas.style.color = pin.place.color;
          const ink = getComputedStyle(pin.canvas).color;
          const key = JSON.stringify([PENCIL_RENDERER_VERSION, ink, paper, size.dpr, pinSizeRef.current, selected]);
          if (pin.key === key) continue;
          const context = prepareJourneyCanvas(pin.canvas, size, true);
          if (!context) continue;
          context.save();
          context.scale(pinSizeRef.current / 44, pinSizeRef.current / 44);
          paintStop(context, 22, 22, seedToNumber(pin.place.id), ink, paper, selected);
          context.restore();
          pin.key = key;
        }
      };
      let frame = 0;
      let animating = false, preparingView = false;
      let activeView: { center: Leaflet.LatLng; zoom: number } | undefined;
      let paintOrigin = map.containerPointToLatLng([0, 0]), paintZoom = map.getZoom();
      let paintWidth = 0, paintHeight = 0, previousSignature = '', previousKey = '';
      type RasterPose = { projection: JourneyPaintPose; size: JourneyCanvasSize; padding: number };
      let paintedPose: RasterPose | undefined;
      let paintedBackground = backgroundRef.current;
      const paint = (targetPose?: RasterPose) => {
        frame = 0;
        if (!alive()) return;
        const scene = layers.snapshot();
        const { routes, routePoints, boundaries, geography, landCover, water } = scene;
        const background = backgroundRef.current;
        const viewport = map.getSize();
        if (!viewport.x || !viewport.y) return;
        // A small reserve keeps ordinary pans on the compositor. Larger pans
        // replenish only exposed strips, within the same backing-store budgets.
        let padding = targetPose?.padding ?? 64;
        let size = targetPose?.size ?? journeyCanvasSize(viewport.x + padding * 2, viewport.y + padding * 2, window.devicePixelRatio || 1);
        if (!size) { padding = 0; size = journeyCanvasSize(viewport.x, viewport.y, window.devicePixelRatio || 1, true); }
        if (!size) { base.clear(); canvas.width = canvas.height = 0; return; }
        const { width, height } = size;
        const options = renderingRef.current;
        // Release the old snapshot before resizing the main canvas so the two
        // live backing stores stay within the combined six-Mi-pixel budget.
        if (!options.cacheBase || canvas.width !== size.pixelWidth || canvas.height !== size.pixelHeight) base.clear();
        const context = prepareJourneyCanvas(canvas, size, options.reuseCanvas);
        if (!context) return;
        const nextScreenLines = requestedScreenLines();
        const zoom = targetPose?.projection.zoom ?? map.getZoom();
        const projection = targetPose?.projection ?? captureJourneyPaintPose(map, padding);
        // Query the whole actual bitmap, including its reserve or saved flight
        // envelope. Each replenishment strip uses this same conservative domain.
        const query = featureQuery(projection, width, height, size.dpr);
        const projectPoint = (point: Leaflet.LatLngExpression): [number, number] => {
          if (targetPose) return projectJourneyPaintPose(map, targetPose.projection, point);
          const projected = map.latLngToContainerPoint(point);
          return [projected.x + padding, projected.y + padding];
        };
        const style = getComputedStyle(host.current!);
        const paper = style.getPropertyValue('--inkra-paper').trim();
        const dark = style.colorScheme === 'dark';
        const border = style.getPropertyValue('--inkra-border-strong').trim();
        const accent = style.getPropertyValue('--inkra-accent').trim();
        const mapPalette = resolveJourneyMapPalette(paletteRef.current, dark, border, resolveColor);
        const colors = featureHits.current.map(item => getComputedStyle(item.path).stroke || accent);
        const colorLookup = new Map(featureHits.current.map((item, i) => [`${item.kind}:${item.id}`, colors[i]]));
        const featureColor = (kind: 'route' | 'area', id: string) => {
          const color = colorLookup.get(`${kind}:${id}`);
          return color && color !== 'none' ? color : accent;
        };
        const selection = annotationSelection.current;
        const project = (position: number[]): [number, number] => projectPoint([position[1], position[0]]);
        const origin = project([0, 0]);
        // A committed geometry revision invalidates the whole bitmap, including
        // old pan strips. The other fields describe its current raster pose.
        const buildingColors = buildingData.current?.features?.map(feature => feature ? resolveBuildingStyle(feature, buildingStylesRef.current, style) : null);
        const signature = JSON.stringify([PENCIL_RENDERER_VERSION, 'journey-base-v2', background, width, height, size.pixelWidth, size.pixelHeight, size.dpr,
          zoom, paper, dark, border, accent, mapPalette, colors, nextScreenLines ? undefined : [...selection.selectedRoutes].sort(), [...selection.selectedAreas].sort(),
          options.featureViewport, options.boundaryViewport, options.terrainViewport, nextScreenLines, buildingRevision.current, buildingColors, scene.revision]);
        const baseKey = signature + JSON.stringify(origin);
        const draw = (line: Leaflet.LatLng[], color: string, seed: number, weight: number, x: number, y: number, w: number, h: number) => {
          const projected = line.map(point => { const p = projectPoint(point); return [p[0] - x, p[1] - y] as [number, number]; });
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
          const shifted = !targetPose && options.cacheBase && previousSignature === signature && aligned
            && Math.abs(dx) < width && Math.abs(dy) < height
            && base.restore(context, previousKey, [pixelX, pixelY]);
          const regions = shifted ? journeyPanRegions(width, height, dx, dy) : [[0, 0, width, height] as const];
          for (const [x, y, w, h] of regions) {
            context.save(); context.translate(x, y);
            context.beginPath(); context.rect(0, 0, w, h); context.clip();
            const localProject = (position: number[]): [number, number] => { const p = project(position); return [p[0] - x, p[1] - y]; };
            if (mapPalette.background !== 'transparent') { context.fillStyle = mapPalette.background; context.fillRect(0, 0, w, h); }
            if (background === 'sea') paintSea(context, w, h, localProject([0, 0]), mapPalette.sea);
            if (geography) paintTerrain(context, geography, localProject, w, h, dark, 'land', options.terrainViewport, mapPalette, keepFeatures(geography, query));
            if (landCover) paintTerrain(context, landCover, localProject, w, h, dark, 'land', options.terrainViewport, mapPalette, keepFeatures(landCover, query));
            if (water) paintTerrain(context, water, localProject, w, h, dark, 'water', options.terrainViewport, mapPalette, keepFeatures(water, query));
            if (buildingData.current) paintBuildings(context, buildingData.current, localProject, w, h, dark, style, buildingStylesRef.current);
            boundaries.forEach(({ points, role }, i) => draw(points, role === 'road' ? mapPalette.road : role === 'boundary' ? mapPalette.boundary : mapPalette.terrain[role]?.stroke ?? mapPalette.boundary, i + 137, 1.2, x, y, w, h));
            [...scene.areas].sort((a, b) => Number(selection.selectedAreas.has(a.id)) - Number(selection.selectedAreas.has(b.id))).forEach(area => paintJourneyArea(context, area, localProject, w, h, featureColor('area', area.id), selection.selectedAreas.has(area.id)));
            if (!nextScreenLines) routePoints.map((line, i) => ({ line, route: routes[i] })).sort((a, b) => Number(selection.selectedRoutes.has(a.route.id)) - Number(selection.selectedRoutes.has(b.route.id))).forEach(({ line, route }) => {
              if (!keepRoute(route, query)) return;
              const width = Number.isFinite(route.width) ? Math.max(.5, Math.min(8, route.width!)) : 2;
              draw(line, featureColor('route', route.id), seedToNumber(route.id), width + (selection.selectedRoutes.has(route.id) ? 1 : 0), x, y, w, h);
            });
            context.restore();
          }
          if (options.cacheBase) base.capture(canvas, size, baseKey);
        }
        previousSignature = signature; previousKey = baseKey;
        if (!targetPose) {
          paintOrigin = map.containerPointToLatLng([-padding, -padding]); paintZoom = zoom;
          paintWidth = width; paintHeight = height;
          canvas.style.transformOrigin = '0 0';
          canvas.style.transform = `translate(${-padding}px, ${-padding}px)`;
        }
        paintedPose = projection ? { projection, size, padding } : undefined;
        paintedBackground = background;
        paintedScreenLines = nextScreenLines;
        paintLines();
      };
      const paintFrame = () => paint();
      const schedule = () => { if (!alive()) return; paintPins(); paintLines(); if (!animating && !frame) frame = requestAnimationFrame(paintFrame); };
      paintRef.current = schedule;
      const refreshBase = () => {
        if (!alive()) return;
        if (frame) cancelAnimationFrame(frame); frame = 0;
        paintPins();
        // Replace the raw geographic pixels in their existing animation envelope.
        // The current camera, CSS transform and fly target are never rewritten.
        const fixed = animating && !preparingView ? paintedPose : undefined;
        const size = fixed && journeyCanvasSize(fixed.size.width, fixed.size.height, window.devicePixelRatio || 1, true);
        paint(fixed ? { ...fixed, size: size || fixed.size } : undefined);
      };
      refreshBaseRef.current = refreshBase;
      const appearanceChanged = () => {
        if (updateModeRef.current === 'preserve-view') refreshBase();
        else schedule();
      };
      const requestInitialFit = () => { if (initialFit.tryFit()) schedule(); };
      initialFitRef.current = requestInitialFit;
      syncLayersRef.current = () => {
        if (!alive()) return;
        const changed = layers.sync(layerData.current);
        if (!alive()) return;
        if (changed) requestInitialFit();
        if (!alive()) return;
        if (changed || paintedBackground !== backgroundRef.current) refreshBase();
      };
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
      focusRef.current = place => viewRef.current(pinsById.get(place.id)?.marker.getLatLng() ?? [place.latitude, place.longitude], journeyFocusZoom(fitZoomRef.current, viewOptions.current.focusZoomScale));
      const restore = () => { base.clear(); appearanceChanged(); };
      canvas.addEventListener('contextrestored', restore);
      lines.addEventListener('contextrestored', paintLines);
      // Reuse the existing raster during a pan; repaint geographical detail on rest.
      const translate = () => {
        if (!alive()) return;
        paintLines();
        const point = map.latLngToContainerPoint(paintOrigin);
        const scale = map.getZoomScale(map.getZoom(), paintZoom);
        canvas.style.transformOrigin = '0 0';
        canvas.style.transform = `translate(${point.x}px, ${point.y}px) scale(${scale})`;
        const viewport = map.getSize();
        if (!animating && (point.x > 0 || point.y > 0 || point.x + paintWidth * scale < viewport.x || point.y + paintHeight * scale < viewport.y)) schedule();
      };
      const settle = () => {
        if (!alive() || preparingView) return;
        animating = false; activeView = undefined;
        // A previously empty map can acquire its first valid data during a
        // flight. Initialize once after that flight; later updates never fit.
        if (updateModeRef.current === 'preserve-view') requestInitialFit();
        if (alive()) schedule();
      };
      map.on('move', translate);
      map.on('moveend zoomend resize', settle);
      const stopDrag = () => { if (!alive()) return; map.stop(); animating = false; activeView = undefined; };
      map.on('dragstart', stopDrag);
      map.on('zoomend', notifyZoom);
      syncPlacesRef.current = () => {
        if (!alive()) return;
        const nextPlaces = placesRef.current.filter(valid);
        const ids = new Set(nextPlaces.map(place => place.id));
        let contentChanged = pinSurfaces.length !== nextPlaces.length || pinSurfaces.some((pin, i) => pin.place.id !== nextPlaces[i]?.id);
        for (const [id, pin] of pinsById) if (!ids.has(id)) {
          motion.remove(id); pin.release(); pin.marker.remove();
          pin.canvas.removeEventListener('contextrestored', pin.restore); pin.canvas.width = pin.canvas.height = 0;
          pinsById.delete(id);
        }
        const nextPins = nextPlaces.map(place => {
          let pin = pinsById.get(place.id);
          if (!pin) {
            const symbol = document.createElement('span'); symbol.className = 'inkra-journey-map__symbol';
            const ink = document.createElement('canvas'); ink.className = 'inkra-journey-map__stop'; ink.setAttribute('aria-hidden', 'true');
            const node = document.createElement('span'); node.className = 'inkra-journey-map__pin';
            const icon = document.createElement('span'); icon.className = 'inkra-journey-map__custom-icon';
            symbol.append(ink, icon, node);
            const marker = L.marker([place.latitude, place.longitude], { icon: L.divIcon({ html: symbol, className: 'inkra-journey-map__marker', iconSize: [44, 44], iconAnchor: [22, 22] }), keyboard: true, title: place.label, alt: place.label }).addTo(map);
            pin = { place, marker, canvas: ink, node, icon, symbol, key: '', restore: () => {}, release: () => {} };
            const record = pin;
            pin.restore = () => { record.key = ''; paintPins(); };
            ink.addEventListener('contextrestored', pin.restore);
            const pick = () => { if (alive() && pinsById.get(record.place.id) === record) selectPlace(record.place); };
            marker.on('click', pick);
            const element = marker.getElement();
            const keydown = (event: KeyboardEvent) => {
              if (event.target !== element || (event.key !== 'Enter' && event.key !== ' ')) return;
              event.preventDefault(); event.stopPropagation(); pick();
            };
            element?.addEventListener('keydown', keydown);
            record.release = () => { marker.off('click', pick); element?.removeEventListener('keydown', keydown); };
            pinsById.set(place.id, pin); contentChanged = true;
          } else if (pin.place.label !== place.label || pin.place.color !== place.color || pin.place.icon !== place.icon || pin.place.labelContent !== place.labelContent) contentChanged = true;
          pin.place = place;
          const position = place.labelPosition ?? labelOptionsRef.current.labelPosition;
          pin.symbol.dataset.labelPosition = ['top', 'bottom', 'left', 'right'].includes(position) ? position : 'bottom';
          pin.node.dataset.labelCustom = String(place.labelContent !== undefined || labelOptionsRef.current.custom);
          if (Number.isFinite(place.labelGap)) pin.node.style.setProperty('--inkra-map-label-gap', `${Math.max(-32, Math.min(128, place.labelGap!))}px`);
          else pin.node.style.removeProperty('--inkra-map-label-gap');
          const custom = place.icon !== undefined && place.icon !== null && place.icon !== false;
          pin.canvas.hidden = custom; pin.icon.hidden = !custom; pin.symbol.dataset.custom = String(custom);
          pin.icon.style.color = place.color ?? '';
          const element = pin.marker.getElement();
          if (element) { element.title = place.label; element.setAttribute('aria-label', place.label); element.setAttribute('aria-pressed', String(selectedRef.current.has(place.id))); }
          const current = pin.marker.getLatLng();
          motion.move(place.id, { latitude: current.lat, longitude: current.lng }, place, place.transition ?? placeTransitionRef.current, reducedMotion.matches);
          return pin;
        });
        pinSurfaces.length = 0; pinSurfaces.push(...nextPins);
        resizePinsRef.current();
        if (contentChanged) setPlaceLabels(nextPins.map(({ place, node, icon }) => ({ place, node, icon })));
        if (markersInitialized && !fitted && nextPlaces.length) requestInitialFit();
      };
      resizePinsRef.current = () => {
        if (!alive()) return;
        const hitSize = Math.max(44, pinSizeRef.current);
        for (const { marker } of markersRef.current) {
          // Keep the native marker and portal nodes: resizing must not reset the camera.
          const element = marker.getElement();
          if (element) Object.assign(element.style, { width: `${hitSize}px`, height: `${hitSize}px`, marginLeft: `${-hitSize / 2}px`, marginTop: `${-hitSize / 2}px` });
          Object.assign(marker.getIcon().options, { iconSize: [hitSize, hitSize], iconAnchor: [hitSize / 2, hitSize / 2] });
        }
        paintPins();
      };
      syncPlacesRef.current(); markersInitialized = true;
      const motionPreferenceChanged = () => syncPlacesRef.current();
      reducedMotion.addEventListener('change', motionPreferenceChanged);
      const observer = new ResizeObserver(() => { if (!alive()) return; map.invalidateSize(); if (!alive()) return; if (!fitted) requestInitialFit(); schedule(); });
      observer.observe(host.current);
      const appearance = new MutationObserver(appearanceChanged);
      for (let element: HTMLElement | null = host.current; element; element = element.parentElement) {
        appearance.observe(element, { attributes: true, attributeFilter: ['data-theme', 'data-inkra-theme', 'style', 'class'] });
      }
      const scheme = matchMedia('(prefers-color-scheme: dark)');
      scheme.addEventListener('change', appearanceChanged);
      let resolution: MediaQueryList;
      const watchResolution = () => {
        resolution?.removeEventListener('change', resolutionChanged);
        resolution = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        resolution.addEventListener('change', resolutionChanged);
      };
      const resolutionChanged = () => { if (!alive()) return; watchResolution(); appearanceChanged(); };
      watchResolution();
      cleanup = () => { disposed = true; initialFit.dispose(); zoomEvents.dispose(); map.off('move', translate); map.off('moveend zoomend resize', settle); map.off('dragstart', stopDrag); map.off('zoomend', notifyZoom); motion.clear(); reducedMotion.removeEventListener('change', motionPreferenceChanged); cancelAnimationFrame(frame); observer.disconnect(); appearance.disconnect(); scheme.removeEventListener('change', appearanceChanged); resolution.removeEventListener('change', resolutionChanged); canvas.removeEventListener('contextrestored', restore); lines.removeEventListener('contextrestored', paintLines); releaseLayers(); base.clear(); colorProbe.remove(); pinSurfaces.forEach(pin => { pin.release(); pin.canvas.removeEventListener('contextrestored', pin.restore); pin.canvas.width = pin.canvas.height = 0; }); pinsById.clear(); map.remove(); lines.width = lines.height = 0; lines.remove(); canvas.width = canvas.height = 0; canvas.remove(); mapRef.current = null; markersRef.current = []; featureHits.current = []; paintRef.current = () => {}; refreshBaseRef.current = () => {}; syncLayersRef.current = () => {}; refreshFeaturesRef.current = () => {}; resizePinsRef.current = () => {}; syncPlacesRef.current = () => {}; viewRef.current = () => {}; zoomRef.current = () => {}; focusRef.current = () => {}; fitRef.current = () => {}; initialFitRef.current = () => {}; };
      initialFit.tryFit();
      if (!alive()) return;
      schedule(); setReady(true);
    }).catch(() => { if (!cancelled) { setFailed(true); cleanup?.(); cleanup = undefined; } });
    return () => { cancelled = true; cleanup?.(); };
  }, [setup.revision]);
  useBrowserLayoutEffect(() => {
    // Publish only committed props. An abandoned concurrent render must not
    // replace native geometry or Reset bounds in the visible map.
    layerData.current = layerInputs;
    fitLimitRef.current = fitLimit;
    backgroundRef.current = background;
    updateModeRef.current = updateMode;
    if (updateMode === 'preserve-view') syncLayersRef.current();
  }, [layerInputs, fitLimit, background, updateMode, ready]);
  useEffect(() => { syncPlacesRef.current(); }, [places, placeTransition, labelPosition, renderPlaceLabel, ready]);
  useEffect(() => { initialFitRef.current(); }, [markers, buildings, ready]);
  useEffect(() => { (updateMode === 'preserve-view' ? refreshBaseRef : paintRef).current(); }, [palette, updateMode]);
  useEffect(() => { (updateMode === 'preserve-view' ? refreshBaseRef : paintRef).current(); }, [buildings, buildingStyles, routeStyles, landCoverBoundaryStyles, ready, updateMode]);
  useEffect(() => { if (ready) onReadyRef.current?.(); }, [ready]);
  const selectedPlacesKey = JSON.stringify([...placeSelection.ids].sort());
  useEffect(() => {
    markersRef.current.forEach(({ place, marker }) => marker.getElement()?.setAttribute('aria-pressed', String(placeSelection.ids.has(place.id))));
    paintRef.current();
    const changed = previousSelection.current.place !== selectedPlace || previousSelection.current.scale !== focusZoomScale;
    previousSelection.current = { place: selectedPlace, scale: focusZoomScale };
    const place = markersRef.current.find(item => item.place.id === selectedPlace)?.place;
    if (selectionMode === 'single' && focusSelectedPlace && changed && place) focusRef.current(place);
  }, [selectedPlacesKey, selectedPlace, selectionMode, focusSelectedPlace, focusZoomScale, ready]);
  useEffect(() => {
    refreshFeaturesRef.current();
    (updateMode === 'preserve-view' ? refreshBaseRef : paintRef).current();
  }, [routeSelection.ids, areaSelection.ids, routeSelection.enabled, areaSelection.enabled, ready, updateMode]);
  useEffect(() => { resizePinsRef.current(); }, [artworkSize, pinColor, ready]);
  useEffect(() => { (updateMode === 'preserve-view' ? refreshBaseRef : paintRef).current(); }, [renderingOptions.featureViewport, renderingOptions.boundaryViewport, renderingOptions.terrainViewport, renderingOptions.reuseCanvas, renderingOptions.cacheBase, updateMode]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const handler of [map.dragging, map.touchZoom, map.doubleClickZoom, map.boxZoom, map.keyboard]) {
      if (interactive) handler.enable(); else handler.disable();
    }
    if (interactive && scrollWheelZoom) map.scrollWheelZoom.enable(); else map.scrollWheelZoom.disable();
    if (interactive && host.current) return attachJourneyTrackpad(hasMarkers ? host.current.parentElement ?? host.current : host.current, map);
  }, [interactive, scrollWheelZoom, ready, hasMarkers]);
  return <div {...props} ref={root} style={haloStyle} data-label-halo={labelHalo !== false} className={['inkra-journey-map', className].filter(Boolean).join(' ')}>
    {placeLabels.map(({ place: snapshot, node, icon }) => {
      const place = displayPlaces.get(snapshot.id); if (!place) return null;
      const content = place.labelContent !== undefined ? place.labelContent : renderPlaceLabel ? renderPlaceLabel(place) : <PencilText>{place.label}</PencilText>;
      return <span key={place.id} className="inkra-journey-map__portal-owner">
        {createPortal(<span className="inkra-journey-map__label-content" onClick={stopLabelInteraction} onPointerDown={stopLabelInteraction} onMouseDown={stopLabelInteraction} onTouchStart={stopLabelInteraction} onKeyDown={stopLabelInteraction} onKeyPress={stopLabelInteraction} onKeyUp={stopLabelInteraction}>{content}</span>, node)}
        {createPortal(<>{place.icon}{place.icon !== undefined && place.icon !== null && place.icon !== false && placeSelection.ids.has(place.id) && <PencilSurface as="span" className="inkra-journey-map__custom-selection" aria-hidden="true" variant="outline" radius={24} seed={`journey-selection-${place.id}`} />}</>, icon)}
      </span>;
    })}
    {featureLabels.map(({ kind, id, label, node }) => createPortal(<PencilText className="inkra-journey-map__feature-label" data-selected={(kind === 'area' ? areaSelection.ids : routeSelection.ids).has(id)}>{label}</PencilText>, node, `${kind}:${id}`))}
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
      {ready && mapRef.current && markers.length > 0 && <MarkerLayer map={mapRef.current} markers={markers} clustering={markerClustering} presentation={markerPresentation} avatarFeather={markerAvatarFeather} selected={activeMarker} onSelect={selectMarker} renderMarker={renderMarker} labels={resolvedMarkerLabels} />}
      {ready && <MapScale map={mapRef.current} />}
      {failed && <p role="status">{labels.unavailable}</p>}
    </div>
    {attributionDisplay === 'inline' && <p className="inkra-journey-map__attribution">{attribution}</p>}
    {(!ready || failed) && markers.length > 0 && <ol className="inkra-journey-map__markers-list" aria-label={resolvedMarkerLabels.list}>{validJourneyMarkers(markers).map(marker => <li key={marker.id}><button type="button" aria-pressed={marker.id === activeMarker} onClick={() => selectMarker(marker)}><PencilText>{marker.label}</PencilText></button></li>)}</ol>}
    {(showPlaceList || !ready || failed) && <ol className="inkra-journey-map__places">{places.filter(valid).map((place, index) => <li key={place.id}><button type="button" aria-pressed={placeSelection.ids.has(place.id)} onClick={() => selectPlace(place, true)}><span aria-hidden="true">{index + 1}</span><PencilText>{place.label}</PencilText></button></li>)}</ol>}
    {(showFeatureList || !ready || failed) && (routes.length > 0 || usableAreas.length > 0) && <ol className="inkra-journey-map__features" aria-label={labels.features}>
      {routes.map(route => <li key={`route:${route.id}`}>{routeSelection.enabled ? <button type="button" aria-pressed={routeSelection.ids.has(route.id)} onClick={() => routeSelection.select(route)}><PencilText>{route.label || route.id}</PencilText></button> : <PencilText>{route.label || route.id}</PencilText>}</li>)}
      {usableAreas.map(area => <li key={`area:${area.id}`}>{areaSelection.enabled ? <button type="button" aria-pressed={areaSelection.ids.has(area.id)} onClick={() => areaSelection.select(area)}><PencilText>{area.label}</PencilText></button> : <PencilText>{area.label}</PencilText>}</li>)}
    </ol>}
  </div>;
}
