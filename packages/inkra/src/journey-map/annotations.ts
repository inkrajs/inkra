import type { JourneyPlaceAnimation } from './motion.js';
import type { ReactNode } from 'react';
import type { MultiPolygon, Polygon, Position } from 'geojson';
import { pencilStroke } from '../internal/stroke.js';
import { seedToNumber } from '../internal/random.js';

export type JourneyPlaceLabelPosition = 'top' | 'bottom' | 'left' | 'right';
export interface JourneyPlace {
  /** Stable, unique identity; coordinate/content updates reuse this marker. */
  id: string;
  label: string;
  /** Optional following display slot. label remains the accessible name. null hides the slot. */
  labelContent?: ReactNode;
  labelPosition?: JourneyPlaceLabelPosition;
  /** -32..128 CSS px; 0 by default. Negative values compensate transparent artwork padding. */
  labelGap?: number;
  latitude: number;
  longitude: number;
  /** CSS color, including theme variables. */
  color?: string;
  /** Replace the default pencil pin; its native 44px target and label remain. */
  icon?: ReactNode;
  /** Per-marker override for coordinate transitions; trajectory generation stays outside the map. */
  transition?: JourneyPlaceAnimation;
}

export interface JourneyRoute {
  id: string;
  /** Caller-owned classification for optional routeStyles. */
  type?: string;
  /** [latitude, longitude]; supplied geometry, without routing inference. */
  coordinates: readonly (readonly [number, number])[];
  label?: string;
  color?: string;
  /** CSS pixels, .5..8; default 2. */
  width?: number;
}

export interface JourneyArea {
  id: string;
  label: string;
  /** GeoJSON [longitude, latitude]. Polygon holes and MultiPolygon are supported. */
  geometry: Polygon | MultiPolygon;
  color?: string;
  /** 0..1; default .12. */
  fillOpacity?: number;
  /** Optional explicit label position inside a business-defined area. */
  labelPosition?: { latitude: number; longitude: number };
}

export const areaPolygons = (geometry: JourneyArea['geometry']) =>
  geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

export function validJourneyArea(area: JourneyArea): boolean {
  if (!area?.geometry || !['Polygon', 'MultiPolygon'].includes(area.geometry.type)) return false;
  if (!Array.isArray(area.geometry.coordinates)) return false;
  const polygons = areaPolygons(area.geometry);
  return polygons.length > 0 && polygons.every(polygon => Array.isArray(polygon) && polygon.length > 0 && polygon.every(ring =>
    Array.isArray(ring) && ring.length >= 4 && ring.every(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 85)
    && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]));
}

const polygonArea = (polygon: Position[][]) => Math.abs(polygon[0].reduce((sum, p, i, ring) => {
  const q = ring[(i + 1) % ring.length]; return sum + p[0] * q[1] - q[0] * p[1];
}, 0));

/** Scan filled intervals, rather than putting a label in a hole or a concavity. */
export function journeyAreaLabel(area: JourneyArea): readonly [number, number] {
  const explicit = area.labelPosition;
  if (explicit && Number.isFinite(explicit.longitude) && Number.isFinite(explicit.latitude)
      && Math.abs(explicit.longitude) <= 180 && Math.abs(explicit.latitude) <= 85) return [explicit.longitude, explicit.latitude];
  const polygon = [...areaPolygons(area.geometry)].sort((a, b) => polygonArea(b) - polygonArea(a))[0];
  let low = Infinity, high = -Infinity;
  for (const p of polygon[0]) { low = Math.min(low, p[1]); high = Math.max(high, p[1]); }
  let result: readonly [number, number] = [polygon[0][0][0], polygon[0][0][1]], score = -1;
  for (let row = 0; row < 17; row++) {
    const y = low + (high - low) * (row + .5) / 17;
    const crossings: number[] = [];
    for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1], b = ring[i];
      if ((a[1] > y) !== (b[1] > y)) crossings.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 1; i < crossings.length; i += 2) {
      const width = crossings[i] - crossings[i - 1];
      const candidate = width / (1 + Math.abs(row - 8) / 17);
      if (candidate > score) { score = candidate; result = [(crossings[i - 1] + crossings[i]) / 2, y]; }
    }
  }
  return result;
}

export function paintJourneyArea(ctx: CanvasRenderingContext2D, area: JourneyArea, project: (p: Position) => readonly [number, number],
  width: number, height: number, color: string, selected: boolean) {
  const alpha = Number.isFinite(area.fillOpacity) ? Math.max(0, Math.min(1, area.fillOpacity!)) : .12;
  const seed = seedToNumber(area.id);
  const anchor = project([0, 0]);
  for (const polygon of areaPolygons(area.geometry)) {
    const rings = polygon.map(ring => ring.map(project));
    let left = width, right = 0, top = height, bottom = 0;
    for (const ring of rings) for (const [x, y] of ring) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
    left = Math.max(0, left); right = Math.min(width, right); top = Math.max(0, top); bottom = Math.min(height, bottom);
    if (left >= right || top >= bottom) continue;
    ctx.save(); ctx.beginPath();
    for (const ring of rings) { ring.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
    ctx.fillStyle = color; ctx.globalAlpha = selected && alpha ? Math.min(1, alpha + .08) : alpha; ctx.fill('evenodd');
    ctx.clip('evenodd'); ctx.globalAlpha = alpha ? .2 : 0;
    if (alpha) for (let row = Math.floor((top - anchor[1]) / 14); row <= Math.ceil((bottom - anchor[1]) / 14); row++) {
      const y = anchor[1] + row * 14;
      for (let col = Math.floor((left - anchor[0] - 40) / 40); col <= Math.ceil((right - anchor[0]) / 40); col++) {
        const x = anchor[0] + col * 40;
        pencilStroke(ctx, [[x, y], [x + 32, y - 7]], color, .6, seed + row * 97 + col, .3, 1, false, { grain: .4, breaks: .3, step: 1.5 });
      }
    }
    ctx.restore();
    for (const ring of rings) pencilStroke(ctx, ring, color, selected ? 2 : 1.2, seed, .3, 2, true,
      { grain: .6, breaks: .12, step: .9, viewport: [width, height], viewportTop: -8 });
  }
}
