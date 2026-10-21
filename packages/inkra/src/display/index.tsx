import { forwardRef, useId } from 'react';
import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
} from 'react';

import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';

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
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { className, seed = 'inkra-skeleton', radius, ...props },
  ref,
) {
  return (
    <PencilSurface<'div'>
      {...props}
      aria-hidden="true"
      as="div"
      className={['inkra-skeleton', className].filter(Boolean).join(' ')}
      ref={ref}
      seed={seed}
      radius={radius}
      variant="quiet"
    />
  );
});

export interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  value: number | null;
  max?: number;
  label?: ReactNode;
  seed?: string | number;
  size?: 'sm' | 'md' | 'lg';
}

type ProgressStyle = CSSProperties & { '--inkra-progress-value'?: string };

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
  const resolvedStyle: ProgressStyle = {
    ...style,
    '--inkra-progress-value': `${percent ?? 36}%`,
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
      <span aria-hidden="true" className="inkra-progress__track">
        <PencilSurface
          as="span"
          className="inkra-progress__outline"
          radius={6}
          seed={`${resolvedSeed}-outline`}
          variant="outline"
        />
        <span
          className="inkra-progress__fill-clip"
        >
          <PencilSurface
            as="span"
            className="inkra-progress__fill"
            radius={6}
            seed={`${resolvedSeed}-fill`}
            variant="selection"
          />
        </span>
      </span>
    </div>
  );
});
