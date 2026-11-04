import type { Feature, GeoJsonObject, Position } from 'geojson';
import { pencilStroke, type PencilPoint } from '../internal/stroke.js';
import { resolveMapColor } from './buildings.js';
import { mapFeatures } from './terrain.js';
import type { JourneyRoute } from './annotations.js';

/** Screen-pixel line styling; no classification or geometry is inferred. */
export interface JourneyLineStyle {
  /** CSS color or var(--custom-property), resolved in the map theme. */
  color?: string;
  /** Nominal pencil width in CSS px, .5..12. Nonpositive/nonfinite uses the context default. */
  width?: number;
  /** Alternating ink/gap lengths in CSS px. 1..8 positive finite entries, each .5..128; [] is solid. */
  dash?: readonly number[];
}
export type JourneyLineStyles = Readonly<Record<string, JourneyLineStyle>>;
type ComputedStyle = Pick<CSSStyleDeclaration, 'getPropertyValue'>;
type Point = [number, number];
export interface JourneyResolvedLineStyle { color: string; width: number; dash: number[] }
interface PathPart { points: Point[]; offset: number; total: number }

export function journeyLineStyleFor(styles: JourneyLineStyles | undefined, key: unknown): JourneyLineStyle | undefined {
  if (!styles || !(typeof key === 'string' || (typeof key === 'number' && Number.isFinite(key)))) return;
  const name = String(key);
  if (!Object.prototype.hasOwnProperty.call(styles, name)) return;
  const value = styles[name];
  return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}

export function resolveJourneyLineStyle(value: JourneyLineStyle | undefined, computed: ComputedStyle, color: string, width: number): JourneyResolvedLineStyle {
  const raw = value?.dash;
  const entries = Array.isArray(raw) && raw.length <= 8 ? Array.from(raw) : undefined;
  let dash = entries && entries.every(item => typeof item === 'number' && Number.isFinite(item) && item > 0)
    ? entries.map(item => Math.max(.5, Math.min(128, item))) : [];
  if (dash.length % 2) dash = [...dash, ...dash];
  return {
    color: resolveMapColor(typeof value?.color === 'string' ? value.color : undefined, computed, color),
    width: typeof value?.width === 'number' && Number.isFinite(value.width) && value.width > 0 ? Math.max(.5, Math.min(12, value.width)) : width,
    dash,
  };
}

/** Explicit upstream route fields override type defaults; dash remains type-driven. */
export function resolveJourneyRouteStyle(route: JourneyRoute, value: JourneyLineStyle | undefined, computed: ComputedStyle, color: string, selected = false): JourneyResolvedLineStyle {
  const resolved = resolveJourneyLineStyle(value, computed, color, 2);
  if (typeof route.color === 'string' && route.color.trim()) resolved.color = resolveMapColor(route.color, computed, resolved.color);
  // Keep the upstream finite-width behavior, including its lower bound for zero/negative inputs.
  if (typeof route.width === 'number' && Number.isFinite(route.width)) resolved.width = Math.max(.5, Math.min(8, route.width));
  if (selected) resolved.width += 1;
  return resolved;
}

/** Clip before sampling, while retaining the uncut arc distance for dash/material phase. */
export function clipJourneyLine(points: readonly PencilPoint[], width: number, height: number, margin: number): PathPart[] {
  if (points.length < 2 || points.length > 65536 || points.some(point => !Number.isFinite(point[0]) || !Number.isFinite(point[1]))) return [];
  const lengths = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER) return [];
  const parts: PathPart[] = []; let distance = 0, previousEnd = -1;
  for (let index = 0; index < lengths.length; index++) {
    const a = points[index], b = points[index + 1], length = lengths[index], dx = b[0] - a[0], dy = b[1] - a[1];
    if (length < 1e-8) continue;
    let from = 0, to = 1, visible = true;
    for (const [p, q] of [[-dx, a[0] + margin], [dx, width + margin - a[0]], [-dy, a[1] + margin], [dy, height + margin - a[1]]]) {
      if (p === 0) { if (q < 0) { visible = false; break; } }
      else { const t = q / p; if (p < 0) from = Math.max(from, t); else to = Math.min(to, t); if (from > to) { visible = false; break; } }
    }
    if (visible && to - from > 1e-10) {
      const start = distance + length * from, end = distance + length * to;
      const first: Point = [a[0] + dx * from, a[1] + dy * from], last: Point = [a[0] + dx * to, a[1] + dy * to];
      const previous = parts[parts.length - 1];
      if (previous && Math.abs(start - previousEnd) < 1e-6) previous.points.push(last);
      else parts.push({ points: [first, last], offset: start, total });
      previousEnd = end;
    }
    distance += length;
  }
  return parts;
}

/** Split a visible path by its global screen arc phase. Odd patterns are normalized first. */
export function dashJourneyLine(part: PathPart, pattern: readonly number[]): PathPart[] {
  if (!pattern.length) return [part];
  if (pattern.length > 16) return [];
  pattern = Array.from(pattern);
  const cycle = pattern.reduce((sum, value) => sum + value, 0);
  if (!(cycle > 0 && Number.isFinite(cycle)) || pattern.some(value => !Number.isFinite(value) || value <= 0)) return [];
  let phase = ((part.offset % cycle) + cycle) % cycle, item = 0;
  while (phase >= pattern[item] && item < pattern.length - 1) { phase -= pattern[item]; item++; }
  const result: PathPart[] = []; let current: PathPart | undefined, at = part.offset, budget = 65536;
  for (let index = 1; index < part.points.length; index++) {
    const a = part.points[index - 1], b = part.points[index], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-8) continue;
    let cursor = 0;
    while (cursor < length - 1e-8) {
      if (--budget < 0) return [];
      const step = Math.min(length - cursor, pattern[item] - phase);
      if (!(step > 0)) { item = (item + 1) % pattern.length; phase = 0; continue; }
      const first: Point = [a[0] + (b[0] - a[0]) * cursor / length, a[1] + (b[1] - a[1]) * cursor / length];
      const last: Point = [a[0] + (b[0] - a[0]) * (cursor + step) / length, a[1] + (b[1] - a[1]) * (cursor + step) / length];
      if (item % 2 === 0) {
        if (!current) current = { points: [first], offset: at + cursor, total: part.total };
        current.points.push(last);
      }
      cursor += step; phase += step;
      if (phase >= pattern[item] - 1e-8) {
        if (current) { result.push(current); current = undefined; }
        item = (item + 1) % pattern.length; phase = 0;
      }
    }
    at += length;
  }
  if (current) result.push(current);
  return result;
}

export function paintJourneyLine(context: CanvasRenderingContext2D, points: readonly PencilPoint[], style: JourneyResolvedLineStyle, seed: number, width: number, height: number) {
  for (const part of clipJourneyLine(points, width, height, Math.max(16, style.width * 3))) {
    for (const dash of dashJourneyLine(part, style.dash)) {
      pencilStroke(context, dash.points, style.color, style.width, seed, .3, 3, false, {
        grain: .7, breaks: .15, variation: .8, gain: 2.5, step: .8,
        distanceOffset: dash.offset, totalDistance: dash.total,
        lineCap: style.dash.length ? 'butt' : undefined,
      });
    }
  }
}

export function paintJourneyLandCoverBoundaries(context: CanvasRenderingContext2D, data: GeoJsonObject, project: (position: Position) => PencilPoint, styles: JourneyLineStyles | undefined, computed: ComputedStyle, width: number, height: number, keepFeature?: (feature: Feature) => boolean) {
  for (const [featureIndex, feature] of mapFeatures(data).entries()) {
    if (!feature) continue;
    // Do not compact the collection or renumber any feature/polygon/ring seed.
    if (keepFeature && !keepFeature(feature)) continue;
    const custom = journeyLineStyleFor(styles, feature.properties?.id);
    if (!custom || !feature.geometry) continue;
    const style = resolveJourneyLineStyle(custom, computed, computed.getPropertyValue('--inkra-ink-muted').trim() || '#777777', 1);
    const geometry = feature.geometry;
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
    if (!Array.isArray(polygons)) continue;
    for (const [polygonIndex, polygon] of polygons.entries()) {
      if (!Array.isArray(polygon)) continue;
      for (const [ringIndex, ring] of polygon.entries()) {
        if (!Array.isArray(ring) || ring.length < 4 || ring.length > 65536 || ring.some(position => !Array.isArray(position) || position.length < 2 || !Number.isFinite(position[0]) || !Number.isFinite(position[1]) || Math.abs(position[0]) > 180 || Math.abs(position[1]) > 85)) continue;
        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) continue;
        paintJourneyLine(context, ring.map(project), style, 31000 + featureIndex * 43 + polygonIndex * 7 + ringIndex, width, height);
      }
    }
  }
}
