import type { Map, Point } from 'leaflet';

type GestureInput = Event & { scale?: number; clientX?: number; clientY?: number };

/** Trackpad pinch is independent of ordinary wheel scrolling and native touch zoom. */
export function attachJourneyTrackpad(host: HTMLElement, map: Map): () => void {
  let frame = 0;
  let pending: { zoom: number; point: Point } | undefined;
  let gesture: { zoom: number; scale: number; point: Point } | undefined;
  let touching = false;
  let remainder = 0;
  let lastWheel = -Infinity;
  const clamp = (zoom: number) => Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), zoom));
  const apply = () => {
    frame = 0;
    if (!pending) return;
    const { point, zoom } = pending;
    pending = undefined;
    const snap = map.options.zoomSnap ?? 0;
    // Snap before calculating the anchor; Leaflet otherwise snaps only the
    // final view and the coordinate under the pointer can drift.
    const target = snap > 0 ? clamp(Math.round(zoom / snap) * snap) : zoom;
    if (target !== map.getZoom()) map.setZoomAround(point, target, { animate: false });
    // Preserve sub-snap movement across a wheel burst instead of losing tiny deltas.
    remainder = zoom - map.getZoom();
  };
  const queue = (zoom: number, point: Point) => {
    pending = { zoom: clamp(zoom), point };
    if (!frame) frame = requestAnimationFrame(apply);
  };
  const pointAt = (event: GestureInput | WheelEvent) => {
    const size = map.getSize();
    if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      const point = map.mouseEventToContainerPoint(event as MouseEvent);
      if (point.x >= 0 && point.y >= 0 && point.x <= size.x && point.y <= size.y) return point;
    }
    return size.divideBy(2);
  };
  const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  const wheel = (event: WheelEvent) => {
    if (!event.ctrlKey) return; // Plain two-finger scrolling continues to the page.
    if (!Number.isFinite(event.deltaY)) return;
    stop(event);
    if (gesture || touching || event.deltaY === 0) return;
    const now = performance.now();
    if (now - lastWheel > 160) remainder = 0;
    lastWheel = now;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1;
    const pixels = Math.max(-100, Math.min(100, event.deltaY * unit));
    queue((pending?.zoom ?? map.getZoom() + remainder) - pixels / (100 * Math.LN2), pointAt(event));
  };
  const start = (event: Event) => {
    if (touching) return; // Leaflet owns physical touchscreen pinch.
    const input = event as GestureInput;
    stop(event); map.stop();
    if (frame) cancelAnimationFrame(frame);
    frame = 0; pending = undefined; remainder = 0;
    gesture = { zoom: map.getZoom(), scale: input.scale && input.scale > 0 && Number.isFinite(input.scale) ? input.scale : 1, point: pointAt(input) };
  };
  const change = (event: Event) => {
    if (!gesture || touching) return;
    stop(event);
    const scale = (event as GestureInput).scale;
    if (scale && scale > 0 && Number.isFinite(scale)) queue(gesture.zoom + Math.log2(scale / gesture.scale), gesture.point);
  };
  const end = (event: Event) => {
    change(event);
    gesture = undefined;
  };
  const touch = (event: TouchEvent) => {
    touching = event.touches.length > 0;
    if (touching && gesture) {
      gesture = undefined; pending = undefined;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }
  };
  host.addEventListener('wheel', wheel, { capture: true, passive: false });
  host.addEventListener('gesturestart', start, { passive: false });
  host.addEventListener('gesturechange', change, { passive: false });
  host.addEventListener('gestureend', end, { passive: false });
  for (const type of ['touchstart', 'touchend', 'touchcancel'] as const) host.addEventListener(type, touch, { capture: true, passive: true });
  const cleanup = () => {
    map.off('unload', cleanup);
    if (frame) cancelAnimationFrame(frame);
    host.removeEventListener('wheel', wheel, true);
    host.removeEventListener('gesturestart', start);
    host.removeEventListener('gesturechange', change);
    host.removeEventListener('gestureend', end);
    for (const type of ['touchstart', 'touchend', 'touchcancel'] as const) host.removeEventListener(type, touch, true);
  };
  map.on('unload', cleanup);
  return cleanup;
}
