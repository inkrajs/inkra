import { forwardRef } from 'react';
import type {
  ComponentPropsWithoutRef,
  ElementType,
  HTMLAttributes,
  ReactNode,
} from 'react';

import { PencilText } from '../PencilText.js';

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
}

const Icon = forwardRef<HTMLDivElement, EmptyIconProps>(function EmptyIcon(
  { className, decorative = true, ...props },
  ref,
) {
  return (
    <div
      {...props}
      aria-hidden={decorative || undefined}
      className={classes('inkra-empty__icon', className)}
      ref={ref}
    />
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
