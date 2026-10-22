import * as DialogPrimitive from '@radix-ui/react-dialog';
import { forwardRef, useId } from 'react';
import type {
  ComponentPropsWithoutRef,
  ComponentRef,
  CSSProperties,
  ReactNode,
} from 'react';
import { __iconData as closeIcon } from 'lucide-react/dist/esm/icons/x.mjs';

import { Button } from '../Button.js';
import type { ButtonProps } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { Tooltip } from '../tooltip/Tooltip.js';
import {
  PortalThemeBridge,
  PortalThemeProvider,
  usePortalTriggerRef,
} from '../overlay/themeBridge.js';

const classes = (...values: Array<string | undefined>) => values.filter(Boolean).join(' ');
const closePaths = closeIcon.node.map(([, attributes]) => ({ d: attributes.d }));

export type DrawerDirection = 'top' | 'right' | 'bottom' | 'left';
export type DrawerSize = 'sm' | 'md' | 'lg' | number | string;

function drawerSize(size: DrawerSize): string {
  if (typeof size === 'number') return `${size}px`;
  if (size === 'sm') return '20rem';
  if (size === 'md') return '28rem';
  if (size === 'lg') return '36rem';
  return size;
}

type DrawerStyle = CSSProperties & { '--inkra-drawer-size'?: string };

export type DrawerRootProps = DialogPrimitive.DialogProps;

export function DrawerRoot(props: DrawerRootProps) {
  return <PortalThemeProvider><DialogPrimitive.Root {...props} /></PortalThemeProvider>;
}

export type DrawerTriggerProps = DialogPrimitive.DialogTriggerProps;

export const DrawerTrigger = forwardRef<
  ComponentRef<typeof DialogPrimitive.Trigger>,
  DrawerTriggerProps
>(function DrawerTrigger(props, forwardedRef) {
  return <DialogPrimitive.Trigger {...props} ref={usePortalTriggerRef(forwardedRef)} />;
});

export type DrawerPortalProps = DialogPrimitive.DialogPortalProps;

export function DrawerPortal({ children, ...props }: DrawerPortalProps) {
  return <DialogPrimitive.Portal {...props}><PortalThemeBridge>{children}</PortalThemeBridge></DialogPrimitive.Portal>;
}

export type DrawerBackdropProps = DialogPrimitive.DialogOverlayProps;

export const DrawerBackdrop = forwardRef<
  ComponentRef<typeof DialogPrimitive.Overlay>,
  DrawerBackdropProps
>(function DrawerBackdrop({ className, ...props }, ref) {
  return <DialogPrimitive.Overlay {...props} className={classes('inkra-drawer__backdrop', className)} ref={ref} />;
});

export interface DrawerContentProps extends DialogPrimitive.DialogContentProps {
  direction?: DrawerDirection;
  seed?: string | number;
  size?: DrawerSize;
}

export const DrawerContent = forwardRef<
  ComponentRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(function DrawerContent({ children, className, direction = 'right', seed, size = 'md', style, ...props }, ref) {
  const id = useId();
  const mergedStyle: DrawerStyle = { ...style, '--inkra-drawer-size': drawerSize(size) };
  const edgeOrientation = direction === 'left' || direction === 'right' ? 'vertical' : 'horizontal';
  return (
    <DialogPrimitive.Content
      {...props}
      className={classes('inkra-drawer__content', className)}
      data-direction={direction}
      ref={ref}
      style={mergedStyle}
    >
      <PencilSurface className="inkra-drawer__surface" radius={0} seed={seed ?? `inkra-drawer-${id}`} variant="full">
        <PencilLine className="inkra-drawer__edge" orientation={edgeOrientation} seed={`drawer-edge-${id}`} />
        <div className="inkra-drawer__layout">{children}</div>
      </PencilSurface>
    </DialogPrimitive.Content>
  );
});

export interface DrawerTitleProps extends Omit<ComponentPropsWithoutRef<typeof DialogPrimitive.Title>, 'children'> {
  children: string;
  seed?: string | number;
}

export const DrawerTitle = forwardRef<ComponentRef<typeof DialogPrimitive.Title>, DrawerTitleProps>(
  function DrawerTitle({ children, className, seed, ...props }, ref) {
    const id = useId();
    return <DialogPrimitive.Title {...props} className={classes('inkra-drawer__title', className)} ref={ref}>
      <PencilText seed={seed ?? `inkra-drawer-title-${id}`}>{children}</PencilText>
    </DialogPrimitive.Title>;
  },
);

export interface DrawerDescriptionProps extends Omit<ComponentPropsWithoutRef<typeof DialogPrimitive.Description>, 'children'> {
  children: string;
  seed?: string | number;
}

export const DrawerDescription = forwardRef<ComponentRef<typeof DialogPrimitive.Description>, DrawerDescriptionProps>(
  function DrawerDescription({ children, className, seed, ...props }, ref) {
    const id = useId();
    return <DialogPrimitive.Description {...props} className={classes('inkra-drawer__description', className)} ref={ref}>
      <PencilText seed={seed ?? `inkra-drawer-description-${id}`}>{children}</PencilText>
    </DialogPrimitive.Description>;
  },
);

export type DrawerCloseProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Close>;

export const DrawerClose = forwardRef<ComponentRef<typeof DialogPrimitive.Close>, DrawerCloseProps>(
  function DrawerClose(props, ref) {
    return <DialogPrimitive.Close {...props} ref={ref} />;
  },
);

export interface DrawerCloseButtonProps extends Omit<ButtonProps, 'aria-label' | 'children' | 'loading' | 'size' | 'type' | 'variant'> {
  label?: string;
}

export const DrawerCloseButton = forwardRef<HTMLButtonElement, DrawerCloseButtonProps>(
  function DrawerCloseButton({ className, label = 'Close', onFocus, ...props }, ref) {
    return <Tooltip.Provider><Tooltip.Root>
      <Tooltip.Trigger asChild>
        <DialogPrimitive.Close asChild>
          <Button {...props} aria-label={label} className={classes('inkra-drawer__close-button', className)} ref={ref} size="icon" type="button" variant="outline"
            onFocus={event => {
              onFocus?.(event);
              const dialog = event.currentTarget.closest('[role="dialog"]');
              if (dialog && (!event.relatedTarget || !dialog.contains(event.relatedTarget))) event.preventDefault();
            }}>
            <PencilIcon decorative paths={closePaths} size={30} sourceSize={24} />
          </Button>
        </DialogPrimitive.Close>
      </Tooltip.Trigger>
      <Tooltip.Portal><Tooltip.Content align="end" side="bottom">{label}</Tooltip.Content></Tooltip.Portal>
    </Tooltip.Root></Tooltip.Provider>;
  },
);

export interface DrawerHeaderProps extends ComponentPropsWithoutRef<'div'> {
  action?: ReactNode;
  closeLabel?: string;
  divided?: boolean;
  showClose?: boolean;
}

export const DrawerHeader = forwardRef<HTMLDivElement, DrawerHeaderProps>(
  function DrawerHeader({ action, children, className, closeLabel = 'Close', divided = true, showClose = true, ...props }, ref) {
    const id = useId();
    return <div {...props} className={classes('inkra-drawer__header', className)} data-divided={divided || undefined} ref={ref}>
      <div className="inkra-drawer__heading">{children}</div>
      {(action || showClose) ? <div className="inkra-drawer__header-actions">{action}{showClose ? <DrawerCloseButton label={closeLabel} /> : null}</div> : null}
      {divided ? <PencilLine className="inkra-drawer__divider" seed={`drawer-header-${id}`} /> : null}
    </div>;
  },
);

export type DrawerBodyProps = ComponentPropsWithoutRef<'div'>;

export const DrawerBody = forwardRef<HTMLDivElement, DrawerBodyProps>(
  function DrawerBody({ className, ...props }, ref) {
    return <div {...props} className={classes('inkra-drawer__body', className)} ref={ref} />;
  },
);

export interface DrawerFooterProps extends ComponentPropsWithoutRef<'div'> {
  align?: 'start' | 'center' | 'end';
  divided?: boolean;
}

export const DrawerFooter = forwardRef<HTMLDivElement, DrawerFooterProps>(
  function DrawerFooter({ align = 'end', children, className, divided = true, ...props }, ref) {
    const id = useId();
    return <div {...props} className={classes('inkra-drawer__footer', className)} data-align={align} data-divided={divided || undefined} ref={ref}>
      {divided ? <PencilLine className="inkra-drawer__divider" seed={`drawer-footer-${id}`} /> : null}
      {children}
    </div>;
  },
);

export const Drawer = Object.freeze({
  Root: DrawerRoot,
  Trigger: DrawerTrigger,
  Portal: DrawerPortal,
  Backdrop: DrawerBackdrop,
  Content: DrawerContent,
  Header: DrawerHeader,
  Body: DrawerBody,
  Footer: DrawerFooter,
  Title: DrawerTitle,
  Description: DrawerDescription,
  Close: DrawerClose,
  CloseButton: DrawerCloseButton,
});
