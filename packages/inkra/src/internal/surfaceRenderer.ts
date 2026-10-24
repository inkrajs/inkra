import { pencilPaper } from './paper.js';
import { pencilStroke } from './stroke.js';
import { drawPencilWash } from './wash.js';
import { pencilRenderDefaults } from './renderTokens.js';
import { BoundedCache, PENCIL_RENDERER_VERSION, canvasByteCost, canvasIsUsable } from './cache.js';
import { releaseSurfaceBitmaps, resizeSurfaceBitmap, resolveSurfaceAllocation } from './surfaceBudget.js';
import type { SurfaceAllocation } from './surfaceBudget.js';

export type PencilSurfaceVariant =
  | 'paper'
  | 'action'
  | 'quiet'
  | 'badge'
  | 'outline'
  | 'danger'
  | 'ghost'
  | 'selection'
  | 'wash'
  | 'full';

export interface PencilSurfaceTheme {
  paper: string;
  dark: boolean;
  ink: string;
  wash: string;
  strokeWidth?: number;
  strokeRoughness?: number;
  washSettings?: { strength: number; spacing: number; roughness: number; angle: number };
}

interface SurfaceStyle {
  radius: number;
  width: number;
  passes: number;
  strength?: number;
  themeStrength?: {
    light: number;
    dark: number;
  };
}

export const PENCIL_ACTION_WASH = Object.freeze({
  lightStrength: 0.2,
  darkStrength: 0.12,
});

export const PENCIL_QUIET_WASH = Object.freeze({
  lightStrength: 0.12,
  darkStrength: 0.08,
});

const surfaceStyles: Record<'paper' | 'action' | 'quiet' | 'badge' | 'outline' | 'danger', SurfaceStyle> = {
  paper: { radius: 8, width: 1.2, passes: 3 },
  action: {
    radius: 7,
    width: 1.35,
    passes: 3,
    themeStrength: { light: PENCIL_ACTION_WASH.lightStrength, dark: PENCIL_ACTION_WASH.darkStrength },
  },
  quiet: {
    radius: 7,
    width: 0.75,
    passes: 2,
    themeStrength: { light: PENCIL_QUIET_WASH.lightStrength, dark: PENCIL_QUIET_WASH.darkStrength },
  },
  badge: { radius: 6, width: 0.9, passes: 2, strength: 0.25 },
  outline: { radius: 7, width: 1.2, passes: 3 },
  danger: { radius: 7, width: 0.75, passes: 2, strength: 0.18 },
};

export const PENCIL_FILL_WASH = Object.freeze({
  angle: pencilRenderDefaults.washAngle,
  spacing: pencilRenderDefaults.washSpacing,
  roughness: pencilRenderDefaults.washRoughness,
  inset: 2,
  edgeReach: 0,
});

export const PENCIL_SELECTION_WASH = Object.freeze({
  ...PENCIL_FILL_WASH,
  lightStrength: PENCIL_ACTION_WASH.lightStrength,
  darkStrength: PENCIL_ACTION_WASH.darkStrength,
  radius: 8,
});

function outline(width: number, height: number, radius: number, seed: number) {
  const left = 2.5;
  const top = 2.5;
  const right = width - 2.5;
  const bottom = height - 2.5;
  const points: Array<readonly [number, number]> = [];

  for (let corner = 0; corner < 4; corner += 1) {
    const variation = radius === 0 ? 0 : ((seed >>> (corner * 4)) & 7) * 0.12;
    const resolvedRadius = Math.min(radius + variation, (right - left) / 2, (bottom - top) / 2);
    const centerX = corner < 2 ? right - resolvedRadius : left + resolvedRadius;
    const centerY = corner === 0 || corner === 3 ? top + resolvedRadius : bottom - resolvedRadius;
    for (let step = 0; step <= 6; step += 1) {
      const angle = (corner - 1 + step / 6) * Math.PI / 2;
      points.push([
        centerX + Math.cos(angle) * resolvedRadius,
        centerY + Math.sin(angle) * resolvedRadius,
      ]);
    }
  }

  return points;
}

function paperPattern(
  context: CanvasRenderingContext2D,
  color: string,
  dark: boolean,
  dpr: number,
): CanvasPattern | string {
  const pattern = context.createPattern(pencilPaper(color, dark, dpr), 'repeat');
  if (!pattern) return color;
  if (typeof pattern.setTransform === 'function' && typeof DOMMatrix !== 'undefined') {
    pattern.setTransform(new DOMMatrix().scale(1 / dpr));
  }
  return pattern;
}

function allocateSurface(
  canvas: HTMLCanvasElement,
  borderCanvas: HTMLCanvasElement | null,
  width: number,
  height: number,
  dpr: number,
  bleed: number,
): Extract<SurfaceAllocation, { ok: true }> {
  const allocation = resolveSurfaceAllocation(width, height, dpr, bleed, borderCanvas ? 2 : 1);
  if (!allocation.ok) {
    releaseSurfaceBitmaps(canvas, borderCanvas);
    throw new RangeError(`PencilSurface allocation rejected: ${allocation.reason}`);
  }
  return allocation;
}

function paintPencilSurface(
  canvas: HTMLCanvasElement,
  borderCanvas: HTMLCanvasElement | null,
  width: number,
  height: number,
  variant: PencilSurfaceVariant,
  seed: number,
  allocation: Extract<SurfaceAllocation, { ok: true }>,
  theme: PencilSurfaceTheme,
  radius?: number,
): Array<readonly [number, number]> | undefined {
  const bleed = variant === 'wash' ? 12 : 0;
  const renderDpr = allocation.dpr;
  resizeSurfaceBitmap(canvas, allocation.width, allocation.height);
  const context = canvas.getContext('2d');
  if (!context) {
    releaseSurfaceBitmaps(canvas, borderCanvas);
    throw new Error('Canvas 2D is unavailable');
  }
  if (borderCanvas) resizeSurfaceBitmap(borderCanvas, allocation.width, allocation.height);
  context.setTransform(
    canvas.width / (width + bleed * 2),
    0,
    0,
    canvas.height / (height + bleed * 2),
    0,
    0,
  );

  if (variant === 'wash') {
    context.translate(bleed, bleed);
    drawPencilWash(context, { x: 0, y: 0, width, height }, theme.wash, seed, {
      strength: theme.washSettings?.strength ?? pencilRenderDefaults.washStrength / 0.48,
      spacing: theme.washSettings?.spacing ?? pencilRenderDefaults.washSpacing,
      roughness: theme.washSettings?.roughness ?? pencilRenderDefaults.washRoughness,
      angle: (theme.washSettings?.angle ?? pencilRenderDefaults.washAngle) + 35,
      inset: 2,
      radius: 8,
      edgeReach: 8,
      dpr: renderDpr,
    });
    return undefined;
  }

  if (variant === 'selection') {
    drawPencilWash(context, { x: 0, y: 0, width, height }, theme.wash, seed, {
      strength: (theme.dark ? PENCIL_SELECTION_WASH.darkStrength : PENCIL_SELECTION_WASH.lightStrength) * (theme.washSettings?.strength ?? pencilRenderDefaults.washStrength / 0.48),
      spacing: theme.washSettings?.spacing ?? PENCIL_SELECTION_WASH.spacing,
      roughness: theme.washSettings?.roughness ?? PENCIL_SELECTION_WASH.roughness,
      inset: PENCIL_SELECTION_WASH.inset,
      radius: radius !== undefined && Number.isFinite(radius) ? Math.max(0, Math.min(radius, 8)) : PENCIL_SELECTION_WASH.radius,
      edgeReach: PENCIL_SELECTION_WASH.edgeReach,
      angle: theme.washSettings?.angle ?? PENCIL_SELECTION_WASH.angle,
      dpr: renderDpr,
    });
    return undefined;
  }

  if (variant === 'ghost') {
    return undefined;
  }

  if (variant === 'full') {
    context.fillStyle = paperPattern(context, theme.paper, theme.dark, renderDpr);
    context.fillRect(0, 0, width, height);
    return undefined;
  }

  const style = surfaceStyles[variant];
  const strength = style.themeStrength
    ? (theme.dark ? style.themeStrength.dark : style.themeStrength.light)
    : style.strength;
  const resolvedRadius = radius !== undefined && Number.isFinite(radius) ? Math.max(0, Math.min(radius, 8)) : style.radius;
  const points = outline(width, height, resolvedRadius, seed);
  if (variant !== 'outline') {
    context.save();
    context.beginPath();
    context.moveTo(...points[0]);
    for (const point of points.slice(1)) context.lineTo(...point);
    context.closePath();
    context.clip();
    context.fillStyle = paperPattern(context, theme.paper, theme.dark, renderDpr);
    context.fillRect(0, 0, width, height);

    if (strength) {
      drawPencilWash(context, { x: 0, y: 0, width, height }, theme.wash, seed, {
        ...PENCIL_FILL_WASH,
        ...theme.washSettings,
        strength: strength * (theme.washSettings?.strength ?? pencilRenderDefaults.washStrength / 0.48),
        radius: resolvedRadius,
        dpr: renderDpr,
      });
    }
    context.restore();
  }

  let borderContext = context;
  if (borderCanvas) {
    const separateContext = borderCanvas.getContext('2d');
    if (separateContext) {
      separateContext.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      borderContext = separateContext;
    }
  }
  pencilStroke(borderContext, points, theme.ink, style.width * ((theme.strokeWidth ?? pencilRenderDefaults.strokeWidth) / 1.2), seed, theme.strokeRoughness ?? pencilRenderDefaults.strokeRoughness, style.passes, true, {
    variation: 0.82,
    breaks: variant === 'paper' ? 0.2 : 0.25,
    grain: 0.7,
    gain: variant === 'action' ? 2.5 : 2.1,
    step: 0.8,
  });
  return points;
}

interface SurfaceImage {
  ink: HTMLCanvasElement;
  border: HTMLCanvasElement | null;
  points: Array<readonly [number, number]> | undefined;
  valid: boolean;
}

const surfaceCache = new BoundedCache<SurfaceImage>(64, 16 * 1024 * 1024);
// Admit only a repeat within the recent working set. Cold mounts and long scans
// must not pay for snapshots that will be evicted before they are ever reused.
const surfaceRequests = new BoundedCache<true>(64, 64);

function copyCanvas(source: HTMLCanvasElement, target: HTMLCanvasElement): void {
  resizeSurfaceBitmap(target, source.width, source.height);
  const context = target.getContext('2d');
  if (!context || context.isContextLost?.()) throw new Error('Canvas 2D is unavailable');
  context.drawImage(source, 0, 0);
}

export function drawPencilSurface(
  canvas: HTMLCanvasElement,
  borderCanvas: HTMLCanvasElement | null,
  width: number,
  height: number,
  variant: PencilSurfaceVariant,
  seed: number,
  dpr: number,
  theme: PencilSurfaceTheme,
  radius?: number,
): Array<readonly [number, number]> | undefined {
  // Transparent surfaces have no pixels to allocate or cache.
  if (variant === 'ghost') {
    canvas.width = canvas.height = 0;
    if (borderCanvas) borderCanvas.width = borderCanvas.height = 0;
    return undefined;
  }
  const bleed = variant === 'wash' ? 12 : 0;
  const allocation = allocateSurface(canvas, borderCanvas, width, height, dpr, bleed);
  const key = JSON.stringify([
    PENCIL_RENDERER_VERSION, variant, width, height, seed, allocation.dpr, Boolean(borderCanvas), radius,
    theme.paper, theme.dark, theme.ink, theme.wash, theme.strokeWidth, theme.strokeRoughness,
    theme.washSettings?.strength, theme.washSettings?.spacing,
    theme.washSettings?.roughness, theme.washSettings?.angle,
  ]);
  const cached = surfaceCache.get(key);
  if (cached?.valid && canvasIsUsable(cached.ink) && (!cached.border || canvasIsUsable(cached.border))) {
    copyCanvas(cached.ink, canvas);
    if (cached.border && borderCanvas) copyCanvas(cached.border, borderCanvas);
    return cached.points?.map(([x, y]) => [x, y] as const);
  }
  if (cached) surfaceCache.delete(key);
  const points = paintPencilSurface(canvas, borderCanvas, width, height, variant, seed, allocation, theme, radius);
  const cost = canvasByteCost(canvas) + (borderCanvas ? canvasByteCost(borderCanvas) : 0);
  const repeated = surfaceRequests.get(key) === true;
  surfaceRequests.set(key, true, 1);
  // Keep the cache useful for repeated controls, not a single large panel.
  if (repeated && cost <= 2 * 1024 * 1024) {
    try {
      const ink = document.createElement('canvas');
      const border = borderCanvas ? document.createElement('canvas') : null;
      copyCanvas(canvas, ink);
      if (border && borderCanvas) copyCanvas(borderCanvas, border);
      const image: SurfaceImage = { ink, border, points: points?.map(([x, y]) => [x, y] as const), valid: true };
      // A restored context can report healthy after losing all of its pixels.
      // Keep that entry invalid even if loss and restoration precede the next hit.
      const invalidate = () => { image.valid = false; };
      ink.addEventListener?.('contextlost', invalidate, { once: true });
      border?.addEventListener?.('contextlost', invalidate, { once: true });
      surfaceCache.set(key, image, cost);
    } catch {
      // Caching is optional: a snapshot allocation failure must not discard a
      // successfully painted live surface.
    }
  }
  return points;
}
