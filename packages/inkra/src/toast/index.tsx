import { Toast as BaseToast } from '@base-ui/react/toast';
import type { ToastManager as BaseToastManager } from '@base-ui/react/toast';
import type { ReactNode } from 'react';

import { Button } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import {
  PortalThemeBridge,
  PortalThemeProvider,
  usePortalTriggerRef,
} from '../overlay/themeBridge.js';

export type ToastPlacement = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
export type ToastTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export type ToastSwipeDirection = 'up' | 'down' | 'left' | 'right';
export type ToastManager<Data extends object = any> = BaseToastManager<Data>;

export interface ToastProviderProps {
  children?: ReactNode;
  timeout?: number;
  limit?: number;
  toastManager?: ToastManager;
  placement?: ToastPlacement;
  swipeDirection?: ToastSwipeDirection | ToastSwipeDirection[];
  closeLabel?: string;
  viewportLabel?: string;
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
  return type === 'success' || type === 'warning' || type === 'danger' || type === 'info'
    ? type
    : 'neutral';
}

function ToastThemeAnchor() {
  const ref = usePortalTriggerRef<HTMLSpanElement>(null);
  return <span aria-hidden="true" className="inkra-toast__theme-anchor" ref={ref} />;
}

function ToastQueue({
  closeLabel,
  placement,
  swipeDirection,
  viewportClassName,
  viewportLabel,
}: Required<Pick<ToastProviderProps, 'closeLabel' | 'placement' | 'swipeDirection' | 'viewportLabel'>>
  & Pick<ToastProviderProps, 'viewportClassName'>) {
  const { toasts } = BaseToast.useToastManager();

  return (
    <BaseToast.Portal>
      <PortalThemeBridge>
        <BaseToast.Viewport
          aria-label={viewportLabel}
          className={['inkra-toast__viewport', viewportClassName].filter(Boolean).join(' ')}
          data-placement={placement}
        >
          {toasts.map((toastItem) => {
            const tone = toneOf(toastItem.type);
            return (
              <BaseToast.Root
                className="inkra-toast__root"
                data-tone={tone}
                key={toastItem.id}
                swipeDirection={swipeDirection}
                toast={toastItem}
              >
                <PencilSurface
                  aria-hidden="true"
                  as="span"
                  className="inkra-toast__surface"
                  seed={`toast-${toastItem.id}-${toastItem.updateKey ?? 0}`}
                  variant={tone === 'neutral' ? 'paper' : 'quiet'}
                />
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
  placement = 'bottom-end',
  swipeDirection = ['down', 'right'],
  timeout,
  toastManager,
  viewportClassName,
  viewportLabel = 'Notifications',
}: ToastProviderProps) {
  return (
    <PortalThemeProvider>
      <BaseToast.Provider limit={limit} timeout={timeout} toastManager={toastManager}>
        <ToastThemeAnchor />
        {children}
        <ToastQueue
          closeLabel={closeLabel}
          placement={placement}
          swipeDirection={swipeDirection}
          viewportClassName={viewportClassName}
          viewportLabel={viewportLabel}
        />
      </BaseToast.Provider>
    </PortalThemeProvider>
  );
}

export const useToastManager = BaseToast.useToastManager;
export const createToastManager = BaseToast.createToastManager;
export const Toast = { Provider, useToastManager, createToastManager };
