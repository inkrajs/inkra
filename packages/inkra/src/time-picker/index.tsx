import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { ChangeEvent, MouseEvent, ReactNode } from 'react';

import { Button } from '../Button.js';
import { useResolvedControlProps } from '../form/controlProps.js';
import { Input } from '../form/Input.js';
import type { InputProps, InputValueChangeDetails } from '../form/Input.js';
import { PencilIcon } from '../PencilIcon.js';

export type TimePickerHourCycle = 'h12' | 'h24';
export type TimePickerChangeDetails = InputValueChangeDetails;

export interface TimePickerProps extends Omit<
  InputProps,
  'clearable' | 'clearButtonLabel' | 'onClear' | 'onValueChange' | 'type'
> {
  hourCycle?: TimePickerHourCycle;
  locale?: string;
  showSeconds?: boolean;
  clearable?: boolean;
  clearButtonLabel?: string;
  onClear?: (event: MouseEvent<HTMLButtonElement>) => void;
  onValueChange?: (value: string, details: TimePickerChangeDetails) => void;
  startIcon?: ReactNode;
}

const clockPaths = [
  { d: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z' },
  { d: 'M12 6v6l4 2' },
];
const clearPaths = [{ d: 'M18 6 6 18' }, { d: 'm6 6 12 12' }];

export const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(function TimePicker(allProps, forwardedRef) {
  const controlled = Object.prototype.hasOwnProperty.call(allProps, 'value');
  const {
    clearable = true,
    clearButtonLabel = 'Clear time',
    defaultValue,
    disabled,
    endAction,
    hourCycle = 'h24',
    lang,
    locale,
    id,
    invalid,
    'aria-describedby': ariaDescribedBy,
    'aria-errormessage': ariaErrorMessage,
    'aria-invalid': ariaInvalid,
    onChange,
    onClear,
    onValueChange,
    readOnly,
    required,
    showSeconds = false,
    startIcon,
    step,
    value,
    ...props
  } = allProps;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uncontrolledValue, setUncontrolledValue] = useState(() => String(defaultValue ?? ''));
  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);
  const state = useResolvedControlProps({
    id,
    required,
    disabled,
    readOnly,
    invalid,
    'aria-describedby': ariaDescribedBy,
    'aria-errormessage': ariaErrorMessage,
    'aria-invalid': ariaInvalid,
  });
  const currentValue = controlled ? String(value ?? '') : uncontrolledValue;
  const canClear = clearable && currentValue.length > 0 && !state.disabled && !state.readOnly;

  useEffect(() => {
    const input = inputRef.current;
    if (!input || controlled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const synchronize = () => setUncontrolledValue(input.value);
    const reset = (event: Event) => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (!event.defaultPrevented) synchronize(); }, 0);
    };
    input.form?.addEventListener('reset', reset);
    return () => {
      clearTimeout(timer);
      input.form?.removeEventListener('reset', reset);
    };
  }, [controlled, defaultValue, props.form]);

  const clearAction = clearable ? (
    <Button
      aria-hidden={!canClear || undefined}
      aria-label={clearButtonLabel}
      className="inkra-time-picker__clear"
      disabled={!canClear}
      onClick={event => {
        const input = inputRef.current;
        if (!input || !canClear) return;
        if (!controlled) {
          input.value = '';
          setUncontrolledValue('');
        }
        input.focus({ preventScroll: true });
        onValueChange?.('', { reason: 'clear' });
        onClear?.(event);
      }}
      size="icon-sm"
      tabIndex={canClear ? 0 : -1}
      variant="ghost"
    >
      <PencilIcon paths={clearPaths} sourceSize={24} size={20} />
    </Button>
  ) : null;

  return (
    <Input
      {...props}
      aria-describedby={state.describedBy}
      aria-errormessage={state.errorMessage}
      aria-invalid={state.ariaInvalid}
      className={['inkra-time-picker', props.className].filter(Boolean).join(' ')}
      data-hour-cycle={hourCycle}
      defaultValue={defaultValue}
      disabled={state.disabled}
      endAction={clearAction || endAction ? <>{clearAction}{endAction}</> : undefined}
      lang={lang ?? locale ?? (hourCycle === 'h12' ? 'en-US' : 'en-GB')}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        if (!controlled) setUncontrolledValue(event.currentTarget.value);
        onChange?.(event);
        onValueChange?.(event.currentTarget.value, { reason: 'input' });
      }}
      id={state.id}
      invalid={state.invalid}
      readOnly={state.readOnly}
      ref={inputRef}
      required={state.required}
      startIcon={startIcon ?? <PencilIcon paths={clockPaths} sourceSize={24} size={22} />}
      step={step ?? (showSeconds ? 1 : undefined)}
      type="time"
      value={value}
    />
  );
});
