import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { CanvasHTMLAttributes } from 'react';

import {
  BoundedCache,
  PENCIL_RENDERER_VERSION,
  boundedCanvasSize,
  canvasByteCost,
  canvasIsUsable,
  effectiveDpr,
} from './internal/cache.js';
import { observeCanvasRecovery } from './internal/recovery.js';
import { seedToNumber } from './internal/random.js';
import { pencilStroke } from './internal/stroke.js';
import { maxStrokeRoughness, pencilRenderDefaults, readRenderToken } from './internal/renderTokens.js';
import { cachedPathParts } from './internal/iconGeometry.js';
import { paintFilledIcon } from './internal/iconFill.js';

export interface PencilIconPath {
  d: string;
  /** Filled icons: stroke stays a line, wash exposes paper, fill is dense; omitted mode detects closed silhouettes. */
  mode?: 'stroke' | 'wash' | 'scuff' | 'fill' | 'cutout';
  /** Optional pigment for an explicit fill region, including CSS custom properties. */
  color?: string;
  fillRule?: CanvasFillRule;
}

export interface PencilIconBadge {
  paths: readonly PencilIconPath[];
  filledPaths?: readonly PencilIconPath[];
  variant?: 'outline' | 'filled';
  fillColor?: string;
  sourceSize?: number;
  position?: 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
  /** Relative canvas size, clamped to 0.35-0.65. Defaults to 0.55. */
  scale?: number;
}

export interface PencilIconProps extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, 'children' | 'height' | 'width'> {
  paths: readonly PencilIconPath[];
  /** Filled icons retain open symbols and use negative space for interior details. */
  variant?: 'outline' | 'filled';
  /** Optional authored geometry for shapes whose filled silhouette differs from the outline. */
  filledPaths?: readonly PencilIconPath[];
  /** Body pigment, independent of the CSS color used for the contour. Defaults to currentColor. */
  fillColor?: string;
  badge?: PencilIconBadge;
  seed?: string | number;
  size?: number;
  sourceSize?: number;
  active?: boolean;
  /** Overrides icon/theme stroke weight. Clamped to 0.3-3. */
  strokeWidth?: number;
  /** Pigment opacity, clamped to 0-1. Defaults to the icon intensity token or 1. */
  intensity?: number;
  /** Stroke gap amount, clamped to 0-1. Zero disables gaps, not pigment grain. */
  breaks?: number;
  /** Maximum gaps per continuous path, limited by displayed length; floored/clamped to 0-12, default 1. */
  breakCount?: number;
  /** Pressure-driven stroke width variation, clamped to 0-1. Defaults to 0.82. */
  pressureVariation?: number;
  decorative?: boolean;
}

const imageCache = new BoundedCache<HTMLCanvasElement>(128, 24 * 1024 * 1024);

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
  options: { seed: number; size: number; sourceSize: number; active: boolean; color: string; dpr: number; variant?: 'outline' | 'filled'; fillColor?: string; badge?: PencilIconBadge; rtl?: boolean; weightScale?: number; roughnessScale?: number; breaks?: number; breakCount?: number; pressureVariation?: number },
): HTMLCanvasElement {
  const { seed, size, sourceSize, active, color, dpr } = options;
  const weightScale = options.weightScale ?? 1;
  const roughnessScale = options.roughnessScale ?? 1;
  const breaks = options.breaks ?? pencilRenderDefaults.iconBreaks;
  const breakCount = options.breakCount ?? pencilRenderDefaults.iconBreakCount;
  const pressureVariation = options.pressureVariation ?? pencilRenderDefaults.iconPressureVariation;
  const variationScale = pressureVariation / pencilRenderDefaults.iconPressureVariation;
  const pixels = Math.round(size * dpr);
  boundedCanvasSize(pixels, pixels, 1);
  if (!Number.isFinite(sourceSize) || sourceSize <= 0 || sourceSize > 4096 || paths.length > 1024) {
    throw new RangeError('Pencil icon exceeds the bounded geometry budget');
  }
  const canvas = document.createElement('canvas');
  canvas.width = pixels;
  canvas.height = pixels;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const coordinateScale = size / 40;
  context.scale(dpr * coordinateScale, dpr * coordinateScale);
  const offset = (40 - sourceSize) / 2;
  context.translate(offset, offset);
  let sampledPoints = 0;

  if (options.variant === 'filled') {
    paintFilledIcon(context, paths, { color, fillColor: options.fillColor ?? color, sourceSize, seed, weightScale, roughnessScale, breaks, breakCount, pressureVariation, coordinateScale });
  } else paths.forEach((path, index) => {
    if (path.d.length > 65536) return;
    const mode = path.mode ?? 'stroke';
    if (mode === 'cutout') return;
    const pathSeed = seed + index * 137;
    if (mode === 'wash' || mode === 'fill') {
      try {
        context.save();
        context.clip(new Path2D(path.d));
        context.globalAlpha = active ? 0.76 : 0.34;
        for (let y = sourceSize * 0.18; y < sourceSize; y += 1.6) {
          pencilStroke(
            context,
            [[sourceSize * 0.15, y + 3], [sourceSize * 0.85, y - 3]],
            color,
            1.1 * weightScale / (pencilRenderDefaults.strokeWidth / 1.2),
            pathSeed + Math.round(y * 17),
            0.25,
            2,
            false,
            { variation: Math.min(1, 0.85 * variationScale), fitPressure: true, breaks, breakCount, breakScale: coordinateScale, continuousBreaks: true, grain: 0.7, gain: 2.2, step: 0.35 },
          );
        }
        context.restore();
      } catch {
        drawFallbackPath(context, path.d, color, mode, weightScale);
      }
      return;
    }

    try {
      if (sampledPoints >= 65536) {
        drawFallbackPath(context, path.d, color, mode, weightScale);
        return;
      }
      const parts = cachedPathParts(path.d);
      sampledPoints += parts.reduce((total, part) => total + part.length, 0);
      if (sampledPoints > 65536) {
        drawFallbackPath(context, path.d, color, mode, weightScale);
        return;
      }
      for (const points of parts) {
        pencilStroke(
          context,
          points,
          color,
          (mode === 'scuff' ? 0.55 : 1.65) * weightScale,
          pathSeed,
          0.3 * roughnessScale,
          mode === 'scuff' ? 1 : 3,
          false,
          {
            variation: pressureVariation,
            fitPressure: true,
            breaks,
            breakCount,
            breakScale: coordinateScale,
            continuousBreaks: true,
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
      1.1 * weightScale,
      seed + 977,
      0.25 * roughnessScale,
      3,
      false,
      { variation: 0.8 * variationScale, fitPressure: true, breaks, breakCount, breakScale: coordinateScale, continuousBreaks: true, grain: 0.7, gain: 2.8, step: 0.35 },
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
    const badgeVariant = badge.variant ?? options.variant;
    const badgeImage = renderIcon(badgeVariant === 'filled' ? badge.filledPaths ?? badge.paths : badge.paths, {
      seed: seed + 1543, size: size * scale, sourceSize: badgeSourceSize, active: false, color, dpr,
      variant: badgeVariant, fillColor: badge.fillColor ?? options.fillColor,
      weightScale: weightScale / scale, roughnessScale, breaks, breakCount, pressureVariation,
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
    variant = 'outline',
    filledPaths,
    fillColor,
    seed,
    size = 40,
    sourceSize = 32,
    strokeWidth,
    intensity,
    breaks,
    breakCount,
    pressureVariation,
    ...props
  },
  forwardedRef,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPaintRef = useRef('');
  useImperativeHandle(forwardedRef, () => canvasRef.current as HTMLCanvasElement);
  // Compare values, not caller object identity. Serializing each render also
  // detects in-place edits; the effect receives a stable snapshot of that value.
  const originalGeometryKey = JSON.stringify(paths);
  const geometryKey = variant === 'filled' && filledPaths ? JSON.stringify(filledPaths) : originalGeometryKey;
  const badgeKey = badge ? JSON.stringify(badge) : '';
  const stablePaths: readonly PencilIconPath[] = useMemo(() => JSON.parse(geometryKey), [geometryKey]);
  const stableBadge: PencilIconBadge | undefined = useMemo(() => badgeKey ? JSON.parse(badgeKey) : undefined, [badgeKey]);
  const resolvedSeed = seedToNumber(seed ?? originalGeometryKey);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let disposed = false;
    const paintIcon = () => {
      if (disposed) return;
      const dpr = effectiveDpr(3);
      const computed = getComputedStyle(canvas);
      const color = computed.color;
      const resolveColor = (value?: string): string => {
        if (!value || value === 'currentColor') return color;
        const probe = document.createElement('span');
        probe.style.color = value;
        // Canvas fallback children inherit its own color and custom properties, not just its parent's.
        canvas.appendChild(probe);
        try { return getComputedStyle(probe).color || color; }
        finally { probe.remove(); }
      };
      const resolvedFill = variant === 'filled' ? resolveColor(fillColor) : color;
      const resolvePaths = (items: readonly PencilIconPath[]) => items.map(path => path.color ? { ...path, color: resolveColor(path.color) } : path);
      const renderedPaths = variant === 'filled' ? resolvePaths(stablePaths) : stablePaths;
      const renderedBadge = stableBadge ? { ...stableBadge,
        fillColor: resolveColor(stableBadge.fillColor ?? fillColor),
        paths: resolvePaths(stableBadge.paths),
        filledPaths: stableBadge.filledPaths ? resolvePaths(stableBadge.filledPaths) : undefined,
      } : undefined;
      const rtl = computed.direction === 'rtl';
      const iconWeight = readRenderToken(computed, '--inkra-icon-stroke-width', pencilRenderDefaults.iconStrokeWidth, 0.3, 3);
      const weightScale = (typeof strokeWidth === 'number' && Number.isFinite(strokeWidth) ? Math.min(3, Math.max(0.3, strokeWidth)) : iconWeight) / 1.2;
      const pigmentOpacity = typeof intensity === 'number' && Number.isFinite(intensity)
        ? Math.min(1, Math.max(0, intensity))
        : readRenderToken(computed, '--inkra-icon-intensity', 1, 0, 1);
      const roughnessScale = readRenderToken(computed, '--inkra-stroke-amplitude', pencilRenderDefaults.strokeRoughness, 0, maxStrokeRoughness) / 0.6;
      const strokeBreaks = typeof breaks === 'number' && Number.isFinite(breaks)
        ? Math.min(1, Math.max(0, breaks))
        : readRenderToken(computed, '--inkra-icon-breaks', pencilRenderDefaults.iconBreaks, 0, 1);
      const strokeVariation = typeof pressureVariation === 'number' && Number.isFinite(pressureVariation)
        ? Math.min(1, Math.max(0, pressureVariation))
        : readRenderToken(computed, '--inkra-icon-pressure-variation', pencilRenderDefaults.iconPressureVariation, 0, 1);
      const strokeBreakCount = Math.floor(typeof breakCount === 'number' && Number.isFinite(breakCount)
        ? Math.min(12, Math.max(0, breakCount))
        : readRenderToken(computed, '--inkra-icon-break-count', pencilRenderDefaults.iconBreakCount, 0, 12));
      const key = JSON.stringify([
        PENCIL_RENDERER_VERSION,
        'icon-path-paper-wash-v8',
        geometryKey,
        badgeKey,
        variant, resolvedFill, renderedPaths, renderedBadge,
        rtl,
        resolvedSeed,
        size,
        sourceSize,
        active,
        color,
        dpr,
        weightScale, roughnessScale, strokeBreaks, strokeBreakCount, strokeVariation,
      ]);
      const paintKey = `${key}:${pigmentOpacity}`;
      if (paintKey === lastPaintRef.current && canvasIsUsable(canvas)) return;
      delete canvas.dataset.pencilIconReady;
      let image = imageCache.get(key);
      if (image && !canvasIsUsable(image)) {
        imageCache.delete(key);
        image = undefined;
      }
      if (!image) {
        image = renderIcon(renderedPaths, { seed: resolvedSeed, size, sourceSize, active, color, dpr, variant, fillColor: resolvedFill, badge: renderedBadge, rtl, weightScale, roughnessScale, breaks: strokeBreaks, breakCount: strokeBreakCount, pressureVariation: strokeVariation });
        imageCache.set(key, image, canvasByteCost(image));
      }
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context || context.isContextLost?.()) return;
      // Composite once so overlapping strokes and badges share the same intensity.
      context.save();
      context.globalAlpha = pigmentOpacity;
      context.drawImage(image, 0, 0);
      context.restore();
      lastPaintRef.current = paintKey;
      canvas.dataset.pencilIconReady = 'true';
    };
    const paint = () => {
      try {
        paintIcon();
      } catch {
        // Invalid/oversized decoration must not throw from a React effect.
        canvas.width = canvas.height = 0;
        lastPaintRef.current = '';
        delete canvas.dataset.pencilIconReady;
      }
    };
    const onContextLost = () => { delete canvas.dataset.pencilIconReady; lastPaintRef.current = ''; };
    canvas.addEventListener('contextlost', onContextLost);
    const inheritedColor = new MutationObserver(paint);
    for (let element: HTMLElement | null = canvas; element; element = element.parentElement) {
      inheritedColor.observe(element, { attributes: true, attributeFilter: ['style', 'class', 'dir', 'data-theme', 'data-inkra-theme'] });
    }
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const forcedColors = window.matchMedia('(forced-colors: active)');
    colorScheme.addEventListener('change', paint);
    forcedColors.addEventListener('change', paint);
    const stopRecovery = observeCanvasRecovery(() => { lastPaintRef.current = ''; paint(); });
    paint();
    return () => {
      disposed = true;
      canvas.removeEventListener('contextlost', onContextLost);
      stopRecovery();
      inheritedColor.disconnect();
      colorScheme.removeEventListener('change', paint);
      forcedColors.removeEventListener('change', paint);
    };
  }, [active, stableBadge, badgeKey, geometryKey, stablePaths, resolvedSeed, size, sourceSize, strokeWidth, intensity, breaks, breakCount, pressureVariation, variant, fillColor]);

  const accessibilityProps = decorative
    ? { 'aria-hidden': true }
    : { role: props.role ?? 'img' };
  return (
    <canvas
      {...props}
      {...accessibilityProps}
      className={['inkra-pencil-icon', className].filter(Boolean).join(' ')}
      data-active={active || undefined}
      data-icon-variant={variant}
      data-composite={Boolean(badge?.paths.length) || undefined}
      data-renderer="inkra-pressure-pencil"
      ref={canvasRef}
      style={{ width: size, height: size, ...props.style }}
    />
  );
});
