import {
  createContext,
  forwardRef,
  useContext,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  HTMLAttributes,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';

import { Button } from '../Button.js';
import type { ButtonProps } from '../Button.js';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';

const classes = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ');
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export type TiltAxis = 'both' | 'x' | 'y';

export interface TiltRotation {
  rotateX: number;
  rotateY: number;
}

export function calculateTiltRotation(
  clientX: number,
  clientY: number,
  bounds: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  maxAngle: number,
  axis: TiltAxis = 'both',
): TiltRotation {
  if (bounds.width <= 0 || bounds.height <= 0) return { rotateX: 0, rotateY: 0 };
  const horizontal = clamp(((clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1);
  const vertical = clamp(((clientY - bounds.top) / bounds.height) * 2 - 1, -1, 1);
  const angle = Math.max(0, Math.abs(maxAngle));
  const rotateX = axis === 'y' ? 0 : vertical * angle;
  const rotateY = axis === 'x' ? 0 : -horizontal * angle;
  return {
    rotateX: rotateX === 0 ? 0 : rotateX,
    rotateY: rotateY === 0 ? 0 : rotateY,
  };
}

type TiltStyle = CSSProperties & {
  '--inkra-tilt-max-angle'?: string;
  '--inkra-tilt-response'?: string;
  '--inkra-tilt-reset-duration'?: string;
  '--inkra-tilt-rotate-x'?: string;
  '--inkra-tilt-rotate-y'?: string;
};

export interface TiltProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onPointerMove'> {
  /** Rotation axes that respond to the mouse position. */
  axis?: TiltAxis;
  /** Disables pointer tracking and returns the content to its resting position. */
  disabled?: boolean;
  /** Maximum rotation in degrees at each edge. */
  maxAngle?: number;
  /** Transform response time while following the mouse, in milliseconds. */
  response?: number;
  /** Transform duration used when the mouse leaves, in milliseconds. */
  resetDuration?: number;
  onPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

function useReducedMotion(onReduce: () => void) {
  const reducedRef = useRef(false);

  useBrowserLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      reducedRef.current = query.matches;
      if (query.matches) onReduce();
    };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [onReduce]);

  return reducedRef;
}

export const Tilt = forwardRef<HTMLDivElement, TiltProps>(function Tilt(
  {
    axis = 'both',
    children,
    className,
    disabled = false,
    maxAngle = 8,
    onPointerCancel,
    onPointerEnter,
    onPointerLeave,
    onPointerMove,
    resetDuration = 180,
    response = 120,
    style,
    ...props
  },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reset = () => {
    const root = rootRef.current;
    if (!root) return;
    root.style.setProperty('--inkra-tilt-rotate-x', '0deg');
    root.style.setProperty('--inkra-tilt-rotate-y', '0deg');
    root.removeAttribute('data-tilting');
  };
  const reducedMotion = useReducedMotion(reset);
  useImperativeHandle(forwardedRef, () => rootRef.current as HTMLDivElement);

  useBrowserLayoutEffect(() => {
    if (disabled) reset();
  }, [disabled]);

  const canTrack = (event: ReactPointerEvent<HTMLDivElement>) => (
    !disabled && !reducedMotion.current && event.pointerType === 'mouse' && event.isPrimary
  );
  const handlePointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    onPointerEnter?.(event);
    if (event.defaultPrevented || !canTrack(event)) return;
    event.currentTarget.setAttribute('data-tilting', 'true');
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    if (event.defaultPrevented || !canTrack(event)) return;
    const { rotateX, rotateY } = calculateTiltRotation(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
      maxAngle,
      axis,
    );
    event.currentTarget.style.setProperty('--inkra-tilt-rotate-x', `${rotateX}deg`);
    event.currentTarget.style.setProperty('--inkra-tilt-rotate-y', `${rotateY}deg`);
    event.currentTarget.setAttribute('data-tilting', 'true');
  };
  const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    onPointerLeave?.(event);
    reset();
  };
  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    onPointerCancel?.(event);
    reset();
  };
  const tiltStyle: TiltStyle = {
    '--inkra-tilt-max-angle': `${Math.max(0, Math.abs(maxAngle))}deg`,
    '--inkra-tilt-response': `${Math.max(0, response)}ms`,
    '--inkra-tilt-reset-duration': `${Math.max(0, resetDuration)}ms`,
    '--inkra-tilt-rotate-x': '0deg',
    '--inkra-tilt-rotate-y': '0deg',
    ...style,
  };

  return <div
    {...props}
    className={classes('inkra-tilt', className)}
    data-axis={axis}
    data-disabled={disabled || undefined}
    onPointerCancel={handlePointerCancel}
    onPointerEnter={handlePointerEnter}
    onPointerLeave={handlePointerLeave}
    onPointerMove={handlePointerMove}
    ref={rootRef}
    style={tiltStyle}
  >{children}</div>;
});

interface FlipContextValue {
  enabled: boolean;
  flipped: boolean;
  setFlipped: (flipped: boolean) => void;
}

const FlipContext = createContext<FlipContextValue | null>(null);

export interface FlipProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'> {
  /** Content shown in the initial orientation. */
  front: ReactNode;
  /** Content shown after flipping. */
  back: ReactNode;
  /** Controlled flipped state. */
  flipped?: boolean;
  /** Initial state when Flip is uncontrolled. */
  defaultFlipped?: boolean;
  /** Enables state changes without disabling content inside either face. */
  flipEnabled?: boolean;
  onFlippedChange?: (flipped: boolean) => void;
  /** Enables mouse tilt independently from flipping. */
  tilt?: boolean;
  tiltAxis?: TiltAxis;
  tiltMaxAngle?: number;
  tiltResponse?: number;
  tiltResetDuration?: number;
  /** Flip transition duration in milliseconds. */
  duration?: number;
}

type FlipStyle = CSSProperties & {
  '--inkra-flip-duration'?: string;
};

const focusableSelector = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const Flip = forwardRef<HTMLDivElement, FlipProps>(function Flip(
  {
    back,
    className,
    defaultFlipped = false,
    duration = 420,
    flipEnabled = true,
    flipped: controlledFlipped,
    front,
    onFlippedChange,
    style,
    tabIndex,
    tilt = false,
    tiltAxis = 'both',
    tiltMaxAngle = 8,
    tiltResetDuration = 180,
    tiltResponse = 120,
    ...props
  },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const previousFlipped = useRef(controlledFlipped ?? defaultFlipped);
  const [uncontrolledFlipped, setUncontrolledFlipped] = useState(defaultFlipped);
  const flipped = controlledFlipped ?? uncontrolledFlipped;
  useImperativeHandle(forwardedRef, () => rootRef.current as HTMLDivElement);

  const setFlipped = (next: boolean) => {
    if (!flipEnabled || next === flipped) return;
    if (controlledFlipped === undefined) setUncontrolledFlipped(next);
    onFlippedChange?.(next);
  };

  useBrowserLayoutEffect(() => {
    if (previousFlipped.current === flipped) return;
    previousFlipped.current = flipped;
    const outgoing = flipped ? frontRef.current : backRef.current;
    if (!outgoing?.contains(document.activeElement)) return;
    const incoming = flipped ? backRef.current : frontRef.current;
    const nextFocus = incoming?.querySelector<HTMLElement>(focusableSelector);
    (nextFocus ?? rootRef.current)?.focus({ preventScroll: true });
  }, [flipped]);

  const context: FlipContextValue = { enabled: flipEnabled, flipped, setFlipped };
  const flipStyle: FlipStyle = {
    '--inkra-flip-duration': `${Math.max(0, duration)}ms`,
    ...style,
  };

  return <FlipContext.Provider value={context}>
    <Tilt
      {...props}
      axis={tiltAxis}
      className={classes('inkra-flip', className)}
      data-flipped={flipped || undefined}
      disabled={!tilt}
      maxAngle={tiltMaxAngle}
      ref={rootRef}
      resetDuration={tiltResetDuration}
      response={tiltResponse}
      style={flipStyle}
      tabIndex={tabIndex ?? -1}
    >
      <div className="inkra-flip__scene">
        <div
          aria-hidden={flipped || undefined}
          className="inkra-flip__face inkra-flip__face--front"
          data-active={!flipped || undefined}
          inert={flipped || undefined}
          ref={frontRef}
        >{front}</div>
        <div
          aria-hidden={!flipped || undefined}
          className="inkra-flip__face inkra-flip__face--back"
          data-active={flipped || undefined}
          inert={!flipped || undefined}
          ref={backRef}
        >{back}</div>
      </div>
    </Tilt>
  </FlipContext.Provider>;
});

export interface FlipToggleProps extends ButtonProps {
  /** Explicit next state; omit to toggle the current state. */
  flipped?: boolean;
}

export const FlipToggle = forwardRef<HTMLButtonElement, FlipToggleProps>(function FlipToggle(
  { children, className, disabled, flipped: nextFlipped, onClick, type = 'button', ...props },
  ref,
) {
  const context = useContext(FlipContext);
  if (!context) throw new Error('FlipToggle must be rendered inside Flip.');

  return <Button
    {...props}
    aria-pressed={context.flipped}
    className={classes('inkra-flip-toggle', className)}
    disabled={disabled || !context.enabled}
    onClick={event => {
      onClick?.(event);
      if (!event.defaultPrevented) context.setFlipped(nextFlipped ?? !context.flipped);
    }}
    ref={ref}
    type={type}
  >{children}</Button>;
});
