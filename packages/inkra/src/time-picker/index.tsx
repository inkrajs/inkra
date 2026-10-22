import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';

import { Button } from '../Button.js';
import { useResolvedControlProps } from '../form/controlProps.js';
import { mergeAriaIds, useFieldContext } from '../form/context.js';
import type { InputProps, InputValueChangeDetails } from '../form/Input.js';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilText } from '../PencilText.js';
import { PencilLine } from '../PencilLine.js';
import { Popover } from '../overlay/Popover.js';
import { RadioGroup, RadioGroupItem } from '../selection/RadioGroup.js';

export type TimePickerHourCycle = 'h12' | 'h24';
export type TimePickerChangeDetails = InputValueChangeDetails;

export interface TimePickerProps extends Omit<
  InputProps, 'clearable' | 'clearButtonLabel' | 'onClear' | 'onValueChange' | 'type'
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
const pad = (value: number) => {
  const [whole, fraction] = String(value).split('.');
  return `${whole.padStart(2, '0')}${fraction ? `.${fraction}` : ''}`;
};
const times = (length: number, start = 0) => Array.from({ length }, (_, index) => index + start);

function partsOf(value: string): [number, number, number] | undefined {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/.test(value)) return undefined;
  const [hour, minute, second = 0] = value.split(':').map(Number);
  return [hour, minute, second];
}

function TimeColumn({ name, label, value, options, onChange, format = pad }: {
  name: string;
  label: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return <RadioGroup name={name} label={label} value={String(value)}
    variant="segmented" className="inkra-time-picker__column"
    onValueChange={next => onChange(Number(next))}>
    {options.map(option => <RadioGroupItem key={option} value={String(option)} label={format(option)} />)}
  </RadioGroup>;
}

export const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(function TimePicker(allProps, forwardedRef) {
  const {
    value, defaultValue, onValueChange, onChange, onClear, clearable = true, clearButtonLabel,
    hourCycle = 'h24', locale, lang, showSeconds = false, step, min, max, name, form, id,
    disabled, readOnly, required, invalid, 'aria-describedby': ariaDescribedBy,
    'aria-errormessage': ariaErrorMessage, 'aria-invalid': ariaInvalid, 'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy, className, style, size = 'md', fullWidth = true,
    startIcon, endIcon, endAction, startAction, prefix, suffix, placeholder, seed,
    variant = 'outline', textAlign = 'start', loading, classNames, ...nativeProps
  } = allProps;
  const generatedId = useId();
  const field = useFieldContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const initialValue = useRef(String(defaultValue ?? value ?? ''));
  const controlled = Object.prototype.hasOwnProperty.call(allProps, 'value');
  const [internalValue, setInternalValue] = useState(() => String(defaultValue ?? ''));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('00:00');
  const [draftValid, setDraftValid] = useState(true);
  const [constraintInvalid, setConstraintInvalid] = useState(false);
  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);
  const state = useResolvedControlProps({
    id: id ?? `inkra-time-picker-${generatedId}`, disabled, readOnly, required, invalid,
    'aria-describedby': ariaDescribedBy, 'aria-errormessage': ariaErrorMessage, 'aria-invalid': ariaInvalid,
  });
  const currentValue = controlled ? String(value ?? '') : internalValue;
  const secondsVisible = showSeconds || (step !== undefined && step !== 'any' && Number(step) % 60 !== 0);
  const resolvedStep = step ?? (secondsVisible ? 1 : 60);
  const stepBase = String(defaultValue ?? initialValue.current);
  const resolvedLocale = locale ?? lang ?? (hourCycle === 'h12' ? 'en-US' : 'en-GB');
  const zh = resolvedLocale.toLowerCase().startsWith('zh');
  const copy = zh
    ? { title: '选择时间', hour: '时', minute: '分', second: '秒', period: '时段', am: '上午', pm: '下午',
      done: '确定', cancel: '取消', clear: '清空时间', invalid: '请选择符合时间范围和步进的时间。' }
    : { title: 'Choose time', hour: 'Hour', minute: 'Minute', second: 'Second', period: 'Period', am: 'AM', pm: 'PM',
      done: 'Apply', cancel: 'Cancel', clear: 'Clear time', invalid: 'Choose a time within the allowed range and step.' };
  const currentParts = partsOf(currentValue);
  const displayValue = currentParts
    ? new Intl.DateTimeFormat(resolvedLocale, {
      hour: '2-digit', minute: '2-digit', ...(secondsVisible ? { second: '2-digit' } : {}),
      hourCycle: hourCycle === 'h12' ? 'h12' : 'h23',
    }).format(new Date(2000, 0, 1, ...currentParts))
    : placeholder ?? copy.title;
  const canClear = clearable && Boolean(currentValue) && !state.disabled && !state.readOnly;
  const valueId = field ? `${state.id}-value` : undefined;
  const [hour, minute, second] = partsOf(draft) ?? [0, 0, 0];

  const validDraft = (candidate = draft) => {
    // Native validation owns overnight ranges, fractional steps and step bases.
    const input = document.createElement('input');
    input.type = 'time';
    if (min !== undefined) input.min = String(min);
    if (max !== undefined) input.max = String(max);
    input.step = String(resolvedStep);
    input.defaultValue = stepBase;
    input.required = true;
    input.value = candidate;
    return input.validity.valid;
  };
  const updateOpen = (next: boolean) => {
    if (next && (state.disabled || state.readOnly)) return;
    if (next) {
      const initial = partsOf(currentValue) ? currentValue : partsOf(String(min)) ? String(min) : '00:00';
      const nextDraft = secondsVisible && initial.length === 5 ? `${initial}:00` : initial;
      setDraft(nextDraft);
      setDraftValid(validDraft(nextDraft));
    }
    setOpen(next);
  };
  const updatePart = (part: number, next: number) => {
    const values = [hour, minute, second];
    values[part] = next;
    const nextDraft = values.slice(0, secondsVisible ? 3 : 2).map(pad).join(':');
    setDraft(nextDraft);
    setDraftValid(validDraft(nextDraft));
  };
  const commit = (next: string, reason: 'input' | 'clear') => {
    if (!controlled) setInternalValue(next);
    setConstraintInvalid(false);
    onValueChange?.(next, { reason });
    setOpen(false);
  };

  useEffect(() => { setDraftValid(validDraft()); }, [draft, min, max, resolvedStep, stepBase]);
  useBrowserLayoutEffect(() => {
    // React's controlled value attribute must not move the native step base on each edit.
    if (inputRef.current) inputRef.current.defaultValue = stepBase;
  }, [currentValue, stepBase]);
  useEffect(() => {
    const input = inputRef.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = (event: Event) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (event.defaultPrevented) return;
        if (!controlled) setInternalValue(String(defaultValue ?? ''));
        else if (input) input.value = currentValue;
        setConstraintInvalid(false);
        setOpen(false);
      }, 0);
    };
    input?.form?.addEventListener('reset', reset);
    return () => { clearTimeout(timer); input?.form?.removeEventListener('reset', reset); };
  }, [controlled, currentValue, defaultValue, form]);
  useEffect(() => { if (state.disabled || state.readOnly) setOpen(false); }, [state.disabled, state.readOnly]);

  return <Popover.Root open={open} onOpenChange={updateOpen}>
    <div className={['inkra-time-picker', classNames?.root, className].filter(Boolean).join(' ')}
      style={style} dir={nativeProps.dir} data-full-width={fullWidth}
      data-invalid={state.invalid || constraintInvalid || undefined} data-readonly={state.readOnly || undefined}
      data-disabled={state.disabled || undefined}>
      {startAction}
      <Popover.Trigger asChild>
        <Button className={['inkra-time-picker__trigger', classNames?.control].filter(Boolean).join(' ')}
          id={state.id} ref={triggerRef} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}
          aria-describedby={mergeAriaIds(state.describedBy, valueId)} aria-invalid={constraintInvalid || state.ariaInvalid}
          aria-errormessage={state.errorMessage} aria-required={state.required || undefined}
          aria-readonly={state.readOnly || undefined} disabled={state.disabled} fullWidth align={textAlign}
          variant={variant === 'soft' ? 'secondary' : variant === 'underline' ? 'outline' : variant}
          size={size} seed={seed} loading={loading} autoFocus={nativeProps.autoFocus}
          startIcon={startIcon ?? <PencilIcon paths={clockPaths} sourceSize={24} size={22} />} endIcon={endIcon}>
          {prefix}<PencilText>{displayValue}</PencilText>{suffix}
        </Button>
      </Popover.Trigger>
      {valueId && <span className="inkra-time-picker__accessible-value" id={valueId}>{displayValue}</span>}
      {clearable && <Button className="inkra-time-picker__clear" aria-label={clearButtonLabel ?? copy.clear}
        title={clearButtonLabel ?? copy.clear} aria-hidden={!canClear || undefined} disabled={!canClear}
        tabIndex={canClear ? 0 : -1} variant="outline" size="icon" onClick={event => {
          commit('', 'clear');
          onClear?.(event);
          triggerRef.current?.focus({ preventScroll: true });
        }}><PencilIcon paths={clearPaths} sourceSize={24} size={22} /></Button>}
      {endAction}
      <input {...nativeProps} ref={inputRef} type="time" className="inkra-time-picker__native"
        id={`${state.id}-native`} aria-hidden="true" tabIndex={-1}
        name={name} form={form} value={currentValue} min={min} max={max} step={resolvedStep}
        lang={lang ?? resolvedLocale} data-hour-cycle={hourCycle} disabled={state.disabled} readOnly={state.readOnly}
        required={state.required} onChange={event => {
          if (!controlled) setInternalValue(event.currentTarget.value);
          onChange?.(event);
          onValueChange?.(event.currentTarget.value, { reason: 'input' });
        }} onFocus={event => { nativeProps.onFocus?.(event); triggerRef.current?.focus({ preventScroll: true }); }}
        onInvalid={event => {
          event.preventDefault();
          setConstraintInvalid(true);
          triggerRef.current?.focus();
          nativeProps.onInvalid?.(event);
        }} />
    </div>
    <Popover.Portal>
      <Popover.Content className="inkra-time-picker__popover" ref={contentRef} align="start" sideOffset={8}
        collisionPadding={12} aria-label={copy.title} onOpenAutoFocus={event => {
          event.preventDefault();
          requestAnimationFrame(() => {
            const content = contentRef.current;
            content?.querySelectorAll<HTMLInputElement>('input:checked').forEach(input => {
              const scroll = input.closest('.inkra-radio-group__items');
              const item = input.closest('.inkra-radio-group__item');
              if (scroll && item) scroll.scrollTop += item.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 88;
            });
            (content?.querySelector<HTMLInputElement>('input:checked')
              ?? content?.querySelector<HTMLInputElement>('input'))?.focus({ preventScroll: true });
          });
        }}>
        <Popover.Title>{copy.title}</Popover.Title>
        <PencilLine />
        <div className="inkra-time-picker__columns">
          <TimeColumn name={`${generatedId}-hour`} label={copy.hour}
            value={hourCycle === 'h12' ? hour % 12 || 12 : hour}
            options={hourCycle === 'h12' ? times(12, 1) : times(24)}
            onChange={next => updatePart(0, hourCycle === 'h12' ? next % 12 + (hour >= 12 ? 12 : 0) : next)} />
          <TimeColumn name={`${generatedId}-minute`} label={copy.minute} value={minute}
            options={times(60)} onChange={next => updatePart(1, next)} />
          {secondsVisible && <TimeColumn name={`${generatedId}-second`} label={copy.second}
            value={Math.floor(second)} options={times(60)} onChange={next => updatePart(2, next)} />}
          {hourCycle === 'h12' && <TimeColumn name={`${generatedId}-period`} label={copy.period}
            value={hour >= 12 ? 1 : 0} options={[0, 1]} format={next => next ? copy.pm : copy.am}
            onChange={next => updatePart(0, hour % 12 + next * 12)} />}
        </div>
        {!draftValid && <PencilText as="p" className="inkra-time-picker__error" role="status">{copy.invalid}</PencilText>}
        <PencilLine />
        <div className="inkra-time-picker__footer">
          <Popover.Close asChild><Button variant="outline">{copy.cancel}</Button></Popover.Close>
          <Button disabled={!draftValid || state.disabled || state.readOnly} onClick={() => {
            if (validDraft()) commit(draft, 'input');
          }}>{copy.done}</Button>
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
});
