export function readRenderToken(style: Pick<CSSStyleDeclaration, 'getPropertyValue'>, name: string, fallback: number, min: number, max: number): number {
  const value = Number.parseFloat(style.getPropertyValue(name));
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
