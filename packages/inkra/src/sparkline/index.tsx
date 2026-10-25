import { useInkraLocale } from '../i18n/index.js';
import { forwardRef, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, KeyboardEvent } from 'react';
import { PencilText } from '../PencilText.js';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import { effectiveDpr } from '../internal/cache.js';
import { observeCanvasRecovery } from '../internal/recovery.js';
import { seedToNumber } from '../internal/random.js';
import { pencilStroke } from '../internal/stroke.js';
import { drawPencilWash } from '../internal/wash.js';
import { pencilRenderDefaults, readRenderToken } from '../internal/renderTokens.js';
import { createSparklineGeometry, normalizeSparklineData, sparklineDomain } from './model.js';
import type { SparklineDatum } from './model.js';

export type SparklineType = 'line' | 'bar';
export interface SparklineProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  data: readonly SparklineDatum[];
  type?: SparklineType;
  width?: number;
  height?: number;
  min?: number;
  max?: number;
  label?: string;
  showPoints?: boolean;
  showArea?: boolean;
  showSummary?: boolean;
  getLabel?: (value: number | null, index: number) => string;
}

function resolveCssColor(host: HTMLElement, style: CSSStyleDeclaration, token: string, fallback: string): string {
  const value = style.getPropertyValue(token).trim();
  if (!value || !value.includes('var(')) return value || fallback;
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  host.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || fallback;
}

export const Sparkline = forwardRef<HTMLDivElement, SparklineProps>(function Sparkline(inkraProps, ref) {
  const { t } = useInkraLocale();
  const {
  data,
  type = 'line',
  width = 180,
  height = 56,
  min,
  max,
  label = t('sparkline.label'),
  showPoints = true,
  showArea = true,
  showSummary = true,
  getLabel = (value, index) => t(value === null ? 'sparkline.missing' : 'sparkline.point', { index: index + 1, value: value ?? '' }),
  className,
  ...props
} = inkraProps;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactionCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pencilReady, setPencilReady] = useState(false);
  const [interactionReady, setInteractionReady] = useState(false);
  const points = useMemo(() => normalizeSparklineData(data), [data]);
  const values = useMemo(() => points.flatMap(point => point.value === null ? [] : [point.value]), [points]);
  const domain = useMemo(() => sparklineDomain(points), [points]);
  const boundedPoints = useMemo(
    () => points.map(point => ({
      ...point,
      value: point.value === null ? null : Math.min(max ?? Infinity, Math.max(min ?? -Infinity, point.value)),
    })),
    [max, min, points],
  );
  const geometry = useMemo(() => createSparklineGeometry(boundedPoints, width, height), [boundedPoints, height, width]);
  const [activeIndex, setActiveIndex] = useState<number | null>(() => {
    for (let index = points.length - 1; index >= 0; index--) if (points[index].value !== null) return index;
    return null;
  });
  const activePoint = activeIndex === null ? null : points[activeIndex] ?? null;
  const effectiveShowPoints = showPoints || values.length === 1;
  const summary = useMemo(() => {
    if (!values.length) return t('sparkline.empty');
    let minimum = values[0];
    let maximum = values[0];
    for (let index = 1; index < values.length; index++) {
      minimum = Math.min(minimum, values[index]);
      maximum = Math.max(maximum, values[index]);
    }
    return t('sparkline.summary', { current: values[values.length - 1], minimum, maximum });
  }, [t, values]);
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!points.length || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = activeIndex ?? 0;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : Math.min(points.length - 1, Math.max(0, current + (event.key === 'ArrowRight' ? 1 : -1)));
    setActiveIndex(next);
  };
  const classes = ['inkra-sparkline', `inkra-sparkline--${type}`, className].filter(Boolean).join(' ');
  useBrowserLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') return undefined;
    let frame = 0;
    let disposed = false;
    const paint = () => {
      frame = 0;
      if (disposed) return;
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      const clear = () => { canvas.width = 1; canvas.height = 1; setPencilReady(false); };
      if (!values.length || cssWidth < 4 || cssHeight < 4) { clear(); return; }
      const dpr = effectiveDpr(2);
      const context = canvas.getContext('2d');
      if (!context || context.isContextLost?.()) { clear(); return; }
      const style = getComputedStyle(canvas);
      const lineColor = resolveCssColor(canvas, style, '--inkra-accent-strong', style.color);
      const washColor = resolveCssColor(canvas, style, '--inkra-accent', lineColor);
      const strokeWidth = readRenderToken(style, '--inkra-stroke-width', pencilRenderDefaults.strokeWidth, 0.3, 3);
      const roughness = readRenderToken(style, '--inkra-stroke-amplitude', pencilRenderDefaults.strokeRoughness, 0, 4);
      const washStrength = readRenderToken(style, '--inkra-wash-strength', pencilRenderDefaults.washStrength, 0, 1) / 0.48;
      const washSpacing = readRenderToken(style, '--inkra-wash-spacing', pencilRenderDefaults.washSpacing, 1, 6);
      const washRoughness = readRenderToken(style, '--inkra-wash-roughness', pencilRenderDefaults.washRoughness, 0, 6);
      const washAngle = readRenderToken(style, '--inkra-wash-angle', pencilRenderDefaults.washAngle, -85, 85);
      canvas.width = Math.ceil(cssWidth * dpr);
      canvas.height = Math.ceil(cssHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, cssWidth, cssHeight);
      const scaleX = cssWidth / width;
      const scaleY = cssHeight / height;
      const segments: Array<Array<readonly [number, number]>> = [];
      let segment: Array<readonly [number, number]> = [];
      boundedPoints.forEach(point => {
        if (point.value === null) {
          if (segment.length) segments.push(segment);
          segment = [];
          return;
        }
        segment.push([geometry.x(point.index) * scaleX, geometry.y(point.value) * scaleY]);
      });
      if (segment.length) segments.push(segment);
      const seed = seedToNumber(`sparkline-${type}-${data.length}`);
      if (type === 'line' && segments.some(points => points.length > 1)) {
        if (showArea && typeof Path2D !== 'undefined' && geometry.areaPath) {
          context.save(); context.scale(scaleX, scaleY); context.clip(new Path2D(geometry.areaPath)); context.setTransform(dpr, 0, 0, dpr, 0, 0);
          drawPencilWash(context, { x: 0, y: 0, width: cssWidth, height: cssHeight }, washColor, seed + 17, { strength: washStrength * 0.22, spacing: washSpacing, roughness: washRoughness, angle: washAngle, inset: 2, radius: 2, dpr }); context.restore();
        }
        segments.forEach((points, index) => {
          if (points.length > 1) pencilStroke(context, points, lineColor, strokeWidth, seed + index * 47, roughness, 2, false, { variation: 0.82, breaks: 0.25, grain: 0.62, gain: 2.1, step: 0.8 });
        });
      } else if (type === 'bar') {
        const baseline = geometry.y(0) * scaleY;
        const barWidth = Math.max(2, cssWidth / Math.max(16, points.length * 2));
        boundedPoints.forEach(point => {
          if (point.value === null) return;
          const y = geometry.y(point.value) * scaleY;
          drawPencilWash(context, { x: geometry.x(point.index) * scaleX - barWidth / 2, y: Math.min(y, baseline), width: barWidth, height: Math.max(2, Math.abs(baseline - y)) }, washColor, seed + point.index * 31, { strength: washStrength * 0.34, spacing: washSpacing, roughness: washRoughness, angle: washAngle, inset: 1, radius: 1, dpr });
          pencilStroke(context, [[geometry.x(point.index) * scaleX - barWidth / 2, Math.min(y, baseline)], [geometry.x(point.index) * scaleX + barWidth / 2, Math.min(y, baseline)]], lineColor, strokeWidth * 0.55, seed + point.index * 43, roughness, 1, false, { variation: 0.8, breaks: 0.2, grain: 0.65, step: 0.8 });
        });
      }
      if (!disposed) setPencilReady(true);
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        try { paint(); } catch { canvas.width = 1; canvas.height = 1; setPencilReady(false); }
      });
    };
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    resize?.observe(canvas);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', schedule);
    const inheritedStyle = new MutationObserver(schedule);
    for (let element: HTMLElement | null = canvas; element; element = element.parentElement) inheritedStyle.observe(element, { attributes: true, attributeFilter: ['style', 'class', 'data-theme', 'data-inkra-theme'] });
    const stopRecovery = observeCanvasRecovery(() => { setPencilReady(false); schedule(); });
    try { paint(); } catch { canvas.width = 1; canvas.height = 1; setPencilReady(false); }
    return () => { disposed = true; setPencilReady(false); resize?.disconnect(); inheritedStyle.disconnect(); stopRecovery(); media.removeEventListener('change', schedule); cancelAnimationFrame(frame); };
  }, [boundedPoints, data.length, geometry, height, showArea, type, values.length, width]);
  useBrowserLayoutEffect(() => {
    const canvas = interactionCanvasRef.current;
    if (!canvas || typeof window === 'undefined') return undefined;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      const context = canvas.getContext('2d');
      const clearInteraction = () => { canvas.width = 1; canvas.height = 1; setInteractionReady(false); };
      if (!context || cssWidth < 4 || cssHeight < 4 || !values.length) { clearInteraction(); return; }
      const dpr = effectiveDpr(2);
      const style = getComputedStyle(canvas);
      const lineColor = resolveCssColor(canvas, style, '--inkra-accent-strong', style.color);
      const strokeWidth = readRenderToken(style, '--inkra-stroke-width', pencilRenderDefaults.strokeWidth, 0.3, 3);
      const roughness = readRenderToken(style, '--inkra-stroke-amplitude', pencilRenderDefaults.strokeRoughness, 0, 4);
      canvas.width = Math.ceil(cssWidth * dpr); canvas.height = Math.ceil(cssHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, cssWidth, cssHeight);
      const scaleX = cssWidth / width; const scaleY = cssHeight / height; const seed = seedToNumber(`sparkline-interaction-${type}-${data.length}`);
          if (type === 'line' && effectiveShowPoints) boundedPoints.forEach(point => {
        if (point.value === null) return;
        const x = geometry.x(point.index) * scaleX; const y = geometry.y(point.value) * scaleY;
        pencilStroke(context, [[x - 2.8, y], [x, y - 2.8], [x + 2.8, y], [x, y + 2.8], [x - 2.8, y]], lineColor, strokeWidth * 0.7, seed + point.index * 61, roughness, 1, true, { variation: 0.75, breaks: 0.12, grain: 0.62, gain: 1.8, step: 0.8 });
      });
      if (activePoint && activePoint.value !== null) {
        const x = geometry.x(activePoint.index) * scaleX;
        pencilStroke(context, [[x, 2], [x, cssHeight - 2]], lineColor, strokeWidth * 0.18, seed + 401, roughness, 1, false, { variation: 0.55, breaks: 0.45, grain: 0.5, gain: 1.1, step: 1.2 });
      }
      setInteractionReady(true);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { try { paint(); } catch { canvas.width = 1; canvas.height = 1; setInteractionReady(false); } }); };
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    resize?.observe(canvas);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', schedule);
    const inheritedStyle = new MutationObserver(schedule);
    for (let element: HTMLElement | null = canvas; element; element = element.parentElement) inheritedStyle.observe(element, { attributes: true, attributeFilter: ['style', 'class', 'data-theme', 'data-inkra-theme'] });
    const stopRecovery = observeCanvasRecovery(() => { setInteractionReady(false); schedule(); });
    try { paint(); } catch { canvas.width = 1; canvas.height = 1; setInteractionReady(false); }
    return () => { setInteractionReady(false); resize?.disconnect(); inheritedStyle.disconnect(); stopRecovery(); media.removeEventListener('change', schedule); cancelAnimationFrame(frame); };
      }, [activeIndex, activePoint, boundedPoints, data.length, effectiveShowPoints, geometry, height, type, values.length, width]);
      return <div {...props} ref={ref} className={`${classes}${pencilReady ? ' inkra-sparkline--pencil-ready' : ''}${interactionReady ? ' inkra-sparkline--interaction-ready' : ''}`} data-empty={values.length === 0 || undefined} data-show-points={effectiveShowPoints || undefined}>
    <svg className="inkra-sparkline__svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} tabIndex={0} onKeyDown={onKeyDown}>
      {showArea && type === 'line' && geometry.areaPath && <path className="inkra-sparkline__area" d={geometry.areaPath} aria-hidden="true" />}
      {type === 'line' && geometry.linePath && <path className="inkra-sparkline__line" d={geometry.linePath} aria-hidden="true" />}
      {type === 'bar' && boundedPoints.map(point => {
        if (point.value === null) return null;
        const baseline = geometry.y(0);
        const valueY = geometry.y(point.value);
        return <rect key={point.index} className="inkra-sparkline__bar" x={geometry.x(point.index) - Math.max(2, width / Math.max(16, points.length * 2)) / 2} width={Math.max(2, width / Math.max(16, points.length * 2))} y={Math.min(baseline, valueY)} height={Math.max(1, Math.abs(baseline - valueY))} data-index={point.index} data-active={activeIndex === point.index || undefined} onMouseEnter={() => setActiveIndex(point.index)} />;
      })}
      {(showPoints || values.length === 1) && type === 'line' && boundedPoints.map(point => point.value === null ? null : <circle key={point.index} className="inkra-sparkline__point" cx={geometry.x(point.index)} cy={geometry.y(point.value)} r={activeIndex === point.index ? 3.5 : 2} data-active={activeIndex === point.index || undefined} onMouseEnter={() => setActiveIndex(point.index)} />)}
      {activePoint && activePoint.value !== null && <line className="inkra-sparkline__guide" x1={geometry.x(activePoint.index)} x2={geometry.x(activePoint.index)} y1={4} y2={height - 4} aria-hidden="true" />}
    </svg>
    <canvas ref={canvasRef} className="inkra-sparkline__pencil inkra-sparkline__pencil--static" style={{ aspectRatio: `${width} / ${height}` }} aria-hidden="true" />
    <canvas ref={interactionCanvasRef} className="inkra-sparkline__pencil inkra-sparkline__pencil--interaction" style={{ aspectRatio: `${width} / ${height}` }} aria-hidden="true" />
    {activePoint && <div className="inkra-sparkline__tooltip" aria-hidden="true"><PencilText>{getLabel(activePoint.value, activePoint.index)}</PencilText></div>}
    {showSummary && <p className="inkra-sparkline__summary"><span className="visually-hidden">{label}: </span><PencilText seed={`sparkline-summary-${label}-${summary}`}>{summary}</PencilText></p>}
    <div className="inkra-sparkline__data" aria-label={`${label} data`}>
      {points.map(point => <span key={point.index}>{getLabel(point.value, point.index)}</span>)}
    </div>
    <span className="visually-hidden">Domain {domain[0]} to {domain[1]}</span>
  </div>;
});

export { createSparklineGeometry, normalizeSparklineData, sparklineDomain } from './model.js';
export type { SparklineDatum, SparklinePoint } from './model.js';

