/** Independent rendering strategies; omitted options inherit the auto defaults. */
export interface JourneyMapRenderingOptions {
  /** Reject offscreen boundary/route stroke segments without changing their samples. */
  boundaryViewport?: boolean;
  /** Skip terrain cells whose entire ink envelope misses the polygon row band. */
  terrainViewport?: boolean;
  /** Keep an unchanged backing size and explicitly clear/reset the drawing transform. */
  reuseCanvas?: boolean;
  /** Reuse one bounded base bitmap when only place selection changes. */
  cacheBase?: boolean;
}

export type JourneyMapRendering = 'auto' | 'legacy' | JourneyMapRenderingOptions;

export function journeyAnimationMs(animate: boolean, duration: number, reducedMotion: boolean): number {
  if (!animate || reducedMotion) return 0;
  return Number.isFinite(duration) ? Math.max(0, Math.min(duration, 5000)) : 420;
}

export function journeyFocusZoom(overviewZoom: number, scale: number): number {
  const ratio = Number.isFinite(scale) && scale >= 1 ? Math.min(scale, 64) : 2;
  return overviewZoom + Math.log2(ratio);
}

export function resolveJourneyMapRendering(rendering: JourneyMapRendering = 'auto'): Required<JourneyMapRenderingOptions> {
  if (rendering === 'legacy') return { boundaryViewport: false, terrainViewport: false, reuseCanvas: false, cacheBase: false };
  const options = typeof rendering === 'object' ? rendering : {};
  return {
    boundaryViewport: options.boundaryViewport ?? true,
    terrainViewport: options.terrainViewport ?? true,
    reuseCanvas: options.reuseCanvas ?? true,
    cacheBase: options.cacheBase ?? true,
  };
}

const MAX_SIDE = 8192;
const MAX_LAYER_PIXELS = 4 * 1024 * 1024;
// One base bitmap per map; together with the visible bitmap, at most 6 Mi pixels.
const MAX_BASE_PIXELS = 3 * 1024 * 1024;

export interface JourneyCanvasSize {
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
  dpr: number;
}

/** Non-overlapping newly exposed strips after moving an existing base bitmap. */
export function journeyPanRegions(width: number, height: number, dx: number, dy: number): readonly (readonly [number, number, number, number])[] {
  if (Math.abs(dx) >= width || Math.abs(dy) >= height) return [[0, 0, width, height]];
  const regions: [number, number, number, number][] = [];
  if (dx) regions.push([dx > 0 ? 0 : width + dx, 0, Math.abs(dx), height]);
  if (dy) regions.push([Math.max(0, dx), dy > 0 ? 0 : height + dy, width - Math.abs(dx), Math.abs(dy)]);
  return regions;
}

/** Pure and SSR safe: browser DPR is supplied by the caller. */
export function journeyCanvasSize(width: number, height: number, requestedDpr: number): JourneyCanvasSize | undefined {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) return;
  const requested = Number.isFinite(requestedDpr) ? Math.max(1, Math.min(requestedDpr, 2)) : 1;
  const dpr = Math.min(requested, MAX_SIDE / width, MAX_SIDE / height, Math.sqrt(MAX_LAYER_PIXELS / (width * height)));
  if (dpr < 1) return;
  const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
  // Round-down adjustment prevents rounding the two sides over the pixel budget.
  const boundedDpr = pixelWidth * pixelHeight > MAX_LAYER_PIXELS
    ? Math.min(dpr, Math.floor(width * dpr) / width, Math.floor(height * dpr) / height) : dpr;
  return { width, height, pixelWidth: Math.round(width * boundedDpr), pixelHeight: Math.round(height * boundedDpr), dpr: boundedDpr };
}

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

export function prepareJourneyCanvas(canvas: HTMLCanvasElement, size: JourneyCanvasSize, reuse: boolean): CanvasRenderingContext2D | null {
  const changed = canvas.width !== size.pixelWidth || canvas.height !== size.pixelHeight;
  if (changed) releaseCanvas(canvas); // Avoid an oversized intermediate width/height swap.
  if (changed || !reuse) {
    canvas.width = size.pixelWidth;
    canvas.height = size.pixelHeight;
  }
  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;
  const context = canvas.getContext('2d');
  if (!context || context.isContextLost?.()) return null;
  // Never accumulate DPR transforms when the backing store is reused.
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  context.clearRect(0, 0, size.pixelWidth, size.pixelHeight);
  context.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  return context;
}

/** Per-map, memory-only, single-entry cache. No DOM or allocation until capture. */
export class JourneyBaseBitmap {
  private canvas: HTMLCanvasElement | undefined;
  private key: string | undefined;
  private readonly invalidate = () => { this.key = undefined; };

  restore(context: CanvasRenderingContext2D, key: string, offset: readonly [number, number] = [0, 0]): boolean {
    if (key !== this.key || !this.canvas) return false;
    const cachedContext = this.canvas.getContext('2d');
    if (!cachedContext || cachedContext.isContextLost?.()) { this.clear(); return false; }
    try {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.drawImage(this.canvas, offset[0], offset[1]);
      return true;
    } catch {
      this.clear();
      return false;
    } finally {
      context.restore();
    }
  }

  capture(source: HTMLCanvasElement, size: JourneyCanvasSize, key: string): void {
    if (size.pixelWidth * size.pixelHeight > MAX_BASE_PIXELS) { this.clear(); return; }
    try {
      const canvas = this.canvas ?? document.createElement('canvas');
      if (!this.canvas) {
        canvas.addEventListener('contextlost', this.invalidate);
        canvas.addEventListener('contextrestored', this.invalidate);
        this.canvas = canvas;
      }
      this.key = undefined;
      if (canvas.width !== size.pixelWidth || canvas.height !== size.pixelHeight) {
        releaseCanvas(canvas);
        canvas.width = size.pixelWidth;
        canvas.height = size.pixelHeight;
      }
      const context = canvas.getContext('2d');
      if (!context || context.isContextLost?.()) { this.clear(); return; }
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, size.pixelWidth, size.pixelHeight);
      context.drawImage(source, 0, 0);
      this.key = key;
    } catch {
      // Allocation/copy failures affect optimization, never the already drawn map.
      this.clear();
    }
  }

  clear(): void {
    this.key = undefined;
    if (!this.canvas) return;
    this.canvas.removeEventListener('contextlost', this.invalidate);
    this.canvas.removeEventListener('contextrestored', this.invalidate);
    releaseCanvas(this.canvas);
    this.canvas = undefined;
  }
}
