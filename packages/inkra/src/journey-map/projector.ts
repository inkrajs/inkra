import type { LatLngExpression, Map as LeafletMap } from 'leaflet';

/** CSS-pixel projection of one already painted Leaflet view, before its CSS transform. */
export interface JourneyPaintPose {
  readonly zoom: number;
  readonly offset: readonly [x: number, y: number];
}

type CaptureMap = Pick<LeafletMap, 'getZoom' | 'project' | 'latLngToContainerPoint'>;
type ProjectMap = Pick<LeafletMap, 'project'>;

/** Capture Leaflet's rounded world-to-container translation using public methods only. */
export function captureJourneyPaintPose(map: CaptureMap, padding: number): JourneyPaintPose | undefined {
  if (!Number.isFinite(padding)) return;
  const zoom = map.getZoom();
  if (!Number.isFinite(zoom)) return;
  const reference: LatLngExpression = [0, 0];
  const world = map.project(reference, zoom);
  const container = map.latLngToContainerPoint(reference);
  if (!Number.isFinite(world.x) || !Number.isFinite(world.y)
    || !Number.isFinite(container.x) || !Number.isFinite(container.y)) return;
  const x = container.x - Math.round(world.x) + padding;
  const y = container.y - Math.round(world.y) + padding;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  return { zoom, offset: [x, y] };
}

/** Project into a captured bitmap without reading or changing the current camera.
 * The caller owns map liveness, input validation and the bitmap's dimensions/DPR. */
export function projectJourneyPaintPose(map: ProjectMap, pose: JourneyPaintPose, position: LatLngExpression): [number, number] {
  const world = map.project(position, pose.zoom);
  return [Math.round(world.x) + pose.offset[0], Math.round(world.y) + pose.offset[1]];
}
