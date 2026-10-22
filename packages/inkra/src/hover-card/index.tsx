import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ComponentRef } from 'react';

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '../overlay/index.js';
import type {
  PopoverCloseProps,
  PopoverContentProps,
  PopoverDescriptionProps,
  PopoverRootProps,
  PopoverTitleProps,
  PopoverTriggerProps,
} from '../overlay/index.js';

const classes = (...values: Array<string | undefined>) => values.filter(Boolean).join(' ');

interface HoverCardContextValue {
  cancelPending: () => void;
  getOpenReason: () => 'focus' | 'hover' | 'press' | 'programmatic';
  markExplicitOpen: () => void;
  scheduleClose: () => void;
  scheduleOpen: (reason: 'focus' | 'hover') => void;
}

const HoverCardContext = createContext<HoverCardContextValue | null>(null);

function useHoverCardContext(part: string) {
  const context = useContext(HoverCardContext);
  if (!context) throw new Error(`${part} must be used inside HoverCard.Root.`);
  return context;
}

export interface HoverCardRootProps extends Omit<
  PopoverRootProps,
  'defaultOpen' | 'modal' | 'onOpenChange' | 'open'
> {
  /** Delay in milliseconds before hover or focus opens the card. */
  openDelay?: number;
  /** Delay in milliseconds before pointer or focus departure closes the card. */
  closeDelay?: number;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

export function HoverCardRoot({
  children,
  closeDelay = 300,
  defaultOpen = false,
  onOpenChange,
  open,
  openDelay = 700,
  ...props
}: HoverCardRootProps) {
  const controlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const currentOpen = controlled ? open : uncontrolledOpen;
  const currentOpenRef = useRef(currentOpen);
  const openReasonRef = useRef<'focus' | 'hover' | 'press' | 'programmatic'>('programmatic');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  currentOpenRef.current = currentOpen;

  const cancelPending = () => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const commitOpen = (nextOpen: boolean) => {
    cancelPending();
    if (nextOpen === currentOpenRef.current) return;
    if (!controlled) {
      currentOpenRef.current = nextOpen;
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
    if (!nextOpen) openReasonRef.current = 'programmatic';
  };

  const schedule = (
    nextOpen: boolean,
    delay: number,
    reason: 'focus' | 'hover' | 'programmatic',
  ) => {
    cancelPending();
    if (nextOpen === currentOpenRef.current) return;
    openReasonRef.current = reason;
    const safeDelay = Number.isFinite(delay) ? Math.max(0, delay) : 0;
    if (safeDelay === 0) {
      commitOpen(nextOpen);
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      commitOpen(nextOpen);
    }, safeDelay);
  };

  useEffect(() => cancelPending, []);

  return (
    <HoverCardContext.Provider value={{
      cancelPending,
      getOpenReason: () => openReasonRef.current,
      markExplicitOpen: () => {
        cancelPending();
        openReasonRef.current = 'press';
      },
      scheduleClose: () => schedule(false, closeDelay, 'programmatic'),
      scheduleOpen: reason => schedule(true, openDelay, reason),
    }}>
      <Popover.Root
        {...props}
        modal={false}
        open={currentOpen}
        onOpenChange={commitOpen}
      >
        {children}
      </Popover.Root>
    </HoverCardContext.Provider>
  );
}

export type HoverCardTriggerProps = PopoverTriggerProps;

export const HoverCardTrigger = forwardRef<
  ComponentRef<typeof PopoverTrigger>,
  HoverCardTriggerProps
>(function HoverCardTrigger(
  {
    onBlur,
    onClick,
    onFocus,
    onPointerDown,
    onPointerEnter,
    onPointerLeave,
    ...props
  },
  ref,
) {
  const context = useHoverCardContext('HoverCard.Trigger');

  return (
    <Popover.Trigger
      {...props}
      ref={ref}
      onBlur={event => {
        onBlur?.(event);
        if (!event.defaultPrevented) context.scheduleClose();
      }}
      onFocus={event => {
        onFocus?.(event);
        if (!event.defaultPrevented) context.scheduleOpen('focus');
      }}
      onClick={event => {
        onClick?.(event);
        if (!event.defaultPrevented) context.markExplicitOpen();
      }}
      onPointerDown={event => {
        onPointerDown?.(event);
        if (!event.defaultPrevented) context.cancelPending();
      }}
      onPointerEnter={event => {
        onPointerEnter?.(event);
        if (!event.defaultPrevented && event.pointerType !== 'touch') context.scheduleOpen('hover');
      }}
      onPointerLeave={event => {
        onPointerLeave?.(event);
        if (!event.defaultPrevented && event.pointerType !== 'touch') context.scheduleClose();
      }}
    />
  );
});

export type HoverCardFocusOnOpen = 'always' | 'focus-and-press' | 'never' | 'press';

export interface HoverCardContentProps extends PopoverContentProps {
  /** Controls which activation reasons may move focus into the card. */
  focusOnOpen?: HoverCardFocusOnOpen;
}

export const HoverCardContent = forwardRef<
  ComponentRef<typeof PopoverContent>,
  HoverCardContentProps
>(function HoverCardContent(
  {
    avoidCollisions = true,
    children,
    className,
    collisionPadding = 16,
    focusOnOpen = 'press',
    onBlurCapture,
    onFocusCapture,
    onOpenAutoFocus,
    onPointerDown,
    onPointerEnter,
    onPointerLeave,
    sideOffset = 8,
    ...props
  },
  ref,
) {
  const context = useHoverCardContext('HoverCard.Content');

  return (
    <Popover.Portal>
      <Popover.Content
        {...props}
        avoidCollisions={avoidCollisions}
        className={classes('inkra-hover-card__content', className)}
        collisionPadding={collisionPadding}
        ref={ref}
        sideOffset={sideOffset}
        onBlurCapture={event => {
          onBlurCapture?.(event);
          if (event.defaultPrevented) return;
          const nextTarget = event.relatedTarget;
          if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
            context.scheduleClose();
          }
        }}
        onFocusCapture={event => {
          onFocusCapture?.(event);
          if (!event.defaultPrevented) context.cancelPending();
        }}
        onOpenAutoFocus={event => {
          onOpenAutoFocus?.(event);
          if (event.defaultPrevented) return;
          const reason = context.getOpenReason();
          const shouldFocus = focusOnOpen === 'always'
            || focusOnOpen === 'press' && reason === 'press'
            || focusOnOpen === 'focus-and-press' && (reason === 'focus' || reason === 'press');
          if (!shouldFocus) event.preventDefault();
        }}
        onPointerDown={event => {
          onPointerDown?.(event);
          if (!event.defaultPrevented) context.cancelPending();
        }}
        onPointerEnter={event => {
          onPointerEnter?.(event);
          if (!event.defaultPrevented && event.pointerType !== 'touch') context.cancelPending();
        }}
        onPointerLeave={event => {
          onPointerLeave?.(event);
          if (!event.defaultPrevented && event.pointerType !== 'touch') context.scheduleClose();
        }}
      >
        {children}
      </Popover.Content>
    </Popover.Portal>
  );
});

export type HoverCardTitleProps = PopoverTitleProps;
export const HoverCardTitle = PopoverTitle;

export type HoverCardDescriptionProps = PopoverDescriptionProps;
export const HoverCardDescription = PopoverDescription;

export type HoverCardCloseProps = PopoverCloseProps;
export const HoverCardClose = PopoverClose;

export const HoverCard = Object.freeze({
  Root: HoverCardRoot,
  Trigger: HoverCardTrigger,
  Content: HoverCardContent,
  Title: HoverCardTitle,
  Description: HoverCardDescription,
  Close: HoverCardClose,
});
