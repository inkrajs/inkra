import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import type { InputHTMLAttributes, MouseEvent, ReactNode } from 'react';

import { PencilIcon } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { InputAction } from './InputAction.js';
import { useResolvedControlProps } from './controlProps.js';
import { EditablePencilText } from './EditablePencilText.js';
import type { FieldControlSize, FieldControlStateProps } from './types.js';

export type InputVariant = 'underline' | 'outline' | 'soft' | 'ghost';
export type InputTextAlign = 'start' | 'center' | 'end';
export interface InputValueChangeDetails {
  reason: 'input' | 'clear';
}
export type InputClassNames = Partial<Record<
  'root' | 'control' | 'input' | 'startIcon' | 'endIcon' | 'prefix' | 'suffix' | 'actions', string
>>;

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'>,
    FieldControlStateProps {
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  clearable?: boolean;
  clearButtonLabel?: string;
  onClear?: (event: MouseEvent<HTMLButtonElement>) => void;
  onValueChange?: (value: string, details: InputValueChangeDetails) => void;
  loading?: boolean;
  startAction?: ReactNode;
  endAction?: ReactNode;
  variant?: InputVariant;
  fullWidth?: boolean;
  textAlign?: InputTextAlign;
  classNames?: InputClassNames;
}

const editablePencilInputTypes = new Set(['text', 'search', 'email', 'url', 'tel', 'number']);
const clearableInputTypes = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);
// Lucide X / LoaderCircle ISC geometry, rendered by the shared pencil engine.
const clearPaths = [{ d: 'M18 6 6 18' }, { d: 'm6 6 12 12' }];
const loadingPaths = [{ d: 'M21 12a9 9 0 1 1-6.219-8.56' }];
const classes = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(' ');

function affixContent(content: ReactNode, seed: string) {
  return typeof content === 'string' || typeof content === 'number'
    ? <PencilText seed={seed}>{String(content)}</PencilText>
    : content;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    'aria-describedby': ariaDescribedBy,
    'aria-errormessage': ariaErrorMessage,
    'aria-invalid': ariaInvalid,
    className,
    classNames = {},
    clearable = false,
    clearButtonLabel = 'Clear input',
    defaultValue,
    dir,
    disabled,
    endAction,
    endIcon,
    fullWidth = true,
    id,
    invalid = false,
    loading,
    onChange,
    onClear,
    onCompositionEnd,
    onCompositionStart,
    onValueChange,
    prefix,
    readOnly,
    required,
    seed,
    size = 'md',
    startAction,
    startIcon,
    style,
    suffix,
    textAlign = 'start',
    value,
    variant = 'underline',
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uncontrolledValue, setUncontrolledValue] = useState(() => String(defaultValue ?? ''));
  const [composing, setComposing] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const isControlled = value != null;
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
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
  const resolvedSeed = seed ?? `inkra-input-${state.id ?? generatedId}`;
  const resolvedType = props.type ?? 'text';
  const enhanceEditableText = editablePencilInputTypes.has(resolvedType);
  const hasClearSlot = clearable && clearableInputTypes.has(resolvedType);
  const currentValue = isControlled ? String(value) : uncontrolledValue;
  const canClear = hasClearSlot && currentValue.length > 0 && !state.disabled && !state.readOnly && !composing;
  const hasStart = startIcon != null || prefix != null || startAction != null;
  const hasEnd = endIcon != null || suffix != null || loading !== undefined || hasClearSlot || endAction != null;

  useEffect(() => {
    const input = inputRef.current;
    if (!input || isControlled) return;
    let disposed = false;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    const synchronize = () => { if (!disposed) setUncontrolledValue(input.value); };
    const reset = (event: Event) => {
      // The reset event precedes the browser's default value restoration.
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { if (!event.defaultPrevented) synchronize(); }, 0);
    };
    synchronize();
    input.addEventListener('input', synchronize);
    input.addEventListener('change', synchronize);
    input.addEventListener('focus', synchronize);
    const form = input.form;
    form?.addEventListener('reset', reset);
    return () => {
      disposed = true;
      clearTimeout(resetTimer);
      input.removeEventListener('input', synchronize);
      input.removeEventListener('change', synchronize);
      input.removeEventListener('focus', synchronize);
      form?.removeEventListener('reset', reset);
    };
  }, [isControlled, props.form, defaultValue]);

  const clear = (event: MouseEvent<HTMLButtonElement>) => {
    const input = inputRef.current;
    if (!canClear || !input || input.matches(':disabled')) return;
    if (!isControlled) {
      input.value = '';
      setUncontrolledValue('');
    }
    input.focus({ preventScroll: true });
    onValueChange?.('', { reason: 'clear' });
    onClear?.(event);
  };

  return (
    <span
      className={classes('inkra-field-control-hit', 'inkra-input-root', classNames.root)}
      dir={dir}
      data-full-width={fullWidth}
      data-variant={variant}
      data-focus-within={focusWithin || undefined}
      data-clearable={hasClearSlot || undefined}
      data-loading={loading || undefined}
      data-start-content={hasStart || undefined}
      data-end-content={hasEnd || undefined}
      data-disabled={state.disabled || undefined}
      data-invalid={state.invalid || undefined}
      data-readonly={state.readOnly || undefined}
      data-size={size}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
      }}
    >
      <PencilSurface<'span'>
        as="span"
        clipContent
        className={classes('inkra-field-control inkra-field-control--input', classNames.control)}
        seed={resolvedSeed}
        variant={variant === 'underline' ? 'ghost' : state.invalid ? 'danger' : variant === 'soft' ? 'quiet' : variant === 'ghost' && focusWithin ? 'outline' : variant}
      >
        {startAction == null ? null : (
          <InputAction position="start" disabled={state.disabled} seed={`${resolvedSeed}-start-action`}>{startAction}</InputAction>
        )}
        {startIcon == null ? null : (
          <span aria-hidden="true" className={classes('inkra-field-control__icon inkra-field-control__icon--start', classNames.startIcon)}>
            {startIcon}
          </span>
        )}
        {prefix == null ? null : <span className={classes('inkra-input__affix inkra-input__affix--prefix', classNames.prefix)}>{affixContent(prefix, `${resolvedSeed}-prefix`)}</span>}
        <input
          {...props}
          aria-busy={loading || props['aria-busy']}
          aria-describedby={state.describedBy}
          aria-errormessage={state.errorMessage}
          aria-invalid={state.ariaInvalid}
          className={classes('inkra-input', className, classNames.input)}
          defaultValue={defaultValue}
          disabled={state.disabled}
          id={state.id}
          readOnly={state.readOnly}
          ref={inputRef}
          required={state.required}
          style={{ textAlign, ...style }}
          value={value}
          onChange={event => {
            if (!isControlled) setUncontrolledValue(event.currentTarget.value);
            onChange?.(event);
            onValueChange?.(event.currentTarget.value, { reason: 'input' });
          }}
          onCompositionStart={event => { setComposing(true); onCompositionStart?.(event); }}
          onCompositionEnd={event => { setComposing(false); onCompositionEnd?.(event); }}
        />
        {suffix == null ? null : <span className={classes('inkra-input__affix inkra-input__affix--suffix', classNames.suffix)}>{affixContent(suffix, `${resolvedSeed}-suffix`)}</span>}
        {endIcon == null ? null : (
          <span aria-hidden="true" className={classes('inkra-field-control__icon inkra-field-control__icon--end', classNames.endIcon)}>
            {endIcon}
          </span>
        )}
        {loading === undefined ? null : (
          <span aria-hidden="true" className="inkra-input__loading" data-active={loading}>
            <PencilIcon className="inkra-input__spinner" paths={loadingPaths} sourceSize={24} size={30} seed={`${resolvedSeed}-loading`} />
          </span>
        )}
        {hasClearSlot || endAction != null ? (
          <span className={classes('inkra-input__actions', classNames.actions)}>
            {hasClearSlot ? (
              <button
                type="button"
                className="inkra-input__clear"
                aria-label={clearButtonLabel}
                title={clearButtonLabel}
                aria-hidden={!canClear || undefined}
                disabled={!canClear}
                tabIndex={canClear ? 0 : -1}
                data-visible={canClear}
                onPointerDown={event => event.preventDefault()}
                onClick={clear}
              >
                <PencilIcon paths={clearPaths} sourceSize={24} size={30} seed={`${resolvedSeed}-clear`} />
              </button>
            ) : null}
            {endAction == null ? null : (
              <InputAction disabled={state.disabled} seed={`${resolvedSeed}-action`}>{endAction}</InputAction>
            )}
          </span>
        ) : null}
        {variant === 'underline' ? (
          <PencilLine
            className="inkra-input__underline"
            seed={`${resolvedSeed}-underline`}
            weight={(focusWithin ? 1.5 : 1) + (state.invalid ? 0.1 : 0)}
          />
        ) : null}
        {enhanceEditableText ? (
          <EditablePencilText
            key={`${textAlign}-${dir ?? 'inherit'}`}
            controlRef={inputRef}
            defaultValue={defaultValue}
            placeholder={props.placeholder}
            seed={`${resolvedSeed}-editable`}
            value={isControlled ? value : uncontrolledValue}
          />
        ) : null}
      </PencilSurface>
    </span>
  );
});

export type { FieldControlSize };
