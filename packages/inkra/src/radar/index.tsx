import { scaleLinear } from 'd3-scale';
import { curveLinearClosed, lineRadial } from 'd3-shape';
import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { Button } from '../Button.js';
import { Table } from '../content/index.js';
import { observeCanvasRecovery } from '../internal/recovery.js';
import { seedToNumber } from '../internal/random.js';
import { pencilStroke } from '../internal/stroke.js';
import type { PencilPoint } from '../internal/stroke.js';
import { drawPencilWash } from '../internal/wash.js';
import { effectiveDpr } from '../internal/cache.js';
import { maxStrokeRoughness, pencilRenderDefaults, readRenderToken } from '../internal/renderTokens.js';

export type RadarKey = string | number;

export interface RadarAxis {
  id: RadarKey;
  label: ReactNode;
  min?: number;
  max?: number;
  ariaLabel?: string;
  formatValue?: (value: number) => string;
}

export interface RadarPoint {
  axisId: RadarKey;
  value?: number | null;
  label?: ReactNode;
}

export interface RadarSeries {
  id: RadarKey;
  label: ReactNode;
  data: readonly RadarPoint[];
  color?: string;
  pattern?: 'solid' | 'dash' | 'dot';
  hidden?: boolean;
}

export interface RadarValueContext {
  axis: RadarAxis;
  series: RadarSeries;
  point: RadarPoint;
  value: number | null;
  missing: boolean;
}

export interface RadarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'> {
  axes: readonly RadarAxis[];
  series: readonly RadarSeries[];
  label: ReactNode;
  description?: ReactNode;
  size?: number | string;
  maxRadius?: number;
  levels?: number;
  showAxes?: boolean;
  showLabels?: boolean;
  showLegend?: boolean;
  showValues?: boolean;
  showTable?: boolean;
  legendLabel?: ReactNode;
  missingLabel?: string;
  emptyMessage?: ReactNode;
  selectedSeries?: RadarKey | null;
  defaultSelectedSeries?: RadarKey | null;
  onSelectedSeriesChange?: (id: RadarKey | null, series: RadarSeries | null) => void;
  renderAxisLabel?: (axis: RadarAxis) => ReactNode;
  renderValueLabel?: (context: RadarValueContext) => ReactNode;
  getValueLabel?: (value: number, axis: RadarAxis) => string;
}

type Point = { angle: number; radius: number; value: number | null; point: RadarPoint; axis: RadarAxis };

function RadarInk({
  axisAngles,
  axes,
  levels,
  radius,
  center,
  seriesPoints,
}: {
  axisAngles: readonly number[];
  axes: readonly RadarAxis[];
  levels: number;
  radius: number;
  center: number;
  seriesPoints: readonly { item: RadarSeries; points: readonly Point[]; color: string; index: number }[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let disposed = false;
    let lastPaint = '';
    const paint = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) {
        lastPaint = '';
        delete canvas.dataset.ready;
        setReady(false);
        return;
      }
      try {
      const dpr = effectiveDpr(2);
      const context = canvas.getContext('2d');
      if (!context || context.isContextLost?.()) { setReady(current => current ? false : current); return; }
      const style = getComputedStyle(canvas);
      const strokeWidth = readRenderToken(style, '--inkra-stroke-width', pencilRenderDefaults.strokeWidth, 0.3, 3);
      const roughness = readRenderToken(style, '--inkra-stroke-amplitude', pencilRenderDefaults.strokeRoughness, 0, maxStrokeRoughness);
      const washStrength = readRenderToken(style, '--inkra-wash-strength', pencilRenderDefaults.washStrength, 0, 1)
        * (0.18 / pencilRenderDefaults.washStrength);
      const washSpacing = readRenderToken(style, '--inkra-wash-spacing', pencilRenderDefaults.washSpacing, 1, 6);
      const washRoughness = readRenderToken(style, '--inkra-wash-roughness', pencilRenderDefaults.washRoughness, 0, 6);
      const washAngle = readRenderToken(style, '--inkra-wash-angle', pencilRenderDefaults.washAngle, -85, 85);
      const washInset = readRenderToken(style, '--inkra-wash-inset', 2, 0, 24);
      const resolveColor = (token: string, fallback: string) => style.getPropertyValue(token).trim() || fallback;
      const resolvePaint = (value: string, fallback: string) => {
        const probe = document.createElement('span');
        probe.style.color = value;
        probe.style.position = 'absolute';
        probe.style.inlineSize = '0';
        probe.style.blockSize = '0';
        canvas.parentElement?.appendChild(probe);
        const resolved = getComputedStyle(probe).color;
        probe.remove();
        return resolved && resolved !== 'rgba(0, 0, 0, 0)' ? resolved : fallback;
      };
      const borderColor = resolveColor('--inkra-border', '#99aa9b');
      const paperColor = resolveColor('--inkra-paper', '#f4f0e3');
      const resolvedSeriesColors = seriesPoints.map(entry => resolvePaint(entry.color, borderColor));
      const key = JSON.stringify([width, height, dpr, borderColor, paperColor, strokeWidth, roughness, washStrength, washSpacing, washRoughness, washAngle, washInset, levels, radius, axisAngles, resolvedSeriesColors, seriesPoints.map(entry => [entry.item.id, entry.points.map(point => point.value)])]);
      if (key === lastPaint && canvas.dataset.ready === 'true') return;
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const scaleX = width / 1000;
      const scaleY = height / 1000;
      const line = (points: PencilPoint[], color: string, weight: number, seed: string | number, closed = false) => {
        if (points.length < 2) return;
        const path = closed ? [...points, points[0]] : points;
        pencilStroke(context, path, color, weight, seedToNumber(seed), roughness, 2, closed, { variation: 0.82, breaks: 0.2, grain: 0.72, gain: 2.1, step: 0.7 });
      };
      const coordinate = (angle: number, r: number): PencilPoint => [(center + Math.sin(angle) * r) * scaleX, (center - Math.cos(angle) * r) * scaleY];
      const gridColor = borderColor;
      for (let level = 1; level <= levels; level += 1) {
        line(axisAngles.map(angle => coordinate(angle, radius * level / levels)), gridColor, strokeWidth * 0.55, `radar-grid-${level}`, true);
      }
      axes.forEach((_, index) => line([coordinate(0, 0), coordinate(axisAngles[index], radius)], gridColor, strokeWidth * 0.5, `radar-axis-${index}`));
      seriesPoints.forEach(({ item, points, index }, seriesIndex) => {
        const resolvedColor = resolvedSeriesColors[seriesIndex];
        const valid = points.filter(point => point.value != null).map(point => coordinate(point.angle, point.radius));
        if (valid.length < 2) return;
        const minX = Math.min(...valid.map(point => point[0]));
        const maxX = Math.max(...valid.map(point => point[0]));
        const minY = Math.min(...valid.map(point => point[1]));
        const maxY = Math.max(...valid.map(point => point[1]));
        context.save();
        context.beginPath();
        valid.forEach(([x, y], pointIndex) => pointIndex ? context.lineTo(x, y) : context.moveTo(x, y));
        context.closePath();
        context.clip();
        drawPencilWash(context, { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }, resolvedColor, seedToNumber(`radar-wash-${String(item.id)}`), { strength: washStrength, spacing: washSpacing, roughness: washRoughness, inset: washInset, radius: 8, edgeReach: 4, angle: washAngle, dpr });
        context.restore();
        line(valid, resolvedColor, strokeWidth * (0.68 + (index === 0 ? 0.12 : 0)), `radar-series-${String(item.id)}`, true);
        points.forEach((point, pointIndex) => {
          if (point.value == null) return;
          const [x, y] = coordinate(point.angle, point.radius);
          const marker = index % 3 === 1
            ? [[x - 5, y - 5], [x + 5, y - 5], [x + 5, y + 5], [x - 5, y + 5], [x - 5, y - 5]] as PencilPoint[]
            : index % 3 === 2
              ? [[x, y - 6], [x + 6, y + 5], [x - 6, y + 5], [x, y - 6]] as PencilPoint[]
              : Array.from({ length: 25 }, (_, markerIndex) => { const angle = markerIndex / 24 * Math.PI * 2; return [x + Math.cos(angle) * 5, y + Math.sin(angle) * 5] as PencilPoint; });
          pencilStroke(context, marker, resolvedColor, strokeWidth * 0.9, seedToNumber(`radar-marker-${String(item.id)}-${pointIndex}`), roughness, 2, true, { variation: 0.78, breaks: 0.24, grain: 0.7, gain: 2.1, step: 0.55 });
          void pointIndex;
        });
      });
      lastPaint = key;
      canvas.dataset.ready = 'true';
      if (!disposed) setReady(current => current ? current : true);
      } catch {
        lastPaint = '';
        delete canvas.dataset.ready;
        setReady(false);
        canvas.width = 1;
        canvas.height = 1;
        canvas.getContext('2d')?.clearRect(0, 0, 1, 1);
      }
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(paint);
    const inheritedStyle = new MutationObserver(paint);
    for (let node: HTMLElement | null = canvas; node; node = node.parentElement) inheritedStyle.observe(node, { attributes: true, attributeFilter: ['style', 'class', 'dir', 'data-theme', 'data-inkra-theme'] });
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', paint);
    const stopRecovery = observeCanvasRecovery(() => { lastPaint = ''; delete canvas.dataset.ready; paint(); });
    observer?.observe(canvas);
    paint();
    return () => { disposed = true; observer?.disconnect(); inheritedStyle.disconnect(); scheme.removeEventListener('change', paint); stopRecovery(); };
  }, [axes, axisAngles, center, levels, radius, seriesPoints]);
  return <canvas aria-hidden="true" className="inkra-radar__ink" data-ready={ready || undefined} ref={canvasRef} />;
}

const palette = ['#4b96aa', '#994f3f', '#629568', '#8d6b9c', '#c58b47'] as const;

function keyPart(value: RadarKey) { return JSON.stringify([typeof value, value]); }
function sameKey(a: RadarKey | null | undefined, b: RadarKey | null | undefined) { return a != null && b != null && a === b; }
function axisText(axis: RadarAxis) { return axis.ariaLabel ?? (typeof axis.label === 'string' || typeof axis.label === 'number' ? String(axis.label) : String(axis.id)); }
function cssSize(value: number | string | undefined, fallback: string) {
  if (typeof value === 'number') return Number.isFinite(value) ? `${Math.max(220, value)}px` : fallback;
  return value || fallback;
}
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function formatNumber(value: number, axis: RadarAxis, getValueLabel?: (value: number, axis: RadarAxis) => string) {
  return axis.formatValue?.(value) ?? getValueLabel?.(value, axis) ?? String(value);
}
function textNode(value: ReactNode, seed: string) {
  return typeof value === 'string' || typeof value === 'number' ? <PencilText seed={seed}>{String(value)}</PencilText> : value;
}
function domainForAxis(axis: RadarAxis, values: number[]): [number, number] {
  let min = finite(axis.min) ? axis.min : values.length ? Math.min(...values) : 0;
  let max = finite(axis.max) ? axis.max : values.length ? Math.max(...values) : 1;
  if (min > max) [min, max] = [max, min];
  if (min === max) {
    const pad = Math.abs(min) * 0.5 || 1;
    return [min - pad, max + pad];
  }
  return [min, max];
}
function paintStyle(color: string) {
  return { '--inkra-accent': color, '--inkra-accent-soft': color, '--inkra-accent-strong': color } as CSSProperties;
}

export const Radar = forwardRef<HTMLDivElement, RadarProps>(function Radar({
  axes,
  series,
  label,
  description,
  size = 'min(100%, 34rem)',
  maxRadius,
  levels = 4,
  showAxes = true,
  showLabels = true,
  showLegend = true,
  showValues = true,
  showTable = true,
  legendLabel = 'Series',
  missingLabel = 'Missing',
  emptyMessage = 'No radar data',
  selectedSeries,
  defaultSelectedSeries = null,
  onSelectedSeriesChange,
  renderAxisLabel,
  renderValueLabel,
  getValueLabel,
  className,
  style,
  ...props
}, forwardedRef) {
  const id = useId();
  const labelId = `inkra-radar-${id}-label`;
  const descriptionId = description == null ? undefined : `inkra-radar-${id}-description`;
  const [internalSelected, setInternalSelected] = useState<RadarKey | null>(defaultSelectedSeries);
  const selected = selectedSeries === undefined ? internalSelected : selectedSeries ?? null;
  const visibleSeries = series.filter(item => !item.hidden);
  const domains = useMemo(() => new Map(axes.map(axis => {
    const values = visibleSeries.flatMap(item => item.data.filter(point => point.axisId === axis.id && finite(point.value)).map(point => point.value as number));
    return [keyPart(axis.id), domainForAxis(axis, values)] as const;
  })), [axes, visibleSeries]);
  const side = 1000;
  const radius = Math.max(120, Math.min(maxRadius ?? 390, 470));
  const axisCount = axes.length;
  const angles = axes.map((_, index) => (index * Math.PI * 2) / Math.max(1, axisCount));
  const center = side / 2;
  const valuePoints = (item: RadarSeries): Point[] => axes.map((axis, index) => {
    const point = item.data.find(candidate => candidate.axisId === axis.id) ?? { axisId: axis.id, value: null };
    const domain = domains.get(keyPart(axis.id)) ?? [0, 1];
    const value = finite(point.value) ? point.value : null;
    const scale = scaleLinear().domain(domain).range([0, radius]).clamp(true);
    return { angle: angles[index], radius: value == null ? 0 : scale(value), value, point, axis };
  });
  const line = useMemo(() => lineRadial<Point>().angle(point => point.angle).radius(point => point.radius).curve(curveLinearClosed), []);
  const rootStyle = { ...style, '--inkra-radar-size': cssSize(size, 'min(100%, 34rem)'), '--inkra-radar-levels': Math.max(2, Math.min(8, Math.round(levels))) } as CSSProperties;
  const selectSeries = (item: RadarSeries) => {
    const next = sameKey(selected, item.id) ? null : item.id;
    if (selectedSeries === undefined) setInternalSelected(next);
    onSelectedSeriesChange?.(next, next == null ? null : item);
  };
  const renderValue = (context: RadarValueContext) => {
    if (renderValueLabel) return renderValueLabel(context);
    return context.missing ? missingLabel : showValues ? formatNumber(context.value as number, context.axis, getValueLabel) : '•';
  };

  return <div {...props} ref={forwardedRef} className={['inkra-radar', className].filter(Boolean).join(' ')} style={rootStyle}>
    <div className="inkra-radar__heading">
      <div className="inkra-radar__label" id={labelId}>{typeof label === 'string' ? <PencilText seed={`${id}-label`}>{label}</PencilText> : label}</div>
      {description == null ? null : <div className="inkra-radar__description" id={descriptionId}>{textNode(description, `${id}-description`)}</div>}
    </div>
    {axes.length < 3 || visibleSeries.length === 0 ? <div className="inkra-radar__empty">{textNode(emptyMessage, `${id}-empty`)}</div> : <>
      <div className="inkra-radar__viewport">
        <RadarInk axisAngles={angles} axes={showAxes ? axes : []} center={center} levels={Math.max(2, Math.min(8, Math.round(levels)))} radius={radius} seriesPoints={visibleSeries.map((item, index) => ({ item, points: valuePoints(item), color: item.color ?? palette[index % palette.length], index }))} />
        <svg aria-hidden="true" className="inkra-radar__svg-fallback" viewBox={`0 0 ${side} ${side}`} focusable="false" role="presentation">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth="1" />
          {visibleSeries.map(item => <path d={line(valuePoints(item)) ?? undefined} key={keyPart(item.id)} transform={`translate(${center} ${center})`} />)}
        </svg>
        {showLabels ? <div aria-hidden="true" className="inkra-radar__labels">{axes.map((axis, index) => {
          const x = 50 + Math.sin(angles[index]) * 48;
          const y = 50 - Math.cos(angles[index]) * 48;
          return <span className="inkra-radar__axis-label" key={keyPart(axis.id)} style={{ left: `${x}%`, top: `${y}%` }}>{renderAxisLabel ? renderAxisLabel(axis) : textNode(axis.label, `${id}-axis-${String(axis.id)}`)}</span>;
        })}</div> : null}
      </div>
      <div aria-describedby={descriptionId} aria-labelledby={labelId} className="inkra-radar__summary" role="group">
        {visibleSeries.map((item, index) => {
          const points = valuePoints(item);
          const color = item.color ?? palette[index % palette.length];
          return <div className="inkra-radar__series-summary" key={keyPart(item.id)} data-series-id={item.id}>
            <Button aria-pressed={sameKey(selected, item.id)} className="inkra-radar__legend-button" onClick={() => selectSeries(item)} size="sm" variant="ghost">
              <PencilSurface aria-hidden="true" as="span" className="inkra-radar__legend-mark" radius={4} seed={`radar-${keyPart(item.id)}`} style={paintStyle(color)} variant={sameKey(selected, item.id) ? 'selection' : 'quiet'} />
              {textNode(item.label, `${id}-summary-${String(item.id)}`)}
            </Button>
            <div className="inkra-radar__values">{points.map((point, pointIndex) => {
              const context: RadarValueContext = { axis: point.axis, series: item, point: point.point, value: point.value, missing: point.value == null };
              return <span className="inkra-radar__value" data-missing={context.missing || undefined} key={pointIndex}><strong>{textNode(point.axis.label, `${id}-value-axis-${String(point.axis.id)}`)}</strong> {textNode(renderValue(context), `${id}-value-${String(item.id)}-${String(point.axis.id)}`)}</span>;
            })}</div>
          </div>;
        })}
      </div>
      {showLegend ? <div aria-label={typeof legendLabel === 'string' ? legendLabel : undefined} className="inkra-radar__legend" role="group"><span className="inkra-radar__legend-title">{textNode(legendLabel, `${id}-legend-title`)}</span>{visibleSeries.map((item, index) => <Button aria-pressed={sameKey(selected, item.id)} className="inkra-radar__legend-button" key={keyPart(item.id)} onClick={() => selectSeries(item)} size="sm" variant="ghost"><PencilSurface aria-hidden="true" as="span" className="inkra-radar__legend-mark" radius={4} seed={`radar-legend-${keyPart(item.id)}`} style={paintStyle(item.color ?? palette[index % palette.length])} variant={sameKey(selected, item.id) ? 'selection' : 'quiet'} />{textNode(item.label, `${id}-legend-${String(item.id)}`)}</Button>)}</div> : null}
      {showTable ? <Table.Container aria-label={typeof label === 'string' ? label : undefined} aria-describedby={descriptionId}><Table.Root className="inkra-radar__table"><Table.Caption>{textNode('Radar data', `${id}-table-caption`)}</Table.Caption><Table.Header><Table.Row><Table.Head>{textNode('Series', `${id}-table-series`)}</Table.Head>{axes.map(axis => <Table.Head key={keyPart(axis.id)}>{textNode(axis.label, `${id}-table-axis-${String(axis.id)}`)}</Table.Head>)}</Table.Row></Table.Header><Table.Body>{visibleSeries.map(item => <Table.Row key={keyPart(item.id)}><Table.Head scope="row">{textNode(item.label, `${id}-table-series-${String(item.id)}`)}</Table.Head>{axes.map(axis => { const point = item.data.find(candidate => candidate.axisId === axis.id); const missing = !finite(point?.value); return <Table.Cell data-missing={missing || undefined} key={keyPart(axis.id)}>{textNode(missing ? missingLabel : formatNumber(point?.value as number, axis, getValueLabel), `${id}-table-value-${String(item.id)}-${String(axis.id)}`)}</Table.Cell>; })}</Table.Row>)}</Table.Body></Table.Root></Table.Container> : null}
    </>}
  </div>;
});
