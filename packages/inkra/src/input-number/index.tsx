import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import { Button } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import { Input } from '../form/Input.js';
import type { InputProps } from '../form/Input.js';
import { useResolvedControlProps } from '../form/controlProps.js';
import { Tooltip } from '../tooltip/Tooltip.js';
import {
  normalizeInputNumberRepeat,
  resolveInputNumberStep,
  stepInputNumber,
  type InputNumberModifierState,
  type InputNumberStepDirection,
  type InputNumberStepModifier,
} from './model.js';

export type { InputNumberStepModifier } from './model.js';

export interface InputNumberValueChangeDetails {
  reason: 'input' | 'increment' | 'decrement';
}

export interface InputNumberProps extends Omit<InputProps, 'type' | 'value' | 'defaultValue' | 'onValueChange' | 'min' | 'max' | 'step' | 'startAction' | 'endAction' | 'clearable' | 'clearButtonLabel' | 'onClear'> {
  value?: number | null;
  defaultValue?: number | null;
  onValueChange?: (value: number | null, details: InputNumberValueChangeDetails) => void;
  min?: number;
  max?: number;
  step?: number | 'any';
  stepModifiers?: readonly InputNumberStepModifier[];
  pressAndHold?: boolean;
  repeatDelay?: number;
  repeatInterval?: number;
  controls?: boolean;
  incrementButtonLabel?: string;
  decrementButtonLabel?: string;
}

// Lucide Plus / Minus ISC geometry uses the shared pencil renderer.
const plusPaths = [{ d: 'M5 12h14' }, { d: 'M12 5v14' }];
const minusPaths = [{ d: 'M5 12h14' }];
const finiteValue = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const format = (value: number | null | undefined) => String(finiteValue(value) ?? '');
const numberFromDraft = (draft: string) => draft === '' ? null : finiteValue(Number(draft));

export const InputNumber = forwardRef<HTMLInputElement, InputNumberProps>(function InputNumber(
  {
    classNames,
    controls = true,
    decrementButtonLabel = 'Decrease value',
    defaultValue,
    disabled,
    incrementButtonLabel = 'Increase value',
    inputMode = 'decimal',
    max,
    min,
    onChange,
    onBlur,
    onKeyDown,
    onValueChange,
    pressAndHold = true,
    readOnly,
    repeatDelay = 400,
    repeatInterval = 80,
    size = 'md',
    step = 1,
    stepModifiers,
    textAlign = 'center',
    value,
    ...props
  },
  forwardedRef,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isControlled = value !== undefined;
  const [draft, setDraft] = useState(() => format(isControlled ? value : defaultValue));
  const currentValue = numberFromDraft(draft);
  const state = useResolvedControlProps({ disabled, readOnly });
  const latest = useRef({ isControlled, value, defaultValue });
  latest.current = { isControlled, value, defaultValue };
  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);
  const holdRef = useRef<{
    button: HTMLButtonElement;
    pointerId: number;
    direction: InputNumberStepDirection;
    modifiers: InputNumberModifierState;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressClickRef = useRef(false);
  const removeHoldListeners = useRef<(() => void) | undefined>(undefined);
  const stopHolding = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
    removeHoldListeners.current?.();
    removeHoldListeners.current = undefined;
    const hold = holdRef.current;
    holdRef.current = null;
    if (hold?.button.hasPointerCapture?.(hold.pointerId)) {
      try { hold.button.releasePointerCapture(hold.pointerId); } catch { /* The pointer may already be inactive. */ }
    }
  }, []);

  // Idle controls do not need global pointer, keyboard or visibility listeners.
  const listenWhileHolding = () => {
    const onVisibilityChange = () => { if (document.hidden) stopHolding(); };
    const onPointerEnd = (event: globalThis.PointerEvent) => {
      if (event.pointerId === holdRef.current?.pointerId) stopHolding();
    };
    const updateModifiers = (event: KeyboardEvent) => {
      if (holdRef.current) holdRef.current.modifiers = {
        shiftKey: event.shiftKey, altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey,
      };
    };
    window.addEventListener('blur', stopHolding);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    window.addEventListener('keydown', updateModifiers);
    window.addEventListener('keyup', updateModifiers);
    document.addEventListener('visibilitychange', onVisibilityChange);
    removeHoldListeners.current = () => {
      window.removeEventListener('blur', stopHolding);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      window.removeEventListener('keydown', updateModifiers);
      window.removeEventListener('keyup', updateModifiers);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  };
  useEffect(() => stopHolding, [stopHolding]);

  useBrowserLayoutEffect(() => {
    if (isControlled && currentValue !== finiteValue(value)) setDraft(format(value));
  }, [currentValue, draft, isControlled, value]);

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!input || !form) return;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    const reset = (event: Event) => {
      stopHolding();
      clearTimeout(resetTimer);
      // Native reset runs after the event; restore the public default, not the latest draft.
      resetTimer = setTimeout(() => {
        if (event.defaultPrevented) return;
        const state = latest.current;
        const restored = format(state.isControlled ? state.value : state.defaultValue);
        input.value = restored;
        setDraft(restored);
      }, 0);
    };
    form.addEventListener('reset', reset);
    return () => { clearTimeout(resetTimer); form.removeEventListener('reset', reset); };
  }, [props.form, stopHolding]);

  const cannotStep = state.disabled || state.readOnly || step === 'any' || (min !== undefined && max !== undefined && min > max);
  const decreaseDisabled = cannotStep || (currentValue !== null && min !== undefined && currentValue <= min);
  const increaseDisabled = cannotStep || (currentValue !== null && max !== undefined && currentValue >= max);
  useBrowserLayoutEffect(() => {
    const direction = holdRef.current?.direction;
    if (cannotStep || !controls || !pressAndHold
      || (direction === 'increment' && increaseDisabled)
      || (direction === 'decrement' && decreaseDisabled)) stopHolding();
  }, [cannotStep, controls, decreaseDisabled, increaseDisabled, pressAndHold, stopHolding]);
  function changeStep(direction: InputNumberStepDirection, modifiers: InputNumberModifierState) {
    const input = inputRef.current;
    if (!input || input.matches(':disabled') || input.readOnly || cannotStep) return false;
    const changed = stepInputNumber(input, direction, resolveInputNumberStep(modifiers, stepModifiers));
    input.focus({ preventScroll: true });
    if (!changed) return false;
    setDraft(input.value);
    onValueChange?.(Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : null, { reason: direction });
    return true;
  }
  const stepRef = useRef(changeStep);
  stepRef.current = changeStep;
  const intervalRef = useRef(repeatInterval);
  intervalRef.current = repeatInterval;

  function startHolding(event: PointerEvent<HTMLButtonElement>, direction: InputNumberStepDirection) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    stopHolding();
    suppressClickRef.current = false;
    if (!pressAndHold) return;
    suppressClickRef.current = true;
    const modifiers = {
      shiftKey: event.shiftKey, altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey,
    };
    if (!changeStep(direction, modifiers)) return;
    const button = event.currentTarget;
    if (!button.isConnected || button.disabled) return;
    holdRef.current = { button, pointerId: event.pointerId, direction, modifiers };
    listenWhileHolding();
    try { button.setPointerCapture(event.pointerId); } catch { /* Window listeners retain release handling. */ }
    const repeat = () => {
      const hold = holdRef.current;
      if (!hold || document.hidden || !stepRef.current(hold.direction, hold.modifiers)) {
        stopHolding();
        return;
      }
      if (holdRef.current) timerRef.current = setTimeout(repeat, normalizeInputNumberRepeat(intervalRef.current, 80, 32));
    };
    timerRef.current = setTimeout(repeat, normalizeInputNumberRepeat(repeatDelay, 400, 150));
  }

  function buttonEvents(direction: InputNumberStepDirection) {
    return {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => startHolding(event, direction),
      onPointerUp: stopHolding,
      onPointerCancel: stopHolding,
      onLostPointerCapture: stopHolding,
      onBlur: stopHolding,
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        if (event.detail > 0 && suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        suppressClickRef.current = false;
        changeStep(direction, event);
      },
    };
  }
  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 26 : 22;
  const buttonSize = size === 'sm' ? 'icon-sm' : size === 'lg' ? 'icon-lg' : 'icon';

  return <Input
    {...props}
    ref={inputRef}
    type="number"
    inputMode={inputMode}
    textAlign={textAlign}
    clearable={false}
    size={size}
    min={min}
    max={max}
    step={step}
    disabled={state.disabled}
    readOnly={state.readOnly}
    value={draft}
    classNames={{ ...classNames, root: ['inkra-input-number', classNames?.root].filter(Boolean).join(' ') }}
    onBlur={event => { stopHolding(); onBlur?.(event); }}
    onKeyDown={event => {
      onKeyDown?.(event);
      if (event.defaultPrevented || event.nativeEvent.isComposing || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      if (resolveInputNumberStep(event, stepModifiers) === undefined) return;
      event.preventDefault();
      changeStep(event.key === 'ArrowUp' ? 'increment' : 'decrement', event);
    }}
    onChange={event => {
      const input = event.currentTarget;
      const nextValue = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : null;
      setDraft(input.value);
      onChange?.(event);
      onValueChange?.(nextValue, { reason: 'input' });
    }}
    startAction={controls ? <Tooltip.Provider><span className="inkra-input-number__controls">
      <Tooltip.Root>
        <Tooltip.Trigger asChild><Button type="button" size={buttonSize} variant="ghost" disabled={decreaseDisabled} aria-label={decrementButtonLabel} {...buttonEvents('decrement')}><PencilIcon paths={minusPaths} size={iconSize} sourceSize={24} /></Button></Tooltip.Trigger>
        <Tooltip.Portal><Tooltip.Content>{decrementButtonLabel}</Tooltip.Content></Tooltip.Portal>
      </Tooltip.Root>
    </span></Tooltip.Provider> : undefined}
    endAction={controls ? <Tooltip.Provider><span className="inkra-input-number__controls">
      <Tooltip.Root>
        <Tooltip.Trigger asChild><Button type="button" size={buttonSize} variant="ghost" disabled={increaseDisabled} aria-label={incrementButtonLabel} {...buttonEvents('increment')}><PencilIcon paths={plusPaths} size={iconSize} sourceSize={24} /></Button></Tooltip.Trigger>
        <Tooltip.Portal><Tooltip.Content>{incrementButtonLabel}</Tooltip.Content></Tooltip.Portal>
      </Tooltip.Root>
    </span></Tooltip.Provider> : undefined}
  />;
});
