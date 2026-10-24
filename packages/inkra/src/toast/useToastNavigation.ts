import { useEffect } from 'react';
import { getToastRouter, toastPlacements } from './manager.js';
import type { ToastManager } from './manager.js';

/** Coordinate F6 once: native per-queue listeners would otherwise compete for focus. */
export function useToastNavigation(manager: ToastManager) {
  useEffect(() => {
    const router = getToastRouter(manager);
    let returnTarget: HTMLElement | null = null;
    let focusedToastElement: HTMLElement | null = null;
    const restore = () => {
      if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
      returnTarget = null;
    };
    const focusin = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if ([...router.viewports.values()].some(viewport => viewport.contains(target))) {
        focusedToastElement = target;
      } else {
        focusedToastElement = null;
        returnTarget = null;
      }
    };
    const unsubscribe = router.subscribe(() => {
      if (returnTarget && focusedToastElement && !focusedToastElement.isConnected && document.activeElement === document.body) restore();
    });
    const focusable = (viewport: HTMLElement) => Array.from(viewport.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
    )).filter(element => element.getClientRects().length && !element.closest('[inert], [data-ending-style], [data-limited]'));
    const keydown = (event: KeyboardEvent) => {
      const viewports = toastPlacements.map(placement => router.viewports.get(placement))
        .filter((viewport): viewport is HTMLElement => !!viewport?.isConnected && focusable(viewport).length > 0);
      if (!viewports.length) return;
      const active = document.activeElement as HTMLElement | null;
      const index = viewports.findIndex(viewport => viewport.contains(active));
      if (event.key === 'F6' && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (index === -1) returnTarget = active;
        const next = index === -1 ? (event.shiftKey ? viewports.length - 1 : 0)
          : (index + (event.shiftKey ? -1 : 1) + viewports.length) % viewports.length;
        focusable(viewports[next])[0]?.focus({ preventScroll: true });
      } else if (index !== -1 && returnTarget && event.key === 'Tab') {
        const items = focusable(viewports[index]);
        if ((event.shiftKey && items[0] === active) || (!event.shiftKey && items[items.length - 1] === active)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          restore();
        }
      } else if (index !== -1 && returnTarget && event.key === 'Escape') {
        const toast = active?.closest<HTMLElement>('[data-toast-id]');
        if (!toast?.dataset.toastId) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        manager.close(toast.dataset.toastId);
        const next = focusable(viewports[index]).find(element => !toast.contains(element));
        if (next) next.focus({ preventScroll: true });
        else restore();
      }
    };
    window.addEventListener('keydown', keydown, true);
    document.addEventListener('focusin', focusin, true);
    return () => {
      unsubscribe();
      window.removeEventListener('keydown', keydown, true);
      document.removeEventListener('focusin', focusin, true);
    };
  }, [manager]);
}
