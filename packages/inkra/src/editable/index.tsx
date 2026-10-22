import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type {
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  Ref,
} from 'react';

import { Button } from '../Button.js';
import { Input } from '../form/Input.js';
import { Textarea } from '../form/Textarea.js';
import type { InputProps } from '../form/Input.js';
import type { TextareaProps } from '../form/Textarea.js';

export type EditableBlurBehavior = 'ignore' | 'save' | 'cancel';
export type EditableSaveResult = boolean | string | void | null | undefined;
export type EditableSaveHandler = (value: string, previousValue: string) => EditableSaveResult | Promise<EditableSaveResult>;
export type EditableValidateHandler = (value: string, previousValue: string) => EditableSaveResult | Promise<EditableSaveResult>;

export interface EditableEditorProps {
  value: string;
  onValueChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur: () => void;
  disabled?: boolean;
  invalid?: boolean;
  error?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
}

export type EditableEditor = ReactNode | ((props: EditableEditorProps) => ReactNode);

export interface EditableProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'> {
  value?: string;
  defaultValue?: string;
  editing?: boolean;
  defaultEditing?: boolean;
  onValueChange?: (value: string) => void;
  onEditingChange?: (editing: boolean) => void;
  onSave?: EditableSaveHandler;
  validate?: EditableValidateHandler;
  onCancel?: (value: string) => void;
  display?: ReactNode | ((value: string) => ReactNode);
  editor?: EditableEditor;
  multiline?: boolean;
  inputProps?: Omit<InputProps, 'value' | 'defaultValue' | 'onValueChange' | 'onChange'>;
  textareaProps?: Omit<TextareaProps, 'value' | 'defaultValue' | 'onChange'>;
  placeholder?: string;
  startEditingLabel?: string;
  saveLabel?: string;
  cancelLabel?: string;
  blurBehavior?: EditableBlurBehavior;
  submitOnEnter?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  seed?: string | number;
}

export interface EditableHandle {
  focus: () => void;
  startEditing: () => void;
  save: () => void;
  cancel: () => void;
}

const classes = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(' ');
const interactiveSelector = 'button, a, input, textarea, select, option, [contenteditable="true"], [data-editable-ignore]';

function resultMessage(result: EditableSaveResult, fallback: string): string | undefined {
  if (typeof result === 'string') return result || fallback;
  if (result === false) return fallback;
  return undefined;
}

function isComposing(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
  return event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
}

export const Editable = forwardRef<EditableHandle, EditableProps>(function Editable(
  {
    'aria-label': ariaLabel,
    blurBehavior = 'ignore',
    className,
    defaultEditing = false,
    defaultValue = '',
    disabled = false,
    display,
    editor,
    editing,
    id,
    inputProps,
    invalid = false,
    multiline = false,
    onCancel,
    onEditingChange,
    onSave,
    onValueChange,
    placeholder = 'Edit value',
    readOnly = false,
    saveLabel = 'Save',
    cancelLabel = 'Cancel',
    startEditingLabel = 'Edit value',
    seed,
    submitOnEnter = !multiline,
    textareaProps,
    validate,
    value,
    ...props
  },
  forwardedRef,
) {
  const generatedId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const controlledValue = value !== undefined;
  const controlledEditing = editing !== undefined;
  const [localValue, setLocalValue] = useState(String(value ?? defaultValue));
  const [localEditing, setLocalEditing] = useState(defaultEditing);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const previousValueRef = useRef(String(value ?? defaultValue));
  const currentValue = controlledValue ? String(value ?? '') : localValue;
  const isEditing = controlledEditing ? Boolean(editing) : localEditing;
  const resolvedSeed = seed ?? `inkra-editable-${id ?? generatedId}`;
  const resolvedId = id ?? `inkra-editable-${generatedId}`;

  useEffect(() => {
    if (controlledValue) {
      const next = String(value ?? '');
      if (!isEditing) {
        previousValueRef.current = next;
        setLocalValue(next);
      }
    }
  }, [controlledValue, isEditing, value]);

  useEffect(() => {
    if (!isEditing || disabled || readOnly) return;
    const frame = requestAnimationFrame(() => editorRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [disabled, isEditing, readOnly]);

  const setEditing = useCallback((next: boolean) => {
    if (!controlledEditing) setLocalEditing(next);
    onEditingChange?.(next);
  }, [controlledEditing, onEditingChange]);

  const updateValue = useCallback((next: string) => {
    if (!controlledValue) setLocalValue(next);
    onValueChange?.(next);
  }, [controlledValue, onValueChange]);

  const startEditing = useCallback(() => {
    if (disabled || readOnly || saving || isEditing) return;
    setError(undefined);
    previousValueRef.current = currentValue;
    setEditing(true);
  }, [currentValue, disabled, isEditing, readOnly, saving, setEditing]);

  const finish = useCallback((restoreFocus = true) => {
    setEditing(false);
    if (restoreFocus) requestAnimationFrame(() => displayRef.current?.focus({ preventScroll: true }));
  }, [setEditing]);

  const cancel = useCallback(() => {
    if (saving) return;
    const previous = previousValueRef.current;
    updateValue(previous);
    setError(undefined);
    onCancel?.(previous);
    finish();
  }, [finish, onCancel, saving, updateValue]);

  const save = useCallback(async () => {
    if (saving || disabled || readOnly) return;
    const next = currentValue;
    const previous = previousValueRef.current;
    setSaving(true);
    setError(undefined);
    try {
      const validation = validate ? await validate(next, previous) : undefined;
      const validationMessage = resultMessage(validation, 'Value is invalid');
      if (validationMessage) {
        setError(validationMessage);
        return;
      }
      const saved = onSave ? await onSave(next, previous) : undefined;
      const saveMessage = resultMessage(saved, 'Could not save value');
      if (saveMessage) {
        setError(saveMessage);
        return;
      }
      previousValueRef.current = next;
      updateValue(next);
      finish();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save value');
    } finally {
      setSaving(false);
    }
  }, [currentValue, disabled, finish, onSave, readOnly, saving, updateValue, validate]);

  useImperativeHandle(forwardedRef, () => ({ focus: () => displayRef.current?.focus(), startEditing, save, cancel }), [cancel, save, startEditing]);

  const handleDisplayClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(interactiveSelector)) return;
    startEditing();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      startEditing();
    }
  };
  const handleEditorKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (isComposing(event)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
      return;
    }
    if (event.key === 'Enter' && submitOnEnter && (!multiline || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void save();
    }
  };
  const handleEditorBlur = () => {
    if (saving || blurBehavior === 'ignore') return;
    if (blurBehavior === 'cancel') cancel();
    else void save();
  };
  const displayContent = typeof display === 'function'
    ? display(currentValue)
    : (display ?? currentValue) || placeholder;
  const editorProps: EditableEditorProps = {
    value: currentValue,
    onValueChange: updateValue,
    onKeyDown: handleEditorKeyDown,
    onBlur: handleEditorBlur,
    disabled: disabled || saving,
    invalid: invalid || Boolean(error),
    error,
    autoFocus: true,
    'aria-label': ariaLabel,
  };
  const defaultEditor = multiline
    ? <Textarea {...textareaProps} aria-label={ariaLabel} autoFocus ref={editorRef as Ref<HTMLTextAreaElement>} value={currentValue} onChange={event => updateValue(event.currentTarget.value)} onKeyDown={handleEditorKeyDown} onBlur={handleEditorBlur} disabled={disabled || saving} invalid={invalid || Boolean(error)} placeholder={placeholder} seed={`${resolvedSeed}-textarea`} />
    : <Input {...inputProps} aria-label={ariaLabel} autoFocus ref={editorRef as Ref<HTMLInputElement>} value={currentValue} onValueChange={updateValue} onKeyDown={handleEditorKeyDown} onBlur={handleEditorBlur} disabled={disabled || saving} invalid={invalid || Boolean(error)} placeholder={placeholder} seed={`${resolvedSeed}-input`} />;

  return <div {...props} className={classes('inkra-editable', className)} data-editing={isEditing || undefined} data-saving={saving || undefined} data-invalid={Boolean(error) || invalid || undefined} data-multiline={multiline || undefined} ref={rootRef}>
    {isEditing ? <div className="inkra-editable__editor" data-editable-editor="true">
      {editor == null ? defaultEditor : typeof editor === 'function' ? editor(editorProps) : editor}
      <div className="inkra-editable__actions">
        <Button type="button" size="sm" variant="primary" loading={saving} onClick={() => void save()} aria-label={saveLabel}>{saveLabel}</Button>
        <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={cancel} aria-label={cancelLabel}>{cancelLabel}</Button>
      </div>
      {error ? <div className="inkra-editable__error" role="alert" id={`${resolvedId}-error`}>{error}</div> : null}
    </div> : <div aria-label={ariaLabel ?? startEditingLabel} className="inkra-editable__display" data-editable-display="true" onClick={handleDisplayClick} onKeyDown={handleKeyDown} ref={displayRef} role="button" tabIndex={disabled || readOnly ? -1 : 0} aria-disabled={disabled || readOnly || undefined}>{displayContent}</div>}
  </div>;
});

export type { InputProps, TextareaProps };
