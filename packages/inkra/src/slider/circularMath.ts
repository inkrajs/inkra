/** Clock angles: 0 points up and positive angles turn clockwise. */
export const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360;
export const clampCircularValue = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

function cleanNumber(value: number): number {
  return Number(value.toPrecision(14));
}

/** Snap to the grid anchored at min, retaining max as an attainable final stop. */
export function snapCircularValue(value: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(value)) return min;
  const bounded = clampCircularValue(value, min, max);
  const snapped = clampCircularValue(cleanNumber(min + Math.round((bounded - min) / step) * step), min, max);
  return max - bounded < Math.abs(snapped - bounded) ? max : snapped;
}

export function stepCircularValue(value: number, steps: number, min: number, max: number, step: number): number {
  const position = (value - min) / step;
  const index = steps > 0 ? Math.floor(position + 1e-9) : Math.ceil(position - 1e-9);
  return clampCircularValue(cleanNumber(min + (index + steps) * step), min, max);
}

/** Map an initial track press to an arc, selecting the closest endpoint in its gap. */
export function initialArcPosition(angle: number, start: number, sweep: number, clockwise: boolean, current: number): number {
  const position = normalizeAngle((angle - start) * (clockwise ? 1 : -1));
  if (sweep < 360) return position <= sweep ? position : position - sweep < 360 - position ? sweep : 0;
  // Only the exact seam represents two values; other track presses are absolute.
  if (position < 1e-7 || 360 - position < 1e-7) return current > 180 ? 360 : 0;
  return position;
}

/** Unwrap small consecutive movements; crossing the seam never resets to zero. */
export function advanceArcPosition(position: number, previousAngle: number, angle: number, sweep: number, clockwise: boolean): number {
  const delta = normalizeAngle(angle - previousAngle + 180) - 180;
  return clampCircularValue(position + delta * (clockwise ? 1 : -1), 0, sweep);
}
