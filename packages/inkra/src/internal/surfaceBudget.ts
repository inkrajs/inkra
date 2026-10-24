// 1024x640 at DPR 2 is 2.62M pixels per layer and 5.24M with a clipped border layer.
export const MAX_SURFACE_PHYSICAL_EDGE = 8192;
export const MAX_SURFACE_LAYER_PIXELS = 4 * 1024 * 1024;
export const MAX_SURFACE_TOTAL_PIXELS = 6 * 1024 * 1024;

export type SurfaceAllocationFailure =
  | 'invalid-size'
  | 'edge-limit'
  | 'layer-budget'
  | 'surface-budget';

export type SurfaceAllocation = {
  ok: true;
  dpr: number;
  width: number;
  height: number;
  layerPixels: number;
  totalPixels: number;
} | {
  ok: false;
  reason: SurfaceAllocationFailure;
};

const DPR_PRECISION = 1024;

function allocationAtDpr(
  logicalWidth: number,
  logicalHeight: number,
  dpr: number,
  layers: 1 | 2,
): SurfaceAllocation {
  const physicalWidth = Math.ceil(logicalWidth * dpr);
  const physicalHeight = Math.ceil(logicalHeight * dpr);
  if (!Number.isSafeInteger(physicalWidth) || !Number.isSafeInteger(physicalHeight)
    || physicalWidth < 1 || physicalHeight < 1) {
    return { ok: false, reason: 'invalid-size' };
  }
  if (physicalWidth > MAX_SURFACE_PHYSICAL_EDGE || physicalHeight > MAX_SURFACE_PHYSICAL_EDGE) {
    return { ok: false, reason: 'edge-limit' };
  }

  const layerPixels = physicalWidth * physicalHeight;
  if (!Number.isSafeInteger(layerPixels) || layerPixels > MAX_SURFACE_LAYER_PIXELS) {
    return { ok: false, reason: 'layer-budget' };
  }
  const totalPixels = layerPixels * layers;
  if (!Number.isSafeInteger(totalPixels) || totalPixels > MAX_SURFACE_TOTAL_PIXELS) {
    return { ok: false, reason: 'surface-budget' };
  }
  return { ok: true, dpr, width: physicalWidth, height: physicalHeight, layerPixels, totalPixels };
}

export function resolveSurfaceAllocation(
  width: number,
  height: number,
  dpr: number,
  bleed: number,
  layers: 1 | 2,
): SurfaceAllocation {
  if (![width, height, dpr, bleed].every(Number.isFinite)
    || width <= 0 || height <= 0 || dpr < 1 || bleed < 0) {
    return { ok: false, reason: 'invalid-size' };
  }

  const logicalWidth = width + bleed * 2;
  const logicalHeight = height + bleed * 2;
  const requested = allocationAtDpr(logicalWidth, logicalHeight, dpr, layers);
  if (requested.ok) return requested;

  const minimum = allocationAtDpr(logicalWidth, logicalHeight, 1, layers);
  if (!minimum.ok) return minimum;

  let lower = 1;
  let upper = dpr;
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const candidate = (lower + upper) / 2;
    if (allocationAtDpr(logicalWidth, logicalHeight, candidate, layers).ok) lower = candidate;
    else upper = candidate;
  }
  const resolvedDpr = Math.max(1, Math.floor(lower * DPR_PRECISION) / DPR_PRECISION);
  const resolved = allocationAtDpr(logicalWidth, logicalHeight, resolvedDpr, layers);
  return resolved.ok ? resolved : minimum;
}

type CanvasBitmap = Pick<HTMLCanvasElement, 'width' | 'height'>;

export function resizeSurfaceBitmap(canvas: CanvasBitmap, width: number, height: number): void {
  if (canvas.width === width && canvas.height === height) {
    canvas.width = width;
    return;
  }
  canvas.width = 0;
  canvas.height = 0;
  canvas.width = width;
  canvas.height = height;
}

export function releaseSurfaceBitmaps(...canvases: Array<CanvasBitmap | null | undefined>): void {
  for (const canvas of canvases) {
    if (!canvas) continue;
    canvas.width = 0;
    canvas.height = 0;
  }
}
