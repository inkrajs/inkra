import { DEFAULT_COLOR_VALUE, normalizeColorValue } from './color.js';
import type { ColorValue } from './color.js';

export type ColorPaintType = 'solid' | 'linear' | 'radial' | 'conic';
export interface ColorGradientStop {
  id?: string;
  color: string;
  position: number;
}
export interface ColorGradient {
  type: Exclude<ColorPaintType, 'solid'>;
  stops: readonly ColorGradientStop[];
  angle?: number;
  center?: { x: number; y: number };
  shape?: 'circle' | 'ellipse';
  extent?: 'closest-side' | 'closest-corner' | 'farthest-side' | 'farthest-corner';
  repeating?: boolean;
}
export type ColorPaint = ColorValue | ColorGradient;
export const colorPaintTypes: readonly ColorPaintType[] = ['solid', 'linear', 'radial', 'conic'];
const extents = ['closest-side', 'closest-corner', 'farthest-side', 'farthest-corner'];
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const percent = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;

export function normalizeColorPaint(input: string | ColorGradient): ColorPaint | null {
  if (typeof input === 'string') return normalizeColorValue(input);
  if (!input || !['linear', 'radial', 'conic'].includes(input.type)
    || !Array.isArray(input.stops) || input.stops.length < 2 || input.stops.length > 64
    || (input.angle !== undefined && !finite(input.angle))
    || (input.center !== undefined && (!input.center || !finite(input.center.x) || !finite(input.center.y)))
    || (input.shape !== undefined && !['circle', 'ellipse'].includes(input.shape))
    || (input.extent !== undefined && !extents.includes(input.extent))) return null;
  const ids = new Set<string>();
  const stops: ColorGradientStop[] = [];
  for (const [index, stop] of input.stops.entries()) {
    if (!stop || typeof stop.color !== 'string' || !finite(stop.position)) return null;
    const color = normalizeColorValue(stop.color);
    if (!color) return null;
    let id = typeof stop.id === 'string' && stop.id ? stop.id : `stop-${index}`;
    while (ids.has(id)) id += '-duplicate';
    ids.add(id);
    stops.push({ id, color, position: percent(stop.position) });
  }
  stops.sort((a, b) => a.position - b.position);
  const angle = input.angle ?? (input.type === 'linear' ? 90 : 0);
  return {
    type: input.type, stops,
    angle: (Math.round(((angle % 360 + 360) % 360) * 100) / 100) % 360,
    center: { x: percent(input.center?.x ?? 50), y: percent(input.center?.y ?? 50) },
    shape: input.shape ?? 'ellipse', extent: input.extent ?? 'farthest-corner',
    repeating: input.repeating === true,
  };
}

/** Serialize structured paint only; arbitrary CSS expressions are not parsed. */
export function formatColorPaint(input: string | ColorGradient): string {
  const value = normalizeColorPaint(input);
  if (!value) return DEFAULT_COLOR_VALUE;
  if (typeof value === 'string') return value;
  const stops = value.stops.map(stop => `${stop.color} ${stop.position}%`).join(', ');
  const at = `at ${value.center!.x}% ${value.center!.y}%`;
  const geometry = value.type === 'linear' ? `${value.angle}deg`
    : value.type === 'radial' ? `${value.shape} ${value.extent} ${at}`
      : `from ${value.angle}deg ${at}`;
  return `${value.repeating ? 'repeating-' : ''}${value.type}-gradient(${geometry}, ${stops})`;
}

export function createColorGradient(type: ColorGradient['type'], color = DEFAULT_COLOR_VALUE): ColorGradient {
  const start = normalizeColorValue(color) ?? DEFAULT_COLOR_VALUE;
  return normalizeColorPaint({ type, stops: [
    { id: 'start', color: start, position: 0 },
    { id: 'end', color: start === '#e6c17bff' ? DEFAULT_COLOR_VALUE : '#e6c17bff', position: 100 },
  ] }) as ColorGradient;
}
