import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { BoundedCache, PENCIL_RENDERER_VERSION, boundedCanvasSize, canvasByteCost, canvasIsUsable, effectiveDpr } from '../internal/cache.js';
import { observeCanvasRecovery } from '../internal/recovery.js';
import { seedToNumber } from '../internal/random.js';
import { maxStrokeRoughness, pencilRenderDefaults, readRenderToken } from '../internal/renderTokens.js';
import { pencilStroke } from '../internal/stroke.js';
import type { PencilPoint } from '../internal/stroke.js';

const ringCache = new BoundedCache<HTMLCanvasElement>(48, 8 * 1024 * 1024);

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function arcClip(diameter: number, radius: number, thickness: number, percent: number | null): CSSProperties['clipPath'] {
  const progress = Math.max(0, Math.min(100, percent ?? 28));
  if (progress === 0) return 'inset(50%)';
  if (progress === 100) return 'none';

  const radians = progress / 100 * Math.PI * 2;
  const arcLength = radius * radians;
  const taperLength = Math.min(arcLength * 0.28, Math.max(7, thickness * 2.4));
  const steps = Math.max(8, Math.ceil(progress * 0.9));
  const outer: string[] = [];
  const inner: string[] = [];
  let start: { angle: number; halfWidth: number } | undefined;
  let end: { angle: number; halfWidth: number } | undefined;

  const point = (angle: number, distance: number) => `${((diameter / 2 + Math.cos(angle) * distance) / diameter * 100).toFixed(3)}% ${((diameter / 2 + Math.sin(angle) * distance) / diameter * 100).toFixed(3)}%`;

  for (let index = 0; index <= steps; index += 1) {
    const ratio = index / steps;
    const distanceFromEnd = Math.min(ratio, 1 - ratio) * arcLength;
    const taper = 0.12 + smoothstep(Math.min(1, distanceFromEnd / taperLength)) * 0.88;
    // Leave enough room for the global stroke-width token while narrowing only
    // the exposed ends. The pencil texture itself still determines the edge.
    const halfWidth = thickness * 1.55 * taper;
    const angle = ratio * radians - Math.PI / 2;
    if (index === 0) start = { angle, halfWidth };
    if (index === steps) end = { angle, halfWidth };
    outer.push(point(angle, radius + halfWidth));
    inner.push(point(angle, Math.max(0, radius - halfWidth)));
  }

  const endCap = Array.from({ length: 5 }, (_, index) => {
    const capAngle = Math.PI / 2 - index / 4 * Math.PI;
    const tangent = end!.angle + Math.PI / 2;
    const x = diameter / 2 + Math.cos(end!.angle) * radius
      + Math.cos(end!.angle) * Math.sin(capAngle) * end!.halfWidth
      + Math.cos(tangent) * Math.cos(capAngle) * end!.halfWidth;
    const y = diameter / 2 + Math.sin(end!.angle) * radius
      + Math.sin(end!.angle) * Math.sin(capAngle) * end!.halfWidth
      + Math.sin(tangent) * Math.cos(capAngle) * end!.halfWidth;
    return `${(x / diameter * 100).toFixed(3)}% ${(y / diameter * 100).toFixed(3)}%`;
  });
  const startCap = Array.from({ length: 5 }, (_, index) => {
    const capAngle = -Math.PI / 2 + index / 4 * Math.PI;
    const tangent = start!.angle + Math.PI / 2;
    const x = diameter / 2 + Math.cos(start!.angle) * radius
      + Math.cos(start!.angle) * Math.sin(capAngle) * start!.halfWidth
      - Math.cos(tangent) * Math.cos(capAngle) * start!.halfWidth;
    const y = diameter / 2 + Math.sin(start!.angle) * radius
      + Math.sin(start!.angle) * Math.sin(capAngle) * start!.halfWidth
      - Math.sin(tangent) * Math.cos(capAngle) * start!.halfWidth;
    return `${(x / diameter * 100).toFixed(3)}% ${(y / diameter * 100).toFixed(3)}%`;
  });

  return `polygon(${outer.join(',')},${endCap.join(',')},${inner.reverse().join(',')},${startCap.join(',')})`;
}

export function ProgressRing({ diameter, thickness, percent, seed }: {
  diameter: number;
  thickness: number;
  percent: number | null;
  seed: string | number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const radius = diameter / 2 - thickness - 4;
  const clipPath = useMemo(() => arcClip(diameter, radius, thickness, percent), [diameter, percent, radius, thickness]);

  // Paint a stable full ring once; CSS reveals the current arc without repainting its texture.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let lastPaint = '';
    const paint = () => {
      try {
        if (!CSS.supports('clip-path', 'polygon(0 0, 100% 0, 100% 100%)')) return;
        const width = canvas.clientWidth;
        if (!width) return;
        const style = getComputedStyle(canvas);
        const weight = readRenderToken(style, '--inkra-stroke-width', pencilRenderDefaults.strokeWidth, 0.3, 3);
        const roughness = readRenderToken(style, '--inkra-stroke-amplitude', pencilRenderDefaults.strokeRoughness, 0, maxStrokeRoughness);
        const dpr = effectiveDpr(2);
        const size = boundedCanvasSize(width, width, dpr);
        const key = JSON.stringify([PENCIL_RENDERER_VERSION, diameter, thickness, width, dpr, style.color, weight, roughness, seed]);
        if (key === lastPaint && canvasIsUsable(canvas)) return;
        let image = ringCache.get(key);
        if (image && !canvasIsUsable(image)) { ringCache.delete(key); image = undefined; }
        if (!image) {
          image = document.createElement('canvas');
          image.width = size.width;
          image.height = size.height;
          image.addEventListener('contextlost', () => ringCache.delete(key), { once: true });
          const context = image.getContext('2d');
          if (!context) throw new Error('Canvas unavailable');
          context.scale(image.width / diameter, image.height / diameter);
          const points: PencilPoint[] = Array.from({ length: 361 }, (_, index) => {
            const angle = index * Math.PI / 180 - Math.PI / 2;
            return [diameter / 2 + Math.cos(angle) * radius, diameter / 2 + Math.sin(angle) * radius];
          });
          pencilStroke(context, points, style.color, thickness * weight / 2.15, seedToNumber(seed), roughness * 0.55, 2, true,
            { variation: 0.86, breaks: 0.32, grain: 0.84, gain: 1.35, step: 0.55, edgeGrain: true });
          ringCache.set(key, image, canvasByteCost(image));
        }
        const context = canvas.getContext('2d');
        if (!context || context.isContextLost?.()) throw new Error('Canvas unavailable');
        canvas.width = image.width;
        canvas.height = image.height;
        context.drawImage(image, 0, 0);
        canvas.dataset.ready = 'true';
        lastPaint = key;
      } catch {
        canvas.width = canvas.height = 0;
        delete canvas.dataset.ready;
        lastPaint = '';
      }
    };
    const lost = () => { delete canvas.dataset.ready; lastPaint = ''; };
    canvas.addEventListener('contextlost', lost);
    const observer = new MutationObserver(paint);
    for (let node: HTMLElement | null = canvas; node; node = node.parentElement) {
      observer.observe(node, { attributes: true, attributeFilter: ['style', 'class', 'dir', 'data-theme', 'data-inkra-theme'] });
    }
    const resize = new ResizeObserver(paint);
    resize.observe(canvas);
    const scheme = matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', paint);
    window.addEventListener('resize', paint);
    const stopRecovery = observeCanvasRecovery(() => { lastPaint = ''; paint(); });
    paint();
    return () => {
      observer.disconnect();
      resize.disconnect();
      scheme.removeEventListener('change', paint);
      window.removeEventListener('resize', paint);
      canvas.removeEventListener('contextlost', lost);
      stopRecovery();
    };
  }, [diameter, radius, seed, thickness]);

  return <span className="inkra-progress__ring" aria-hidden="true">
    <span className="inkra-progress__ring-rotation">
      <span className="inkra-progress__ring-direction">
        <canvas ref={canvasRef} className="inkra-progress__ring-ink" style={{ clipPath }} />
        <svg className="inkra-progress__ring-fallback" viewBox={`0 0 ${diameter} ${diameter}`} focusable="false">
          <circle cx={diameter / 2} cy={diameter / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={thickness}
            pathLength={100} strokeDasharray="100" strokeDashoffset={100 - (percent ?? 28)} strokeLinecap="round"
            transform={`rotate(-90 ${diameter / 2} ${diameter / 2})`} />
        </svg>
      </span>
    </span>
  </span>;
}
