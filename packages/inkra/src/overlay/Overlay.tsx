import * as DialogPrimitive from '@radix-ui/react-dialog';
import { forwardRef, useId } from 'react';
import type { ComponentPropsWithoutRef, ComponentRef, ReactNode } from 'react';
import { __iconData as closeIcon } from 'lucide-react/dist/esm/icons/x.mjs';

import { Button } from '../Button.js';
import type { ButtonProps } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import type { PencilSurfaceVariant } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { Tooltip } from '../tooltip/Tooltip.js';
import {
  mapPortalChildren,
  PortalThemeProvider,
  usePortalThemeProps,
  usePortalTriggerRef,
} from './themeBridge.js';

function classes(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export type OverlayRootProps = DialogPrimitive.DialogProps;

export function OverlayRoot(props: OverlayRootProps) {
  return (
    <PortalThemeProvider>
      <DialogPrimitive.Root {...props} />
    </PortalThemeProvider>
  );
}

export type OverlayTriggerProps = DialogPrimitive.DialogTriggerProps;

export const OverlayTrigger = forwardRef<
  ComponentRef<typeof DialogPrimitive.Trigger>,
  OverlayTriggerProps
>(function OverlayTrigger(props, forwardedRef) {
  const ref = usePortalTriggerRef(forwardedRef);
  return <DialogPrimitive.Trigger {...props} ref={ref} />;
});

export type OverlayPortalProps = DialogPrimitive.DialogPortalProps;

export function OverlayPortal({ children, ...props }: OverlayPortalProps) {
  return mapPortalChildren(children, child => <DialogPrimitive.Portal {...props}>{child}</DialogPrimitive.Portal>);
}

export type OverlayBackdropProps = DialogPrimitive.DialogOverlayProps;

export const OverlayBackdrop = forwardRef<
  ComponentRef<typeof DialogPrimitive.Overlay>,
  OverlayBackdropProps
>(function OverlayBackdrop({ className, ...props }, ref) {
  props = usePortalThemeProps(props);
  return (
    <DialogPrimitive.Overlay
      {...props}
      className={classes('inkra-overlay__backdrop', className)}
      ref={ref}
    />
  );
});

export interface OverlayContentProps extends DialogPrimitive.DialogContentProps {
  /** Plain preserves the padded legacy content; sections fixes Header/Footer around a scrolling Body. */
  layout?: 'plain' | 'sections';
  seed?: string | number;
  surfaceVariant?: PencilSurfaceVariant;
  surfaceRadius?: number;
  surfaceClassName?: string;
}

export const OverlayContent = forwardRef<
  ComponentRef<typeof DialogPrimitive.Content>,
  OverlayContentProps
>(function OverlayContent(
  {
    children,
    className,
    layout = 'plain',
    seed,
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
    <DialogPrimitive.Content
      {...props}
      className={classes('inkra-overlay__content', className)}
      data-layout={layout}
      ref={ref}
    >
      <PencilSurface
        className={classes('inkra-overlay__surface', surfaceClassName)}
        radius={surfaceRadius}
        seed={seed ?? `inkra-overlay-${id}`}
        variant={surfaceVariant}
      >
        <div className="inkra-overlay__content-body">{children}</div>
      </PencilSurface>
    </DialogPrimitive.Content>
  );
});

export interface OverlayTitleProps extends Omit<
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>,
  'children'
> {
  children: string;
  seed?: string | number;
}

export const OverlayTitle = forwardRef<
  ComponentRef<typeof DialogPrimitive.Title>,
  OverlayTitleProps
>(function OverlayTitle({ children, className, seed, ...props }, ref) {
  const id = useId();
  return (
    <DialogPrimitive.Title
      {...props}
      className={classes('inkra-overlay__title', className)}
      ref={ref}
    >
      <PencilText seed={seed ?? `inkra-overlay-title-${id}`}>{children}</PencilText>
    </DialogPrimitive.Title>
  );
});

export interface OverlayDescriptionProps extends Omit<
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>,
  'children'
> {
  children: string;
  seed?: string | number;
}

export const OverlayDescription = forwardRef<
  ComponentRef<typeof DialogPrimitive.Description>,
  OverlayDescriptionProps
>(function OverlayDescription({ children, className, seed, ...props }, ref) {
  const id = useId();
  return (
    <DialogPrimitive.Description
      {...props}
      className={classes('inkra-overlay__description', className)}
      ref={ref}
    >
      <PencilText seed={seed ?? `inkra-overlay-description-${id}`}>{children}</PencilText>
    </DialogPrimitive.Description>
  );
});

export type OverlayCloseProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Close>;

export const OverlayClose = forwardRef<
  ComponentRef<typeof DialogPrimitive.Close>,
  OverlayCloseProps
>(function OverlayClose(props, ref) {
  return <DialogPrimitive.Close {...props} ref={ref} />;
});

const closePaths = closeIcon.node.map(([, attributes]) => ({ d: attributes.d }));

export interface OverlayCloseButtonProps extends Omit<ButtonProps, 'children' | 'size' | 'variant' | 'loading' | 'aria-label' | 'type'> {
  label?: string;
}

export const OverlayCloseButton = forwardRef<HTMLButtonElement, OverlayCloseButtonProps>(
  function OverlayCloseButton({ label = 'Close', className, onFocus, ...props }, ref) {
    return <Tooltip.Provider><Tooltip.Root>
      <Tooltip.Trigger asChild>
        <DialogPrimitive.Close asChild>
          <Button {...props} ref={ref} type="button" size="icon" variant="ghost"
            className={classes('inkra-overlay__close-button', className)} aria-label={label}
            onFocus={event => {
              onFocus?.(event);
              const dialog = event.currentTarget.closest('[role="dialog"]');
              // Initial dialog focus must not open a tooltip that consumes the first Escape.
              if (dialog && (!event.relatedTarget || !dialog.contains(event.relatedTarget))) event.preventDefault();
            }}>
            <PencilIcon paths={closePaths} size={30} sourceSize={24} decorative />
          </Button>
        </DialogPrimitive.Close>
      </Tooltip.Trigger>
      <Tooltip.Portal><Tooltip.Content side="bottom" align="end">{label}</Tooltip.Content></Tooltip.Portal>
    </Tooltip.Root></Tooltip.Provider>;
  },
);

export interface OverlayHeaderProps extends ComponentPropsWithoutRef<'div'> {
  divided?: boolean;
  showClose?: boolean;
  closeLabel?: string;
  action?: ReactNode;
}

export const OverlayHeader = forwardRef<HTMLDivElement, OverlayHeaderProps>(
  function OverlayHeader({ children, className, divided = true, showClose = true, closeLabel = 'Close', action, ...props }, ref) {
    const id = useId();
    return <div {...props} ref={ref} className={classes('inkra-overlay__header', className)} data-divided={divided || undefined}>
      <div className="inkra-overlay__heading">{children}</div>
      {(action || showClose) && <div className="inkra-overlay__header-actions">
        {action}{showClose && <OverlayCloseButton label={closeLabel} />}
      </div>}
      {divided && <PencilLine className="inkra-overlay__section-divider" seed={`overlay-header-${id}`} />}
    </div>;
  },
);

export type OverlayBodyProps = ComponentPropsWithoutRef<'div'>;

export const OverlayBody = forwardRef<HTMLDivElement, OverlayBodyProps>(
  function OverlayBody({ className, ...props }, ref) {
    return <div {...props} ref={ref} className={classes('inkra-overlay__body', className)} />;
  },
);

export interface OverlayFooterProps extends ComponentPropsWithoutRef<'div'> {
  divided?: boolean;
  align?: 'start' | 'center' | 'end';
}

export const OverlayFooter = forwardRef<HTMLDivElement, OverlayFooterProps>(
  function OverlayFooter({ children, className, divided = true, align = 'end', ...props }, ref) {
    const id = useId();
    return <div {...props} ref={ref} className={classes('inkra-overlay__footer', className)} data-divided={divided || undefined} data-align={align}>
      {divided && <PencilLine className="inkra-overlay__section-divider" seed={`overlay-footer-${id}`} />}
      {children}
    </div>;
  },
);

export const Overlay = Object.freeze({
  Root: OverlayRoot,
  Trigger: OverlayTrigger,
  Portal: OverlayPortal,
  Backdrop: OverlayBackdrop,
  Content: OverlayContent,
  Header: OverlayHeader,
  Body: OverlayBody,
  Footer: OverlayFooter,
  CloseButton: OverlayCloseButton,
  Title: OverlayTitle,
  Description: OverlayDescription,
  Close: OverlayClose,
});
