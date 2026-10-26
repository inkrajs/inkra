import * as PopoverPrimitive from '@radix-ui/react-popover';
import { __iconData as skipIcon } from 'lucide-react/dist/esm/icons/skip-forward.mjs';
import { __iconData as closeIcon } from 'lucide-react/dist/esm/icons/x.mjs';
import {
  Children,
  Fragment,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  ComponentPropsWithoutRef,
  ComponentRef,
  KeyboardEvent,
  ReactElement,
  ReactNode,
  Ref,
  RefObject,
} from 'react';

import { Button } from '../Button.js';
import { useInkraLocale } from '../i18n/index.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import {
  PortalThemeProvider,
  usePortalThemeProps,
  usePortalTriggerRef,
} from '../overlay/themeBridge.js';

type GuideSide = 'top' | 'right' | 'bottom' | 'left';
type GuideAlign = 'start' | 'center' | 'end';
export type GuideSkipPlacement = 'panel' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
export type GuideSkipAppearance = 'icon' | 'text';

export type GuideTarget =
  | string
  | HTMLElement
  | RefObject<HTMLElement | null>
  | (() => HTMLElement | null);

export interface GuideStepProps {
  /** Stable identifier reported by callbacks. */
  id?: string;
  /** A selector, element, ref, or resolver. Missing targets fall back to the viewport. */
  target: GuideTarget;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  side?: GuideSide;
  align?: GuideAlign;
  sideOffset?: number;
  collisionPadding?: number;
}

export function GuideStep(_props: GuideStepProps) {
  return null;
}

GuideStep.displayName = 'Guide.Step';

export type GuideOpenChangeReason = 'trigger' | 'close' | 'escape' | 'finish' | 'skip';

export interface GuideOpenChangeDetails {
  reason: GuideOpenChangeReason;
  step: number;
  stepId?: string;
}

export interface GuideStepChangeDetails {
  reason: 'next' | 'previous';
  previousStep: number;
  stepId?: string;
}

export interface GuideLabels {
  previous: string;
  next: string;
  finish: string;
  skip: string;
  close: string;
  /** Supports {current} and {total}. */
  progress: string;
}

export interface GuideRootProps {
  children?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: GuideOpenChangeDetails) => void;
  step?: number;
  defaultStep?: number;
  onStepChange?: (step: number, details: GuideStepChangeDetails) => void;
  onFinish?: () => void;
  onSkip?: () => void;
  showSkip?: boolean;
  skipPlacement?: GuideSkipPlacement;
  skipAppearance?: GuideSkipAppearance;
  showClose?: boolean;
  closeOnEscape?: boolean;
  scrollIntoView?: boolean | ScrollIntoViewOptions;
  restoreFocus?: boolean;
  highlightPadding?: number;
  highlightRadius?: number;
  locale?: string;
  labels?: Partial<GuideLabels>;
  portalContainer?: HTMLElement | null;
  className?: string;
}

interface GuideTriggerContextValue {
  setTrigger: (node: HTMLButtonElement | null) => void;
}

const GuideTriggerContext = createContext<GuideTriggerContextValue | null>(null);

export type GuideTriggerProps = PopoverPrimitive.PopoverTriggerProps;

function assignRef<Value>(ref: Ref<Value> | undefined, value: Value | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

export const GuideTrigger = forwardRef<
  ComponentRef<typeof PopoverPrimitive.Trigger>,
  GuideTriggerProps
>(function GuideTrigger(props, forwardedRef) {
  const context = useContext(GuideTriggerContext);
  const portalRef = usePortalTriggerRef(forwardedRef);
  const ref = useCallback((node: HTMLButtonElement | null) => {
    portalRef(node);
    if (node) context?.setTrigger(node);
  }, [context, portalRef]);
  return <PopoverPrimitive.Trigger {...props} ref={ref} />;
});

function classes(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function clampStep(step: number | undefined, count: number): number {
  if (count <= 0) return 0;
  const finite = Number.isFinite(step) ? Math.trunc(step as number) : 0;
  return Math.min(count - 1, Math.max(0, finite));
}

function bounded(value: number | undefined, fallback: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(0, value as number)) : fallback;
}

function resolveTarget(target: GuideTarget): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (typeof target === 'string') return document.querySelector<HTMLElement>(target);
  if (typeof target === 'function') return target();
  if ('current' in target) return target.current;
  return target;
}

function isTextEntry(node: EventTarget | null): boolean {
  return node instanceof HTMLElement
    && (node.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName));
}

function formatProgress(template: string, current: number, total: number): string {
  return template.replace(/\{current\}/g, String(current)).replace(/\{total\}/g, String(total));
}

function collectGuideChildren(children: ReactNode): { steps: GuideStepProps[]; content: ReactNode[] } {
  const steps: GuideStepProps[] = [];
  const content: ReactNode[] = [];
  const collect = (items: ReactNode) => Children.forEach(items, child => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
      collect(child.props.children);
    } else if (isValidElement<GuideStepProps>(child) && child.type === GuideStep) {
      steps.push(child.props);
    } else {
      content.push(child);
    }
  });
  collect(children);
  return { steps, content };
}

interface Measurable {
  getBoundingClientRect: () => DOMRect;
}

interface GuideLayerProps {
  activeStep: GuideStepProps;
  activeIndex: number;
  total: number;
  className?: string;
  closeOnEscape: boolean;
  highlightPadding: number;
  highlightRadius: number;
  labels: GuideLabels;
  portalContainer?: HTMLElement | null;
  scrollIntoView: boolean | ScrollIntoViewOptions;
  showClose: boolean;
  showSkip: boolean;
  skipAppearance: GuideSkipAppearance;
  skipPlacement: GuideSkipPlacement;
  onClose: () => void;
  onEscape: () => void;
  onFinish: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
}

const closePaths = closeIcon.node.map(([, attributes]) => ({ d: attributes.d }));
const skipPaths = skipIcon.node.map(([, attributes]: [string, { d: string }]) => ({ d: attributes.d }));
const cornerPlacements: Exclude<GuideSkipPlacement, 'panel'>[] = ['top-start', 'top-end', 'bottom-start', 'bottom-end'];

function focusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return [...container.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}

function cornerRect(
  placement: Exclude<GuideSkipPlacement, 'panel'>,
  width: number,
  height: number,
  direction: 'ltr' | 'rtl',
): DOMRect {
  const inset = 16;
  const start = direction === 'rtl' ? window.innerWidth - inset - width : inset;
  const end = direction === 'rtl' ? inset : window.innerWidth - inset - width;
  return new DOMRect(
    placement.endsWith('start') ? start : end,
    placement.startsWith('top') ? inset : window.innerHeight - inset - height,
    width,
    height,
  );
}

function overlaps(left: DOMRect, right: DOMRect, gap = 8): boolean {
  return left.left < right.right + gap && left.right > right.left - gap
    && left.top < right.bottom + gap && left.bottom > right.top - gap;
}

function GuideLayer({
  activeStep,
  activeIndex,
  total,
  className,
  closeOnEscape,
  highlightPadding,
  highlightRadius,
  labels,
  portalContainer,
  scrollIntoView,
  showClose,
  showSkip,
  skipAppearance,
  skipPlacement,
  onClose,
  onEscape,
  onFinish,
  onNext,
  onPrevious,
  onSkip,
}: GuideLayerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const [resolvedSkipPlacement, setResolvedSkipPlacement] = useState(skipPlacement);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const fallbackAnchor = useRef<Measurable>({
    getBoundingClientRect: () => {
      const width = typeof window === 'undefined' ? 0 : window.innerWidth;
      const height = typeof window === 'undefined' ? 0 : window.innerHeight;
      return new DOMRect(width / 2, Math.max(24, height * 0.38), 1, 1);
    },
  });
  const anchorRef = useRef<Measurable | null>(fallbackAnchor.current);
  anchorRef.current = target ?? fallbackAnchor.current;

  const measure = useCallback(() => {
    setViewportWidth(current => current === window.innerWidth ? current : window.innerWidth);
    const nextTarget = resolveTarget(activeStep.target);
    setTarget(current => current === nextTarget ? current : nextTarget);
    const nextRect = nextTarget?.getBoundingClientRect() ?? null;
    setTargetRect(current => {
      if (!current && !nextRect) return current;
      if (current && nextRect
        && current.x === nextRect.x && current.y === nextRect.y
        && current.width === nextRect.width && current.height === nextRect.height) return current;
      return nextRect;
    });
  }, [activeStep.target]);

  useEffect(() => {
    let frame = 0;
    let secondFrame = 0;
    const initialTarget = resolveTarget(activeStep.target);
    if (initialTarget && scrollIntoView) {
      const options = scrollIntoView === true
        ? { block: 'center', inline: 'nearest', behavior: 'smooth' } satisfies ScrollIntoViewOptions
        : scrollIntoView;
      if (typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        initialTarget.scrollIntoView(options);
      } else {
        initialTarget.scrollIntoView({ ...options, behavior: 'auto' });
      }
    }
    measure();
    frame = requestAnimationFrame(() => {
      measure();
      secondFrame = requestAnimationFrame(measure);
    });
    const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(measure);
    observer?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['id', 'class', 'hidden'],
    });
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(secondFrame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [activeIndex, activeStep.target, measure, scrollIntoView]);

  useEffect(() => {
    if (!target || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, [measure, target]);

  useEffect(() => {
    if (!showSkip || skipPlacement === 'panel') {
      setResolvedSkipPlacement(skipPlacement);
      return undefined;
    }
    let frame = 0;
    const resolvePlacement = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const content = contentRef.current;
        const skip = skipRef.current;
        if (!content) return;
        const contentRect = content.getBoundingClientRect();
        const skipRect = skip?.getBoundingClientRect();
        const direction = getComputedStyle(content).direction === 'rtl' ? 'rtl' : 'ltr';
        const preferred = skipPlacement as Exclude<GuideSkipPlacement, 'panel'>;
        const alternatives = [
          preferred,
          preferred.startsWith('top') ? preferred.replace('top', 'bottom') : preferred.replace('bottom', 'top'),
          preferred.endsWith('start') ? preferred.replace('start', 'end') : preferred.replace('end', 'start'),
          ...cornerPlacements,
        ] as Exclude<GuideSkipPlacement, 'panel'>[];
        const width = skipRect?.width || (skipAppearance === 'icon' ? 44 : 128);
        const height = skipRect?.height || 44;
        const next = alternatives.find(placement => !overlaps(cornerRect(placement, width, height, direction), contentRect)) ?? 'panel';
        setResolvedSkipPlacement(current => current === next ? current : next);
      });
    };
    resolvePlacement();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resolvePlacement);
    if (contentRef.current) observer?.observe(contentRef.current);
    if (skipRef.current) observer?.observe(skipRef.current);
    window.addEventListener('resize', resolvePlacement);
    window.addEventListener('scroll', resolvePlacement, true);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', resolvePlacement);
      window.removeEventListener('scroll', resolvePlacement, true);
    };
  }, [activeIndex, showSkip, skipAppearance, skipPlacement]);

  const themedProps = usePortalThemeProps({});
  const paddedRect = targetRect ? {
    left: Math.max(0, targetRect.left - highlightPadding),
    top: Math.max(0, targetRect.top - highlightPadding),
    width: Math.max(1, Math.min(window.innerWidth, targetRect.right + highlightPadding) - Math.max(0, targetRect.left - highlightPadding)),
    height: Math.max(1, Math.min(window.innerHeight, targetRect.bottom + highlightPadding) - Math.max(0, targetRect.top - highlightPadding)),
  } : null;
  const description = activeStep.description ?? activeStep.children;
  const last = activeIndex === total - 1;
  const progress = formatProgress(labels.progress, activeIndex + 1, total);
  const collisionPadding = activeStep.collisionPadding ?? 16;
  const sideOffset = activeStep.sideOffset ?? 12;
  const preferredSide = activeStep.side ?? 'bottom';
  const expectedWidth = viewportWidth <= 480
    ? Math.max(1, viewportWidth - 16)
    : Math.min(352, Math.max(1, viewportWidth - 24));
  const side = targetRect && (preferredSide === 'left' || preferredSide === 'right')
    && Math.max(
      targetRect.left - collisionPadding - sideOffset,
      viewportWidth - targetRect.right - collisionPadding - sideOffset,
    ) < expectedWidth
    ? 'bottom'
    : preferredSide;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      const focusables = focusableElements(contentRef.current);
      const first = focusables[0];
      const lastFocusable = focusables[focusables.length - 1];
      const cornerSkip = showSkip && resolvedSkipPlacement !== 'panel';
      if (!event.shiftKey && event.target === lastFocusable) {
        event.preventDefault();
        (cornerSkip ? skipRef.current : first ?? contentRef.current)?.focus();
        return;
      }
      if (event.shiftKey && (event.target === first || event.target === contentRef.current)) {
        event.preventDefault();
        (cornerSkip ? skipRef.current : lastFocusable ?? contentRef.current)?.focus();
        return;
      }
    }
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isTextEntry(event.target)) return;
    const direction = getComputedStyle(event.currentTarget).direction;
    const nextKey = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const previousKey = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === nextKey) {
      event.preventDefault();
      last ? onFinish() : onNext();
    } else if (event.key === previousKey && activeIndex > 0) {
      event.preventDefault();
      onPrevious();
    }
  };

  const handleSkipKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Tab') return;
    const focusables = focusableElements(contentRef.current);
    const destination = event.shiftKey ? focusables[focusables.length - 1] ?? contentRef.current : focusables[0] ?? contentRef.current;
    event.preventDefault();
    destination?.focus();
  };

  const skipAction = (corner: boolean) => <Button
    aria-label={labels.skip}
    className={corner ? 'inkra-guide__skip' : 'inkra-guide__skip-panel'}
    data-appearance={skipAppearance}
    data-placement={corner ? resolvedSkipPlacement : 'panel'}
    data-tooltip={corner && skipAppearance === 'icon' ? labels.skip : undefined}
    onClick={onSkip}
    onKeyDown={corner ? handleSkipKeyDown : undefined}
    ref={corner ? skipRef : undefined}
    size={skipAppearance === 'icon' ? 'icon-xs' : 'sm'}
    title={corner && skipAppearance === 'icon' ? labels.skip : undefined}
    variant="ghost"
  >
    {skipAppearance === 'icon'
      ? <PencilIcon decorative paths={skipPaths} size={18} sourceSize={24} />
      : labels.skip}
  </Button>;

  return (
    <>
      <PopoverPrimitive.Anchor virtualRef={anchorRef} />
      <PopoverPrimitive.Portal container={portalContainer ?? undefined}>
        {paddedRect ? (
          <PencilSurface
            {...themedProps}
            aria-hidden="true"
            className="inkra-guide__spotlight"
            radius={highlightRadius}
            seed={`inkra-guide-highlight-${activeStep.id ?? activeIndex}`}
            style={{
              '--inkra-guide-highlight-radius': `${highlightRadius}px`,
              height: paddedRect.height,
              left: paddedRect.left,
              top: paddedRect.top,
              width: paddedRect.width,
            } as CSSProperties}
            variant="outline"
          />
        ) : <div {...themedProps} aria-hidden="true" className="inkra-guide__backdrop" />}
      </PopoverPrimitive.Portal>
      {showSkip && resolvedSkipPlacement !== 'panel' ? (
        <PopoverPrimitive.Portal container={portalContainer ?? undefined}>
          <div {...themedProps} className="inkra-guide__skip-layer">
            {skipAction(true)}
          </div>
        </PopoverPrimitive.Portal>
      ) : null}
      <PopoverPrimitive.Portal container={portalContainer ?? undefined}>
        <PopoverPrimitive.Content
          {...themedProps}
          ref={contentRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          align={activeStep.align ?? 'center'}
          className={classes('inkra-guide__content', className)}
          collisionPadding={collisionPadding}
          data-target-missing={!target || undefined}
          onCloseAutoFocus={event => event.preventDefault()}
          onEscapeKeyDown={event => {
            event.preventDefault();
            if (closeOnEscape) onEscape();
          }}
          onFocusOutside={event => event.preventDefault()}
          onInteractOutside={event => event.preventDefault()}
          onKeyDown={handleKeyDown}
          onOpenAutoFocus={event => {
            event.preventDefault();
            requestAnimationFrame(() => contentRef.current?.focus({ preventScroll: true }));
          }}
          side={side}
          sideOffset={sideOffset}
          tabIndex={-1}
        >
          <PencilSurface
            className="inkra-guide__surface"
            radius={8}
            seed={`inkra-guide-panel-${activeStep.id ?? activeIndex}`}
            variant="paper"
          >
            <div className="inkra-guide__panel">
              <header className="inkra-guide__header">
                <div className="inkra-guide__heading">
                  <span className="inkra-guide__progress"><PencilText>{progress}</PencilText></span>
                  <h2 className="inkra-guide__title" id={titleId}><PencilText>{activeStep.title}</PencilText></h2>
                </div>
                {showClose ? (
                  <Button aria-label={labels.close} className="inkra-guide__close" onClick={onClose} size="icon" variant="ghost">
                    <PencilIcon decorative paths={closePaths} size={24} sourceSize={24} />
                  </Button>
                ) : null}
              </header>
              {description ? (
                <div className="inkra-guide__description" id={descriptionId}>
                  {typeof description === 'string' ? <PencilText>{description}</PencilText> : description}
                </div>
              ) : null}
              <footer className="inkra-guide__footer">
                {showSkip && resolvedSkipPlacement === 'panel' ? skipAction(false) : <span />}
                <div className="inkra-guide__navigation">
                  <Button disabled={activeIndex === 0} onClick={onPrevious} variant="secondary">{labels.previous}</Button>
                  <Button onClick={last ? onFinish : onNext}>{last ? labels.finish : labels.next}</Button>
                </div>
              </footer>
            </div>
          </PencilSurface>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </>
  );
}

export function GuideRoot({
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  step,
  defaultStep = 0,
  onStepChange,
  onFinish,
  onSkip,
  showSkip = true,
  skipPlacement = 'top-end',
  skipAppearance = 'icon',
  showClose = true,
  closeOnEscape = true,
  scrollIntoView = true,
  restoreFocus = true,
  highlightPadding,
  highlightRadius,
  locale,
  labels,
  portalContainer,
  className,
}: GuideRootProps) {
  const { t } = useInkraLocale(locale);
  const { steps, content } = useMemo(() => collectGuideChildren(children), [children]);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [uncontrolledStep, setUncontrolledStep] = useState(() => clampStep(defaultStep, steps.length));
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasVisibleOpenRef = useRef(false);
  const controlledOpen = open !== undefined;
  const controlledStep = step !== undefined;
  const currentOpen = controlledOpen ? open : uncontrolledOpen;
  const activeIndex = clampStep(controlledStep ? step : uncontrolledStep, steps.length);
  const activeStep = steps[activeIndex];
  const visibleOpen = Boolean(currentOpen && activeStep);
  const resolvedLabels = useMemo<GuideLabels>(() => ({
    previous: labels?.previous ?? t('guide.previous'),
    next: labels?.next ?? t('guide.next'),
    finish: labels?.finish ?? t('guide.finish'),
    skip: labels?.skip ?? t('guide.skip'),
    close: labels?.close ?? t('guide.close'),
    progress: labels?.progress ?? t('guide.progress'),
  }), [labels, t]);

  useEffect(() => {
    if (visibleOpen) previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [visibleOpen]);

  useEffect(() => {
    const wasVisibleOpen = wasVisibleOpenRef.current;
    wasVisibleOpenRef.current = visibleOpen;
    if (!wasVisibleOpen || visibleOpen || !restoreFocus) return undefined;
    const frame = requestAnimationFrame(() => {
      const previousFocus = previousFocusRef.current;
      const trigger = triggerRef.current;
      const destination = trigger?.isConnected ? trigger : previousFocus?.isConnected ? previousFocus : null;
      destination?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [restoreFocus, visibleOpen]);

  useEffect(() => {
    if (!controlledStep && uncontrolledStep !== activeIndex) setUncontrolledStep(activeIndex);
  }, [activeIndex, controlledStep, uncontrolledStep]);

  const requestOpen = useCallback((nextOpen: boolean, reason: GuideOpenChangeReason) => {
    if (!controlledOpen) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen, { reason, step: activeIndex, stepId: activeStep?.id });
  }, [activeIndex, activeStep?.id, controlledOpen, onOpenChange]);

  const requestStep = useCallback((nextStep: number, reason: GuideStepChangeDetails['reason']) => {
    const next = clampStep(nextStep, steps.length);
    if (next === activeIndex) return;
    if (!controlledStep) setUncontrolledStep(next);
    onStepChange?.(next, { reason, previousStep: activeIndex, stepId: steps[next]?.id });
  }, [activeIndex, controlledStep, onStepChange, steps]);

  const resetUncontrolledStep = useCallback(() => {
    if (!controlledStep) setUncontrolledStep(clampStep(defaultStep, steps.length));
  }, [controlledStep, defaultStep, steps.length]);

  const finish = useCallback(() => {
    onFinish?.();
    requestOpen(false, 'finish');
    resetUncontrolledStep();
  }, [onFinish, requestOpen, resetUncontrolledStep]);

  const skip = useCallback(() => {
    onSkip?.();
    requestOpen(false, 'skip');
    resetUncontrolledStep();
  }, [onSkip, requestOpen, resetUncontrolledStep]);

  const triggerContext = useMemo(() => ({
    setTrigger: (node: HTMLButtonElement | null) => {
      if (node) triggerRef.current = node;
    },
  }), []);

  return (
    <PortalThemeProvider>
      <GuideTriggerContext.Provider value={triggerContext}>
        <PopoverPrimitive.Root
          modal={false}
          open={visibleOpen}
          onOpenChange={nextOpen => requestOpen(nextOpen, 'trigger')}
        >
          {content}
          {visibleOpen && activeStep ? (
            <GuideLayer
              activeIndex={activeIndex}
              activeStep={activeStep}
              className={className}
              closeOnEscape={closeOnEscape}
              highlightPadding={bounded(highlightPadding, 8, 48)}
              highlightRadius={bounded(highlightRadius, 8, 32)}
              labels={resolvedLabels}
              onClose={() => requestOpen(false, 'close')}
              onEscape={() => requestOpen(false, 'escape')}
              onFinish={finish}
              onNext={() => requestStep(activeIndex + 1, 'next')}
              onPrevious={() => requestStep(activeIndex - 1, 'previous')}
              onSkip={skip}
              portalContainer={portalContainer}
              scrollIntoView={scrollIntoView}
              showClose={showClose}
              showSkip={showSkip}
              skipAppearance={skipAppearance}
              skipPlacement={skipPlacement}
              total={steps.length}
            />
          ) : null}
        </PopoverPrimitive.Root>
      </GuideTriggerContext.Provider>
    </PortalThemeProvider>
  );
}

export const Guide = /* @__PURE__ */ Object.freeze({
  Root: GuideRoot,
  Trigger: GuideTrigger,
  Step: GuideStep,
});
