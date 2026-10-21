import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

import { PENCIL_RENDERER_VERSION, effectiveDpr } from './cache.js';
import { observeCanvasRecovery } from './recovery.js';
import { seedToNumber } from './random.js';
import { drawPencilSurface } from './surfaceRenderer.js';
import type { PencilSurfaceVariant } from './surfaceRenderer.js';

function token(style: CSSStyleDeclaration, name: string, fallback: string): string {
  return style.getPropertyValue(name).trim() || fallback;
}

export function usePencilSurface(
  rootRef: RefObject<HTMLElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  borderRef: RefObject<HTMLCanvasElement | null>,
  variant: PencilSurfaceVariant,
  seed: string | number,
  clipContent: boolean,
  radius?: number,
): void {
  useLayoutEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return undefined;
    let frame = 0;
    let lastPaint = '';
    let disposed = false;

    const paint = () => {
      frame = 0;
      if (disposed) return;
      const width = root.clientWidth;
      const height = root.clientHeight;
      if (width < 6 || height < 6) return;
      const dpr = effectiveDpr(2);
      const style = getComputedStyle(root);
      const paper = token(style, '--inkra-paper', '#fcfcfa');
      const ink = variant === 'action' || variant === 'outline'
        ? token(style, '--inkra-accent-strong', '#234e39')
        : variant === 'danger'
          ? token(style, '--inkra-danger', '#873e36')
          : token(style, '--inkra-border-strong', '#778575');
      const dark = style.colorScheme.includes('dark');
      const wash = variant === 'selection'
        ? token(style, '--inkra-selection-pigment', dark ? '#c6b873' : '#769566')
        : variant === 'danger'
          ? token(style, '--inkra-danger-soft', '#d49b8b')
          : variant === 'badge'
          ? token(style, '--inkra-coral-soft', '#f8ebe7')
          : variant === 'quiet'
            ? token(style, '--inkra-accent-soft', '#e6efe8')
            : token(style, '--inkra-accent', '#2e634a');
      const numericSeed = seedToNumber(seed);
      const paintKey = JSON.stringify([
        PENCIL_RENDERER_VERSION,
        variant,
        numericSeed,
        width,
        height,
        dpr,
        paper,
        ink,
        wash,
        dark,
        clipContent,
        radius,
      ]);
      if (paintKey === lastPaint && !canvas.getContext('2d')?.isContextLost?.()) return;
      try {
        const points = drawPencilSurface(
          canvas,
          borderRef.current,
          width,
          height,
          variant,
          numericSeed,
          dpr,
          { paper, dark, ink, wash },
          radius,
        );
        if (clipContent && points) {
          root.style.setProperty(
            '--inkra-pencil-clip',
            `polygon(${points.map(([x, y]) => `${x / width * 100}% ${y / height * 100}%`).join(',')})`,
          );
        } else {
          root.style.removeProperty('--inkra-pencil-clip');
        }
        delete root.dataset.pencilFallback;
        lastPaint = paintKey;
      } catch {
        root.dataset.pencilFallback = 'true';
        root.style.removeProperty('--inkra-pencil-clip');
        lastPaint = '';
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    resize?.observe(root);
    window.addEventListener('resize', schedule, { passive: true });
    const appearance = new MutationObserver(schedule);
    appearance.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-theme', 'data-inkra-theme'],
    });
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    colorScheme.addEventListener('change', schedule);
    const stopRecovery = observeCanvasRecovery(() => {
      lastPaint = '';
      schedule();
    });
    paint();

    return () => {
      disposed = true;
      stopRecovery();
      resize?.disconnect();
      appearance.disconnect();
      colorScheme.removeEventListener('change', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [variant, seed, clipContent, radius, rootRef, canvasRef, borderRef]);
}
