import type { GeoJsonObject, Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { pencilStroke, type PencilPoint } from '../internal/stroke.js';
import { defaultJourneyMapPalette, resolveJourneyMapPalette, type ResolvedJourneyMapPalette, type JourneyMapPigment } from './palette.js';
import { seededRandom } from '../internal/random.js';

type Project = (position: Position) => PencilPoint;
// Anchored hatch and category glyphs adapted from adventure/pencil/brush.js.
const stroke = (ctx: CanvasRenderingContext2D, points: PencilPoint[], color: string, seed: number, width = .6) =>
  pencilStroke(ctx, points, color, width, seed, .3, 1, false, { variation: 1, breaks: .45, grain: .78, gain: 1.7, step: 1 });

let seaMask: HTMLCanvasElement | undefined, seaTile: HTMLCanvasElement | undefined, seaColor: string | undefined;
export function paintSea(ctx: CanvasRenderingContext2D, width: number, height: number, anchor: PencilPoint, colors: Required<JourneyMapPigment> = defaultJourneyMapPalette.sea) {
  if (!seaMask) {
    seaMask = document.createElement('canvas'); seaMask.width = seaMask.height = 512;
    const ink = seaMask.getContext('2d');
    if (!ink) { seaMask = undefined; return; }
    const rng = seededRandom(4801);
    for (let i = 0; i < 320; i++) {
      const x = rng() * 512, y = rng() * 512, length = 9 + rng() * 49;
      ink.globalAlpha = .1 + rng() * .2;
      for (const [dx, dy] of [[0, 0], [-512, 0], [0, 512], [-512, 512]]) {
        ink.save(); ink.translate(dx, dy);
        stroke(ink, [[x, y], [x + length * .5, y - length * .09], [x + length, y - length * .18]], '#000000', 8100 + i, .5 + i % 4 * .1);
        ink.restore();
      }
    }
  }
  // One fixed alpha mask + one reusable color tile: 2 MiB RGBA total.
  // Color edits tint the existing pencil marks instead of sampling them again.
  if (!seaTile) { seaTile = document.createElement('canvas'); seaTile.width = seaTile.height = 512; }
  if (seaColor !== colors.stroke) {
    const ink = seaTile.getContext('2d'); if (!ink) return;
    ink.clearRect(0, 0, 512, 512); ink.drawImage(seaMask, 0, 0);
    ink.globalCompositeOperation = 'source-in'; ink.fillStyle = colors.stroke; ink.fillRect(0, 0, 512, 512);
    ink.globalCompositeOperation = 'source-over'; seaColor = colors.stroke;
  }
  if (colors.fill !== 'transparent') { ctx.save(); ctx.fillStyle = colors.fill; ctx.fillRect(0, 0, width, height); ctx.restore(); }
  const pattern = ctx.createPattern(seaTile, 'repeat');
  if (!pattern) return;
  pattern.setTransform(new DOMMatrix().translate(anchor[0], anchor[1]));
  ctx.save(); ctx.fillStyle = pattern; ctx.fillRect(0, 0, width, height); ctx.restore();
}

export function mapFeatures(data: GeoJsonObject): Feature[] {
  if (data.type === 'FeatureCollection') return (data as FeatureCollection).features;
  if (data.type === 'Feature') return [data as Feature];
  return [{ type: 'Feature', properties: {}, geometry: data as Geometry }];
}

/** Conservative x bounds of polygon edges inside a horizontal strip.
 * Hole rings may widen the bounds, but never remove visible fill. */
export function terrainRowBounds(rings: readonly (readonly PencilPoint[])[], top: number, bottom: number): readonly [number, number] | undefined {
  let left = Infinity, right = -Infinity;
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length];
    if ((ay < top && by < top) || (ay > bottom && by > bottom)) continue;
    if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) return [-Infinity, Infinity];
    if (ay === by) { left = Math.min(left, ax, bx); right = Math.max(right, ax, bx); continue; }
    const low = Math.max(0, Math.min(1, (top - ay) / (by - ay)));
    const high = Math.max(0, Math.min(1, (bottom - ay) / (by - ay)));
    const x1 = ax + (bx - ax) * low, x2 = ax + (bx - ax) * high;
    left = Math.min(left, x1, x2); right = Math.max(right, x1, x2);
  }
  return left <= right ? [left, right] : undefined;
}

export function paintTerrain(ctx: CanvasRenderingContext2D, data: GeoJsonObject, project: Project, width: number, height: number, dark: boolean, defaultKind = 'land', terrainViewport = false, colors?: ResolvedJourneyMapPalette) {
  const resolved = colors ?? resolveJourneyMapPalette(undefined, dark);
  for (const [featureIndex, feature] of mapFeatures(data).entries()) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : geometry.type === 'Polygon' ? [geometry.coordinates] : [];
    const kind = String(feature.properties?.mapRole ?? feature.properties?.id ?? defaultKind);
    const fallback = Object.prototype.hasOwnProperty.call(resolved.terrain, defaultKind) ? resolved.terrain[defaultKind] : resolved.terrain.land;
    const { fill, stroke: ink } = Object.prototype.hasOwnProperty.call(resolved.terrain, kind) ? resolved.terrain[kind] : fallback;
    for (const [polygonIndex, polygon] of polygons.entries()) {
      const rings = polygon.map(ring => ring.map(project));
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const ring of rings) for (const [x, y] of ring) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      const left = Math.max(0, minX), right = Math.min(width, maxX);
      const top = Math.max(0, minY), bottom = Math.min(height, maxY);
      if (left >= right || top >= bottom) continue;
      ctx.save(); ctx.beginPath();
      for (const ring of rings) { ring.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
      ctx.clip('evenodd');
      if (defaultKind === 'land' && kind === 'land') { ctx.fillStyle = resolved.landBase; ctx.fillRect(left, top, right - left, bottom - top); }
      ctx.fillStyle = fill; ctx.globalAlpha = dark ? .16 : .45; ctx.fillRect(left, top, right - left, bottom - top);
      ctx.globalAlpha = dark ? .75 : .65;
      // Anchor the sampling lattice to geographic coordinates, never the viewport.
      const origin = project([0, 0]);
      const spacing = kind === 'forest' ? 9 : 13;
      const seed = 21000 + featureIndex * 43 + polygonIndex;
      for (let row = Math.floor((top - origin[1]) / spacing); row <= Math.ceil((bottom - origin[1]) / spacing); row++) {
        // Jitter, the 44px hatch, category glyphs and pencil bleed all fit this
        // envelope. Keep the original world-grid indices and per-cell seeds.
        const rowY = origin[1] + row * spacing;
        const band = terrainViewport ? terrainRowBounds(rings, rowY - 25, rowY + 20) : [left, right];
        if (!band) continue;
        const first = Math.max(Math.floor((left - origin[0]) / 36), terrainViewport ? Math.ceil((band[0] - origin[0] - 68) / 36) : -Infinity);
        const last = Math.min(Math.ceil((right - origin[0]) / 36), terrainViewport ? Math.floor((band[1] - origin[0] + 17) / 36) : Infinity);
        for (let col = first; col <= last; col++) {
          const cell = (seed ^ Math.imul(col, 73856093) ^ Math.imul(row, 19349663)) >>> 0;
          const rng = seededRandom(cell);
          if (rng() < .2) continue;
          const x = origin[0] + col * 36 + rng() * 12, y = origin[1] + row * spacing + rng() * 5;
          const length = 14 + rng() * 30;
          stroke(ctx, [[x, y], [x + length * .45, y - length * .14], [x + length, y - length * .28]], ink, cell, .65);
          if (kind === 'forest') stroke(ctx, [[x - 3, y], [x, y - 7], [x + 3, y], [x, y - 4], [x, y + 2]], ink, cell + 1);
          else if (kind === 'bare') stroke(ctx, [[x - 5, y + 3], [x, y - 5], [x + 5, y + 3]], ink, cell + 1);
          else if (kind === 'crop') stroke(ctx, [[x - 3, y - 3], [x + 5, y - 1], [x + 4, y + 3]], ink, cell + 1);
        }
      }
      ctx.restore();
    }
  }
}

// The original stopMarker.js uses an irregular ring and separate pencil fill passes.
export function paintStop(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number, color: string, paper: string, selected: boolean) {
  const ring = (radius: number): PencilPoint[] => Array.from({ length: 73 }, (_, i) => {
    const angle = i / 72 * Math.PI * 2;
    const r = radius + Math.sin(angle * 3 + seed * .71) * .48 + Math.sin(angle * 5 - seed * .71) * .24;
    return [x + Math.cos(angle) * r, y + Math.sin(angle) * r * .95];
  });
  const outline = ring(11);
  ctx.save(); ctx.beginPath(); outline.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = paper; ctx.fill();
  for (let row = -9; row <= 9; row += 1.6) {
    const half = Math.sqrt(Math.max(0, 81 - row * row));
    stroke(ctx, [[x - half, y + row + .7], [x + half, y + row - .7]], color, seed + row * 13, 1.4);
  }
  pencilStroke(ctx, outline, color, 1.4, seed, .3, 3, true, { variation: .8, breaks: .18, grain: .66, gain: 2.7, step: .5 });
  if (selected) pencilStroke(ctx, ring(16), color, 1.4, seed + 29, .3, 3, true, { variation: .8, breaks: .3, grain: .66, gain: 2.7, step: .5 });
  ctx.restore();
}
