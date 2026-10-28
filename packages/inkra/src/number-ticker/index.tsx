import { useInkraLocale } from '../i18n/index.js';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { PencilText } from '../PencilText.js';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import {
  canAnimateTickerValue,
  createNumberFormatter,
  createTickerFormatter,
  easeOutCubic,
  formatDerivedTickerDelta,
  formatTickerValue,
  interpolateTickerValue,
  tickerValueChanged,
  subtractTickerValues,
  tickerValueKey,
} from './model.js';
import type { NumberTickerCompact, NumberTickerCompactOptions, NumberTickerFormatOptions, NumberTickerLocale, NumberTickerValue } from './model.js';
import { ExactDecimal } from './precision.js';
import { RollingValue } from './RollingValue.js';
import { createRollingMotion, rollingTokens, sameRollingTokens } from './rolling.js';
import type { RollingFrame, RollingMotionColumn } from './rolling.js';
import { MorphValue } from './MorphValue.js';
import { morphTokenMapping } from './morph.js';
import { createMorphMotion, measureMorphWidths } from './morph-motion.js';
import type { MorphFrame, MorphMotion } from './morph-motion.js';

export type NumberTickerAnimation = 'count' | 'roll' | 'morph';
export type NumberTickerRollDirection = 'auto' | 'up' | 'down';

export interface NumberTickerRenderDetails {
  animating: boolean;
  formattedValue: string;
}

export interface NumberTickerDeltaDetails {
  direction: 'increase' | 'decrease';
  formattedDelta: string;
}

export interface NumberTickerProps extends Omit<ComponentPropsWithoutRef<'span'>, 'children' | 'prefix'> {
  value: NumberTickerValue;
  locale?: NumberTickerLocale;
  formatOptions?: NumberTickerFormatOptions;
  compact?: NumberTickerCompact;
  compactOptions?: NumberTickerCompactOptions;
  prefix?: ReactNode;
  suffix?: ReactNode;
  renderValue?: (value: NumberTickerValue, details: NumberTickerRenderDetails) => ReactNode;
  getValueLabel?: (value: NumberTickerValue, formattedValue: string) => string;
  animate?: boolean;
  animation?: NumberTickerAnimation;
  rollDirection?: NumberTickerRollDirection;
  duration?: number;
  easing?: (progress: number) => number;
  showDelta?: boolean;
  deltaDuration?: number;
  deltaFormatOptions?: NumberTickerFormatOptions;
  renderDelta?: (delta: NumberTickerValue, details: NumberTickerDeltaDetails) => ReactNode;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useBrowserLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

function lettering(content: ReactNode, seed: string): ReactNode {
  return typeof content === 'string' ? <PencilText seed={seed}>{content}</PencilText> : content;
}

function accessibleAffix(content: ReactNode): string {
  return typeof content === 'string' || typeof content === 'number' ? String(content) : '';
}

export const NumberTicker = forwardRef<HTMLSpanElement, NumberTickerProps>(function NumberTicker(
  {
    animate = true,
    animation = 'count',
    className,
    compact = false,
    compactOptions,
    deltaDuration = 1600,
    deltaFormatOptions,
    duration = 420,
    easing = easeOutCubic,
    formatOptions,
    getValueLabel,
    locale: localeProp,
    prefix,
    renderDelta,
    renderValue,
    rollDirection = 'auto',
    showDelta = false,
    suffix,
    value,
    ...props
  },
  forwardedRef,
) {
  const { locale: inheritedLocale } = useInkraLocale();
  const locale = localeProp ?? inheritedLocale;
  const rootRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<number | null>(null);
  const deltaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayedRef = useRef(value);
  const targetRef = useRef(value);
  const [displayedValue, setDisplayedValue] = useState(value);
  const [announcedValue, setAnnouncedValue] = useState(value);
  const [animating, setAnimating] = useState(false);
  const [delta, setDelta] = useState<NumberTickerValue | null>(null);
  const [roll, setRoll] = useState<{ columns: RollingMotionColumn[]; direction: 'up' | 'down' } | null>(null);
  const [rollProgress, setRollProgress] = useState(1);
  const rollFrameRef = useRef<RollingFrame | null>(null);
  const [morph, setMorph] = useState<MorphMotion | null>(null);
  const morphFrameRef = useRef<MorphFrame | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const localeKey = Array.isArray(locale) ? locale.join('\u0000') : locale;
  const formatOptionsKey = JSON.stringify(formatOptions ?? {});
  const compactOptionsKey = tickerValueKey(compactOptions ?? {});
  const deltaFormatOptionsKey = JSON.stringify(deltaFormatOptions ?? formatOptions ?? {});
  const formatter = useMemo(
    () => createTickerFormatter(locale, formatOptions, compact, compactOptions),
    [localeKey, formatOptionsKey, compact, compactOptionsKey],
  );
  const deltaFormatter = useMemo(
    () => createTickerFormatter(locale, deltaFormatOptions ?? formatOptions, compact, compactOptions),
    [localeKey, deltaFormatOptionsKey, compact, compactOptionsKey],
  );
  const announcementFormatter = useMemo(
    () => createNumberFormatter(locale, compact ? { ...formatOptions, notation: 'standard' } : formatOptions),
    [localeKey, formatOptionsKey, compact],
  );
  useImperativeHandle(forwardedRef, () => rootRef.current as HTMLSpanElement);
  const rollRequested = animation === 'roll' && !renderValue;
  const morphRequested = animation === 'morph' && !renderValue;
  const finalParts = useMemo(() => rollRequested || morphRequested ? formatter.formatToParts(value) : [], [formatter, value, rollRequested, morphRequested]);
  const finalTokens = useMemo(() => rollingTokens(finalParts), [finalParts]);
  // Keep exact large values readable without creating thousands of painted reels.
  const useRoll = rollRequested && finalTokens.length <= 128;
  const useMorph = morphRequested && finalTokens.length <= 128;
  const useTokens = useRoll || useMorph;
  const settledTokensRef = useRef(finalTokens);
  const morphPartsRef = useRef(finalParts);
  const previousFormatterRef = useRef(formatter);
  const previousUseRollRef = useRef(useRoll);
  const previousAnimationRef = useRef(animation);
  const columns = useMemo(() => roll?.columns ?? createRollingMotion(finalTokens, finalTokens, 'up'), [roll, finalTokens]);

  useBrowserLayoutEffect(() => {
    const previousTarget = targetRef.current;
    targetRef.current = value;

    if (showDelta && tickerValueChanged(previousTarget, value)) {
      const nextDelta = subtractTickerValues(value, previousTarget);
      setDelta(nextDelta);
      if (deltaTimerRef.current !== null) clearTimeout(deltaTimerRef.current);
      if (deltaDuration > 0 && Number.isFinite(deltaDuration)) {
        deltaTimerRef.current = setTimeout(() => {
          deltaTimerRef.current = null;
          setDelta(null);
        }, deltaDuration);
      }
    } else if (!showDelta) {
      setDelta(null);
    }

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const reduceImmediately = reducedMotion
      || (typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const from = displayedRef.current;
    const formatChanged = previousFormatterRef.current !== formatter;
    previousFormatterRef.current = formatter;
    const modeChanged = previousUseRollRef.current !== useRoll || previousAnimationRef.current !== animation;
    previousUseRollRef.current = useRoll;
    previousAnimationRef.current = animation;
    if (!animate || reduceImmediately || formatChanged || modeChanged
      || (useTokens && !rollFrameRef.current && (!morphFrameRef.current || morphFrameRef.current.progress >= 1) && sameRollingTokens(settledTokensRef.current, finalTokens))
      || ((rollRequested || morphRequested) && (!useTokens || settledTokensRef.current.length > 128))
      || (!canAnimateTickerValue(from, value, duration) && !(useMorph && canAnimateTickerValue(previousTarget, value, duration)))) {
      displayedRef.current = value;
      setDisplayedValue(value);
      setAnnouncedValue(value);
      setAnimating(false);
      setRoll(null);
      setRollProgress(1);
      settledTokensRef.current = finalTokens;
      rollFrameRef.current = null;
      setMorph(null);
      morphFrameRef.current = null;
      morphPartsRef.current = finalParts;
      return undefined;
    }

    if (useMorph) {
      const direction = rollDirection === 'auto'
        ? (new ExactDecimal(String(value)).gt(String(previousTarget)) ? 'up' : 'down') : rollDirection;
      const previousTokens = morphFrameRef.current?.motion.tokens ?? settledTokensRef.current;
      const zeroPart = formatter.formatToParts(0).find(part => part.type === 'integer')?.value ?? '0';
      const zero = Array.from(zeroPart).slice(-1)[0] ?? '0';
      const mapping = morphTokenMapping(morphPartsRef.current, finalParts, previousTarget, value, zero);
      const motion = createMorphMotion(previousTokens, finalTokens, mapping, direction,
        measureMorphWidths(rootRef.current, [...previousTokens, ...finalTokens]), morphFrameRef.current ?? undefined);
      // Bound interrupted layers as well as formatted target token counts.
      if (motion.glyphs.length > 512) {
        displayedRef.current = value; setDisplayedValue(value); setAnnouncedValue(value); setAnimating(false);
        setMorph(null); morphFrameRef.current = null; morphPartsRef.current = finalParts;
        settledTokensRef.current = finalTokens; setRoll(null); rollFrameRef.current = null; setRollProgress(1);
        return undefined;
      }
      setMorph(motion);
      morphFrameRef.current = { motion, progress: 0 };
      morphPartsRef.current = finalParts;
      setRoll(null); rollFrameRef.current = null;
      setRollProgress(0);
    } else if (useRoll) {
      setMorph(null); morphFrameRef.current = null;
      const direction = rollDirection === 'auto'
        ? (new ExactDecimal(String(value)).gt(String(from)) ? 'up' : 'down') : rollDirection;
      const nextColumns = createRollingMotion(settledTokensRef.current, finalTokens, direction, rollFrameRef.current ?? undefined);
      setRoll({ columns: nextColumns, direction });
      setRollProgress(0);
      rollFrameRef.current = { columns: nextColumns, progress: 0 };
    } else {
      setRoll(null);
      rollFrameRef.current = null;
      setMorph(null); morphFrameRef.current = null;
    }
    let startTime: number | null = null;
    setAnimating(true);
    const tick = (time: number) => {
      if (startTime === null) startTime = time;
      const progress = Math.min(1, Math.max(0, (time - startTime) / duration));
      const eased = easing(progress);
      const bounded = Number.isFinite(eased) ? Math.min(1, Math.max(0, eased)) : progress;
      const next = interpolateTickerValue(from, value, bounded);
      displayedRef.current = next;
      if (useTokens) {
        setRollProgress(bounded);
        if (rollFrameRef.current) rollFrameRef.current.progress = bounded;
        if (morphFrameRef.current) morphFrameRef.current.progress = bounded;
      } else setDisplayedValue(next);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
        displayedRef.current = value;
        setDisplayedValue(value);
        setAnnouncedValue(value);
        setAnimating(false);
        setRoll(null);
        setRollProgress(1);
        settledTokensRef.current = finalTokens;
        rollFrameRef.current = null;
        if (morphFrameRef.current) morphFrameRef.current.progress = 1;
      }
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [animate, deltaDuration, duration, easing, reducedMotion, showDelta, value, useRoll, useMorph, useTokens, rollRequested, morphRequested, rollDirection, formatter, animation]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (deltaTimerRef.current !== null) clearTimeout(deltaTimerRef.current);
  }, []);

  const formattedValue = formatTickerValue(formatter, displayedValue);
  const finalFormattedValue = formatTickerValue(formatter, value);
  const announcedFormattedValue = formatTickerValue(announcementFormatter, announcedValue);
  const defaultAccessibleLabel = [accessibleAffix(prefix), announcedFormattedValue, accessibleAffix(suffix)]
    .filter(Boolean).join(' ');
  const accessibleLabel = getValueLabel?.(announcedValue, announcedFormattedValue) ?? defaultAccessibleLabel;
  const valueContent = renderValue?.(displayedValue, { animating, formattedValue })
    ?? (useMorph ? <MorphValue tokens={finalTokens} motion={morph} progress={morph ? rollProgress : 1} />
      : useRoll ? <RollingValue columns={columns} progress={roll ? rollProgress : 1} direction={roll?.direction ?? 'up'} /> : animating
      ? <span className="inkra-number-ticker__native-value">{formattedValue}</span>
      : <PencilText seed={`number-ticker-${finalFormattedValue}`}>{finalFormattedValue}</PencilText>);
  const deltaContent = delta === null ? null : (() => {
    const formattedDelta = formatDerivedTickerDelta(deltaFormatter, delta);
    const details: NumberTickerDeltaDetails = {
      direction: new ExactDecimal(String(delta)).lt(0) ? 'decrease' : 'increase',
      formattedDelta,
    };
    return renderDelta?.(delta, details) ?? <PencilText seed={`number-ticker-delta-${formattedDelta}`}>{formattedDelta}</PencilText>;
  })();
  const classes = ['inkra-number-ticker', animating && 'inkra-number-ticker--animating', className]
    .filter(Boolean).join(' ');

  return <span {...props} className={classes} ref={rootRef} data-animating={animating || undefined} data-animation={animation}>
    <span aria-hidden="true" className="inkra-number-ticker__visual">
      {prefix !== undefined && <span className="inkra-number-ticker__prefix">{lettering(prefix, 'number-ticker-prefix')}</span>}
      <span className="inkra-number-ticker__value">{valueContent}</span>
      {suffix !== undefined && <span className="inkra-number-ticker__suffix">{lettering(suffix, 'number-ticker-suffix')}</span>}
      {deltaContent !== null && <span className="inkra-number-ticker__delta" data-direction={new ExactDecimal(String(delta)).lt(0) ? 'decrease' : 'increase'}>{deltaContent}</span>}
    </span>
    <span className="inkra-number-ticker__announcement" aria-atomic="true" aria-live="polite">{accessibleLabel}</span>
  </span>;
});

export {
  createNumberFormatter,
  easeOutCubic,
  formatTickerDelta,
  formatTickerValue,
  interpolateTickerValue,
  numberTickerUnits,
} from './model.js';
export type { NumberTickerCompact, NumberTickerCompactOptions, NumberTickerFormatOptions, NumberTickerLocale, NumberTickerUnit, NumberTickerValue } from './model.js';
