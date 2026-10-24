import { forwardRef } from 'react';
import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  ElementType,
  HTMLAttributes,
  ReactNode,
} from 'react';

import { PencilText } from '../PencilText.js';
import { PencilIcon } from '../PencilIcon.js';
import type { PencilIconPath } from '../PencilIcon.js';
import { emptyIllustrations } from './illustrations.js';
import type { EmptyIllustration } from './illustrations.js';

export type { EmptyIllustration } from './illustrations.js';

function classes(base: string, className?: string) {
  return [base, className].filter(Boolean).join(' ');
}

export interface EmptyRootProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  align?: 'start' | 'center';
}

const Root = forwardRef<HTMLDivElement, EmptyRootProps>(function EmptyRoot(
  { align = 'center', className, size = 'md', ...props },
  ref,
) {
  return (
    <div
      {...props}
      className={classes('inkra-empty', className)}
      data-align={align}
      data-size={size}
      ref={ref}
    />
  );
});

export interface EmptyIconProps extends HTMLAttributes<HTMLDivElement> {
  decorative?: boolean;
  /** Built-in illustration used when children are omitted. */
  illustration?: EmptyIllustration;
  /** Illustration size in CSS pixels; constrained by available width. */
  size?: number;
}

function IllustrationLayer({ paths, accent }: { paths: readonly PencilIconPath[]; accent?: boolean }) {
  return <span className={classes('inkra-empty__illustration-layer', accent ? 'inkra-empty__illustration-layer--accent' : undefined)}>
    <PencilIcon paths={paths} size={192} sourceSize={40} decorative />
    <svg aria-hidden="true" focusable="false" viewBox="0 0 40 40" className="inkra-empty__illustration-fallback">
      {paths.map((path, index) => <path key={index} d={path.d} fill={path.mode === 'wash' ? 'currentColor' : 'none'} fillOpacity={0.12} stroke={path.mode === 'wash' ? 'none' : 'currentColor'} strokeWidth={0.5} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  </span>;
}

const Icon = forwardRef<HTMLDivElement, EmptyIconProps>(function EmptyIcon(
  { children, className, decorative = true, illustration = 'inbox', size, style, ...props },
  ref,
) {
  const builtIn = children === undefined;
  const drawing = emptyIllustrations[illustration] ?? emptyIllustrations.inbox;
  const resolvedSize = typeof size === 'number' && Number.isFinite(size) && size > 0 ? size : undefined;
  return (
    <div
      {...props}
      aria-hidden={decorative || undefined}
      role={props.role ?? (!decorative && builtIn ? 'img' : undefined)}
      className={classes('inkra-empty__icon', className)}
      data-illustration={builtIn ? illustration : undefined}
      ref={ref}
      style={{ '--inkra-empty-icon-size': resolvedSize === undefined ? undefined : `${resolvedSize}px`, ...style } as CSSProperties}
    >
      {builtIn ? <span className="inkra-empty__illustration" aria-hidden="true">
        <IllustrationLayer paths={drawing.accent} accent />
        <IllustrationLayer paths={drawing.ink} />
      </span> : children}
    </div>
  );
});

type EmptyTitleProps<Element extends ElementType = 'h3'> = {
  as?: Element;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<Element>, 'as' | 'children'>;

function Title<Element extends ElementType = 'h3'>({
  as,
  children,
  className,
  ...props
}: EmptyTitleProps<Element>) {
  const Element = as ?? 'h3';
  return (
    <Element {...props} className={classes('inkra-empty__title', className)}>
      {typeof children === 'string' ? <PencilText>{children}</PencilText> : children}
    </Element>
  );
}

const Description = forwardRef<HTMLParagraphElement, ComponentPropsWithoutRef<'p'>>(
  function EmptyDescription({ children, className, ...props }, ref) {
    return (
      <p {...props} className={classes('inkra-empty__description', className)} ref={ref}>
        {typeof children === 'string' ? <PencilText>{children}</PencilText> : children}
      </p>
    );
  },
);

const Actions = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function EmptyActions(
  { className, ...props },
  ref,
) {
  return <div {...props} className={classes('inkra-empty__actions', className)} ref={ref} />;
});

export const Empty = { Root, Icon, Title, Description, Actions };
