import { Toast as BaseToast } from '@base-ui/react/toast';
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

import { Button } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import {
  PortalThemeBridge,
  PortalThemeProvider,
  usePortalTriggerRef,
} from '../overlay/themeBridge.js';

import { createToastManager, getToastRouter, toastPlacements } from './manager.js';
import type { ToastManager, ToastObject, ToastPlacement, ToastVariant } from './manager.js';
import { useToastNavigation } from './useToastNavigation.js';
export { createToastManager } from './manager.js';
export type { ToastManager, ToastObject, ToastPlacement, ToastVariant, ToastAddOptions, ToastUpdateOptions, ToastPromiseOptions } from './manager.js';

export type ToastTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export type ToastSwipeDirection = 'up' | 'down' | 'left' | 'right';

const ManagerContext = createContext<ToastManager | null>(null);
const emptyToasts: ToastObject[] = [];
const getServerSnapshot = () => emptyToasts;

export interface ToastProviderProps {
  children?: ReactNode;
  timeout?: number;
  limit?: number;
  toastManager?: ToastManager;
  placement?: ToastPlacement;
  variant?: ToastVariant;
  /** Per-position overrides; limit otherwise applies independently to every queue. */
  limits?: Partial<Record<ToastPlacement, number>>;
  swipeDirection?: ToastSwipeDirection | ToastSwipeDirection[];
  closeLabel?: string;
  viewportLabel?: string | ((placement: ToastPlacement) => string);
  viewportClassName?: string;
}

const closePaths = [
  { d: 'M6 6 18 18' },
  { d: 'M18 6 6 18' },
] as const;

function text(content: ReactNode) {
  return typeof content === 'string' ? <PencilText>{content}</PencilText> : content;
}

function toneOf(type: string | undefined): ToastTone {
  if (type === 'error') return 'danger';
  return type === 'success' || type === 'warning' || type === 'danger' || type === 'info'
    ? type
    : 'neutral';
}

function ToastThemeAnchor() {
  const ref = usePortalTriggerRef<HTMLSpanElement>(null);
  return <span aria-hidden="true" className="inkra-toast__theme-anchor" ref={ref} />;
}

function ToastDefaults({ manager, placement, variant }: { manager: ToastManager; placement: ToastPlacement; variant: ToastVariant }) {
  const router = getToastRouter(manager);
  useBrowserLayoutEffect(() => { router.defaults = { placement, variant }; }, [router, placement, variant]);
  return null;
}

function ToastQueue({
  closeLabel,
  placement,
  swipeDirection,
  viewportClassName,
  viewportLabel,
  manager,
}: Required<Pick<ToastProviderProps, 'closeLabel' | 'placement' | 'viewportLabel'>>
  & Pick<ToastProviderProps, 'viewportClassName' | 'swipeDirection'> & { manager: ToastManager }) {
  const controller = BaseToast.useToastManager();
  const { toasts } = controller;
  const router = getToastRouter(manager);
  useBrowserLayoutEffect(() => { router.controllers.set(placement, controller); }, [router, placement, controller]);
  useBrowserLayoutEffect(() => () => { router.controllers.delete(placement); }, [router, placement]);
  useBrowserLayoutEffect(() => { router.report(placement, toasts); }, [router, placement, toasts]);
  useEffect(() => () => { router.report(placement, emptyToasts); }, [router, placement]);
  const directions = swipeDirection ?? (placement.startsWith('top') ? ['up', 'left', 'right'] : placement.startsWith('bottom') ? ['down', 'left', 'right'] : ['left', 'right']) as ToastSwipeDirection[];

  if (!toasts.length) return null;
  return (
    <BaseToast.Portal>
      <PortalThemeBridge>
        <BaseToast.Viewport
          ref={element => { if (element) router.viewports.set(placement, element); else router.viewports.delete(placement); }}
          aria-label={typeof viewportLabel === 'function' ? viewportLabel(placement) : viewportLabel}
          className={['inkra-toast__viewport', viewportClassName].filter(Boolean).join(' ')}
          data-placement={placement}
        >
          {(toasts as ToastObject[]).map((toastItem) => {
            const tone = toneOf(toastItem.type);
            const variant = !toastItem.variant || toastItem.variant === 'auto'
              ? (/^(top|bottom)-(start|end)$/.test(placement) ? 'card' : 'compact')
              : toastItem.variant;
            return (
              <BaseToast.Root
                className="inkra-toast__root"
                data-tone={tone}
                data-variant={variant}
                data-toast-id={toastItem.id}
                key={toastItem.id}
                swipeDirection={directions}
                toast={toastItem}
              >
                <PencilSurface
                  aria-hidden="true"
                  as="span"
                  className="inkra-toast__surface"
                  seed={`toast-${toastItem.id}`}
                  variant={variant === 'compact' ? 'full' : tone === 'neutral' ? 'paper' : 'quiet'}
                />
                {variant === 'compact' && <PencilSurface aria-hidden="true" as="span" className="inkra-toast__wash" seed={`toast-wash-${toastItem.id}`} variant="selection" />}
                <PencilSurface aria-hidden="true" as="span" className="inkra-toast__focus" seed={`toast-focus-${toastItem.id}`} variant="outline" />
                <BaseToast.Content className="inkra-toast__content">
                  <div className="inkra-toast__copy">
                    {toastItem.title != null && (
                      <BaseToast.Title className="inkra-toast__title">
                        {text(toastItem.title)}
                      </BaseToast.Title>
                    )}
                    {toastItem.description != null && (
                      <BaseToast.Description className="inkra-toast__description">
                        {text(toastItem.description)}
                      </BaseToast.Description>
                    )}
                  </div>
                  <div className="inkra-toast__actions">
                    {toastItem.actionProps?.children != null && (
                      <BaseToast.Action
                        className="inkra-toast__action"
                        render={<Button size="sm" variant="outline" />}
                      />
                    )}
                    <BaseToast.Close
                      aria-label={closeLabel}
                      className="inkra-toast__close"
                      render={<Button size="icon-sm" variant="ghost" />}
                    >
                      <PencilIcon paths={closePaths} size={20} sourceSize={24} decorative />
                    </BaseToast.Close>
                  </div>
                </BaseToast.Content>
              </BaseToast.Root>
            );
          })}
        </BaseToast.Viewport>
      </PortalThemeBridge>
    </BaseToast.Portal>
  );
}

function Provider({
  children,
  closeLabel = 'Close notification',
  limit,
  limits,
  placement = 'bottom-end',
  variant = 'auto',
  swipeDirection,
  timeout,
  toastManager,
  viewportClassName,
  viewportLabel = 'Notifications',
}: ToastProviderProps) {
  const [localManager] = useState(() => createToastManager());
  const manager = toastManager ?? localManager;
  const router = getToastRouter(manager);
  useToastNavigation(manager);
  return (
    <PortalThemeProvider>
      <ManagerContext.Provider value={manager}>
        <ToastDefaults manager={manager} placement={placement} variant={variant} />
        <ToastThemeAnchor />
        {/* Bind native queues before consumers can notify from mount effects. */}
        {toastPlacements.map(position => (
          <BaseToast.Provider key={position} limit={limits?.[position] ?? limit} timeout={timeout} toastManager={router.queues[position]}>
            <ToastQueue
              manager={manager}
              closeLabel={closeLabel}
              placement={position}
              swipeDirection={swipeDirection}
              viewportClassName={viewportClassName}
              viewportLabel={viewportLabel}
            />
          </BaseToast.Provider>
        ))}
        {children}
      </ManagerContext.Provider>
    </PortalThemeProvider>
  );
}

export function useToastManager<Data extends object = any>() {
  const manager = useContext(ManagerContext);
  if (!manager) throw new Error('useToastManager must be used within Toast.Provider.');
  const router = getToastRouter(manager);
  const toasts = useSyncExternalStore(router.subscribe, router.getSnapshot, getServerSnapshot) as ToastObject<Data>[];
  return useMemo(() => ({ ...manager as ToastManager<Data>, toasts }), [manager, toasts]);
}
export const Toast = { Provider, useToastManager, createToastManager };
