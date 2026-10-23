import { forwardRef, useId } from 'react';
import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
} from 'react';

import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import {
  SegmentedProgress,
  type ProgressPartialSegment,
  type ProgressThreshold,
} from '../segmented-progress/SegmentedProgress.js';
import { ProgressRing } from './ProgressRing.js';
export type { ProgressPartialSegment, ProgressThreshold } from '../segmented-progress/SegmentedProgress.js';

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

type TokenStyle = CSSProperties & Record<`--inkra-${string}`, string>;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  seed?: string | number;
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

const badgeTokens: Record<BadgeVariant, { foreground: string; pigment: string }> = {
  neutral: { foreground: 'ink-muted', pigment: 'surface-muted' },
  accent: { foreground: 'accent-strong', pigment: 'accent-soft' },
  success: { foreground: 'success-foreground', pigment: 'success-pigment' },
  warning: { foreground: 'warning-foreground', pigment: 'warning-pigment' },
  danger: { foreground: 'danger-foreground', pigment: 'danger-pigment' },
  info: { foreground: 'info-foreground', pigment: 'info-pigment' },
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  {
    children,
    className,
    seed,
    style,
    variant = 'neutral',
    size = 'md', startIcon, endIcon,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const tokens = badgeTokens[variant];
  const resolvedStyle: TokenStyle = {
    ...style,
    color: `var(--inkra-${tokens.foreground})`,
    '--inkra-coral-soft': `var(--inkra-${tokens.pigment})`,
    '--inkra-border-strong': `var(--inkra-${tokens.foreground})`,
  };

  return (
    <PencilSurface<'span'>
      {...props}
      as="span"
      className={['inkra-badge', className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-size={size}
      radius={6}
      ref={ref}
      seed={seed ?? `inkra-badge-${generatedId}`}
      style={resolvedStyle}
      variant="badge"
    >
      {startIcon && <span className="inkra-badge__icon" aria-hidden="true">{startIcon}</span>}
      {typeof children === 'string' ? (
        <PencilText seed={`${seed ?? `inkra-badge-${generatedId}`}-label`}>{children}</PencilText>
      ) : children}
      {endIcon && <span className="inkra-badge__icon" aria-hidden="true">{endIcon}</span>}
    </PencilSurface>
  );
});

export type SeparatorOrientation = 'horizontal' | 'vertical';

export interface SeparatorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  weight?: number;
  decorative?: boolean;
  orientation?: SeparatorOrientation;
  seed?: string | number;
}

export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(function Separator(
  {
    className,
    decorative = false,
    orientation = 'horizontal',
    weight = 0.9,
    seed,
    ...props
  },
  ref,
) {
  const semanticProps = decorative
    ? { 'aria-hidden': true as const }
    : { 'aria-orientation': orientation, role: 'separator' as const };

  return (
    <div
      {...props}
      {...semanticProps}
      className={['inkra-separator', className].filter(Boolean).join(' ')}
      data-orientation={orientation}
      ref={ref}
    >
      <PencilLine
        className="inkra-separator__line"
        orientation={orientation}
        seed={seed ?? `inkra-separator-${orientation}`}
        weight={Number.isFinite(weight) ? Math.max(0.3, Math.min(2, weight)) : 0.9}
      />
    </div>
  );
});

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  seed?: string | number;
  radius?: number;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  animation?: 'none' | 'pulse';
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { className, seed = 'inkra-skeleton', radius, width, height, animation = 'none', style, ...props },
  ref,
) {
  return (
    <PencilSurface<'div'>
      {...props}
      aria-hidden="true"
      as="div"
      className={['inkra-skeleton', className].filter(Boolean).join(' ')}
      data-animation={animation}
      style={{ width, height, ...style }}
      ref={ref}
      seed={seed}
      radius={radius}
      variant="quiet"
    />
  );
});

export interface ProgressRenderState {
  value: number | null;
  max: number;
  percent: number | null;
}

export type ProgressContentPosition = 'center' | 'top' | 'bottom' | 'start' | 'end';

export interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  value: number | null;
  max?: number;
  label?: ReactNode;
  seed?: string | number;
  size?: 'sm' | 'md' | 'lg';
  shape?: 'linear' | 'circular' | 'segmented';
  /** Circular diameter in CSS pixels, clamped to 32-512. */
  diameter?: number;
  /** Circular stroke width, clamped to 1-diameter/8. */
  thickness?: number;
  /** Segmented cell count, clamped to 1-64. */
  segmentCount?: number;
  /** Segmented gap in CSS pixels, clamped to 0-24. */
  segmentGap?: number;
  /** How the active partial cell is represented. */
  partialSegment?: ProgressPartialSegment;
  /** Pigment ranges expressed in the same value units as max. */
  thresholds?: readonly ProgressThreshold[];
  /** Per-cell pigment overrides by zero-based segment index. */
  segmentColors?: readonly string[];
  /** Defaults to center for circular, end otherwise. Center maps to end for non-circular shapes. */
  contentPosition?: ProgressContentPosition;
  /** Non-interactive content; render state contains normalized values. */
  children?: ReactNode | ((state: ProgressRenderState) => ReactNode);
}

type ProgressStyle = CSSProperties & Record<`--inkra-progress-${string}`, string>;

function normalizeMax(max: number | undefined): number {
  return typeof max === 'number' && Number.isFinite(max) && max > 0 ? max : 100;
}

function normalizeValue(value: number | null, max: number): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  {
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    className,
    label,
    max,
    seed,
    style,
    value,
    size = 'md',
    shape = 'linear',
    diameter,
    thickness,
    segmentCount,
    segmentGap,
    partialSegment = 'fractional',
    thresholds,
    segmentColors,
    contentPosition,
    children,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const labelId = `inkra-progress-${generatedId}-label`;
  const resolvedMax = normalizeMax(max);
  const resolvedValue = normalizeValue(value, resolvedMax);
  const percent = resolvedValue === null ? null : resolvedValue / resolvedMax * 100;
  const resolvedLabelledBy = ariaLabel == null && ariaLabelledBy == null && label != null
    ? labelId
    : ariaLabelledBy;
  const resolvedSeed = seed ?? `inkra-progress-${generatedId}`;
  const resolvedDiameter = typeof diameter === 'number' && Number.isFinite(diameter)
    ? Math.max(32, Math.min(512, diameter)) : { sm: 64, md: 96, lg: 128 }[size];
  const resolvedThickness = Math.min(resolvedDiameter / 8, Math.max(1,
    typeof thickness === 'number' && Number.isFinite(thickness) ? thickness : { sm: 4, md: 6, lg: 8 }[size]));
  const resolvedSegmentCount = typeof segmentCount === 'number' && Number.isFinite(segmentCount)
    ? Math.max(1, Math.min(64, Math.round(segmentCount))) : 10;
  const resolvedSegmentGap = typeof segmentGap === 'number' && Number.isFinite(segmentGap)
    ? Math.max(0, Math.min(24, segmentGap)) : { sm: 2, md: 3, lg: 4 }[size];
  const position = contentPosition ?? (shape === 'circular' ? 'center' : 'end');
  const content = typeof children === 'function' ? children({ value: resolvedValue, max: resolvedMax, percent }) : children;
  const resolvedStyle: ProgressStyle = {
    ...style,
    '--inkra-progress-value': `${percent ?? 36}%`,
    ...(shape === 'circular' ? {
      '--inkra-progress-angle': `${(percent ?? 28) * 3.6}deg`,
      '--inkra-progress-diameter': `${resolvedDiameter}px`,
      '--inkra-progress-content-inset': `${(resolvedThickness * 2 + 8) / resolvedDiameter * 100}%`,
    } : {}),
  };

  return (
    <div
      {...props}
      aria-label={ariaLabel}
      aria-labelledby={resolvedLabelledBy}
      aria-valuemax={resolvedMax}
      aria-valuemin={0}
      aria-valuenow={resolvedValue ?? undefined}
      className={['inkra-progress', className].filter(Boolean).join(' ')}
      data-state={resolvedValue === null ? 'indeterminate' : 'determinate'}
      data-value={resolvedValue ?? undefined}
      data-size={size}
      data-shape={shape}
      ref={ref}
      role="progressbar"
      style={resolvedStyle}
    >
      {label == null ? null : (
        typeof label === 'string' ? (
          <PencilText as="span" className="inkra-progress__label" id={labelId} seed={`${resolvedSeed}-label`}>
            {label}
          </PencilText>
        ) : <span className="inkra-progress__label" id={labelId}>{label}</span>
      )}
      <div className="inkra-progress__body" data-content-position={content == null ? undefined : shape !== 'circular' && position === 'center' ? 'end' : position}>
        {shape === 'circular' ? (
          <ProgressRing diameter={resolvedDiameter} thickness={resolvedThickness} percent={percent} seed={`${resolvedSeed}-ring`} />
        ) : shape === 'segmented' ? (
          <SegmentedProgress
            count={resolvedSegmentCount}
            gap={resolvedSegmentGap}
            max={resolvedMax}
            partialSegment={partialSegment}
            percent={percent}
            seed={`${resolvedSeed}-segments`}
            segmentColors={segmentColors}
            thresholds={thresholds}
          />
        ) : (
          <span aria-hidden="true" className="inkra-progress__track">
            <PencilSurface
              as="span"
              className="inkra-progress__outline"
              radius={6}
              seed={`${resolvedSeed}-outline`}
              variant="outline"
            />
            <span className="inkra-progress__fill-clip">
              <PencilSurface
                as="span"
                className="inkra-progress__fill"
                radius={6}
                seed={`${resolvedSeed}-fill`}
                variant="selection"
              />
            </span>
          </span>
        )}
        {content != null && <div className="inkra-progress__content">
          {typeof content === 'string' || typeof content === 'number' ? <PencilText>{String(content)}</PencilText> : content}
        </div>}
      </div>
    </div>
  );
});
