import { Toast as BaseToast } from '@base-ui/react/toast';
import type {
  ToastManagerAddOptions as BaseAddOptions,
  ToastManagerUpdateOptions as BaseUpdateOptions,
  ToastManagerPromiseOptions as BasePromiseOptions,
  ToastObject as BaseToastObject,
} from '@base-ui/react/toast';

export const toastPlacements = [
  'top-start', 'top-center', 'top-end',
  'center-start', 'center', 'center-end',
  'bottom-start', 'bottom-center', 'bottom-end',
] as const;
export type ToastPlacement = typeof toastPlacements[number];
export type ToastVariant = 'auto' | 'card' | 'compact';
export type ToastObject<Data extends object = any> = BaseToastObject<Data> & {
  placement?: ToastPlacement;
  variant?: ToastVariant;
};
export type ToastAddOptions<Data extends object = any> = BaseAddOptions<Data> & {
  placement?: ToastPlacement;
  variant?: ToastVariant;
};
export type ToastUpdateOptions<Data extends object = any> = BaseUpdateOptions<Data> & { variant?: ToastVariant };
export type ToastPromiseOptions<Value, Data extends object = any> = BasePromiseOptions<Value, Data> & {
  placement?: ToastPlacement;
  variant?: ToastVariant;
};

export interface ToastManager<Data extends object = any> {
  add: <T extends Data = Data>(options: ToastAddOptions<T>) => string;
  update: <T extends Data = Data>(id: string, options: ToastUpdateOptions<T> | ((previous: ToastObject<T>) => ToastUpdateOptions<T>)) => void;
  close: (id?: string) => void;
  closeAll: (placement?: ToastPlacement) => void;
  promise: <Value, T extends Data = Data>(value: Promise<Value>, options: ToastPromiseOptions<Value, T>) => Promise<Value>;
}

function createRouter() {
  const queues = Object.fromEntries(toastPlacements.map(placement => [placement, BaseToast.createToastManager()])) as Record<ToastPlacement, ReturnType<typeof BaseToast.createToastManager>>;
  const controllers = new Map<ToastPlacement, ReturnType<typeof BaseToast.useToastManager>>();
  const snapshots = new Map<ToastPlacement, ToastObject[]>();
  const owners = new Map<string, ToastPlacement>();
  const listeners = new Set<() => void>();
  let snapshot: ToastObject[] = [];
  return {
    queues,
    controllers,
    engine: (placement: ToastPlacement) => controllers.get(placement) ?? queues[placement],
    viewports: new Map<ToastPlacement, HTMLElement>(),
    owners,
    defaults: { placement: 'bottom-end' as ToastPlacement, variant: 'auto' as ToastVariant },
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    report(placement: ToastPlacement, toasts: ToastObject[]) {
      if (snapshots.get(placement) === toasts) return;
      const currentIds = new Set(toasts.map(toast => toast.id));
      for (const previous of snapshots.get(placement) ?? []) {
        if (!currentIds.has(previous.id)) owners.delete(previous.id);
      }
      for (const toast of toasts) owners.set(toast.id, placement);
      snapshots.set(placement, toasts);
      snapshot = toastPlacements.flatMap(position => snapshots.get(position) ?? []);
      listeners.forEach(listener => listener());
    },
  };
}

const routers = new WeakMap<ToastManager, ReturnType<typeof createRouter>>();
export function getToastRouter(manager: ToastManager) {
  const router = routers.get(manager);
  if (!router) throw new Error('Use createToastManager from @inkra/react with Toast.Provider.');
  return router;
}

/** Routes notifications; Base UI still owns each queue, timer and lifecycle. */
export function createToastManager<Data extends object = any>(): ToastManager<Data> {
  const router = createRouter();
  const manager: ToastManager<Data> = {
    add(options) {
      // An upsert stays in its original queue, even if the default position changed.
      const placement = (options.id && router.owners.get(options.id)) || options.placement || router.defaults.placement;
      const id = router.engine(placement).add({ ...options, placement, variant: options.variant ?? router.defaults.variant } as ToastAddOptions);
      router.owners.set(id, placement);
      return id;
    },
    update(id, options) {
      for (const placement of toastPlacements) router.engine(placement).update(id, options);
    },
    close(id) {
      for (const placement of toastPlacements) router.engine(placement).close(id);
    },
    closeAll(placement) {
      if (placement) router.engine(placement).close();
      else manager.close();
    },
    promise(value, options) {
      const placement = options.placement ?? router.defaults.placement;
      const loading = typeof options.loading === 'string' ? { title: options.loading } : options.loading;
      return router.engine(placement).promise(value, {
        ...options,
        loading: { ...loading, placement, variant: options.variant ?? router.defaults.variant } as ToastUpdateOptions,
      });
    },
  };
  routers.set(manager, router);
  return manager;
}
