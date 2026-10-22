import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import type {
  FitToViewMode,
  ReactZoomPanPinchRef,
  ZoomToElementOptions,
  ZoomToElementTarget,
} from 'react-zoom-pan-pinch';
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { PencilSurface } from '../PencilSurface.js';
import type {
  CSSProperties,
  ForwardedRef,
  HTMLAttributes,
  ReactNode,
} from 'react';

export interface PanZoomTransform {
  x: number;
  y: number;
  scale: number;
}

export interface PanZoomChangeDetails {
  reason: 'gesture' | 'programmatic';
}

export interface PanZoomPoint {
  x: number;
  y: number;
}

export interface PanZoomAnimationOptions {
  duration?: number;
}

export interface PanZoomFitOptions extends PanZoomAnimationOptions {
  mode?: FitToViewMode;
  minScale?: number;
  maxScale?: number;
}

export interface PanZoomZoomToOptions extends PanZoomAnimationOptions {
  anchor?: PanZoomPoint;
}

export type PanZoomZoomToElementOptions = ZoomToElementOptions;

export interface PanZoomRef {
  reset: (options?: PanZoomAnimationOptions) => Promise<void>;
  fit: (options?: PanZoomFitOptions) => Promise<void>;
  setTransform: (transform: PanZoomTransform, options?: PanZoomAnimationOptions) => Promise<void>;
  zoomIn: (step?: number, options?: PanZoomAnimationOptions) => Promise<void>;
  zoomOut: (step?: number, options?: PanZoomAnimationOptions) => Promise<void>;
  zoomTo: (scale: number, options?: PanZoomZoomToOptions) => Promise<void>;
  zoomToElement: (target: ZoomToElementTarget | ZoomToElementTarget[], options?: PanZoomZoomToElementOptions) => Promise<void>;
  panBy: (deltaX: number, deltaY: number, options?: PanZoomAnimationOptions) => Promise<void>;
  clientToContent: (clientX: number, clientY: number) => PanZoomPoint;
  contentToClient: (x: number, y: number) => PanZoomPoint;
  getTransform: () => PanZoomTransform;
  getViewportElement: () => HTMLDivElement | null;
  getContentElement: () => HTMLDivElement | null;
}

export type PanZoomWheelMode = 'modifier' | 'always' | 'disabled';

export interface PanZoomProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue' | 'onChange'> {
  children: ReactNode;
  value?: PanZoomTransform;
  defaultValue?: PanZoomTransform;
  onTransformChange?: (transform: PanZoomTransform, details: PanZoomChangeDetails) => void;
  minScale?: number;
  maxScale?: number;
  wheel?: PanZoomWheelMode;
  pinch?: boolean;
  pan?: boolean;
  keyboard?: boolean;
  keyboardPanStep?: number;
  keyboardZoomStep?: number;
  doubleClickZoom?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  limitToBounds?: boolean;
  centerZoomedOut?: boolean;
  centerOnInit?: boolean;
  fitOnInit?: boolean | FitToViewMode;
  viewportClassName?: string;
  contentClassName?: string;
  viewportStyle?: CSSProperties;
  contentStyle?: CSSProperties;
  viewportProps?: Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'style' | 'children'>;
  contentProps?: Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'style' | 'children'>;
  instructions?: string;
}

const defaultTransform: PanZoomTransform = { x: 0, y: 0, scale: 1 };
const interactionExclusions = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
];

function clampScale(value: number, minScale: number, maxScale: number) {
  return Math.min(maxScale, Math.max(minScale, value));
}

function normalizedTransform(value: PanZoomTransform, minScale: number, maxScale: number): PanZoomTransform {
  return {
    x: Number.isFinite(value.x) ? value.x : 0,
    y: Number.isFinite(value.y) ? value.y : 0,
    scale: clampScale(Number.isFinite(value.scale) ? value.scale : 1, minScale, maxScale),
  };
}

function transformsEqual(left: PanZoomTransform, right: PanZoomTransform) {
  return left.x === right.x && left.y === right.y && left.scale === right.scale;
}

function prefersReducedMotion(element: HTMLElement | null) {
  return element?.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
}

function PanZoomRoot(
  {
    children,
    value,
    defaultValue = defaultTransform,
    onTransformChange,
    minScale = 0.25,
    maxScale = 8,
    wheel = 'modifier',
    pinch = true,
    pan = true,
    keyboard = true,
    keyboardPanStep = 48,
    keyboardZoomStep = 0.25,
    doubleClickZoom = false,
    disabled = false,
    readOnly = false,
    limitToBounds = true,
    centerZoomedOut = true,
    centerOnInit = false,
    fitOnInit = false,
    className,
    viewportClassName,
    contentClassName,
    style,
    viewportStyle,
    contentStyle,
    viewportProps,
    contentProps,
    instructions,
    'aria-label': ariaLabel = 'Pan and zoom content',
    ...props
  }: PanZoomProps,
  forwardedRef: ForwardedRef<PanZoomRef>,
) {
  const resolvedMinScale = Math.max(Number.isFinite(minScale) ? minScale : 0.25, 0.0001);
  const resolvedMaxScale = Math.max(Number.isFinite(maxScale) ? maxScale : 8, resolvedMinScale);
  const controlled = value !== undefined;
  const initialTransform = normalizedTransform(value ?? defaultValue, resolvedMinScale, resolvedMaxScale);
  const [uncontrolledTransform, setUncontrolledTransform] = useState(initialTransform);
  const visibleTransform = normalizedTransform(value ?? uncontrolledTransform, resolvedMinScale, resolvedMaxScale);
  const engineRef = useRef<ReactZoomPanPinchRef>(null);
  const instructionsId = useId();
  const committedRef = useRef(initialTransform);
  const programmaticRef = useRef(false);
  const pointerBlocksPanRef = useRef(false);
  const wheelTargetBlocksZoomRef = useRef(false);

  const animationDuration = useCallback((duration: number | undefined, fallback: number) => {
    if (duration !== undefined) return duration;
    return prefersReducedMotion(engineRef.current?.instance.wrapperComponent ?? null) ? 0 : fallback;
  }, []);

  const syncExternalTransform = useCallback((next: PanZoomTransform, duration = 0) => {
    const normalized = normalizedTransform(next, resolvedMinScale, resolvedMaxScale);
    committedRef.current = normalized;
    programmaticRef.current = true;
    const engine = engineRef.current;
    if (!engine) return;
    void engine.setTransform(normalized.x, normalized.y, normalized.scale, duration)
      .finally(() => {
        programmaticRef.current = false;
      });
  }, [resolvedMaxScale, resolvedMinScale]);

  useEffect(() => {
    if (!controlled || transformsEqual(visibleTransform, committedRef.current)) return;
    syncExternalTransform(visibleTransform);
  }, [controlled, syncExternalTransform, visibleTransform.x, visibleTransform.y, visibleTransform.scale]);

  useEffect(() => {
    const clamped = normalizedTransform(committedRef.current, resolvedMinScale, resolvedMaxScale);
    if (!transformsEqual(clamped, committedRef.current)) syncExternalTransform(clamped);
  }, [resolvedMaxScale, resolvedMinScale, syncExternalTransform]);

  const runProgrammatic = useCallback(async (action: (engine: ReactZoomPanPinchRef) => Promise<void>) => {
    const engine = engineRef.current;
    if (!engine || disabled) return;
    programmaticRef.current = true;
    try {
      await action(engine);
    } finally {
      programmaticRef.current = false;
    }
  }, [disabled]);

  const reconcileControlled = useCallback(() => {
    if (controlled && !transformsEqual(visibleTransform, committedRef.current)) {
      syncExternalTransform(visibleTransform, animationDuration(undefined, 100));
    }
  }, [animationDuration, controlled, syncExternalTransform, visibleTransform.x, visibleTransform.y, visibleTransform.scale]);

  useImperativeHandle(forwardedRef, () => ({
    reset: options => runProgrammatic(engine => engine.resetTransform(animationDuration(options?.duration, 200))),
    fit: options => runProgrammatic(engine => engine.fitToView({
      mode: options?.mode,
      minScale: options?.minScale,
      maxScale: options?.maxScale,
      animationTime: animationDuration(options?.duration, 200),
    })),
    setTransform: (transform, options) => runProgrammatic(engine => {
      const next = normalizedTransform(transform, resolvedMinScale, resolvedMaxScale);
      return engine.setTransform(next.x, next.y, next.scale, animationDuration(options?.duration, 200));
    }),
    zoomIn: (step = keyboardZoomStep, options) => runProgrammatic(engine => engine.zoomIn(step, animationDuration(options?.duration, 200))),
    zoomOut: (step = keyboardZoomStep, options) => runProgrammatic(engine => engine.zoomOut(step, animationDuration(options?.duration, 200))),
    zoomTo: (scale, options) => runProgrammatic((engine) => {
      const nextScale = clampScale(scale, resolvedMinScale, resolvedMaxScale);
      if (options?.anchor) {
        return engine.zoomToPoint(nextScale, options.anchor.x, options.anchor.y, animationDuration(options.duration, 200));
      }
      return engine.centerView(nextScale, animationDuration(options?.duration, 200));
    }),
    zoomToElement: (target, options) => runProgrammatic(engine => engine.zoomToElement(target, {
      ...options,
      animationTime: animationDuration(options?.animationTime, 300),
    })),
    panBy: (deltaX, deltaY, options) => runProgrammatic(engine => engine.panBy(deltaX, deltaY, animationDuration(options?.duration, 160))),
    clientToContent: (clientX, clientY) => engineRef.current?.clientToContent(clientX, clientY) ?? { x: clientX, y: clientY },
    contentToClient: (x, y) => engineRef.current?.contentToClient(x, y) ?? { x, y },
    getTransform: () => committedRef.current,
    getViewportElement: () => engineRef.current?.instance.wrapperComponent ?? null,
    getContentElement: () => engineRef.current?.instance.contentComponent ?? null,
  }), [animationDuration, keyboardZoomStep, resolvedMaxScale, resolvedMinScale, runProgrammatic]);

  const userInteractionDisabled = disabled || readOnly;
  const wheelActivation = wheel === 'modifier'
    ? (keys: string[]) => !wheelTargetBlocksZoomRef.current && (keys.includes('Control') || keys.includes('Meta'))
    : () => !wheelTargetBlocksZoomRef.current;
  const defaultInstructions = wheel === 'modifier'
    ? 'Use Control or Command with the mouse wheel to zoom. Use arrow keys to pan, plus or minus to zoom, and 0 to reset.'
    : 'Use arrow keys to pan, plus or minus to zoom, and 0 to reset.';
  const wheelHint = instructions ?? defaultInstructions;
  const mergedViewportLabel = viewportProps?.['aria-label'] ?? ariaLabel;
  const describedBy = [viewportProps?.['aria-describedby'], keyboard && !disabled ? instructionsId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return <div
    {...props}
    className={['inkra-pan-zoom', className].filter(Boolean).join(' ')}
    data-disabled={disabled || undefined}
    data-gestures={!userInteractionDisabled && (pan || pinch) || undefined}
    data-read-only={readOnly || undefined}
    data-wheel={wheel}
    style={style}
  >
    <PencilSurface aria-hidden="true" className="inkra-pan-zoom__surface" radius={8} variant="paper" />
    <div className="inkra-pan-zoom__clip">
      <TransformWrapper
        ref={engineRef}
        initialScale={initialTransform.scale}
        initialPositionX={initialTransform.x}
        initialPositionY={initialTransform.y}
        minScale={resolvedMinScale}
        maxScale={resolvedMaxScale}
        limitToBounds={limitToBounds}
        centerZoomedOut={centerZoomedOut}
        centerOnInit={centerOnInit}
        fitOnInit={fitOnInit}
        smooth
        panning={{
          disabled: userInteractionDisabled || !pan,
          excluded: interactionExclusions,
          activationKeys: () => !pointerBlocksPanRef.current,
        }}
        pinch={{ disabled: userInteractionDisabled || !pinch, excluded: interactionExclusions }}
        wheel={{
          disabled: userInteractionDisabled || wheel === 'disabled',
          activationKeys: wheelActivation,
          excluded: interactionExclusions,
        }}
        trackPadPanning={{ disabled: true }}
        keyboard={{
          disabled: userInteractionDisabled || !keyboard,
          panStep: keyboardPanStep,
          zoomStep: keyboardZoomStep,
          animationTime: 100,
          excluded: interactionExclusions,
        }}
        doubleClick={{ disabled: userInteractionDisabled || !doubleClickZoom, mode: 'zoomIn', excluded: interactionExclusions }}
        zoomAnimation={{ disabled: false, animationTime: 200 }}
        velocityAnimation={{ disabled: prefersReducedMotion(engineRef.current?.instance.wrapperComponent ?? null) }}
        onPanningStop={reconcileControlled}
        onPinchStop={reconcileControlled}
        onWheelStop={reconcileControlled}
        onZoomStop={reconcileControlled}
        onTransform={(_, state) => {
          const next = normalizedTransform({ x: state.positionX, y: state.positionY, scale: state.scale }, resolvedMinScale, resolvedMaxScale);
          committedRef.current = next;
          if (!controlled) setUncontrolledTransform(next);
          onTransformChange?.(next, { reason: programmaticRef.current ? 'programmatic' : 'gesture' });
        }}
      >
        <TransformComponent
          wrapperClass={['inkra-pan-zoom__viewport', viewportClassName].filter(Boolean).join(' ')}
          contentClass={['inkra-pan-zoom__content', contentClassName].filter(Boolean).join(' ')}
          wrapperStyle={viewportStyle}
          contentStyle={contentStyle}
          wrapperProps={{
            ...viewportProps,
            role: viewportProps?.role ?? 'region',
            'aria-label': mergedViewportLabel,
            'aria-disabled': disabled || undefined,
            'aria-readonly': readOnly || undefined,
            'aria-describedby': describedBy,
            onPointerDownCapture: event => {
              pointerBlocksPanRef.current = Boolean((event.target as HTMLElement).closest?.('[data-pan-zoom-no-drag]'));
              viewportProps?.onPointerDownCapture?.(event);
            },
            onPointerUpCapture: event => {
              pointerBlocksPanRef.current = false;
              viewportProps?.onPointerUpCapture?.(event);
            },
            onPointerCancelCapture: event => {
              pointerBlocksPanRef.current = false;
              viewportProps?.onPointerCancelCapture?.(event);
            },
            onWheelCapture: event => {
              wheelTargetBlocksZoomRef.current = Boolean((event.target as HTMLElement).closest?.('[contenteditable], [data-pan-zoom-no-drag]'));
              viewportProps?.onWheelCapture?.(event);
            },
          }}
          contentProps={contentProps}
        >
          {children}
        </TransformComponent>
      </TransformWrapper>
    </div>
    <PencilSurface aria-hidden="true" className="inkra-pan-zoom__focus-ring" radius={8} seed="pan-zoom-focus" variant="outline" />
    {keyboard && !disabled && <span className="inkra-pan-zoom__instructions visually-hidden" id={instructionsId}>{wheelHint}</span>}
  </div>;
}

export const PanZoom = forwardRef(PanZoomRoot);
