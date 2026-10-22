import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
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
import { createPencilLinePoints, pencilLineHasDrawableSize } from './internal/line.js';
import type { PencilLineOrientation } from './internal/line.js';
import { pencilStroke } from './internal/stroke.js';
import { maxStrokeRoughness, pencilRenderDefaults, readRenderToken } from './internal/renderTokens.js';

export interface PencilLineProps extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, 'children'> {
  seed?: string | number;
  weight?: number;
  roughness?: number;
  orientation?: PencilLineOrientation;
}

const lineCache = new BoundedCache<HTMLCanvasElement>(96, 12 * 1024 * 1024);

function renderLine(
  width: number,
  height: number,
  color: string,
  seed: number,
  weight: number,
  roughness: number,
  orientation: PencilLineOrientation,
  dpr: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil(height * dpr);
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.scale(dpr, dpr);
  pencilStroke(
    context,
    createPencilLinePoints(width, height, orientation, roughness),
    color,
    weight,
    seed,
    roughness,
    3,
    false,
    { variation: 0.82, breaks: 0.18, grain: 0.68, gain: 2.6, step: 0.5, taperLength: 1.4 },
  );
  return canvas;
}

export const PencilLine = forwardRef<HTMLCanvasElement, PencilLineProps>(function PencilLine(
  {
    className = '',
    orientation = 'horizontal',
    roughness,
    seed = 'inkra-pencil-line',
    weight,
    ...props
  },
  forwardedRef,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(forwardedRef, () => canvasRef.current as HTMLCanvasElement);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let frame = 0;
    let disposed = false;
    let lastPaint = '';
    const paint = () => {
      frame = 0;
      if (disposed) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!pencilLineHasDrawableSize(width, height, orientation)) return;
      const dpr = effectiveDpr(2);
      const style = getComputedStyle(canvas);
      const color = style.color;
      const resolvedWeight = weight ?? readRenderToken(style, '--inkra-stroke-width', pencilRenderDefaults.strokeWidth, 0.3, 3);
      const resolvedRoughness = roughness ?? readRenderToken(style, '--inkra-stroke-amplitude', pencilRenderDefaults.strokeRoughness, 0, maxStrokeRoughness);
      const numericSeed = seedToNumber(seed);
      const key = JSON.stringify([
        PENCIL_RENDERER_VERSION, orientation, width, height, color, numericSeed, resolvedWeight, resolvedRoughness, dpr,
      ]);
      if (key === lastPaint && canvasIsUsable(canvas)) return;
      let image = lineCache.get(key);
      if (image && !canvasIsUsable(image)) {
        lineCache.delete(key);
        image = undefined;
      }
      if (!image) {
        image = renderLine(width, height, color, numericSeed, resolvedWeight, resolvedRoughness, orientation, dpr);
        lineCache.set(key, image, canvasByteCost(image));
      }
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context || context.isContextLost?.()) return;
      context.drawImage(image, 0, 0);
      lastPaint = key;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    resize?.observe(canvas);
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const inheritedStyle = new MutationObserver(schedule);
    for (let element: HTMLElement | null = canvas; element; element = element.parentElement) {
      inheritedStyle.observe(element, { attributes: true, attributeFilter: ['style', 'class', 'data-theme', 'data-inkra-theme'] });
    }
    colorScheme.addEventListener('change', schedule);
    const stopRecovery = observeCanvasRecovery(() => { lastPaint = ''; schedule(); });
    paint();
    return () => {
      disposed = true;
      stopRecovery();
      resize?.disconnect();
      inheritedStyle.disconnect();
      colorScheme.removeEventListener('change', schedule);
      cancelAnimationFrame(frame);
    };
  }, [orientation, roughness, seed, weight]);

  return (
    <canvas
      {...props}
      aria-hidden="true"
      className={['inkra-pencil-line', className].filter(Boolean).join(' ')}
      data-orientation={orientation}
      data-renderer="inkra-pressure-pencil"
      ref={canvasRef}
    />
  );
});

export type { PencilLineOrientation };
