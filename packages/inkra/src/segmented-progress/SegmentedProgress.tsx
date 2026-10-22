import type { CSSProperties } from 'react';

import { PencilSurface } from '../PencilSurface.js';

export type ProgressPartialSegment = 'fractional' | 'complete' | 'next';

export interface ProgressThreshold {
  value: number;
  color: string;
}

interface SegmentedProgressProps {
  count: number;
  gap: number;
  max: number;
  partialSegment: ProgressPartialSegment;
  percent: number | null;
  seed: string | number;
  segmentColors?: readonly string[];
  thresholds?: readonly ProgressThreshold[];
}

type SegmentStyle = CSSProperties & {
  '--inkra-progress-segment-fill': string;
  '--inkra-selection-pigment'?: string;
};

function segmentFill(
  index: number,
  count: number,
  percent: number | null,
  policy: ProgressPartialSegment,
): number {
  if (percent === null) return 1;
  const raw = percent / 100 * count - index;
  if (policy === 'complete') return raw >= 1 ? 1 : 0;
  if (policy === 'next') return raw > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, raw));
}

function thresholdColor(
  index: number,
  count: number,
  max: number,
  thresholds: readonly ProgressThreshold[] | undefined,
): string | undefined {
  if (!thresholds?.length) return undefined;
  const segmentValue = index / count * max;
  let color: string | undefined;
  for (const threshold of thresholds) {
    if (!Number.isFinite(threshold.value) || !threshold.color || threshold.value > segmentValue) continue;
    color = threshold.color;
  }
  return color;
}

export function SegmentedProgress({
  count,
  gap,
  max,
  partialSegment,
  percent,
  seed,
  segmentColors,
  thresholds,
}: SegmentedProgressProps) {
  const normalizedThresholds = thresholds
    ?.filter(threshold => Number.isFinite(threshold.value) && threshold.color)
    .map(threshold => ({ ...threshold, value: Math.max(0, Math.min(max, threshold.value)) }))
    .sort((left, right) => left.value - right.value);

  return (
    <span
      aria-hidden="true"
      className="inkra-progress__segments"
      style={{
        '--inkra-progress-segment-count': count,
        '--inkra-progress-segment-gap': `${gap}px`,
      } as CSSProperties}
    >
      {Array.from({ length: count }, (_, index) => {
        const fill = segmentFill(index, count, percent, partialSegment);
        const color = segmentColors?.[index] || thresholdColor(index, count, max, normalizedThresholds);
        const style: SegmentStyle = {
          '--inkra-progress-segment-fill': `${fill * 100}%`,
          ...(color ? { '--inkra-selection-pigment': color } : {}),
        };
        return (
          <span className="inkra-progress__segment" data-fill={fill === 0 ? 'empty' : fill === 1 ? 'full' : 'partial'} key={index}>
            <PencilSurface
              as="span"
              className="inkra-progress__segment-outline"
              radius={3}
              seed={`${seed}-segment-${index}-outline`}
              variant="outline"
            />
            <span className="inkra-progress__segment-fill-clip" style={style}>
              <PencilSurface
                as="span"
                className="inkra-progress__segment-fill"
                radius={3}
                seed={`${seed}-segment-${index}-fill`}
                variant="selection"
              />
            </span>
          </span>
        );
      })}
    </span>
  );
}
