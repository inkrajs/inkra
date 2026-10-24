export const pencilRenderDefaults = Object.freeze({
  strokeWidth: 2,
  iconStrokeWidth: 1.5,
  iconBreaks: 0.18,
  iconBreakCount: 1,
  iconPressureVariation: 0.82,
  strokeRoughness: 1.5,
  washStrength: 0.8,
  washSpacing: 2,
  washRoughness: 3,
  washAngle: -45,
});

export const maxStrokeRoughness = 4;

export function readRenderToken(style: Pick<CSSStyleDeclaration, 'getPropertyValue'>, name: string, fallback: number, min: number, max: number): number {
  const value = Number.parseFloat(style.getPropertyValue(name));
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
