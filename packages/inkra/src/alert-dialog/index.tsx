import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useRef,
  useState,
} from 'react';
import type {
  ComponentPropsWithoutRef,
  ComponentRef,
  ReactNode,
  Ref,
} from 'react';

import { Button } from '../Button.js';
import type { ButtonProps } from '../Button.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import {
  mapPortalChildren,
  PortalThemeProvider,
  usePortalThemeProps,
  usePortalTriggerRef,
} from '../overlay/themeBridge.js';

const classes = (...values: Array<string | undefined>) => values.filter(Boolean).join(' ');

function assignRef<Value>(ref: Ref<Value> | undefined, value: Value | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

interface AlertDialogContextValue {
  cancelRef: React.RefObject<HTMLButtonElement | null>;
  pending: boolean;
}

const AlertDialogContext = createContext<AlertDialogContextValue | null>(null);

export interface AlertDialogRootProps extends Omit<DialogPrimitive.DialogProps, 'open' | 'defaultOpen' | 'onOpenChange' | 'modal'> {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  pending?: boolean;
}

export function AlertDialogRoot({
  defaultOpen = false,
  onOpenChange,
  open,
  pending = false,
  ...props
}: AlertDialogRootProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const controlled = open !== undefined;
  const currentOpen = controlled ? open : uncontrolledOpen;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return;
    if (!controlled) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  return (
    <PortalThemeProvider>
      <AlertDialogContext.Provider value={{ cancelRef, pending }}>
        <DialogPrimitive.Root
          {...props}
          modal
          open={currentOpen}
          onOpenChange={handleOpenChange}
        />
      </AlertDialogContext.Provider>
    </PortalThemeProvider>
  );
}

export type AlertDialogTriggerProps = DialogPrimitive.DialogTriggerProps;

export const AlertDialogTrigger = forwardRef<
  ComponentRef<typeof DialogPrimitive.Trigger>,
  AlertDialogTriggerProps
>(function AlertDialogTrigger(props, forwardedRef) {
  return <DialogPrimitive.Trigger {...props} ref={usePortalTriggerRef(forwardedRef)} />;
});

export type AlertDialogPortalProps = DialogPrimitive.DialogPortalProps;

export function AlertDialogPortal({ children, ...props }: AlertDialogPortalProps) {
  return mapPortalChildren(children, child => <DialogPrimitive.Portal {...props}>{child}</DialogPrimitive.Portal>);
}

export type AlertDialogBackdropProps = DialogPrimitive.DialogOverlayProps;

export const AlertDialogBackdrop = forwardRef<
  ComponentRef<typeof DialogPrimitive.Overlay>,
  AlertDialogBackdropProps
>(function AlertDialogBackdrop({ className, ...props }, ref) {
  props = usePortalThemeProps(props);
  return (
    <DialogPrimitive.Overlay
      {...props}
      className={classes('inkra-alert-dialog__backdrop', className)}
      ref={ref}
    />
  );
});

export interface AlertDialogContentProps extends DialogPrimitive.DialogContentProps {
  seed?: string | number;
}

export const AlertDialogContent = forwardRef<
  ComponentRef<typeof DialogPrimitive.Content>,
  AlertDialogContentProps
>(function AlertDialogContent(
  {
    children,
    className,
    onEscapeKeyDown,
    onInteractOutside,
    onOpenAutoFocus,
    onPointerDownOutside,
    seed,
    ...props
  },
  forwardedRef,
) {
  const context = useContext(AlertDialogContext);
  const contentRef = useRef<HTMLDivElement>(null);
  const id = useId();
  props = usePortalThemeProps(props);

  return (
    <DialogPrimitive.Content
      {...props}
      role="alertdialog"
      aria-busy={context?.pending || undefined}
      className={classes('inkra-alert-dialog__content', className)}
      data-pending={context?.pending || undefined}
      ref={node => {
        contentRef.current = node;
        assignRef(forwardedRef, node);
      }}
      onEscapeKeyDown={event => {
        onEscapeKeyDown?.(event);
        if (context?.pending) event.preventDefault();
      }}
      onInteractOutside={event => {
        onInteractOutside?.(event);
        event.preventDefault();
      }}
      onPointerDownOutside={event => {
        onPointerDownOutside?.(event);
        event.preventDefault();
      }}
      onOpenAutoFocus={event => {
        onOpenAutoFocus?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        queueMicrotask(() => {
          const cancel = context?.cancelRef.current;
          const content = contentRef.current;
          const ownerDocument = content?.ownerDocument;
          if (cancel && !cancel.disabled && cancel.isConnected) cancel.focus({ preventScroll: true });
          if (ownerDocument?.activeElement === cancel) return;
          if (content?.isConnected) content.focus({ preventScroll: true });
        });
      }}
    >
      <PencilSurface
        aria-hidden="true"
        as="span"
        className="inkra-alert-dialog__focus-ring"
        radius={8}
        seed={`${seed ?? `inkra-alert-dialog-${id}`}-focus`}
        variant="outline"
      />
      <PencilSurface
        className="inkra-alert-dialog__surface"
        radius={8}
        seed={seed ?? `inkra-alert-dialog-${id}`}
        variant="paper"
      >
        <div className="inkra-alert-dialog__layout">{children}</div>
      </PencilSurface>
    </DialogPrimitive.Content>
  );
});

export interface AlertDialogTitleProps extends Omit<
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>,
  'children'
> {
  children: string;
  seed?: string | number;
}

export const AlertDialogTitle = forwardRef<
  ComponentRef<typeof DialogPrimitive.Title>,
  AlertDialogTitleProps
>(function AlertDialogTitle({ children, className, seed, ...props }, ref) {
  const id = useId();
  return (
    <DialogPrimitive.Title
      {...props}
      className={classes('inkra-alert-dialog__title', className)}
      ref={ref}
    >
      <PencilText seed={seed ?? `inkra-alert-dialog-title-${id}`}>{children}</PencilText>
    </DialogPrimitive.Title>
  );
});

export interface AlertDialogDescriptionProps extends Omit<
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>,
  'children'
> {
  children: string;
  seed?: string | number;
}

export const AlertDialogDescription = forwardRef<
  ComponentRef<typeof DialogPrimitive.Description>,
  AlertDialogDescriptionProps
>(function AlertDialogDescription({ children, className, seed, ...props }, ref) {
  const id = useId();
  return (
    <DialogPrimitive.Description
      {...props}
      className={classes('inkra-alert-dialog__description', className)}
      ref={ref}
    >
      <PencilText seed={seed ?? `inkra-alert-dialog-description-${id}`}>{children}</PencilText>
    </DialogPrimitive.Description>
  );
});

export interface AlertDialogHeaderProps extends ComponentPropsWithoutRef<'div'> {
  divided?: boolean;
}

export const AlertDialogHeader = forwardRef<HTMLDivElement, AlertDialogHeaderProps>(
  function AlertDialogHeader({ children, className, divided = true, ...props }, ref) {
    const id = useId();
    return (
      <div
        {...props}
        className={classes('inkra-alert-dialog__header', className)}
        data-divided={divided || undefined}
        ref={ref}
      >
        <div className="inkra-alert-dialog__heading">{children}</div>
        {divided ? <PencilLine className="inkra-alert-dialog__divider" seed={`alert-header-${id}`} /> : null}
      </div>
    );
  },
);

export type AlertDialogBodyProps = ComponentPropsWithoutRef<'div'>;

export const AlertDialogBody = forwardRef<HTMLDivElement, AlertDialogBodyProps>(
  function AlertDialogBody({ className, ...props }, ref) {
    return <div {...props} className={classes('inkra-alert-dialog__body', className)} ref={ref} />;
  },
);

export interface AlertDialogFooterProps extends ComponentPropsWithoutRef<'div'> {
  align?: 'start' | 'center' | 'end';
  divided?: boolean;
}

export const AlertDialogFooter = forwardRef<HTMLDivElement, AlertDialogFooterProps>(
  function AlertDialogFooter({ align = 'end', children, className, divided = true, ...props }, ref) {
    const id = useId();
    return (
      <div
        {...props}
        className={classes('inkra-alert-dialog__footer', className)}
        data-align={align}
        data-divided={divided || undefined}
        ref={ref}
      >
        {divided ? <PencilLine className="inkra-alert-dialog__divider" seed={`alert-footer-${id}`} /> : null}
        {children}
      </div>
    );
  },
);

export interface AlertDialogCancelProps extends Omit<ButtonProps, 'type'> {
  children?: ReactNode;
}

export const AlertDialogCancel = forwardRef<HTMLButtonElement, AlertDialogCancelProps>(
  function AlertDialogCancel({ disabled, variant = 'secondary', ...props }, forwardedRef) {
    const context = useContext(AlertDialogContext);
    return (
      <DialogPrimitive.Close asChild>
        <Button
          {...props}
          disabled={disabled || context?.pending}
          ref={node => {
            assignRef(forwardedRef, node);
            assignRef(context?.cancelRef, node);
          }}
          type="button"
          variant={variant}
        />
      </DialogPrimitive.Close>
    );
  },
);

export interface AlertDialogActionProps extends Omit<ButtonProps, 'type'> {
  children?: ReactNode;
  closeOnAction?: boolean;
}

export const AlertDialogAction = forwardRef<HTMLButtonElement, AlertDialogActionProps>(
  function AlertDialogAction({ closeOnAction = true, disabled, loading, variant = 'destructive', ...props }, ref) {
    const pending = useContext(AlertDialogContext)?.pending ?? false;
    const button = (
      <Button
        {...props}
        aria-busy={pending || undefined}
        disabled={disabled || pending}
        loading={loading || pending}
        ref={ref}
        type="button"
        variant={variant}
      />
    );
    return closeOnAction ? <DialogPrimitive.Close asChild>{button}</DialogPrimitive.Close> : button;
  },
);

export const AlertDialog = Object.freeze({
  Root: AlertDialogRoot,
  Trigger: AlertDialogTrigger,
  Portal: AlertDialogPortal,
  Backdrop: AlertDialogBackdrop,
  Content: AlertDialogContent,
  Header: AlertDialogHeader,
  Body: AlertDialogBody,
  Footer: AlertDialogFooter,
  Title: AlertDialogTitle,
  Description: AlertDialogDescription,
  Cancel: AlertDialogCancel,
  Action: AlertDialogAction,
});
