import { forwardRef, useId } from 'react';
import type {
  ButtonHTMLAttributes,
  ForwardedRef,
  HTMLAttributes,
  ReactNode,
} from 'react';

import { Badge } from '../display/index.js';
import { PencilSurface } from '../PencilSurface.js';

const classes = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ');

export type SlotSize = 'sm' | 'md' | 'lg';

interface SlotSharedProps {
  children?: ReactNode;
  /** Shows emptyContent instead of children while preserving the slot geometry. */
  empty?: boolean;
  emptyContent?: ReactNode;
  selected?: boolean;
  size?: SlotSize;
  count?: number;
  /** Replaces the default Badge while keeping the count anchored to the slot. */
  renderCount?: (count: number) => ReactNode;
  seed?: string | number;
}

export interface StaticSlotProps extends SlotSharedProps, Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  interactive?: false;
  disabled?: boolean;
}

export interface InteractiveSlotProps extends SlotSharedProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  interactive: true;
}

export type SlotProps = StaticSlotProps | InteractiveSlotProps;

export const Slot = forwardRef<HTMLDivElement | HTMLButtonElement, SlotProps>(function Slot(
  {
    children,
    className,
    count,
    disabled = false,
    empty = false,
    emptyContent,
    interactive = false,
    renderCount,
    seed,
    selected = false,
    size = 'md',
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const resolvedSeed = seed ?? `inkra-slot-${generatedId}`;
  const content = empty
    ? (emptyContent ?? <span className="inkra-slot__empty-mark" aria-hidden="true">+</span>)
    : children;
  const countContent = count == null
    ? null
    : renderCount?.(count) ?? <Badge size="sm" aria-label={`${count}`}>{count}</Badge>;
  const commonProps = {
    ...props,
    className: classes('inkra-slot', className),
    'data-disabled': disabled || undefined,
    'data-empty': empty || undefined,
    'data-interactive': interactive || undefined,
    'data-selected': selected || undefined,
    'data-size': size,
  };
  const body = <>
    {selected && <PencilSurface as="span" aria-hidden="true" className="inkra-slot__selected-wash" seed={`${resolvedSeed}-wash`} variant="selection" />}
    <span className="inkra-slot__content">{content}</span>
    {selected && <PencilSurface as="span" aria-hidden="true" className="inkra-slot__selected-outline" radius={8} seed={`${resolvedSeed}-outline`} variant="outline" />}
    {countContent != null && <span className="inkra-slot__count">{countContent}</span>}
  </>;

  if (interactive) {
    return <PencilSurface
      {...commonProps as ButtonHTMLAttributes<HTMLButtonElement>}
      as="button"
      aria-pressed={selected}
      disabled={disabled}
      radius={8}
      ref={ref as ForwardedRef<HTMLButtonElement>}
      seed={resolvedSeed}
      variant="paper"
    >{body}</PencilSurface>;
  }

  return <PencilSurface
    {...commonProps as HTMLAttributes<HTMLDivElement>}
    as="div"
    aria-disabled={disabled || undefined}
    radius={8}
    ref={ref as ForwardedRef<HTMLDivElement>}
    seed={resolvedSeed}
    variant="paper"
  >{body}</PencilSurface>;
});
