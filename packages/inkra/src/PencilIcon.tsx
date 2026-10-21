import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { CanvasHTMLAttributes } from 'react';

import {
  BoundedCache,
  PENCIL_RENDERER_VERSION,
  canvasByteCost,
  canvasIsUsable,
  effectiveDpr,
} from './internal/cache.js';
import { observeCanvasRecovery } from './internal/recovery.js';
import { seedToNumber } from './internal/random.js';
import { pencilStroke } from './internal/stroke.js';
import type { PencilPoint } from './internal/stroke.js';

export interface PencilIconPath {
  d: string;
  mode?: 'stroke' | 'wash' | 'scuff';
}

export interface PencilIconBadge {
  paths: readonly PencilIconPath[];
  sourceSize?: number;
  position?: 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
  /** Relative canvas size, clamped to 0.35-0.65. Defaults to 0.55. */
  scale?: number;
}

export interface PencilIconProps extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, 'children' | 'height' | 'width'> {
  paths: readonly PencilIconPath[];
  badge?: PencilIconBadge;
  seed?: string | number;
  size?: number;
  sourceSize?: number;
  active?: boolean;
  decorative?: boolean;
}

const geometryCache = new BoundedCache<readonly PencilPoint[][]>(256, 180000);
const imageCache = new BoundedCache<HTMLCanvasElement>(128, 24 * 1024 * 1024);

function cachedPathParts(data: string): readonly PencilPoint[][] {
  const key = `${PENCIL_RENDERER_VERSION}:${data}`;
  const cached = geometryCache.get(key);
  if (cached) return cached;
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', data);
  const length = path.getTotalLength();
  const count = Math.max(1, Math.ceil(length / 0.25));
  const parts: PencilPoint[][] = [[]];

  for (let index = 0; index <= count; index += 1) {
    const point = path.getPointAtLength(length * index / count);
    const activePart = parts[parts.length - 1];
    const previous = activePart[activePart.length - 1];
    if (previous && Math.hypot(point.x - previous[0], point.y - previous[1]) > 0.5) parts.push([]);
    parts[parts.length - 1].push([point.x, point.y]);
  }

  return geometryCache.set(key, parts, parts.reduce((total, part) => total + part.length, 0));
}

function drawFallbackPath(
  context: CanvasRenderingContext2D,
  data: string,
  color: string,
  mode: PencilIconPath['mode'],
  weightScale = 1,
): void {
  try {
    const path = new Path2D(data);
    context.save();
    context.strokeStyle = color;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = (mode === 'scuff' ? 0.65 : 1.4) * weightScale;
    context.globalAlpha = mode === 'scuff' ? 0.6 : 0.9;
    context.stroke(path);
    context.restore();
  } catch {
    // Semantic controls remain usable even when a path cannot be painted.
  }
}

function renderIcon(
  paths: readonly PencilIconPath[],
  options: { seed: number; size: number; sourceSize: number; active: boolean; color: string; dpr: number; badge?: PencilIconBadge; rtl?: boolean; weightScale?: number },
): HTMLCanvasElement {
  const { seed, size, sourceSize, active, color, dpr } = options;
  const weightScale = options.weightScale ?? 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const coordinateScale = size / 40;
  context.scale(dpr * coordinateScale, dpr * coordinateScale);
  const offset = (40 - sourceSize) / 2;
  context.translate(offset, offset);

  paths.forEach((path, index) => {
    const mode = path.mode ?? 'stroke';
    const pathSeed = seed + index * 137;
    if (mode === 'wash') {
      try {
        context.save();
        context.clip(new Path2D(path.d));
        context.globalAlpha = active ? 0.76 : 0.34;
        for (let y = sourceSize * 0.18; y < sourceSize; y += 1.6) {
          pencilStroke(
            context,
            [[sourceSize * 0.15, y + 3], [sourceSize * 0.85, y - 3]],
            color,
            1.1,
            pathSeed + Math.round(y * 17),
            0.25,
            2,
            false,
            { variation: 0.85, breaks: 0.25, grain: 0.7, gain: 2.2, step: 0.35 },
          );
        }
        context.restore();
      } catch {
        drawFallbackPath(context, path.d, color, mode, weightScale);
      }
      return;
    }

    try {
      const parts = cachedPathParts(path.d);
      for (const points of parts) {
        pencilStroke(
          context,
          points,
          color,
          (mode === 'scuff' ? 0.55 : 1.65) * weightScale,
          pathSeed,
          0.3,
          mode === 'scuff' ? 1 : 3,
          false,
          {
            variation: 0.82,
            breaks: 0.18,
            grain: 0.68,
            gain: mode === 'scuff' ? 1.5 : 3,
            step: 0.35,
            taperLength: 0.65,
          },
        );
      }
    } catch {
      drawFallbackPath(context, path.d, color, mode, weightScale);
    }
  });

  if (active) {
    pencilStroke(
      context,
      [[sourceSize * 0.2, sourceSize - 2], [sourceSize * 0.5, sourceSize - 1.5], [sourceSize * 0.8, sourceSize - 2.2]],
      color,
      1.1,
      seed + 977,
      0.25,
      3,
      false,
      { variation: 0.8, breaks: 0.25, grain: 0.7, gain: 2.8, step: 0.35 },
    );
  }
  if (options.badge?.paths.length) {
    const badge = options.badge;
    const scale = Number.isFinite(badge.scale) ? Math.min(0.65, Math.max(0.35, badge.scale!)) : 0.55;
    const badgeSourceSize = Number.isFinite(badge.sourceSize) ? Math.min(32, Math.max(1, badge.sourceSize!)) : 24;
    const position = badge.position ?? 'bottom-end';
    const onLeft = position.endsWith('start') !== Boolean(options.rtl);
    const extent = 40 * scale;
    const x = onLeft ? 0 : 40 - extent;
    const y = position.startsWith('top') ? 0 : 40 - extent;
    const badgeImage = renderIcon(badge.paths, {
      seed: seed + 1543, size: size * scale, sourceSize: badgeSourceSize, active: false, color, dpr,
      weightScale: 1 / scale,
    });
    const mask = document.createElement('canvas');
    mask.width = badgeImage.width;
    mask.height = badgeImage.height;
    const maskContext = mask.getContext('2d');
    if (maskContext) {
      maskContext.drawImage(badgeImage, 0, 0);
      const pixels = maskContext.getImageData(0, 0, mask.width, mask.height);
      for (let index = 3; index < pixels.data.length; index += 4) {
        pixels.data[index] = pixels.data[index] ? 255 : 0;
      }
      maskContext.putImageData(pixels, 0, 0);
    }
    context.save();
    context.setTransform(dpr * coordinateScale, 0, 0, dpr * coordinateScale, 0, 0);
    // A narrow contour halo separates the strokes without cutting a disk out of the base icon.
    context.globalCompositeOperation = 'destination-out';
    for (let step = 0; step < 8; step += 1) {
      const angle = step * Math.PI / 4;
      context.drawImage(mask, x + Math.cos(angle) * 1.25, y + Math.sin(angle) * 1.25, extent, extent);
    }
    context.drawImage(mask, x, y, extent, extent);
    context.globalCompositeOperation = 'source-over';
    context.drawImage(badgeImage, x, y, extent, extent);
    context.restore();
  }
  return canvas;
}

export const PencilIcon = forwardRef<HTMLCanvasElement, PencilIconProps>(function PencilIcon(
  {
    active = false,
    badge,
    className = '',
    decorative = true,
    paths,
    seed,
    size = 40,
    sourceSize = 32,
    ...props
  },
  forwardedRef,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(forwardedRef, () => canvasRef.current as HTMLCanvasElement);
  const geometryKey = useMemo(() => JSON.stringify(paths), [paths]);
  const badgeKey = useMemo(() => badge ? JSON.stringify(badge) : '', [badge]);
  const resolvedSeed = seedToNumber(seed ?? geometryKey);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let disposed = false;
    let lastPaint = '';
    const paint = () => {
      if (disposed) return;
      const dpr = effectiveDpr(3);
      const computed = getComputedStyle(canvas);
      const color = computed.color;
      const rtl = computed.direction === 'rtl';
      const key = JSON.stringify([
        PENCIL_RENDERER_VERSION,
        geometryKey,
        badgeKey,
        rtl,
        resolvedSeed,
        size,
        sourceSize,
        active,
        color,
        dpr,
      ]);
      if (key === lastPaint && canvasIsUsable(canvas)) return;
      let image = imageCache.get(key);
      if (image && !canvasIsUsable(image)) {
        imageCache.delete(key);
        image = undefined;
      }
      if (!image) {
        image = renderIcon(paths, { seed: resolvedSeed, size, sourceSize, active, color, dpr, badge, rtl });
        imageCache.set(key, image, canvasByteCost(image));
      }
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context || context.isContextLost?.()) return;
      context.drawImage(image, 0, 0);
      lastPaint = key;
    };
    const appearance = new MutationObserver(paint);
    appearance.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-theme', 'data-inkra-theme'],
    });
    const inheritedColor = new MutationObserver(paint);
    for (let element: HTMLElement | null = canvas; element; element = element.parentElement) {
      inheritedColor.observe(element, { attributes: true, attributeFilter: ['style', 'class', 'dir'] });
    }
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    colorScheme.addEventListener('change', paint);
    const stopRecovery = observeCanvasRecovery(() => { lastPaint = ''; paint(); });
    paint();
    return () => {
      disposed = true;
      stopRecovery();
      appearance.disconnect();
      inheritedColor.disconnect();
      colorScheme.removeEventListener('change', paint);
    };
  }, [active, badge, badgeKey, geometryKey, paths, resolvedSeed, size, sourceSize]);

  const accessibilityProps = decorative
    ? { 'aria-hidden': true }
    : { role: props.role ?? 'img' };
  return (
    <canvas
      {...props}
      {...accessibilityProps}
      className={['inkra-pencil-icon', className].filter(Boolean).join(' ')}
      data-active={active || undefined}
      data-composite={Boolean(badge?.paths.length) || undefined}
      data-renderer="inkra-pressure-pencil"
      ref={canvasRef}
      style={{ width: size, height: size, ...props.style }}
    />
  );
});
