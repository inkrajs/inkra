import * as Primitive from '@radix-ui/react-dropdown-menu';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ComponentPropsWithoutRef,
  ElementType,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
} from 'react';

import { DropdownMenu } from '../dropdown-menu/index.js';
import type { DropdownMenuContentProps } from '../dropdown-menu/index.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import {
  usePortalThemeProps,
  PortalThemeProvider,
  usePortalTriggerRef,
} from '../overlay/themeBridge.js';

const DEFAULT_EXCLUDE = '[data-context-menu-native]';
const DEFAULT_LONG_PRESS_DELAY = 600;
const DEFAULT_LONG_PRESS_TOLERANCE = 10;
const submenuPaths = [{ d: 'm9 18 6-6-6-6' }];
const classes = (...values: Array<string | undefined>) => values.filter(Boolean).join(' ');

export type ContextMenuOpenReason = 'pointer' | 'keyboard' | 'long-press' | 'dismiss';

export interface ContextMenuOpenChangeDetails {
  reason: ContextMenuOpenReason;
  event?: Event;
}

export interface ContextMenuRootProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  modal?: boolean;
  dir?: 'ltr' | 'rtl';
  onOpenChange?: (open: boolean, details: ContextMenuOpenChangeDetails) => void;
}

interface Point {
  x: number;
  y: number;
}

interface ContextMenuContextValue {
  openAt: (point: Point, reason: Exclude<ContextMenuOpenReason, 'dismiss'>, event: Event) => void;
  setTarget: (target: HTMLElement | null) => void;
  restoreFocus: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

const ContextMenuAnchor = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement> & { type?: string }>(
  function ContextMenuAnchor({ type: _type, ...props }, ref) {
    return <span {...props} ref={ref} />;
  },
);

function useContextMenuContext(component: string) {
  const context = useContext(ContextMenuContext);
  if (!context) throw new Error(`${component} must be used inside ContextMenu.Root.`);
  return context;
}

function viewportPoint(point: Point): Point {
  if (typeof window === 'undefined') return point;
  return {
    x: Math.max(0, Math.min(point.x, window.innerWidth)),
    y: Math.max(0, Math.min(point.y, window.innerHeight)),
  };
}

export function ContextMenuRoot({
  children,
  defaultOpen = false,
  dir,
  modal = true,
  onOpenChange,
  open,
}: ContextMenuRootProps) {
  const controlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [point, setPoint] = useState<Point>({ x: 0, y: 0 });
  const [positioned, setPositioned] = useState(false);
  const [anchorVersion, setAnchorVersion] = useState(0);
  const targetRef = useRef<HTMLElement | null>(null);
  const currentOpen = controlled ? open : uncontrolledOpen;

  const changeOpen = useCallback((nextOpen: boolean, details: ContextMenuOpenChangeDetails) => {
    if (!controlled) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen, details);
  }, [controlled, onOpenChange]);

  const openAt = useCallback((nextPoint: Point, reason: Exclude<ContextMenuOpenReason, 'dismiss'>, event: Event) => {
    setPoint(viewportPoint(nextPoint));
    setPositioned(true);
    setAnchorVersion(version => version + 1);
    changeOpen(true, { reason, event });
  }, [changeOpen]);

  const restoreFocus = useCallback(() => {
    const target = targetRef.current;
    if (!target || typeof target.focus !== 'function') return;
    target.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!currentOpen || positioned) return;
    const rect = targetRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPoint(viewportPoint({ x: rect.left, y: rect.bottom }));
    setPositioned(true);
  }, [currentOpen, positioned]);

  const context = useMemo<ContextMenuContextValue>(() => ({
    openAt,
    restoreFocus,
    setTarget: target => { targetRef.current = target; },
  }), [openAt, restoreFocus]);

  return (
    <PortalThemeProvider>
      <ContextMenuContext.Provider value={context}>
        <Primitive.Root
          dir={dir}
          modal={modal}
          open={currentOpen}
          onOpenChange={nextOpen => changeOpen(nextOpen, { reason: 'dismiss' })}
        >
          {children}
          <Primitive.Trigger asChild key={anchorVersion}>
            <ContextMenuAnchor
              aria-hidden="true"
              className="inkra-context-menu__anchor"
              style={{ left: point.x, top: point.y }}
            />
          </Primitive.Trigger>
        </Primitive.Root>
      </ContextMenuContext.Provider>
    </PortalThemeProvider>
  );
}

export type ContextMenuNativePolicy = 'editable' | 'always' | 'never';

export interface ContextMenuLongPressOptions {
  delay?: number;
  movementTolerance?: number;
}

export interface ContextMenuTriggerProps extends Omit<HTMLAttributes<HTMLElement>, 'onContextMenu'> {
  as?: ElementType;
  disabled?: boolean;
  exclude?: string | ((target: Element, currentTarget: HTMLElement) => boolean);
  longPress?: boolean | ContextMenuLongPressOptions;
  nativeContextMenu?: ContextMenuNativePolicy;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
}

function hasTextSelectionWithin(element: HTMLElement): boolean {
  if (typeof window === 'undefined') return false;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;
  return Boolean(
    (selection.anchorNode && element.contains(selection.anchorNode))
      || (selection.focusNode && element.contains(selection.focusNode)),
  );
}

function isEditableTarget(target: Element): boolean {
  return Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
}

function matchesExclusion(
  exclude: ContextMenuTriggerProps['exclude'],
  target: Element,
  currentTarget: HTMLElement,
): boolean {
  if (typeof exclude === 'function') return exclude(target, currentTarget);
  if (!exclude) return false;
  try {
    return Boolean(target.closest(exclude));
  } catch {
    return false;
  }
}

function shouldUseNativeMenu(
  policy: ContextMenuNativePolicy,
  target: Element,
  currentTarget: HTMLElement,
  exclude: ContextMenuTriggerProps['exclude'],
): boolean {
  if (matchesExclusion(exclude, target, currentTarget)) return true;
  if (policy === 'always') return true;
  if (policy === 'never') return false;
  return isEditableTarget(target) || hasTextSelectionWithin(currentTarget);
}

function composeHandler<EventType>(
  supplied: ((event: EventType) => void) | undefined,
  owned: (event: EventType) => void,
) {
  return (event: EventType) => {
    supplied?.(event);
    const maybePrevented = event as { defaultPrevented?: boolean };
    if (!maybePrevented.defaultPrevented) owned(event);
  };
}

export const ContextMenuTrigger = forwardRef<HTMLElement, ContextMenuTriggerProps>(
  function ContextMenuTrigger({
    as: Component = 'div',
    children,
    disabled = false,
    exclude = DEFAULT_EXCLUDE,
    longPress = false,
    nativeContextMenu = 'editable',
    onContextMenu,
    onKeyDown,
    onPointerCancel,
    onPointerDown,
    onPointerLeave,
    onPointerMove,
    onPointerUp,
    tabIndex,
    ...props
  }, forwardedRef) {
    const context = useContextMenuContext('ContextMenu.Trigger');
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startPoint = useRef<Point | null>(null);
    const pointerType = useRef('');
    const suppressContextMenuUntil = useRef(0);
    const { setTarget } = context;
    const captureTarget = useCallback((node: HTMLElement | null) => {
      setTarget(node);
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    }, [forwardedRef, setTarget]);
    const targetRef = usePortalTriggerRef<HTMLElement>(captureTarget);
    const longPressOptions = typeof longPress === 'object' ? longPress : {};
    const longPressEnabled = Boolean(longPress);
    const delay = Math.max(300, longPressOptions.delay ?? DEFAULT_LONG_PRESS_DELAY);
    const tolerance = Math.max(4, longPressOptions.movementTolerance ?? DEFAULT_LONG_PRESS_TOLERANCE);

    useEffect(() => () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    }, []);

    const cancelLongPress = () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      startPoint.current = null;
    };

    const openFromKeyboard = (event: KeyboardEvent<HTMLElement>) => {
      if (disabled || (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10'))) return;
      const target = event.target instanceof Element ? event.target : event.currentTarget;
      if (shouldUseNativeMenu(nativeContextMenu, target, event.currentTarget, exclude)) return;
      event.preventDefault();
      context.setTarget(event.currentTarget);
      const rect = event.currentTarget.getBoundingClientRect();
      context.openAt({ x: rect.left, y: rect.bottom }, 'keyboard', event.nativeEvent);
    };

    const openFromPointer = (event: MouseEvent<HTMLElement>) => {
      if (disabled) return;
      const target = event.target instanceof Element ? event.target : event.currentTarget;
      if (pointerType.current === 'touch' && !longPressEnabled) return;
      if (shouldUseNativeMenu(nativeContextMenu, target, event.currentTarget, exclude)) return;
      event.preventDefault();
      cancelLongPress();
      if (Date.now() < suppressContextMenuUntil.current) return;
      context.setTarget(event.currentTarget);
      context.openAt({ x: event.clientX, y: event.clientY }, 'pointer', event.nativeEvent);
    };

    const startLongPress = (event: PointerEvent<HTMLElement>) => {
      pointerType.current = event.pointerType;
      if (!longPressEnabled || disabled || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
      const target = event.target instanceof Element ? event.target : event.currentTarget;
      if (shouldUseNativeMenu(nativeContextMenu, target, event.currentTarget, exclude)) return;
      cancelLongPress();
      startPoint.current = { x: event.clientX, y: event.clientY };
      const nativeEvent = event.nativeEvent;
      const currentTarget = event.currentTarget;
      const pressPoint = { x: event.clientX, y: event.clientY };
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        if (hasTextSelectionWithin(currentTarget)) return;
        suppressContextMenuUntil.current = Date.now() + 1000;
        context.setTarget(currentTarget);
        context.openAt(pressPoint, 'long-press', nativeEvent);
      }, delay);
    };

    const trackLongPress = (event: PointerEvent<HTMLElement>) => {
      if (!startPoint.current || !longPressTimer.current) return;
      const distance = Math.hypot(
        event.clientX - startPoint.current.x,
        event.clientY - startPoint.current.y,
      );
      if (distance > tolerance) cancelLongPress();
    };

    return (
      <Component
        {...props}
        aria-disabled={disabled || undefined}
        data-context-menu-trigger=""
        ref={targetRef}
        tabIndex={disabled ? -1 : (tabIndex ?? 0)}
        onContextMenu={composeHandler(onContextMenu, openFromPointer)}
        onKeyDown={composeHandler(onKeyDown, openFromKeyboard)}
        onPointerCancel={composeHandler(onPointerCancel, cancelLongPress)}
        onPointerDown={composeHandler(onPointerDown, startLongPress)}
        onPointerLeave={composeHandler(onPointerLeave, cancelLongPress)}
        onPointerMove={composeHandler(onPointerMove, trackLongPress)}
        onPointerUp={composeHandler(onPointerUp, cancelLongPress)}
      >
        {children}
      </Component>
    );
  },
);

export type ContextMenuPortalProps = ComponentPropsWithoutRef<typeof DropdownMenu.Portal>;
export const ContextMenuPortal = DropdownMenu.Portal;

export type ContextMenuContentProps = DropdownMenuContentProps;

export const ContextMenuContent = forwardRef<HTMLDivElement, ContextMenuContentProps>(
  function ContextMenuContent({ align = 'start', onCloseAutoFocus, side = 'right', sideOffset = 2, ...props }, ref) {
    const context = useContextMenuContext('ContextMenu.Content');
    return (
      <DropdownMenu.Content
        {...props}
        align={align}
        ref={ref}
        side={side}
        sideOffset={sideOffset}
        onCloseAutoFocus={event => {
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          context.restoreFocus();
        }}
      />
    );
  },
);

export type ContextMenuItemProps = ComponentPropsWithoutRef<typeof DropdownMenu.Item>;
export const ContextMenuItem = DropdownMenu.Item;
export type ContextMenuCheckboxItemProps = ComponentPropsWithoutRef<typeof DropdownMenu.CheckboxItem>;
export const ContextMenuCheckboxItem = DropdownMenu.CheckboxItem;
export type ContextMenuRadioItemProps = ComponentPropsWithoutRef<typeof DropdownMenu.RadioItem>;
export const ContextMenuRadioItem = DropdownMenu.RadioItem;
export type ContextMenuLabelProps = ComponentPropsWithoutRef<typeof DropdownMenu.Label>;
export const ContextMenuLabel = DropdownMenu.Label;
export type ContextMenuSeparatorProps = ComponentPropsWithoutRef<typeof DropdownMenu.Separator>;
export const ContextMenuSeparator = DropdownMenu.Separator;
export type ContextMenuGroupProps = ComponentPropsWithoutRef<typeof DropdownMenu.Group>;
export const ContextMenuGroup = DropdownMenu.Group;
export type ContextMenuRadioGroupProps = ComponentPropsWithoutRef<typeof DropdownMenu.RadioGroup>;
export const ContextMenuRadioGroup = DropdownMenu.RadioGroup;

export type ContextMenuSubProps = ComponentPropsWithoutRef<typeof Primitive.Sub>;
export const ContextMenuSub = Primitive.Sub;

export interface ContextMenuSubTriggerProps extends Omit<ComponentPropsWithoutRef<typeof Primitive.SubTrigger>, 'asChild'> {
  icon?: ReactNode;
}

export const ContextMenuSubTrigger = forwardRef<HTMLDivElement, ContextMenuSubTriggerProps>(
  function ContextMenuSubTrigger({ children, className, icon, ...props }, ref) {
    return (
      <Primitive.SubTrigger {...props} className={classes('inkra-menu__item', 'inkra-context-menu__sub-trigger', className)} ref={ref}>
        <PencilSurface as="span" aria-hidden="true" variant="selection" className="inkra-menu__highlight" />
        <span className="inkra-menu__icon" aria-hidden="true">{icon}</span>
        <span className="inkra-menu__label">{typeof children === 'string' ? <PencilText>{children}</PencilText> : children}</span>
        <span aria-hidden="true" className="inkra-context-menu__sub-indicator">
          <PencilIcon decorative paths={submenuPaths} size={16} sourceSize={24} />
        </span>
      </Primitive.SubTrigger>
    );
  },
);

export interface ContextMenuSubContentProps extends Omit<ComponentPropsWithoutRef<typeof Primitive.SubContent>, 'asChild'> {
  seed?: string | number;
}

export const ContextMenuSubContent = forwardRef<HTMLDivElement, ContextMenuSubContentProps>(
  function ContextMenuSubContent({ children, className, collisionPadding = 8, seed, sideOffset = 4, ...props }, ref) {
    const id = useId();
    props = usePortalThemeProps(props);
    return (
      <Primitive.Portal>
          <Primitive.SubContent
            {...props}
            className={classes('inkra-menu', 'inkra-context-menu__sub-content', className)}
            collisionPadding={collisionPadding}
            ref={ref}
            sideOffset={sideOffset}
          >
            <PencilSurface className="inkra-menu__paper" radius={8} seed={seed ?? `context-submenu-${id}`} variant="paper">
              {children}
            </PencilSurface>
          </Primitive.SubContent>
      </Primitive.Portal>
    );
  },
);

export const ContextMenu = Object.freeze({
  Root: ContextMenuRoot,
  Trigger: ContextMenuTrigger,
  Portal: ContextMenuPortal,
  Content: ContextMenuContent,
  Item: ContextMenuItem,
  CheckboxItem: ContextMenuCheckboxItem,
  RadioItem: ContextMenuRadioItem,
  Label: ContextMenuLabel,
  Separator: ContextMenuSeparator,
  Group: ContextMenuGroup,
  RadioGroup: ContextMenuRadioGroup,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
});
