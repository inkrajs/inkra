import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { forwardRef, useId } from 'react';
import type { ComponentRef } from 'react';

import { mapPortalChildren, PortalThemeProvider, usePortalThemeProps, usePortalTriggerRef } from '../overlay/themeBridge.js';
import { PencilSurface } from '../PencilSurface.js';
import type { PencilSurfaceVariant } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';

function classes(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export type TooltipProviderProps = TooltipPrimitive.TooltipProviderProps;
export const TooltipProvider = TooltipPrimitive.Provider;

export type TooltipRootProps = TooltipPrimitive.TooltipProps;

export function TooltipRoot(props: TooltipRootProps) {
  return (
    <PortalThemeProvider>
      <TooltipPrimitive.Root {...props} />
    </PortalThemeProvider>
  );
}

export type TooltipTriggerProps = TooltipPrimitive.TooltipTriggerProps;

export const TooltipTrigger = forwardRef<
  ComponentRef<typeof TooltipPrimitive.Trigger>,
  TooltipTriggerProps
>(function TooltipTrigger(props, forwardedRef) {
  const ref = usePortalTriggerRef(forwardedRef);
  return <TooltipPrimitive.Trigger {...props} ref={ref} />;
});

export type TooltipPortalProps = TooltipPrimitive.TooltipPortalProps;

export function TooltipPortal({ children, ...props }: TooltipPortalProps) {
  return mapPortalChildren(children, child => <TooltipPrimitive.Portal {...props}>{child}</TooltipPrimitive.Portal>);
}

export interface TooltipContentProps extends TooltipPrimitive.TooltipContentProps {
  seed?: string | number;
  surfaceClassName?: string;
  surfaceRadius?: number;
  surfaceVariant?: PencilSurfaceVariant;
}

export const TooltipContent = forwardRef<
  ComponentRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(function TooltipContent(
  {
    children,
    className,
    collisionPadding = 8,
    seed,
    sideOffset = 6,
    surfaceClassName,
    surfaceRadius = 6,
    surfaceVariant = 'paper',
    ...props
  },
  ref,
) {
  const generatedId = useId();
  props = usePortalThemeProps(props);
  const resolvedSeed = seed ?? `inkra-tooltip-${generatedId}`;

  return (
    <TooltipPrimitive.Content
      {...props}
      className={classes('inkra-tooltip__content', className)}
      collisionPadding={collisionPadding}
      ref={ref}
      sideOffset={sideOffset}
    >
      <PencilSurface
        className={classes('inkra-tooltip__surface', surfaceClassName)}
        radius={surfaceRadius}
        seed={resolvedSeed}
        variant={surfaceVariant}
      >
        <div className="inkra-tooltip__content-body">
          {typeof children === 'string' ? (
            <PencilText seed={`${resolvedSeed}-text`}>{children}</PencilText>
          ) : children}
        </div>
      </PencilSurface>
    </TooltipPrimitive.Content>
  );
});

export const Tooltip = /* @__PURE__ */ Object.freeze({
  Provider: TooltipProvider,
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Portal: TooltipPortal,
  Content: TooltipContent,
});
