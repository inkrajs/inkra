import { FocusScope } from 'react-aria/FocusScope';
import { ariaHideOutside } from 'react-aria/private/overlays/ariaHideOutside';
import { usePreventScroll } from 'react-aria/usePreventScroll';
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '../Button.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { Progress, Skeleton } from '../display/index.js';
import { useInkraLocale } from '../i18n/index.js';
import {
  PortalThemeBridge,
  PortalThemeProvider,
  usePortalTriggerRef,
} from '../overlay/themeBridge.js';
import { formatLoadingLabel, resolveLoadingLabels, type LoadingLabels } from './locales.js';
import {
  finiteDuration,
  nextTipIndex,
  normalizeLoadingMax,
  normalizeLoadingProgress,
  normalizeTipIndex,
  type LoadingTipOrder,
} from './model.js';

export type { LoadingLabels } from './locales.js';
export type { LoadingTipOrder } from './model.js';

export type LoadingMode = 'inline' | 'region' | 'fullscreen';
export type LoadingPreset = 'brand-center' | 'scene-bottom' | 'intel' | 'staged' | 'edge' | 'skeleton';
export type LoadingStatus = 'loading' | 'error' | 'complete';
export type LoadingStageState = 'pending' | 'active' | 'complete' | 'error';
export type LoadingSlot = 'top-start' | 'top-end' | 'center' | 'bottom-start' | 'bottom-center' | 'bottom-end';
export type LoadingTipTransition = 'fade' | 'slide' | 'none';

export interface LoadingStage {
  id: string;
  label: ReactNode;
  state?: LoadingStageState;
  description?: ReactNode;
}

export interface LoadingProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title'> {
  active?: boolean;
  mode?: LoadingMode;
  preset?: LoadingPreset;
  status?: LoadingStatus;
  blocking?: boolean;
  lockScroll?: boolean;
  delay?: number;
  minDuration?: number;
  logo?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  background?: ReactNode;
  skeleton?: ReactNode;
  children?: ReactNode;
  slots?: Partial<Record<LoadingSlot, ReactNode>>;
  progress?: number | null;
  max?: number;
  progressLabel?: ReactNode;
  stages?: readonly LoadingStage[];
  activeStage?: string;
  tips?: readonly ReactNode[];
  tipOrder?: LoadingTipOrder;
  tipInterval?: number;
  tipAutoPlay?: boolean;
  tipPaused?: boolean;
  defaultTipPaused?: boolean;
  onTipPausedChange?: (paused: boolean) => void;
  tipIndex?: number;
  defaultTipIndex?: number;
  onTipIndexChange?: (index: number) => void;
  tipTransition?: LoadingTipTransition;
  showTipControls?: boolean;
  labels?: Partial<LoadingLabels>;
  onCancel?: () => void;
  onRetry?: () => void;
  onContinue?: () => void;
}

function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function assignRef<Value>(ref: Ref<Value> | undefined, value: Value | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

function useTimedPresence(active: boolean, delay: number, minDuration: number): boolean {
  const startsVisible = active && delay === 0;
  const [present, setPresent] = useState(startsVisible);
  const visibleAt = useRef<number | null>(startsVisible ? Date.now() : null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (active) {
      if (present) return undefined;
      timer = setTimeout(() => {
        visibleAt.current = Date.now();
        setPresent(true);
      }, delay);
    } else if (present) {
      const elapsed = visibleAt.current == null ? minDuration : Date.now() - visibleAt.current;
      timer = setTimeout(() => {
        visibleAt.current = null;
        setPresent(false);
      }, Math.max(0, minDuration - elapsed));
    }
    return () => clearTimeout(timer);
  }, [active, delay, minDuration, present]);

  return present;
}

function useControllableTipIndex(
  controlledIndex: number | undefined,
  defaultIndex: number | undefined,
  length: number,
  onChange: ((index: number) => void) | undefined,
) {
  const [uncontrolledIndex, setUncontrolledIndex] = useState(() => normalizeTipIndex(defaultIndex, length));
  const controlled = controlledIndex !== undefined;
  const index = normalizeTipIndex(controlled ? controlledIndex : uncontrolledIndex, length);
  const setIndex = useCallback((next: number) => {
    const normalized = normalizeTipIndex(next, length);
    if (!controlled) setUncontrolledIndex(normalized);
    if (normalized !== index) onChange?.(normalized);
  }, [controlled, index, length, onChange]);
  return [index, setIndex] as const;
}

function useControllableBoolean(
  value: boolean | undefined,
  defaultValue: boolean,
  onChange: ((value: boolean) => void) | undefined,
) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : uncontrolledValue;
  const setCurrent = useCallback((next: boolean) => {
    if (!controlled) setUncontrolledValue(next);
    if (next !== current) onChange?.(next);
  }, [controlled, current, onChange]);
  return [current, setCurrent] as const;
}

function DefaultSkeleton() {
  return <div className="inkra-loading__skeleton" aria-hidden="true">
    <Skeleton height={28} width="42%" />
    <Skeleton height={16} width="88%" />
    <Skeleton height={16} width="76%" />
    <div className="inkra-loading__skeleton-grid">
      <Skeleton height={96} />
      <Skeleton height={96} />
      <Skeleton height={96} />
    </div>
  </div>;
}

function stageState(stage: LoadingStage, activeStage: string | undefined): LoadingStageState {
  if (stage.state) return stage.state;
  return stage.id === activeStage ? 'active' : 'pending';
}

interface LoadingLayerProps extends Omit<LoadingProps, 'active' | 'delay' | 'minDuration'> {
  labelsResolved: LoadingLabels;
  present: boolean;
  forwardedRef: Ref<HTMLDivElement>;
}

function LoadingLayer({
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  activeStage,
  background,
  blocking,
  children,
  className,
  defaultTipIndex,
  defaultTipPaused = false,
  description,
  forwardedRef,
  labelsResolved,
  lockScroll,
  logo,
  max,
  mode = 'inline',
  onCancel,
  onContinue,
  onRetry,
  onTipIndexChange,
  onTipPausedChange,
  preset = 'brand-center',
  present,
  progress,
  progressLabel,
  showTipControls = false,
  skeleton,
  slots,
  stages = [],
  status = 'loading',
  style,
  tipAutoPlay = true,
  tipIndex,
  tipInterval,
  tipOrder = 'sequence',
  tipPaused,
  tips = [],
  tipTransition = 'fade',
  title,
  ...props
}: LoadingLayerProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const titleId = `${id}-title`;
  const resolvedMax = normalizeLoadingMax(max);
  const resolvedProgress = normalizeLoadingProgress(progress, resolvedMax);
  const interval = Math.max(1000, finiteDuration(tipInterval, 5000));
  const [currentTip, setCurrentTip] = useControllableTipIndex(tipIndex, defaultTipIndex, tips.length, onTipIndexChange);
  const [tipsPaused, setTipsPaused] = useControllableBoolean(tipPaused, defaultTipPaused, onTipPausedChange);
  const activeStageIndex = stages.findIndex(stage => stage.id === activeStage || stageState(stage, activeStage) === 'active');
  const stageAnnouncement = stages.length > 0 && activeStageIndex >= 0
    ? formatLoadingLabel(labelsResolved.stageProgress, { current: activeStageIndex + 1, total: stages.length })
    : undefined;
  const defaultStatus = labelsResolved[status];
  const effectiveBlocking = mode === 'fullscreen' && (blocking ?? preset !== 'edge');
  const effectiveLockScroll = mode === 'fullscreen' && (lockScroll ?? effectiveBlocking);

  usePreventScroll({ isDisabled: !(effectiveLockScroll && present) });

  useEffect(() => {
    if (!effectiveBlocking || !present || !rootRef.current) return undefined;
    return ariaHideOutside([rootRef.current], { shouldUseInert: true });
  }, [effectiveBlocking, present]);

  useEffect(() => {
    if (!present || tips.length <= 1 || !tipAutoPlay || tipsPaused || status !== 'loading') return undefined;
    const timer = setInterval(() => setCurrentTip(nextTipIndex(currentTip, tips.length, tipOrder)), interval);
    return () => clearInterval(timer);
  }, [currentTip, interval, present, setCurrentTip, status, tipAutoPlay, tipOrder, tips.length, tipsPaused]);

  const renderedTitle = title ?? defaultStatus;
  const showActions = Boolean(onCancel || status === 'error' && onRetry || status === 'complete' && onContinue);
  const hasInteractiveContent = showActions || showTipControls || children != null
    || Object.values(slots ?? {}).some(node => node != null);
  const semanticRole = effectiveBlocking ? 'dialog' : hasInteractiveContent ? 'region' : 'status';
  const content = <div
    {...props}
    aria-busy={status === 'loading' || undefined}
    aria-label={ariaLabel ?? (ariaLabelledBy || typeof renderedTitle === 'string' ? undefined : defaultStatus)}
    aria-labelledby={ariaLabelledBy ?? (typeof renderedTitle === 'string' ? titleId : undefined)}
    aria-live={semanticRole === 'status' ? 'polite' : undefined}
    aria-modal={effectiveBlocking || undefined}
    className={classes('inkra-loading', className)}
    data-blocking={effectiveBlocking || undefined}
    data-mode={mode}
    data-preset={preset}
    data-status={status}
    ref={node => {
      rootRef.current = node;
      assignRef(forwardedRef, node);
    }}
    role={semanticRole}
    style={style}
    tabIndex={effectiveBlocking ? -1 : undefined}
  >
    {background == null ? null : <div className="inkra-loading__background" aria-hidden="true">{background}</div>}
    <div className="inkra-loading__veil" aria-hidden="true" />
    {semanticRole === 'region' ? <span className="inkra-loading__sr-status" role="status">{defaultStatus}</span> : null}
    <div className="inkra-loading__layout">
      <div className="inkra-loading__main">
        {logo == null ? null : <div className="inkra-loading__logo">{logo}</div>}
        <div className="inkra-loading__copy">
          {typeof renderedTitle === 'string'
            ? <PencilText as="div" className="inkra-loading__title" id={titleId} seed={`${id}-title`}>{renderedTitle}</PencilText>
            : <div className="inkra-loading__title" id={titleId}>{renderedTitle}</div>}
          {description == null ? null : typeof description === 'string'
            ? <PencilText as="div" className="inkra-loading__description" seed={`${id}-description`}>{description}</PencilText>
            : <div className="inkra-loading__description">{description}</div>}
        </div>

        {preset === 'skeleton' ? (skeleton ?? <DefaultSkeleton />) : null}

        {stages.length > 0 ? <div className="inkra-loading__stages" aria-label={stageAnnouncement}>
          {stages.map((stage, index) => {
            const state = stageState(stage, activeStage);
            return <div className="inkra-loading__stage" data-state={state} key={stage.id}>
              <PencilSurface className="inkra-loading__stage-marker" variant={state === 'active' ? 'selection' : state === 'error' ? 'danger' : 'outline'} radius={8}>
                <PencilText>{state === 'complete' ? '✓' : state === 'error' ? '!' : String(index + 1)}</PencilText>
              </PencilSurface>
              <div className="inkra-loading__stage-copy">
                {typeof stage.label === 'string' ? <PencilText>{stage.label}</PencilText> : stage.label}
                {stage.description == null ? null : <span className="inkra-loading__stage-description">{stage.description}</span>}
              </div>
            </div>;
          })}
        </div> : null}

        {progress !== undefined ? <Progress
          aria-label={typeof progressLabel === 'string' ? progressLabel : defaultStatus}
          className="inkra-loading__progress"
          label={progressLabel}
          max={resolvedMax}
          shape={preset === 'brand-center' ? 'circular' : 'linear'}
          size={preset === 'brand-center' ? 'sm' : 'md'}
          value={resolvedProgress ?? null}
        >
          {resolvedProgress == null || preset === 'brand-center' ? null : `${Math.round(resolvedProgress / resolvedMax * 100)}%`}
        </Progress> : null}

        {tips.length > 0 ? <div className="inkra-loading__tips" data-transition={tipTransition}>
          <div className="inkra-loading__tip" key={`${currentTip}-${tipTransition}`}>{tips[currentTip]}</div>
          {showTipControls && tips.length > 1 ? <div className="inkra-loading__tip-controls">
            <Button aria-label={labelsResolved.previousTip} size="icon-sm" variant="ghost" onClick={() => setCurrentTip(currentTip - 1)}>←</Button>
            <span className="inkra-loading__tip-position" aria-live="off">{currentTip + 1} / {tips.length}</span>
            {tipAutoPlay ? <Button
              aria-label={tipsPaused ? labelsResolved.resumeTips : labelsResolved.pauseTips}
              size="icon-sm"
              variant="ghost"
              onClick={() => setTipsPaused(!tipsPaused)}
            >{tipsPaused ? '▶' : 'Ⅱ'}</Button> : null}
            <Button aria-label={labelsResolved.nextTip} size="icon-sm" variant="ghost" onClick={() => setCurrentTip(currentTip + 1)}>→</Button>
          </div> : null}
        </div> : null}

        {children == null ? null : <div className="inkra-loading__content-layer">{children}</div>}
        {showActions ? <div className="inkra-loading__actions">
          {onCancel ? <Button variant="ghost" onClick={onCancel}>{labelsResolved.cancel}</Button> : null}
          {status === 'error' && onRetry ? <Button onClick={onRetry}>{labelsResolved.retry}</Button> : null}
          {status === 'complete' && onContinue ? <Button onClick={onContinue}>{labelsResolved.continue}</Button> : null}
        </div> : null}
      </div>
    </div>
    {(Object.entries(slots ?? {}) as Array<[LoadingSlot, ReactNode]>).map(([slot, node]) => node == null ? null :
      <div className="inkra-loading__slot" data-slot={slot} key={slot}>{node}</div>)}
    {preset === 'edge' ? <PencilLine className="inkra-loading__edge-line" seed={`${id}-edge`} /> : null}
  </div>;

  return effectiveBlocking
    ? <FocusScope contain restoreFocus autoFocus>{content}</FocusScope>
    : content;
}

interface FullscreenPortalProps extends Omit<LoadingLayerProps, 'forwardedRef'> {
  forwardedRef: Ref<HTMLDivElement>;
}

function FullscreenPortal(props: FullscreenPortalProps) {
  const [mounted, setMounted] = useState(false);
  const anchorRef = usePortalTriggerRef<HTMLSpanElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const restoreGenerationRef = useRef(0);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const generation = ++restoreGenerationRef.current;
    return () => {
      const target = restoreFocusRef.current;
      if (!target?.isConnected || typeof requestAnimationFrame !== 'function') return;
      requestAnimationFrame(() => {
        if (restoreGenerationRef.current !== generation || !target.isConnected) return;
        if (document.activeElement === document.body) target.focus({ preventScroll: true });
      });
    };
  }, []);
  const layer = <PortalThemeBridge><LoadingLayer {...props} /></PortalThemeBridge>;
  return <>
    <span aria-hidden="true" className="inkra-loading__theme-anchor" ref={anchorRef} />
    {mounted && typeof document !== 'undefined' ? createPortal(layer, document.body) : layer}
  </>;
}

export const Loading = forwardRef<HTMLDivElement, LoadingProps>(function Loading(
  {
    active = true,
    delay,
    labels,
    minDuration,
    mode = 'inline',
    ...props
  },
  ref,
) {
  const { locale } = useInkraLocale();
  const resolvedDelay = finiteDuration(delay, 0);
  const resolvedMinDuration = finiteDuration(minDuration, 0);
  const present = useTimedPresence(active, resolvedDelay, resolvedMinDuration);
  const labelsResolved = useMemo(() => resolveLoadingLabels(locale, labels), [labels, locale]);
  if (!present) return null;

  const layerProps: LoadingLayerProps = {
    ...props,
    forwardedRef: ref,
    labelsResolved,
    mode,
    present,
  };

  return mode === 'fullscreen'
    ? <PortalThemeProvider><FullscreenPortal {...layerProps} /></PortalThemeProvider>
    : <LoadingLayer {...layerProps} />;
});
