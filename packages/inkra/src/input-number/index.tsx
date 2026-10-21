import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import { Input } from '../form/Input.js';
import type { InputProps } from '../form/Input.js';
import { useResolvedControlProps } from '../form/controlProps.js';
import { Tooltip } from '../tooltip/Tooltip.js';

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
    onValueChange,
    readOnly,
    size = 'md',
    step = 1,
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

  useLayoutEffect(() => {
    if (isControlled && currentValue !== finiteValue(value)) setDraft(format(value));
  }, [currentValue, draft, isControlled, value]);

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!input || !form) return;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    const reset = (event: Event) => {
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
  }, [props.form]);

  const cannotStep = state.disabled || state.readOnly || step === 'any' || (min !== undefined && max !== undefined && min > max);
  const decreaseDisabled = cannotStep || (currentValue !== null && min !== undefined && currentValue <= min);
  const increaseDisabled = cannotStep || (currentValue !== null && max !== undefined && currentValue >= max);
  function changeStep(direction: 'increment' | 'decrement') {
    const input = inputRef.current;
    if (!input || input.matches(':disabled') || input.readOnly || cannotStep) return;
    const before = input.value;
    // Native stepping applies the step base and decimal rounding without a custom parser.
    if (direction === 'increment') input.stepUp();
    else input.stepDown();
    input.focus({ preventScroll: true });
    if (input.value === before) return;
    setDraft(input.value);
    onValueChange?.(Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : null, { reason: direction });
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
    onChange={event => {
      const input = event.currentTarget;
      const nextValue = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : null;
      setDraft(input.value);
      onChange?.(event);
      onValueChange?.(nextValue, { reason: 'input' });
    }}
    startAction={controls ? <Tooltip.Provider><span className="inkra-input-number__controls">
      <Tooltip.Root>
        <Tooltip.Trigger asChild><Button type="button" size={buttonSize} variant="ghost" disabled={decreaseDisabled} aria-label={decrementButtonLabel} onPointerDown={event => event.preventDefault()} onClick={() => changeStep('decrement')}><PencilIcon paths={minusPaths} size={iconSize} sourceSize={24} /></Button></Tooltip.Trigger>
        <Tooltip.Portal><Tooltip.Content>{decrementButtonLabel}</Tooltip.Content></Tooltip.Portal>
      </Tooltip.Root>
    </span></Tooltip.Provider> : undefined}
    endAction={controls ? <Tooltip.Provider><span className="inkra-input-number__controls">
      <Tooltip.Root>
        <Tooltip.Trigger asChild><Button type="button" size={buttonSize} variant="ghost" disabled={increaseDisabled} aria-label={incrementButtonLabel} onPointerDown={event => event.preventDefault()} onClick={() => changeStep('increment')}><PencilIcon paths={plusPaths} size={iconSize} sourceSize={24} /></Button></Tooltip.Trigger>
        <Tooltip.Portal><Tooltip.Content>{incrementButtonLabel}</Tooltip.Content></Tooltip.Portal>
      </Tooltip.Root>
    </span></Tooltip.Provider> : undefined}
  />;
});
