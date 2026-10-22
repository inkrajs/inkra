import { scaleLinear } from 'd3-scale';
import { area, line } from 'd3-shape';

export type SparklineDatum = number | null | undefined;
export type SparklinePoint = { index: number; value: number | null };
export type SparklineScale = (value: number | { valueOf(): number }) => number;

export function normalizeSparklineData(data: readonly SparklineDatum[]): SparklinePoint[] {
  return data.map((value, index) => ({ index, value: typeof value === 'number' && Number.isFinite(value) ? value : null }));
}

export function sparklineDomain(points: readonly SparklinePoint[]): [number, number] {
  const values = points.flatMap(point => point.value === null ? [] : [point.value]);
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const pad = Math.abs(min) * 0.12 || 1;
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.08;
  return [min - pad, max + pad];
}

export function createSparklineGeometry(
  points: readonly SparklinePoint[],
  width: number,
  height: number,
  padding = 4,
): { x: SparklineScale; y: SparklineScale; linePath: string; areaPath: string } {
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);
  const x = scaleLinear().domain([0, Math.max(1, points.length - 1)]).range([padding, padding + innerWidth]);
  const y = scaleLinear().domain(sparklineDomain(points)).range([padding + innerHeight, padding]);
  const defined = (point: SparklinePoint): point is SparklinePoint & { value: number } => point.value !== null;
  const linePath = line<SparklinePoint>().defined(defined).x(point => x(point.index)).y(point => y(point.value!));
  const areaPath = area<SparklinePoint>().defined(defined).x(point => x(point.index)).y0(padding + innerHeight).y1(point => y(point.value!));
  return { x, y, linePath: linePath(points) ?? '', areaPath: areaPath(points) ?? '' };
}

