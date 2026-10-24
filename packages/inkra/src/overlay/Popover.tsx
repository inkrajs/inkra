import * as PopoverPrimitive from '@radix-ui/react-popover';
import { forwardRef, useId } from 'react';
import type { ComponentPropsWithoutRef, ComponentRef } from 'react';

import { PencilSurface } from '../PencilSurface.js';
import type { PencilSurfaceVariant } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import {
  mapPortalChildren,
  PortalThemeProvider,
  usePortalThemeProps,
  usePortalTriggerRef,
} from './themeBridge.js';

function classes(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export type PopoverRootProps = PopoverPrimitive.PopoverProps;

export function PopoverRoot(props: PopoverRootProps) {
  return (
    <PortalThemeProvider>
      <PopoverPrimitive.Root {...props} />
    </PortalThemeProvider>
  );
}

export type PopoverAnchorProps = PopoverPrimitive.PopoverAnchorProps;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export type PopoverTriggerProps = PopoverPrimitive.PopoverTriggerProps;

export const PopoverTrigger = forwardRef<
  ComponentRef<typeof PopoverPrimitive.Trigger>,
  PopoverTriggerProps
>(function PopoverTrigger(props, forwardedRef) {
  const ref = usePortalTriggerRef(forwardedRef);
  return <PopoverPrimitive.Trigger {...props} ref={ref} />;
});

export type PopoverPortalProps = PopoverPrimitive.PopoverPortalProps;

export function PopoverPortal({ children, ...props }: PopoverPortalProps) {
  return mapPortalChildren(children, child => <PopoverPrimitive.Portal {...props}>{child}</PopoverPrimitive.Portal>);
}

export interface PopoverContentProps extends PopoverPrimitive.PopoverContentProps {
  arrowProps?: PopoverArrowProps;
  seed?: string | number;
  showArrow?: boolean;
  surfaceVariant?: PencilSurfaceVariant;
  surfaceRadius?: number;
  surfaceClassName?: string;
}

export const PopoverContent = forwardRef<
  ComponentRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(function PopoverContent(
  {
    arrowProps,
    children,
    className,
    collisionPadding = 12,
    seed,
    showArrow = false,
    surfaceClassName,
    surfaceRadius = 8,
    surfaceVariant = 'paper',
    ...props
  },
  ref,
) {
  const id = useId();
  props = usePortalThemeProps(props);
  return (
    <PopoverPrimitive.Content
      {...props}
      className={classes('inkra-popover__content', className)}
      collisionPadding={collisionPadding}
      ref={ref}
    >
      <PencilSurface
        className={classes('inkra-popover__surface', surfaceClassName)}
        radius={surfaceRadius}
        seed={seed ?? `inkra-popover-${id}`}
        variant={surfaceVariant}
      >
        <div className="inkra-popover__content-body">{children}</div>
      </PencilSurface>
      {showArrow ? (
        <PopoverPrimitive.Arrow
          {...arrowProps}
          className={classes('inkra-popover__arrow', arrowProps?.className)}
        />
      ) : null}
    </PopoverPrimitive.Content>
  );
});

export interface PopoverTitleProps extends Omit<
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Title>,
  'children'
> {
  children: string;
  seed?: string | number;
}

export const PopoverTitle = forwardRef<
  ComponentRef<typeof PopoverPrimitive.Title>,
  PopoverTitleProps
>(function PopoverTitle({ children, className, seed, ...props }, ref) {
  const id = useId();
  return (
    <PopoverPrimitive.Title
      {...props}
      className={classes('inkra-popover__title', className)}
      ref={ref}
    >
      <PencilText seed={seed ?? `inkra-popover-title-${id}`}>{children}</PencilText>
    </PopoverPrimitive.Title>
  );
});

export interface PopoverDescriptionProps extends Omit<
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Description>,
  'children'
> {
  children: string;
  seed?: string | number;
}

export const PopoverDescription = forwardRef<
  ComponentRef<typeof PopoverPrimitive.Description>,
  PopoverDescriptionProps
>(function PopoverDescription({ children, className, seed, ...props }, ref) {
  const id = useId();
  return (
    <PopoverPrimitive.Description
      {...props}
      className={classes('inkra-popover__description', className)}
      ref={ref}
    >
      <PencilText seed={seed ?? `inkra-popover-description-${id}`}>{children}</PencilText>
    </PopoverPrimitive.Description>
  );
});

export type PopoverCloseProps = ComponentPropsWithoutRef<typeof PopoverPrimitive.Close>;

export const PopoverClose = forwardRef<
  ComponentRef<typeof PopoverPrimitive.Close>,
  PopoverCloseProps
>(function PopoverClose(props, ref) {
  return <PopoverPrimitive.Close {...props} ref={ref} />;
});

export type PopoverArrowProps = ComponentPropsWithoutRef<typeof PopoverPrimitive.Arrow>;

export const Popover = /* @__PURE__ */ Object.freeze({
  Root: PopoverRoot,
  Anchor: PopoverAnchor,
  Trigger: PopoverTrigger,
  Portal: PopoverPortal,
  Content: PopoverContent,
  Title: PopoverTitle,
  Description: PopoverDescription,
  Close: PopoverClose,
});
