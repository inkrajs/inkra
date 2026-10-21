import type { PencilPoint } from './stroke.js';

export type PencilLineOrientation = 'horizontal' | 'vertical';

export function createPencilLinePoints(
  width: number,
  height: number,
  orientation: PencilLineOrientation,
  roughness: number,
): readonly PencilPoint[] {
  if (orientation === 'vertical') {
    const middle = width / 2;
    return [
      [middle, 2],
      [middle - roughness * 0.45, height * 0.34],
      [middle + roughness * 0.3, height * 0.68],
      [middle, height - 2],
    ];
  }

  const middle = height / 2;
  return [
    [2, middle],
    [width * 0.34, middle - roughness * 0.45],
    [width * 0.68, middle + roughness * 0.3],
    [width - 2, middle],
  ];
}

export function pencilLineHasDrawableSize(
  width: number,
  height: number,
  orientation: PencilLineOrientation,
): boolean {
  return orientation === 'vertical' ? height >= 4 && width >= 2 : width >= 4 && height >= 2;
}
