/** Pigment colors retain the map's existing pencil texture and wash opacity. */
export interface JourneyMapPigment { fill?: string; stroke?: string }
export interface JourneyMapPaletteColors {
  /** Canvas background, behind sea and land; omitted keeps the theme paper. */
  background?: string;
  /** Opaque underpainting for the base land polygon. */
  landBase?: string;
  boundary?: string;
  road?: string;
  sea?: JourneyMapPigment;
  /** Built-ins or custom feature.properties.mapRole/id categories. */
  terrain?: Readonly<Record<string, JourneyMapPigment>>;
}
export interface JourneyMapPalette extends JourneyMapPaletteColors {
  /** Partial overrides merged only in a dark theme. */
  dark?: JourneyMapPaletteColors;
}
export const defaultJourneyMapPalette = Object.freeze({
  sea: Object.freeze({ fill: 'transparent', stroke: '#4d91a0' }),
  terrain: Object.freeze(Object.fromEntries(Object.entries({
    land: ['#e6e2af', '#83924a'], forest: ['#a7c7ad', '#3c7356'], crop: ['#e6c17b', '#9c7536'],
    shrub: ['#c8c38f', '#797742'], bare: ['#cec4d9', '#83708e'], snow: ['#f4f5f1', '#94afb7'],
    wetland: ['#a6c7c6', '#437e82'], urban: ['#d49b8b', '#975b4f'], water: ['#87bbc0', '#4d91a0'],
  }).map(([kind, [fill, stroke]]) => [kind, Object.freeze({ fill, stroke })]))),
});
export interface ResolvedJourneyMapPalette {
  background: string; landBase: string; boundary: string; road: string;
  sea: Required<JourneyMapPigment>; terrain: Record<string, Required<JourneyMapPigment>>;
}
/** Pure merge; browser CSS resolution is injected so server imports remain safe. */
export function resolveJourneyMapPalette(palette: JourneyMapPalette | undefined, dark: boolean, border = '#64766b',
  color: (value: string | undefined, fallback: string) => string = (value, fallback) => typeof value === 'string' && value.trim() ? value : fallback): ResolvedJourneyMapPalette {
  const base = palette ?? {}, override = dark ? base.dark ?? {} : {};
  const terrain: ResolvedJourneyMapPalette['terrain'] = Object.create(null);
  const keys = new Set([...Object.keys(defaultJourneyMapPalette.terrain), ...Object.keys(base.terrain ?? {}), ...Object.keys(override.terrain ?? {})]);
  for (const key of [...keys].sort()) {
    const defaults = Object.prototype.hasOwnProperty.call(defaultJourneyMapPalette.terrain, key) ? defaultJourneyMapPalette.terrain[key] : defaultJourneyMapPalette.terrain.land;
    const entry = { ...base.terrain?.[key], ...override.terrain?.[key] };
    const fill = color(entry.fill, defaults.fill);
    terrain[key] = { fill, stroke: color(entry.stroke, dark ? fill : defaults.stroke) };
  }
  const sea = { ...base.sea, ...override.sea };
  return {
    background: color(override.background ?? base.background, 'transparent'),
    landBase: color(override.landBase ?? base.landBase, dark ? '#191d1e' : '#fdfcf8'),
    boundary: color(override.boundary ?? base.boundary, border), road: color(override.road ?? base.road, border),
    sea: { fill: color(sea.fill, defaultJourneyMapPalette.sea.fill), stroke: color(sea.stroke, defaultJourneyMapPalette.sea.stroke) }, terrain,
  };
}
