import type { GeoJsonObject, Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { pencilStroke, type PencilPoint } from '../internal/stroke.js';
import { seededRandom } from '../internal/random.js';

type Project = (position: Position) => PencilPoint;
// Palette, anchored hatch and category glyphs adapted from adventure/pencil/brush.js.
const palette: Record<string, [string, string]> = {
  land: ['#e6e2af', '#83924a'], forest: ['#a7c7ad', '#3c7356'], crop: ['#e6c17b', '#9c7536'],
  shrub: ['#c8c38f', '#797742'], bare: ['#cec4d9', '#83708e'], snow: ['#f4f5f1', '#94afb7'],
  wetland: ['#a6c7c6', '#437e82'], urban: ['#d49b8b', '#975b4f'], water: ['#87bbc0', '#4d91a0'],
};
const stroke = (ctx: CanvasRenderingContext2D, points: PencilPoint[], color: string, seed: number, width = .6) =>
  pencilStroke(ctx, points, color, width, seed, .3, 1, false, { variation: 1, breaks: .45, grain: .78, gain: 1.7, step: 1 });

let seaTile: HTMLCanvasElement | undefined;
export function paintSea(ctx: CanvasRenderingContext2D, width: number, height: number, anchor: PencilPoint) {
  if (!seaTile) {
    seaTile = document.createElement('canvas'); seaTile.width = seaTile.height = 512;
    const ink = seaTile.getContext('2d');
    if (!ink) { seaTile = undefined; return; }
    const rng = seededRandom(4801);
    for (let i = 0; i < 320; i++) {
      const x = rng() * 512, y = rng() * 512, length = 9 + rng() * 49;
      ink.globalAlpha = .1 + rng() * .2;
      for (const [dx, dy] of [[0, 0], [-512, 0], [0, 512], [-512, 512]]) {
        ink.save(); ink.translate(dx, dy);
        stroke(ink, [[x, y], [x + length * .5, y - length * .09], [x + length, y - length * .18]], '#4d91a0', 8100 + i, .5 + i % 4 * .1);
        ink.restore();
      }
    }
  }
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

export function paintTerrain(ctx: CanvasRenderingContext2D, data: GeoJsonObject, project: Project, width: number, height: number, dark: boolean, defaultKind = 'land') {
  for (const [featureIndex, feature] of mapFeatures(data).entries()) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : geometry.type === 'Polygon' ? [geometry.coordinates] : [];
    const kind = String(feature.properties?.id ?? defaultKind);
    const [fill, ink] = palette[kind] ?? palette.land;
    for (const [polygonIndex, polygon] of polygons.entries()) {
      const rings = polygon.map(ring => ring.map(project));
      const points = rings.flat();
      if (!points.length) continue;
      const left = Math.max(0, Math.min(...points.map(p => p[0]))), right = Math.min(width, Math.max(...points.map(p => p[0])));
      const top = Math.max(0, Math.min(...points.map(p => p[1]))), bottom = Math.min(height, Math.max(...points.map(p => p[1])));
      if (left >= right || top >= bottom) continue;
      ctx.save(); ctx.beginPath();
      for (const ring of rings) { ring.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
      ctx.clip('evenodd');
      if (defaultKind === 'land' && kind === 'land') { ctx.fillStyle = dark ? '#191d1e' : '#fdfcf8'; ctx.fillRect(left, top, right - left, bottom - top); }
      ctx.fillStyle = fill; ctx.globalAlpha = dark ? .16 : .45; ctx.fillRect(left, top, right - left, bottom - top);
      ctx.globalAlpha = dark ? .75 : .65;
      // Anchor the sampling lattice to geographic coordinates, never the viewport.
      const origin = project([0, 0]);
      const spacing = kind === 'forest' ? 9 : 13;
      const seed = 21000 + featureIndex * 43 + polygonIndex;
      for (let row = Math.floor((top - origin[1]) / spacing); row <= Math.ceil((bottom - origin[1]) / spacing); row++) {
        for (let col = Math.floor((left - origin[0]) / 36); col <= Math.ceil((right - origin[0]) / 36); col++) {
          const cell = (seed ^ Math.imul(col, 73856093) ^ Math.imul(row, 19349663)) >>> 0;
          const rng = seededRandom(cell);
          if (rng() < .2) continue;
          const x = origin[0] + col * 36 + rng() * 12, y = origin[1] + row * spacing + rng() * 5;
          const length = 14 + rng() * 30;
          stroke(ctx, [[x, y], [x + length * .45, y - length * .14], [x + length, y - length * .28]], dark ? fill : ink, cell, .65);
          if (kind === 'forest') stroke(ctx, [[x - 3, y], [x, y - 7], [x + 3, y], [x, y - 4], [x, y + 2]], dark ? fill : ink, cell + 1);
          else if (kind === 'bare') stroke(ctx, [[x - 5, y + 3], [x, y - 5], [x + 5, y + 3]], dark ? fill : ink, cell + 1);
          else if (kind === 'crop') stroke(ctx, [[x - 3, y - 3], [x + 5, y - 1], [x + 4, y + 3]], dark ? fill : ink, cell + 1);
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
