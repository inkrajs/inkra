import { useInkraLocale } from '../i18n/index.js';
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { PencilIcon, type PencilIconPath } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';

export type RatingSize = 'sm' | 'md' | 'lg';
export type RatingClearStrategy = boolean | 'reselect' | 'keyboard';

export interface RatingSymbolState {
  /** One-based symbol position. */
  index: number;
  /** Fraction displayed for this symbol, from 0 to 1. */
  fraction: number;
  filled: boolean;
  previewing: boolean;
}

export interface RatingProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue' | 'onChange'> {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  name?: string;
  form?: string;
  hoverPreview?: boolean;
  onPreviewChange?: (value: number | null) => void;
  count?: number;
  step?: number;
  clearable?: RatingClearStrategy;
  disabled?: boolean;
  readOnly?: boolean;
  size?: RatingSize;
  dir?: 'ltr' | 'rtl';
  symbol?: ReactNode;
  renderSymbol?: (state: RatingSymbolState) => ReactNode;
  getValueLabel?: (value: number, count: number) => string;
}

const defaultSymbolPaths: readonly PencilIconPath[] = [
  { d: 'M12 2.5 L21.5 12 L12 21.5 L2.5 12 Z' },
  { d: 'M7.5 12 L12 7.5 L16.5 12 L12 16.5 Z', mode: 'scuff' },
];

function finitePositive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function decimalPlaces(value: number): number {
  const [coefficient, exponentText] = String(value).toLowerCase().split('e');
  const [, fraction = ''] = coefficient.split('.');
  const exponent = Number(exponentText ?? 0);
  return Math.max(0, fraction.length - exponent);
}

export function normalizeRatingValue(value: number | undefined, count: number, step: number): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  if (numeric <= 0) return 0;
  if (numeric >= count) return count;
  const precision = Math.min(8, Math.max(decimalPlaces(step), decimalPlaces(count)));
  const snapped = Math.round(numeric / step) * step;
  return Number(Math.min(count, Math.max(0, snapped)).toFixed(precision));
}

function allowsReselectClear(clearable: RatingClearStrategy): boolean {
  return clearable === true || clearable === 'reselect';
}

function allowsKeyboardClear(clearable: RatingClearStrategy): boolean {
  return clearable === true || clearable === 'keyboard';
}

function previousRatingValue(value: number, count: number, step: number): number {
  if (value >= count) {
    const precision = Math.min(8, Math.max(decimalPlaces(step), decimalPlaces(count)));
    const previousIndex = Math.max(0, Math.ceil(count / step) - 1);
    return Number((previousIndex * step).toFixed(precision));
  }
  return value - step;
}

export const Rating = forwardRef<HTMLDivElement, RatingProps>(function Rating(
  {
    value,
    defaultValue = 0,
    onValueChange,
    name,
    form,
    hoverPreview = true,
    onPreviewChange,
    count: countProp = 5,
    step: stepProp = 1,
    clearable = false,
    disabled = false,
    readOnly = false,
    size = 'md',
    dir,
    symbol,
    renderSymbol,
    getValueLabel: valueLabelProp,
    className = '',
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    onBlur,
    onKeyDown,
    onPointerDown,
    onPointerLeave,
    ...props
  },
  forwardedRef,
) {
  const { t } = useInkraLocale();
  const getValueLabel = valueLabelProp ?? ((value: number, count: number) => t('rating.value', { value, count }));
  const count = Math.max(1, Math.floor(finitePositive(countProp, 5)));
  const step = Math.min(count, finitePositive(stepProp, 1));
  const controlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(() => normalizeRatingValue(defaultValue, count, step));
  const committedValue = normalizeRatingValue(controlled ? value : uncontrolledValue, count, step);
  const [previewValue, setPreviewValue] = useState<number | null>(null);
  const previewRef = useRef<number | null>(null);
  const previewCallback = useRef(onPreviewChange);
  previewCallback.current = onPreviewChange;
  const resetState = useRef({ controlled, defaultValue, count, step });
  resetState.current = { controlled, defaultValue, count, step };
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const symbolsRef = useRef<HTMLSpanElement>(null);
  const pendingKeyboardValueRef = useRef<number | null>(null);
  const pendingKeyboardTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useImperativeHandle(forwardedRef, () => rootRef.current as HTMLDivElement);
  const clearPendingKeyboard = useCallback(() => {
    clearTimeout(pendingKeyboardTimerRef.current);
    pendingKeyboardTimerRef.current = undefined;
    pendingKeyboardValueRef.current = null;
  }, []);
  const changePreview = useCallback((next: number | null) => {
    if (previewRef.current === next) return;
    previewRef.current = next;
    setPreviewValue(next);
    previewCallback.current?.(next);
  }, []);
  const previewing = hoverPreview && !disabled && !readOnly && previewValue !== null;
  const displayValue = previewing ? normalizeRatingValue(previewValue, count, step) : committedValue;
  const symbolId = useId();
  const symbolIndexes = useMemo(() => Array.from({ length: count }, (_, index) => index), [count]);
  const defaultIconSize = size === 'sm' ? 26 : size === 'lg' ? 38 : 32;

  useEffect(() => {
    if (disabled || readOnly || !hoverPreview) changePreview(null);
  }, [disabled, readOnly, hoverPreview, changePreview]);

  useEffect(() => {
    clearPendingKeyboard();
    changePreview(null);
  }, [count, step, changePreview, clearPendingKeyboard]);

  useEffect(() => clearPendingKeyboard, [clearPendingKeyboard]);

  useEffect(() => {
    const owner = inputRef.current?.form;
    if (!owner) return;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    const reset = (event: Event) => {
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        if (event.defaultPrevented) return;
        clearPendingKeyboard();
        changePreview(null);
        const state = resetState.current;
        if (!state.controlled) setUncontrolledValue(normalizeRatingValue(state.defaultValue, state.count, state.step));
      }, 0);
    };
    owner.addEventListener('reset', reset);
    return () => { clearTimeout(resetTimer); owner.removeEventListener('reset', reset); };
  }, [form, changePreview, clearPendingKeyboard]);

  const commit = (nextValue: number) => {
    if (disabled || readOnly) return;
    clearPendingKeyboard();
    const normalized = normalizeRatingValue(nextValue, count, step);
    const cleared = normalized === committedValue && normalized !== 0 && allowsReselectClear(clearable);
    const resolved = cleared ? 0 : normalized;
    changePreview(null);
    if (resolved === committedValue) return;
    if (!controlled) setUncontrolledValue(resolved);
    onValueChange?.(resolved);
  };

  const valueFromPointer = (event: { currentTarget: HTMLSpanElement; clientX: number }, index: number): number => {
    const rect = event.currentTarget.getBoundingClientRect();
    const physicalFraction = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 1;
    const logicalFraction = (dir ?? getComputedStyle(event.currentTarget).direction) === 'rtl'
      ? 1 - physicalFraction
      : physicalFraction;
    const rawValue = index + Math.min(1, Math.max(0, logicalFraction));
    return normalizeRatingValue(Math.max(step, Math.ceil((rawValue - Number.EPSILON) / step) * step), count, step);
  };

  const revealValue = useCallback((nextValue: number) => {
    const scroller = symbolsRef.current;
    if (!scroller) return;
    const targetIndex = Math.max(1, Math.ceil(normalizeRatingValue(nextValue, count, step)));
    const target = scroller.querySelector<HTMLElement>(`[data-index="${targetIndex}"]`);
    if (!target) return;
    const viewport = scroller.getBoundingClientRect();
    const item = target.getBoundingClientRect();
    const delta = item.left < viewport.left ? item.left - viewport.left
      : item.right > viewport.right ? item.right - viewport.right
        : 0;
    if (delta) scroller.scrollLeft += delta;
  }, [count, step]);

  useEffect(() => {
    const pending = pendingKeyboardValueRef.current;
    if (pending === null) return;
    clearPendingKeyboard();
    if (pending === committedValue) revealValue(committedValue);
  }, [committedValue, revealValue, clearPendingKeyboard]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled || readOnly) return;
    const rtl = (dir ?? getComputedStyle(event.currentTarget).direction) === 'rtl';
    let nextValue: number | null = null;
    if (event.key === 'ArrowUp') nextValue = committedValue + step;
    if (event.key === 'ArrowDown') nextValue = previousRatingValue(committedValue, count, step);
    if (event.key === 'ArrowRight') nextValue = rtl
      ? previousRatingValue(committedValue, count, step)
      : committedValue + step;
    if (event.key === 'ArrowLeft') nextValue = rtl
      ? committedValue + step
      : previousRatingValue(committedValue, count, step);
    if (event.key === 'Home') nextValue = allowsKeyboardClear(clearable) ? 0 : Math.min(step, count);
    if (event.key === 'End') nextValue = count;
    if (['Backspace', 'Delete', 'Escape'].includes(event.key) && allowsKeyboardClear(clearable)) nextValue = 0;
    if (nextValue === null) return;
    event.preventDefault();
    changePreview(null);
    let normalized = normalizeRatingValue(nextValue, count, step);
    if (normalized === 0 && committedValue > 0 && !allowsKeyboardClear(clearable)) {
      normalized = Math.min(step, count);
    }
    if (normalized === committedValue) return;
    clearPendingKeyboard();
    pendingKeyboardValueRef.current = normalized;
    pendingKeyboardTimerRef.current = setTimeout(() => {
      pendingKeyboardTimerRef.current = undefined;
      pendingKeyboardValueRef.current = null;
    }, 100);
    if (!controlled) setUncontrolledValue(normalized);
    onValueChange?.(normalized);
  };

  const renderLayerSymbol = (index: number, fraction: number, filled: boolean) => {
    const state: RatingSymbolState = {
      index: index + 1,
      fraction,
      filled,
      previewing,
    };
    if (renderSymbol) return renderSymbol(state);
    if (symbol !== undefined) return symbol;
    return <PencilIcon paths={defaultSymbolPaths} sourceSize={24} size={defaultIconSize} active={filled} seed={`${symbolId}-${index}`} />;
  };

  return (
    <div
      {...props}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : t('rating.label'))}
      aria-labelledby={ariaLabelledBy}
      aria-readonly={readOnly || undefined}
      aria-valuemax={count}
      aria-valuemin={0}
      aria-valuenow={committedValue}
      aria-valuetext={getValueLabel(committedValue, count)}
      className={['inkra-rating', className].filter(Boolean).join(' ')}
      data-disabled={disabled || undefined}
      data-previewing={previewing || undefined}
      data-readonly={readOnly || undefined}
      data-size={size}
      dir={dir}
      onBlur={(event) => {
        clearPendingKeyboard();
        changePreview(null);
        onBlur?.(event);
      }}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented && !disabled) {
          clearPendingKeyboard();
          rootRef.current?.focus({ preventScroll: true });
        }
      }}
      onPointerLeave={(event) => {
        changePreview(null);
        onPointerLeave?.(event);
      }}
      ref={rootRef}
      role="slider"
      tabIndex={disabled ? undefined : (props.tabIndex ?? 0)}
    >
      <PencilSurface aria-hidden="true" as="span" className="inkra-rating__focus-ring" variant="outline" seed={`${symbolId}-focus`} />
      <input ref={inputRef} type="hidden" name={name} form={form} value={committedValue} disabled={disabled} />
      <span className="inkra-rating__symbols" aria-hidden="true" ref={symbolsRef}>
        {symbolIndexes.map((index) => {
          const fraction = Math.min(1, Math.max(0, displayValue - index));
          return (
            <span
              className="inkra-rating__symbol-target"
              data-index={index + 1}
              key={index}
              onClick={(event) => commit(valueFromPointer(event, index))}
              onPointerMove={(event) => {
                if (hoverPreview && event.pointerType === 'mouse' && !disabled && !readOnly) {
                  changePreview(valueFromPointer(event, index));
                }
              }}
            >
              <span className="inkra-rating__symbol inkra-rating__symbol--empty">
                {renderLayerSymbol(index, 0, false)}
              </span>
              <span className="inkra-rating__fill" style={{ inlineSize: `${fraction * 100}%` }}>
                <span className="inkra-rating__symbol inkra-rating__symbol--filled">
                  {renderLayerSymbol(index, fraction, true)}
                </span>
              </span>
            </span>
          );
        })}
      </span>
    </div>
  );
});
