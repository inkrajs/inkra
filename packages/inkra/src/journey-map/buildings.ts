import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import { seedToNumber, seededRandom } from '../internal/random.js';
import { pencilStroke, type PencilPoint } from '../internal/stroke.js';

/** Application-supplied classification. JourneyMap never infers a building's use. */
export interface JourneyBuildingProperties {
  purpose?: string;
  [key: string]: unknown;
}

/** GeoJSON coordinates retain their standard [longitude, latitude] order. */
export type JourneyBuildingData = FeatureCollection<Polygon | MultiPolygon, JourneyBuildingProperties>;
export interface JourneyBuildingStyle {
  /** CSS color or var(--custom-property), resolved in the map's theme scope. */
  fill?: string;
  /** CSS color or var(--custom-property). Omitted outlines use the map's ink. */
  stroke?: string;
  /** Paint the dense pencil hatch over the fill wash. Defaults to true. */
  hatch?: boolean;
}
/** Exact purpose keys; omitted and unknown purposes keep the neutral style. */
export type JourneyBuildingStyles = Readonly<Record<string, JourneyBuildingStyle>>;

type BuildingFeature = Feature<Polygon | MultiPolygon, JourneyBuildingProperties>;
type ComputedStyle = Pick<CSSStyleDeclaration, 'getPropertyValue'>;
type Project = (position: Position) => PencilPoint;

const validPosition = (position: Position) => Array.isArray(position) && position.length >= 2 &&
  Number.isFinite(position[0]) && Number.isFinite(position[1]) &&
  Math.abs(position[0]) <= 180 && Math.abs(position[1]) <= 85;

function validPolygon(polygon: Position[][]) {
  return Array.isArray(polygon) && polygon.length > 0 && polygon.every(ring => Array.isArray(ring) && ring.length >= 4 && ring.every(validPosition) &&
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]);
}

function polygons(feature: BuildingFeature) {
  const geometry = feature?.geometry;
  const values = geometry?.type === 'Polygon' ? [geometry.coordinates] :
    geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  // An invalid hole invalidates its polygon rather than silently filling the hole.
  return Array.isArray(values) ? values.filter(validPolygon) : [];
}

/** Internal fitting helper; invalid polygons contribute neither paint nor bounds. */
export function buildingPositions(data: JourneyBuildingData | undefined): [number, number][] {
  const result: [number, number][] = [];
  for (const feature of data?.features ?? []) for (const polygon of polygons(feature)) {
    for (const ring of polygon) for (const position of ring) result.push([position[0], position[1]]);
  }
  return result;
}

function substituteVariables(value: string, style: ComputedStyle, depth = 0): string | undefined {
  const start = value.indexOf('var(');
  if (start < 0) return value;
  if (depth >= 16) return undefined;
  let nesting = 1, comma = -1, end = start + 4;
  for (; end < value.length; end++) {
    if (value[end] === '(') nesting++;
    else if (value[end] === ')' && --nesting === 0) break;
    else if (value[end] === ',' && nesting === 1 && comma < 0) comma = end;
  }
  if (nesting !== 0) return undefined;
  const name = value.slice(start + 4, comma < 0 ? end : comma).trim();
  if (!/^--[\w-]+$/.test(name)) return undefined;
  const replacement = style.getPropertyValue(name).trim() || (comma < 0 ? '' : value.slice(comma + 1, end).trim());
  if (!replacement) return undefined;
  return substituteVariables(value.slice(0, start) + replacement + value.slice(end + 1), style, depth + 1);
}

/** Resolve inherited custom properties without leaking styles to the document root. */
export function resolveMapColor(value: string | undefined, style: ComputedStyle, fallback: string): string {
  if (!value?.trim()) return fallback;
  let color = substituteVariables(value.trim(), style);
  if (!color) return fallback;
  if (color === 'currentColor') color = style.getPropertyValue('color').trim() || fallback;
  // In browsers reject invalid colors before they can inherit the previous canvas color.
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && !CSS.supports('color', color)) return fallback;
  return color;
}

export function resolveBuildingStyle(feature: BuildingFeature, styles: JourneyBuildingStyles | undefined, computed: ComputedStyle): Required<JourneyBuildingStyle> {
  const neutral = computed.getPropertyValue('--inkra-ink-muted').trim() || '#777777';
  const outline = computed.getPropertyValue('--inkra-ink').trim() || '#333333';
  const purpose = feature.properties?.purpose;
  const custom = typeof purpose === 'string' && styles && Object.prototype.hasOwnProperty.call(styles, purpose) ? styles[purpose] : undefined;
  return { fill: resolveMapColor(custom?.fill, computed, neutral), stroke: resolveMapColor(custom?.stroke, computed, outline), hatch: custom?.hatch !== false };
}

/** Decorative geometry only: no fetching, classification, selection or private map access. */
export function paintBuildings(ctx: CanvasRenderingContext2D, data: JourneyBuildingData, project: Project, width: number, height: number, dark: boolean, computed: ComputedStyle, styles?: JourneyBuildingStyles) {
  if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) return;
  const origin = project([0, 0]);
  if (!origin.every(Number.isFinite)) return;
  for (const feature of data.features) {
    if (!feature) continue;
    const { fill, stroke, hatch } = resolveBuildingStyle(feature, styles, computed);
    for (const polygon of polygons(feature)) {
      const rings = polygon.map(ring => ring.map(project));
      if (rings.some(ring => ring.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y)))) continue;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const ring of rings) for (const [x, y] of ring) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      const left = Math.max(0, minX), right = Math.min(width, maxX);
      const top = Math.max(0, minY), bottom = Math.min(height, maxY);
      if (left >= right || top >= bottom) continue;
      // Geometry gives anonymous buildings a deterministic seed even when features reorder.
      const seed = seedToNumber(String(feature.id ?? JSON.stringify(polygon)));
      ctx.save(); ctx.beginPath();
      for (const ring of rings) {
        ring.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
      }
      ctx.clip('evenodd');
      ctx.globalAlpha = dark ? .12 : .1;
      ctx.fillStyle = fill; ctx.fillRect(left, top, right - left, bottom - top);
      ctx.globalAlpha = dark ? .72 : .62;
      if (hatch) {
        // The same anchored pencil material as terrain, with a denser building wash.
        // Include the full hatch envelope on every paint, including replenished pan strips.
        // A cell left/below the clipped region can still deposit ink inside it.
        const firstRow = Math.floor((top - origin[1] - 16) / 3), firstCol = Math.floor((left - origin[0] - 56) / 36);
        const rowCount = Math.ceil((bottom - origin[1] + 16) / 3) - firstRow + 1;
        const colCount = Math.ceil((right - origin[0] + 16) / 36) - firstCol + 1;
        // Bound work for unusually large map hosts; paper and outlines remain visible.
        for (let rowIndex = 0; rowIndex < rowCount && rowCount * colCount <= 65536; rowIndex++) {
          const row = firstRow + rowIndex;
          for (let colIndex = 0; colIndex < colCount; colIndex++) {
            const col = firstCol + colIndex;
            const cell = (seed ^ Math.imul(col, 73856093) ^ Math.imul(row, 19349663)) >>> 0;
            const rng = seededRandom(cell);
            const x = origin[0] + col * 36 + rng() * 8, y = origin[1] + row * 3 + rng();
            const length = 24 + rng() * 20;
            pencilStroke(ctx, [[x, y], [x + length * .45, y - length * .14], [x + length, y - length * .28]], fill, .8, cell, .3, 1, false,
              { variation: 1, breaks: .45, grain: .78, gain: 1.7, step: 1 });
          }
        }
      }
      ctx.restore();
      // Only the resolved CSS keyword is known to contribute no outline pixels.
      if (stroke.trim().toLowerCase() !== 'transparent') {
        ctx.save();
        for (const [ringIndex, ring] of rings.entries()) pencilStroke(ctx, ring, stroke, 1.2, seed + ringIndex, .3, 3, true,
          { variation: .8, breaks: .18, grain: .66, gain: 2.7, step: .5 });
        ctx.restore();
      }
    }
  }
}
