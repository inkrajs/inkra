import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AriaAttributes, CSSProperties, FocusEventHandler } from 'react';
import type { DateRange } from 'react-day-picker';

import { Button } from '../Button.js';
import { Calendar } from '../calendar/index.js';
import type { CalendarProps } from '../calendar/index.js';
import { mergeAriaIds, useFieldContext } from '../form/context.js';
import { useResolvedControlProps } from '../form/controlProps.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { Popover } from '../overlay/Popover.js';

export type DatePickerMode = 'single' | 'range';
export type DatePickerRange = DateRange;
export type DatePickerValue = Date | DatePickerRange | undefined;
export type DatePickerChangeReason = 'select' | 'clear';

export interface DatePickerChangeDetails {
  reason: DatePickerChangeReason;
}

export type DatePickerCalendarProps = Omit<
  CalendarProps,
  'appearance' | 'mode' | 'onSelect' | 'required' | 'selected'
>;

export interface DatePickerProps {
  'aria-describedby'?: string;
  'aria-errormessage'?: string;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
  'aria-label'?: string;
  autoFocus?: boolean;
  className?: string;
  dir?: 'ltr' | 'rtl';
  form?: string;
  id?: string;
  name?: string;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  required?: boolean;
  style?: CSSProperties;
  mode?: DatePickerMode;
  value?: DatePickerValue;
  defaultValue?: DatePickerValue;
  onValueChange?: (value: DatePickerValue, details: DatePickerChangeDetails) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  locale?: string;
  placeholder?: string;
  rangeSeparator?: string;
  endName?: string;
  clearable?: boolean;
  clearButtonLabel?: string;
  calendarLabel?: string;
  openButtonLabel?: string;
  fullWidth?: boolean;
  calendarProps?: DatePickerCalendarProps;
}

const calendarPaths = [
  { d: 'M8 2v4' },
  { d: 'M16 2v4' },
  { d: 'M3 10h18' },
  { d: 'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z' },
];
const clearPaths = [{ d: 'M18 6 6 18' }, { d: 'm6 6 12 12' }];
const classes = (...values: Array<string | false | undefined>) => values.filter(Boolean).join(' ');

function validDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isRange(value: DatePickerValue): value is DatePickerRange {
  return value != null && !validDate(value) && ('from' in value || 'to' in value);
}

export function datePickerLocalValue(value: Date | undefined): string {
  if (!validDate(value)) return '';
  return [
    String(value.getFullYear()).padStart(4, '0'),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function initialForMode(mode: DatePickerMode, value: DatePickerValue): DatePickerValue {
  if (mode === 'single') return validDate(value) ? value : undefined;
  return isRange(value) ? value : undefined;
}

function defaultCopy(locale: string) {
  const chinese = locale.toLowerCase().startsWith('zh');
  return {
    calendar: chinese ? '选择日期' : 'Choose date',
    clear: chinese ? '清空日期' : 'Clear date',
    next: chinese ? '下个月' : 'Next month',
    open: chinese ? '打开日期选择器' : 'Open date picker',
    placeholder: chinese ? '选择日期' : 'Choose a date',
    previous: chinese ? '上个月' : 'Previous month',
    rangePlaceholder: chinese ? '选择日期范围' : 'Choose a date range',
    selected: chinese ? '已选择' : 'selected',
    today: chinese ? '今天' : 'today',
  };
}

export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(allProps, forwardedRef) {
  const valueControlled = Object.prototype.hasOwnProperty.call(allProps, 'value');
  const openControlled = Object.prototype.hasOwnProperty.call(allProps, 'open');
  const {
    'aria-describedby': ariaDescribedBy,
    'aria-errormessage': ariaErrorMessage,
    'aria-invalid': ariaInvalid,
    'aria-label': ariaLabel,
    autoFocus,
    calendarLabel,
    calendarProps = {},
    className,
    clearable = true,
    clearButtonLabel,
    defaultOpen = false,
    defaultValue,
    dir,
    disabled = false,
    endName,
    form,
    fullWidth = true,
    id,
    invalid = false,
    locale = 'en-US',
    mode = 'single',
    name,
    onBlur,
    onFocus,
    onOpenChange,
    onValueChange,
    open,
    openButtonLabel,
    placeholder,
    rangeSeparator = ' – ',
    readOnly = false,
    required = false,
    style,
    value,
  } = allProps;
  const generatedId = useId();
  const field = useFieldContext();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [uncontrolledValue, setUncontrolledValue] = useState<DatePickerValue>(() => initialForMode(mode, defaultValue));
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [constraintInvalid, setConstraintInvalid] = useState(false);
  useImperativeHandle(forwardedRef, () => triggerRef.current as HTMLButtonElement);
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
  const copy = defaultCopy(locale);
  const currentValue = initialForMode(mode, valueControlled ? value : uncontrolledValue);
  const currentOpen = openControlled ? Boolean(open) : uncontrolledOpen;
  const singleValue = validDate(currentValue) ? currentValue : undefined;
  const rangeValue = isRange(currentValue) ? currentValue : undefined;
  const firstDate = singleValue ?? rangeValue?.from ?? rangeValue?.to;
  const hasValue = Boolean(singleValue || rangeValue?.from || rangeValue?.to);
  const formatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }), [locale]);
  const fullFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    day: 'numeric', month: 'long', weekday: 'long', year: 'numeric',
  }), [locale]);
  const captionFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    month: 'long', year: 'numeric',
  }), [locale]);
  const weekdayFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short' }), [locale]);
  const displayValue = singleValue
    ? formatter.format(singleValue)
    : rangeValue?.from
      ? `${formatter.format(rangeValue.from)}${rangeSeparator}${rangeValue.to ? formatter.format(rangeValue.to) : '…'}`
      : placeholder ?? (mode === 'range' ? copy.rangePlaceholder : copy.placeholder);
  const triggerId = state.id ?? `inkra-date-picker-${generatedId}`;
  const accessibleValueId = field ? `${triggerId}-value` : undefined;

  const updateOpen = (nextOpen: boolean) => {
    if (!openControlled) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const commit = (nextValue: DatePickerValue, reason: DatePickerChangeReason) => {
    if (!valueControlled) setUncontrolledValue(initialForMode(mode, nextValue));
    setConstraintInvalid(false);
    onValueChange?.(initialForMode(mode, nextValue), { reason });
  };

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger || valueControlled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = (event: Event) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!event.defaultPrevented) {
          setUncontrolledValue(initialForMode(mode, defaultValue));
          setUncontrolledOpen(false);
          setConstraintInvalid(false);
        }
      }, 0);
    };
    trigger.form?.addEventListener('reset', reset);
    return () => {
      clearTimeout(timer);
      trigger.form?.removeEventListener('reset', reset);
    };
  }, [defaultValue, form, mode, valueControlled]);

  const { disabled: disabledDays, formatters, labels, defaultMonth, ...restCalendarProps } = calendarProps;
  const localizedFormatters: NonNullable<CalendarProps['formatters']> = {
    formatCaption: date => captionFormatter.format(date),
    formatDay: date => new Intl.NumberFormat(locale).format(date.getDate()),
    formatWeekdayName: date => weekdayFormatter.format(date),
    ...formatters,
  };
  const localizedLabels: NonNullable<CalendarProps['labels']> = {
    labelDayButton: (date, modifiers) => [
      fullFormatter.format(date),
      modifiers.today ? copy.today : '',
      modifiers.selected ? copy.selected : '',
    ].filter(Boolean).join(', '),
    labelNext: () => copy.next,
    labelPrevious: () => copy.previous,
    ...labels,
  };
  const sharedCalendarProps = {
    ...restCalendarProps,
    appearance: 'picker' as const,
    defaultMonth: defaultMonth ?? firstDate,
    disabled: state.readOnly ? true : disabledDays,
    formatters: localizedFormatters,
    labels: localizedLabels,
  };

  return (
    <Popover.Root open={currentOpen} onOpenChange={updateOpen}>
      <span
        className={classes('inkra-date-picker', className)}
        data-disabled={state.disabled || undefined}
        data-full-width={fullWidth || undefined}
        data-has-value={hasValue || undefined}
        data-invalid={state.invalid || constraintInvalid || undefined}
        data-mode={mode}
        data-readonly={state.readOnly || undefined}
        dir={dir}
        style={style}
      >
        <Popover.Trigger asChild>
          <Button
            aria-describedby={mergeAriaIds(state.describedBy, accessibleValueId)}
            aria-errormessage={state.errorMessage}
            aria-invalid={constraintInvalid || state.ariaInvalid}
            aria-label={ariaLabel ?? (openButtonLabel ? `${openButtonLabel}: ${displayValue}` : undefined)}
            aria-required={state.required || undefined}
            autoFocus={autoFocus}
            className="inkra-date-picker__trigger"
            disabled={state.disabled}
            form={form}
            fullWidth={fullWidth}
            id={triggerId}
            onBlur={onBlur}
            onFocus={onFocus}
            ref={triggerRef}
            startIcon={<PencilIcon paths={calendarPaths} sourceSize={24} size={22} />}
            variant="outline"
          >
            <span className="inkra-date-picker__value" data-placeholder={!hasValue || undefined}>{displayValue}</span>
          </Button>
        </Popover.Trigger>
        {accessibleValueId ? <span className="inkra-date-picker__accessible-value" id={accessibleValueId}>{displayValue}</span> : null}
        {clearable ? (
          <Button
            aria-hidden={!hasValue || undefined}
            aria-label={clearButtonLabel ?? copy.clear}
            className="inkra-date-picker__clear"
            disabled={!hasValue || state.disabled || state.readOnly}
            onClick={() => {
              commit(undefined, 'clear');
              updateOpen(false);
              triggerRef.current?.focus({ preventScroll: true });
            }}
            size="icon"
            tabIndex={hasValue ? 0 : -1}
            variant="ghost"
          >
            <PencilIcon paths={clearPaths} sourceSize={24} size={22} />
          </Button>
        ) : null}
        {name || state.required ? (
          mode === 'range' ? <>
            <input aria-hidden="true" className="inkra-date-picker__form-field" disabled={state.disabled} form={form} name={name}
              onChange={() => undefined} onInvalid={event => { event.preventDefault(); setConstraintInvalid(true); triggerRef.current?.focus(); }}
              readOnly={state.readOnly} required={state.required} tabIndex={-1} type="text" value={datePickerLocalValue(rangeValue?.from)} />
            <input aria-hidden="true" className="inkra-date-picker__form-field" disabled={state.disabled} form={form} name={endName ?? (name ? `${name}End` : undefined)}
              onChange={() => undefined} onInvalid={event => { event.preventDefault(); setConstraintInvalid(true); triggerRef.current?.focus(); }}
              readOnly={state.readOnly} required={state.required} tabIndex={-1} type="text" value={datePickerLocalValue(rangeValue?.to)} />
          </> : <input aria-hidden="true" className="inkra-date-picker__form-field" disabled={state.disabled} form={form} name={name}
            onChange={() => undefined} onInvalid={event => { event.preventDefault(); setConstraintInvalid(true); triggerRef.current?.focus(); }}
            readOnly={state.readOnly} required={state.required} tabIndex={-1} type="text" value={datePickerLocalValue(singleValue)} />
        ) : null}
      </span>
      <Popover.Portal>
        <Popover.Content
          align="start"
          aria-label={calendarLabel ?? copy.calendar}
          className="inkra-date-picker__popover"
          collisionPadding={12}
          onOpenAutoFocus={event => {
            event.preventDefault();
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                const content = contentRef.current;
                const selected = content?.querySelector<HTMLButtonElement>('.rdp-selected .rdp-day_button:not(:disabled)');
                const today = content?.querySelector<HTMLButtonElement>('.rdp-today .rdp-day_button:not(:disabled)');
                const available = content?.querySelector<HTMLButtonElement>('.rdp-day_button:not(:disabled)');
                (selected ?? today ?? available ?? content)?.focus({ preventScroll: true });
              });
            });
          }}
          ref={contentRef}
          sideOffset={8}
        >
          <PencilLine className="inkra-date-picker__heading-line" seed={`date-picker-${generatedId}-line`} />
          {mode === 'single' ? (
            <Calendar
              {...sharedCalendarProps}
              mode="single"
              selected={singleValue}
              onSelect={nextValue => {
                if (state.readOnly) return;
                commit(nextValue, 'select');
                updateOpen(false);
              }}
            />
          ) : (
            <Calendar
              {...sharedCalendarProps}
              excludeDisabled
              mode="range"
              selected={rangeValue}
              onSelect={nextValue => {
                if (state.readOnly) return;
                commit(nextValue, 'select');
                if (nextValue?.from && nextValue.to) updateOpen(false);
              }}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});

export type DatePickerAriaInvalid = AriaAttributes['aria-invalid'];
