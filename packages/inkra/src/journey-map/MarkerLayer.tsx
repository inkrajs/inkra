import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type * as Leaflet from 'leaflet';
import { Button } from '../Button.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { seedToNumber } from '../internal/random.js';
import { paintStop } from './terrain.js';
import { avatarStackLayout, clusterJourneyMarkers, type JourneyMarker, type JourneyMarkerCluster, type JourneyMarkerClustering, type JourneyMarkerLabels, type JourneyMarkerRenderState, type JourneyMarkerPresentation, type JourneyMarkerAvatarFeather } from './markers.js';
import { AvatarPlaceholder, AvatarSlot } from './AvatarStack.js';
import { useInkraLocale } from '../i18n/index.js';

/** Reuses the existing stop's paper, pencil fill, irregular ring and selected ring. */
function MarkerFrame({ id, selected, children }: { id: string; selected: boolean; children?: ReactNode }) {
  const frame = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    const element = frame.current, node = canvas.current;
    if (!element || !node) return;
    let active = true;
    const draw = () => {
      if (!active) return;
      const context = node.getContext('2d');
      if (!context) { setPainted(false); return; }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      node.width = node.height = Math.round(64 * dpr);
      context.scale(dpr, dpr); context.translate(32, 32); context.scale(1.75, 1.75);
      const style = getComputedStyle(element);
      paintStop(context, 0, 0, seedToNumber(id), style.getPropertyValue('--inkra-accent-strong').trim(), style.getPropertyValue('--inkra-paper').trim(), selected);
      setPainted(true);
    };
    draw();
    const observer = new MutationObserver(draw);
    for (let parent: HTMLElement | null = element.closest<HTMLElement>('.inkra-journey-map'); parent; parent = parent.parentElement) observer.observe(parent, { attributes: true, attributeFilter: ['style', 'class', 'data-theme', 'data-inkra-theme'] });
    const scheme = matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', draw);
    return () => { active = false; observer.disconnect(); scheme.removeEventListener('change', draw); };
  }, [id, selected]);
  return <span ref={frame} className="inkra-journey-map__marker-frame" data-painted={painted} data-selected={selected} aria-hidden="true">
    <canvas ref={canvas} width={64} height={64} />
    {children != null && <span ref={node => { node?.setAttribute('inert', ''); }} className="inkra-journey-map__marker-content">{children}</span>}
  </span>;
}

interface MarkerLayerProps {
  map: Leaflet.Map;
  markers: readonly JourneyMarker[];
  clustering: JourneyMarkerClustering;
  presentation: JourneyMarkerPresentation;
  avatarFeather?: JourneyMarkerAvatarFeather;
  selected: string | null;
  onSelect: (marker: JourneyMarker) => void;
  renderMarker?: (marker: JourneyMarker, state: JourneyMarkerRenderState) => ReactNode;
  labels: Required<JourneyMarkerLabels>;
}

interface FocusOrigin { cluster: JourneyMarkerCluster; markerId?: string; more: boolean }
const markerKey = (id: string) => `marker:${id}`;

export function MarkerLayer({ map, markers, clustering, presentation, avatarFeather, selected, onSelect, renderMarker, labels }: MarkerLayerProps) {
  const { t } = useInkraLocale();
  const avatarMode = presentation === 'avatar-stack';
  const layer = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const actions = useRef(new Map<string, HTMLButtonElement>());
  const panelId = useId();
  const panelHadFocus = useRef(false);
  const previousExpanded = useRef<JourneyMarkerCluster | undefined>(undefined);
  const focused = useRef<FocusOrigin | undefined>(undefined);
  const panelMarker = useRef<string | undefined>(undefined);
  const pendingRestore = useRef<FocusOrigin | undefined>(undefined);
  const [expanded, setExpanded] = useState<string | null>(null);
  const projection = useMemo(() => {
    const read = () => ({
      size: map.getSize(),
      clusters: clusterJourneyMarkers(markers, marker => map.latLngToContainerPoint([marker.latitude, marker.longitude]), clustering, presentation),
    });
    let snapshot = map.getPane('mapPane') ? read() : { size: { x: 0, y: 0 }, clusters: [] as JourneyMarkerCluster[] };
    return {
      getSnapshot: () => snapshot,
      subscribe: (notify: () => void) => {
        let active = true;
        const update = () => {
          // A parent geometry update may remove this map before child cleanup.
          if (!active || !map.getPane('mapPane')) return;
          snapshot = read();
          notify();
        };
        // The external-store subscription commits synchronously before paint.
        // A separate RAF/state update would trail Leaflet's animated projection.
        map.on('move zoom resize', update);
        update();
        return () => { active = false; map.off('move zoom resize', update); };
      },
    };
  }, [map, markers, clustering, presentation]);
  const { clusters, size } = useSyncExternalStore(projection.subscribe, projection.getSnapshot, projection.getSnapshot);
  const expandedCluster = clusters.find(cluster => cluster.id === expanded);
  if (expandedCluster) previousExpanded.current = expandedCluster;
  const restore = (origin?: FocusOrigin) => {
    if (!origin || !layer.current) return;
    const related = clusters.find(item => origin.markerId !== undefined && item.markers.some(marker => marker.id === origin.markerId)) ??
      clusters.find(item => item.markers.some(marker => origin.cluster.markers.some(previous => marker.id === previous.id)));
    const member = origin.markerId !== undefined ? actions.current.get(markerKey(origin.markerId)) : undefined;
    const same = actions.current.get(origin.cluster.id);
    const replacement = related && (actions.current.get(related.id) ?? related.markers.map(marker => actions.current.get(markerKey(marker.id))).find(Boolean));
    const node = origin.more ? same ?? member ?? replacement : member ?? same ?? replacement;
    (node?.isConnected ? node : layer.current).focus({ preventScroll: true });
  };
  const close = (returnFocus = true, markerId?: string) => {
    pendingRestore.current = returnFocus && expandedCluster ? { cluster: expandedCluster, markerId, more: avatarMode } : undefined;
    if (!returnFocus) focused.current = undefined;
    panelHadFocus.current = false;
    setExpanded(null);
  };
  useLayoutEffect(() => {
    if (!expanded) return;
    if (!expandedCluster || (avatarMode && expandedCluster.markers.length <= 3)) {
      if (panelHadFocus.current && previousExpanded.current) pendingRestore.current = { cluster: previousExpanded.current, markerId: panelMarker.current, more: avatarMode };
      setExpanded(null);
      panelHadFocus.current = false;
      return;
    }
    panel.current?.querySelector<HTMLButtonElement>('[data-marker-option]')?.focus({ preventScroll: true });
  }, [expanded, !!expandedCluster, avatarMode]);
  useLayoutEffect(() => {
    if (!expanded && pendingRestore.current) {
      const origin = pendingRestore.current; pendingRestore.current = undefined; restore(origin);
    } else if (!pendingRestore.current && focused.current && document.activeElement === document.body) restore(focused.current);
  }, [expanded, clusters]);
  useEffect(() => {
    const release = (event: Event) => {
      if (!layer.current) return;
      const target = event.target;
      const trigger = target instanceof Element ? target.closest<HTMLElement>('[data-marker-more]') : null;
      const insideTrigger = !!expanded && trigger === actions.current.get(expanded);
      if (avatarMode && expanded && !panel.current?.contains(target as Node) && !insideTrigger) close(false);
      if (!layer.current.contains(target as Node)) { focused.current = undefined; pendingRestore.current = undefined; panelHadFocus.current = false; }
    };
    document.addEventListener('pointerdown', release, true);
    document.addEventListener('focusin', release, true);
    return () => { document.removeEventListener('pointerdown', release, true); document.removeEventListener('focusin', release, true); };
  }, [expanded, avatarMode]);
  useEffect(() => {
    if (!avatarMode || !expanded) return;
    let active = true;
    const dismiss = () => { if (active && layer.current) close(false); };
    map.on('movestart dragstart', dismiss);
    window.addEventListener('blur', dismiss);
    return () => { active = false; map.off('movestart dragstart', dismiss); window.removeEventListener('blur', dismiss); };
  }, [map, avatarMode, expanded]);
  const render = (marker: JourneyMarker) => renderMarker?.(marker, { selected: marker.id === selected }) ?? (avatarMode ? <AvatarPlaceholder /> : <PencilText>{Array.from(marker.label)[0] ?? '·'}</PencilText>);
  return <div ref={layer} className="inkra-journey-map__marker-layer" data-presentation={presentation} data-expanded={!!expandedCluster} tabIndex={-1} onFocusCapture={event => {
    panelHadFocus.current = !!panel.current?.contains(event.target as Node);
    const target = event.target as HTMLElement;
    if (panelHadFocus.current) { panelMarker.current = target.dataset.markerOption; return; }
    const cluster = clusters.find(item => item.id === target.dataset.clusterId);
    if (cluster) focused.current = { cluster, markerId: target.dataset.markerId, more: target.hasAttribute('data-marker-more') };
  }} onBlurCapture={event => { if (event.relatedTarget) { panelHadFocus.current = !!panel.current?.contains(event.relatedTarget as Node); if (!layer.current?.contains(event.relatedTarget as Node)) focused.current = undefined; } }} onKeyDown={event => { if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); close(); } }}>
    {clusters.map((cluster, clusterIndex) => {
      const grouped = cluster.markers.length > 1;
      const active = cluster.markers.some(marker => marker.id === selected);
      const label = grouped ? labels.cluster(cluster.markers.length) : cluster.markers[0].label;
      if (avatarMode) {
        const preview = cluster.markers.slice(0, 3), geometry = avatarStackLayout(cluster.markers.length);
        const more = cluster.markers.length > 3;
        const hiddenSelected = active && !preview.slice(0, 2).some(marker => marker.id === selected);
        const descriptionId = `${panelId}-selected-${clusterIndex}`;
        return <div key={cluster.id} className="inkra-journey-map__point" style={{ left: cluster.x, top: cluster.y, width: geometry.width }} data-marker-ids={JSON.stringify(cluster.markers.map(marker => marker.id))}>
          {preview.map((marker, index) => {
            const isMore = more && index === 2, key = isMore ? cluster.id : markerKey(marker.id);
            return <button key={marker.id} ref={node => { if (node) actions.current.set(key, node); else actions.current.delete(key); }} type="button" className="inkra-journey-map__marker-action inkra-journey-map__avatar-action" style={{ left: index * 20, zIndex: index + 1 }} data-avatar-stack="true" data-avatar-index={index} data-cluster-id={cluster.id} data-marker-id={isMore ? undefined : marker.id} data-marker-more={isMore ? 'true' : undefined} aria-label={isMore ? labels.more(cluster.markers.length) : marker.label} aria-pressed={isMore ? undefined : marker.id === selected} aria-describedby={isMore && hiddenSelected ? descriptionId : undefined} aria-haspopup={isMore ? 'dialog' : undefined} aria-expanded={isMore ? expanded === cluster.id : undefined} aria-controls={isMore && expanded === cluster.id ? panelId : undefined} onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation(); }} onClick={event => {
              event.stopPropagation();
              if (isMore) { if (expanded === cluster.id) close(); else { pendingRestore.current = undefined; setExpanded(cluster.id); } }
              else { pendingRestore.current = undefined; panelHadFocus.current = false; setExpanded(null); onSelect(marker); }
            }}>
              <AvatarSlot marker={marker} index={index} inButton selected={marker.id === selected} groupSelected={isMore && hiddenSelected} total={isMore ? cluster.markers.length : undefined} feather={avatarFeather}>{render(marker)}</AvatarSlot>
            </button>;
          })}
          {more && hiddenSelected && <span id={descriptionId} hidden>{t('common.selected')}: {cluster.markers.find(marker => marker.id === selected)?.label}</span>}
        </div>;
      }
      return <div key={cluster.id} className="inkra-journey-map__point" style={{ left: cluster.x, top: cluster.y }} data-marker-ids={JSON.stringify(cluster.markers.map(marker => marker.id))}>
        <MarkerFrame id={cluster.id} selected={active}>{grouped ? <PencilText>{String(cluster.markers.length)}</PencilText> : render(cluster.markers[0])}</MarkerFrame>
        <button ref={node => { if (node) actions.current.set(cluster.id, node); else actions.current.delete(cluster.id); }} type="button" className="inkra-journey-map__marker-action" data-cluster-id={cluster.id} aria-label={label} title={label} aria-pressed={grouped ? undefined : active} aria-expanded={grouped ? expanded === cluster.id : undefined} aria-controls={grouped && expanded === cluster.id ? panelId : undefined} onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation(); }} onClick={event => { event.stopPropagation(); if (grouped) setExpanded(expanded === cluster.id ? null : cluster.id); else onSelect(cluster.markers[0]); }} />
      </div>;
    })}
    {expandedCluster && <div ref={panel} id={panelId} role={avatarMode ? 'dialog' : 'group'} aria-label={labels.cluster(expandedCluster.markers.length)} className="inkra-journey-map__marker-panel" style={{ left: Math.max(12, Math.min(size.x - 272, expandedCluster.x - 130)), top: Math.max(12, Math.min(size.y - 210, expandedCluster.y + 30)) }}>
      <PencilSurface variant="paper" seed="journey-marker-panel" className="inkra-journey-map__marker-panel-surface" aria-hidden="true" />
      <div className="inkra-journey-map__marker-options">{expandedCluster.markers.map(marker => <div key={marker.id} className="inkra-journey-map__marker-option">
        {avatarMode ? <AvatarSlot marker={marker} inList selected={marker.id === selected} feather={avatarFeather}>{render(marker)}</AvatarSlot> : <MarkerFrame id={marker.id} selected={marker.id === selected}>{render(marker)}</MarkerFrame>}
        <button type="button" data-marker-option={marker.id} aria-pressed={marker.id === selected} onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation(); }} onClick={() => { close(true, marker.id); onSelect(marker); }}><PencilText>{marker.label}</PencilText></button>
      </div>)}</div>
      {!avatarMode && <Button variant="ghost" onClick={() => close()}>{labels.collapse}</Button>}
    </div>}
  </div>;
}
