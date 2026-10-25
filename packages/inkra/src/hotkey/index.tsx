import { useInkraLocale } from '../i18n/index.js';
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type {
  FocusEvent,
  HTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from 'react';

import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { useResolvedControlProps } from '../form/controlProps.js';
import type { FieldControlSize, FieldControlStateProps } from '../form/types.js';
import {
  detectHotkeyPlatform,
  formatHotkey,
  getHotkeyTokens,
  hotkeyFromKeyboardEvent,
  hotkeySignature,
  isHotkeyClear,
  isHotkeyEscape,
  normalizeHotkey,
} from './model.js';
import type {
  HotkeyModifier,
  HotkeyPlatform,
  HotkeyValue,
  ResolvedHotkeyPlatform,
} from './model.js';

export type HotkeyValidationResult = boolean | string | null | undefined;
export type HotkeyInputChangeReason = 'record' | 'clear';

export interface HotkeyInputChangeDetails {
  reason: HotkeyInputChangeReason;
  conflict?: string;
}

export interface HotkeyProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  value: HotkeyValue;
  platform?: HotkeyPlatform;
  separator?: ReactNode;
  size?: FieldControlSize;
}

export interface HotkeyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children' | 'defaultValue' | 'onChange' | 'readOnly' | 'size' | 'value'>,
    FieldControlStateProps {
  value?: HotkeyValue | null;
  defaultValue?: HotkeyValue | null;
  onValueChange?: (value: HotkeyValue | null, details: HotkeyInputChangeDetails) => void;
  onCancel?: () => void;
  validateHotkey?: (value: HotkeyValue) => HotkeyValidationResult;
  onConflict?: (value: HotkeyValue, message: string) => void;
  conflict?: boolean | string;
  conflictMessage?: string;
  platform?: HotkeyPlatform;
  placeholder?: string;
  recordingLabel?: string;
  clearable?: boolean;
  clearButtonLabel?: string;
  blurOnCapture?: boolean;
  readOnly?: boolean;
  classNames?: Partial<Record<'root' | 'control' | 'input' | 'value' | 'message', string>>;
}

const clearPaths = [{ d: 'M18 6 6 18' }, { d: 'm6 6 12 12' }];
const classes = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(' ');

function browserPlatform() {
  if (typeof navigator === 'undefined') return '';
  const userAgentData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return userAgentData?.platform ?? navigator.platform ?? navigator.userAgent;
}

function useHotkeyPlatform(platform: HotkeyPlatform): ResolvedHotkeyPlatform {
  const explicit = platform === 'auto' ? null : platform;
  const [detected, setDetected] = useState<ResolvedHotkeyPlatform>('windows');
  useEffect(() => {
    if (!explicit) setDetected(detectHotkeyPlatform(browserPlatform()));
  }, [explicit]);
  return explicit ?? detected;
}

function conflictText(result: HotkeyValidationResult, fallback: string): string | undefined {
  if (typeof result === 'string') return result || undefined;
  return result ? fallback : undefined;
}

export const Hotkey = forwardRef<HTMLElement, HotkeyProps>(function Hotkey(
  { 'aria-label': ariaLabel, className, platform = 'auto', separator, size = 'md', value, ...props },
  ref,
) {
  const resolvedPlatform = useHotkeyPlatform(platform);
  const normalized = normalizeHotkey(value);
  const tokens = getHotkeyTokens(normalized, resolvedPlatform);
  const label = formatHotkey(normalized, resolvedPlatform);
  return (
    <kbd
      {...props}
      aria-label={ariaLabel ?? label}
      className={classes('inkra-hotkey', className)}
      data-platform={resolvedPlatform}
      data-size={size}
      ref={ref}
    >
      {tokens.map((token, index) => (
        <span className="inkra-hotkey__part" key={`${token}-${index}`}>
          {index > 0 && resolvedPlatform !== 'mac' ? (
            <span aria-hidden="true" className="inkra-hotkey__separator">{separator ?? '+'}</span>
          ) : null}
          <PencilSurface<'span'> aria-hidden="true" as="span" className="inkra-hotkey__key" radius={4} seed={`${hotkeySignature(normalized)}-${resolvedPlatform}-${index}`} variant="quiet">
            <PencilText seed={`${hotkeySignature(normalized)}-${resolvedPlatform}-${index}-label`}>{token}</PencilText>
          </PencilSurface>
        </span>
      ))}
    </kbd>
  );
});

export const HotkeyInput = forwardRef<HTMLInputElement, HotkeyInputProps>(function HotkeyInput(
  inkraProps,
  forwardedRef,
) {
  const { t } = useInkraLocale();
  const {
    'aria-describedby': ariaDescribedBy,
    'aria-errormessage': ariaErrorMessage,
    'aria-invalid': ariaInvalid,
    'aria-label': ariaLabel,
    blurOnCapture = true,
    className,
    classNames = {},
    clearable = true,
    clearButtonLabel = t('hotkey.clear'),
    conflict,
    conflictMessage = t('hotkey.conflict'),
    defaultValue = null,
    disabled,
    id,
    invalid = false,
    onBlur,
    onCancel,
    onCompositionEnd,
    onCompositionStart,
    onConflict,
    onFocus,
    onKeyDown,
    onValueChange,
    placeholder = t('hotkey.placeholder'),
    platform = 'auto',
    readOnly,
    recordingLabel = t('hotkey.recordingPrompt'),
    required,
    seed,
    size = 'md',
    validateHotkey,
    value,
    ...props
  } = inkraProps;
  const generatedId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState<HotkeyValue | null>(() => defaultValue ? normalizeHotkey(defaultValue) : null);
  const [focused, setFocused] = useState(false);
  const [localConflict, setLocalConflict] = useState<{ signature: string; message: string } | null>(null);
  const currentValue = isControlled ? (value ? normalizeHotkey(value) : null) : uncontrolledValue;
  const resolvedPlatform = useHotkeyPlatform(platform);
  const externalConflict = conflictText(conflict, conflictMessage);
  const currentSignature = hotkeySignature(currentValue);
  const validationMessage = externalConflict ?? (localConflict?.signature === currentSignature ? localConflict.message : undefined);
  const messageId = validationMessage ? `${id ?? generatedId}-hotkey-conflict` : undefined;
  const statusId = `${id ?? generatedId}-hotkey-status`;
  const state = useResolvedControlProps({
    id,
    required,
    disabled,
    readOnly,
    invalid: invalid || Boolean(validationMessage),
    'aria-describedby': [ariaDescribedBy, statusId, messageId].filter(Boolean).join(' ') || undefined,
    'aria-errormessage': validationMessage ? messageId : ariaErrorMessage,
    'aria-invalid': ariaInvalid,
  });
  const resolvedSeed = seed ?? `inkra-hotkey-input-${state.id ?? generatedId}`;
  const displayValue = currentValue ? formatHotkey(currentValue, resolvedPlatform) : '';
  const recording = focused && !state.disabled && !state.readOnly;
  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

  const updateValue = (nextValue: HotkeyValue | null, details: HotkeyInputChangeDetails) => {
    if (!isControlled) setUncontrolledValue(nextValue);
    onValueChange?.(nextValue, details);
  };

  const clear = () => {
    if (state.disabled || state.readOnly || !currentValue) return;
    setLocalConflict(null);
    updateValue(null, { reason: 'clear' });
    inputRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || state.disabled || state.readOnly) return;
    const nativeEvent = event.nativeEvent;
    const eventLike = {
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      isComposing: composingRef.current || nativeEvent.isComposing,
      keyCode: nativeEvent.keyCode,
    };
    if (isHotkeyEscape(eventLike)) {
      onCancel?.();
      event.currentTarget.blur();
      return;
    }
    if (isHotkeyClear(eventLike)) {
      clear();
      return;
    }
    if (event.key === 'Tab') return;
    const nextValue = hotkeyFromKeyboardEvent(eventLike);
    if (!nextValue) return;
    const result = validateHotkey?.(nextValue);
    const message = conflictText(result, conflictMessage);
    setLocalConflict(message ? { signature: hotkeySignature(nextValue), message } : null);
    if (message) onConflict?.(nextValue, message);
    updateValue(nextValue, { reason: 'record', ...(message ? { conflict: message } : {}) });
    if (blurOnCapture) event.currentTarget.blur();
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    onFocus?.(event);
  };
  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    onBlur?.(event);
  };

  return (
    <span
      className={classes('inkra-hotkey-input', classNames.root)}
      data-disabled={state.disabled || undefined}
      data-focus-within={focused || undefined}
      data-invalid={state.invalid || undefined}
      data-recording={recording || undefined}
      data-readonly={state.readOnly || undefined}
      data-size={size}
    >
      <PencilSurface<'span'>
        as="span"
        className={classes('inkra-hotkey-input__control', classNames.control)}
        clipContent
        seed={resolvedSeed}
        variant={state.invalid ? 'danger' : 'outline'}
      >
        <input
          {...props}
          aria-describedby={state.describedBy}
          aria-errormessage={state.errorMessage}
          aria-invalid={state.ariaInvalid}
          aria-label={ariaLabel}
          autoComplete="off"
          className={classes('inkra-hotkey-input__native', className, classNames.input)}
          disabled={state.disabled}
          id={state.id}
          inputMode="none"
          onBlur={handleBlur}
          onChange={() => {}}
          onCompositionEnd={event => {
            composingRef.current = false;
            onCompositionEnd?.(event);
          }}
          onCompositionStart={event => {
            composingRef.current = true;
            onCompositionStart?.(event);
          }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          readOnly={state.readOnly}
          ref={inputRef}
          required={state.required}
          spellCheck={false}
          value={displayValue}
        />
        <span aria-hidden="true" className={classes('inkra-hotkey-input__value', classNames.value)}>
          {recording ? (
            <PencilText className="inkra-hotkey-input__recording" seed={`${resolvedSeed}-recording`}>{recordingLabel}</PencilText>
          ) : currentValue ? (
            <Hotkey value={currentValue} platform={resolvedPlatform} size={size} />
          ) : (
            <PencilText className="inkra-hotkey-input__placeholder" seed={`${resolvedSeed}-placeholder`}>{placeholder}</PencilText>
          )}
        </span>
        {clearable && currentValue ? (
          <button
            aria-label={clearButtonLabel}
            className="inkra-hotkey-input__clear"
            disabled={state.disabled || state.readOnly}
            onClick={clear}
            onPointerDown={event => event.preventDefault()}
            title={clearButtonLabel}
            type="button"
          >
            <PencilIcon paths={clearPaths} seed={`${resolvedSeed}-clear`} size={size === 'sm' ? 18 : size === 'lg' ? 26 : 22} sourceSize={24} />
          </button>
        ) : null}
        <PencilSurface<'span'>
          aria-hidden="true"
          as="span"
          className="inkra-hotkey-input__focus-ring"
          seed={`${resolvedSeed}-focus`}
          variant="outline"
        />
      </PencilSurface>
      <span aria-live="polite" className="inkra-hotkey-input__status" id={statusId}>{recording ? recordingLabel : ''}</span>
      {validationMessage ? (
        <PencilText as="span" className={classes('inkra-hotkey-input__message', classNames.message)} id={messageId} role="alert" seed={`${resolvedSeed}-message`}>
          {validationMessage}
        </PencilText>
      ) : null}
    </span>
  );
});

export type {
  FieldControlSize,
  HotkeyModifier,
  HotkeyPlatform,
  HotkeyValue,
  ResolvedHotkeyPlatform,
};
export {
  detectHotkeyPlatform,
  formatHotkey,
  getHotkeyTokens,
  hotkeyFromKeyboardEvent,
  hotkeySignature,
  normalizeHotkey,
};
