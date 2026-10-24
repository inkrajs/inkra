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
  FocusEvent,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  Ref,
} from 'react';

import { Button } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { Input } from '../form/Input.js';
import { Textarea } from '../form/Textarea.js';
import { Tooltip } from '../tooltip/Tooltip.js';
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
  onBlur: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  error?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-errormessage'?: string;
  'aria-invalid'?: boolean;
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
const pencilIcon = [{ d: 'M12 20h9' }, { d: 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' }];
const checkIcon = [{ d: 'm20 6-11 11-5-5' }];
const cancelIcon = [{ d: 'M18 6 6 18' }, { d: 'm6 6 12 12' }];

function mergeIds(...ids: Array<string | undefined>) {
  return ids.filter(Boolean).join(' ') || undefined;
}

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
    onBlur: onRootBlur,
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
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const blurFrameRef = useRef<number | undefined>(undefined);
  const savingRef = useRef(false);
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
  const resolvedSize = multiline ? (textareaProps?.size ?? 'md') : (inputProps?.size ?? 'md');
  const actionSize = resolvedSize === 'sm' ? 'icon-sm' : resolvedSize === 'lg' ? 'icon-lg' : 'icon';
  const actionIconSize = resolvedSize === 'sm' ? 18 : resolvedSize === 'lg' ? 24 : 20;

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

  useEffect(() => () => {
    if (blurFrameRef.current !== undefined) cancelAnimationFrame(blurFrameRef.current);
  }, []);

  const setEditing = useCallback((next: boolean) => {
    if (!controlledEditing) setLocalEditing(next);
    onEditingChange?.(next);
  }, [controlledEditing, onEditingChange]);

  const updateValue = useCallback((next: string) => {
    if (!controlledValue) setLocalValue(next);
    onValueChange?.(next);
  }, [controlledValue, onValueChange]);

  const startEditing = useCallback(() => {
    if (disabled || readOnly || savingRef.current || isEditing) return;
    setError(undefined);
    previousValueRef.current = currentValue;
    setEditing(true);
  }, [currentValue, disabled, isEditing, readOnly, setEditing]);

  const finish = useCallback((restoreFocus = true) => {
    setEditing(false);
    if (restoreFocus) requestAnimationFrame(() => editButtonRef.current?.focus({ preventScroll: true }));
  }, [setEditing]);

  const cancel = useCallback((restoreFocus = true) => {
    if (savingRef.current) return;
    if (blurFrameRef.current !== undefined) {
      cancelAnimationFrame(blurFrameRef.current);
      blurFrameRef.current = undefined;
    }
    const previous = previousValueRef.current;
    updateValue(previous);
    setError(undefined);
    onCancel?.(previous);
    finish(restoreFocus);
  }, [finish, onCancel, updateValue]);

  const save = useCallback(async (restoreFocus = true) => {
    if (savingRef.current || disabled || readOnly) return;
    if (blurFrameRef.current !== undefined) {
      cancelAnimationFrame(blurFrameRef.current);
      blurFrameRef.current = undefined;
    }
    const next = currentValue;
    const previous = previousValueRef.current;
    savingRef.current = true;
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
      finish(restoreFocus);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save value');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [currentValue, disabled, finish, onSave, readOnly, updateValue, validate]);

  useImperativeHandle(forwardedRef, () => ({ focus: () => editButtonRef.current?.focus(), startEditing, save, cancel }), [cancel, save, startEditing]);

  const handleDisplayClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(interactiveSelector)) return;
    startEditing();
  };
  const handleEditorKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.defaultPrevented || isComposing(event)) return;
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
  const handleEditorBlur = (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLDivElement>) => {
    if (event.defaultPrevented || rootRef.current?.contains(event.relatedTarget as Node | null)) return;
    if (blurFrameRef.current !== undefined) cancelAnimationFrame(blurFrameRef.current);
    blurFrameRef.current = requestAnimationFrame(() => {
      blurFrameRef.current = undefined;
      if (rootRef.current?.contains(document.activeElement) || savingRef.current || blurBehavior === 'ignore') return;
      if (blurBehavior === 'cancel') cancel(false);
      else void save(false);
    });
  };
  const displayContent = display == null
    ? <PencilText seed={`${resolvedSeed}-display-text`}>{currentValue || placeholder}</PencilText>
    : typeof display === 'function' ? display(currentValue) : display;
  const editorProps: EditableEditorProps = {
    value: currentValue,
    onValueChange: updateValue,
    onKeyDown: handleEditorKeyDown,
    onBlur: handleEditorBlur,
    disabled: disabled || saving,
    readOnly,
    invalid: invalid || Boolean(error),
    error,
    autoFocus: true,
    'aria-label': ariaLabel,
    'aria-describedby': error ? `${resolvedId}-error` : undefined,
    'aria-errormessage': error ? `${resolvedId}-error` : undefined,
    'aria-invalid': invalid || Boolean(error) || undefined,
  };
  const inputDescription = mergeIds(inputProps?.['aria-describedby'], error ? `${resolvedId}-error` : undefined);
  const textareaDescription = mergeIds(textareaProps?.['aria-describedby'], error ? `${resolvedId}-error` : undefined);
  const defaultEditor = multiline
    ? <Textarea
        {...textareaProps}
        aria-describedby={textareaDescription}
        aria-errormessage={error ? `${resolvedId}-error` : textareaProps?.['aria-errormessage']}
        aria-invalid={invalid || Boolean(error) || textareaProps?.['aria-invalid']}
        aria-label={ariaLabel}
        autoFocus
        disabled={disabled || saving}
        invalid={invalid || Boolean(error)}
        onBlur={event => {
          textareaProps?.onBlur?.(event);
          handleEditorBlur(event);
        }}
        onChange={event => updateValue(event.currentTarget.value)}
        onKeyDown={event => {
          textareaProps?.onKeyDown?.(event);
          handleEditorKeyDown(event);
        }}
        placeholder={placeholder}
        readOnly={readOnly}
        ref={editorRef as Ref<HTMLTextAreaElement>}
        seed={`${resolvedSeed}-textarea`}
        value={currentValue}
      />
    : <Input
        {...inputProps}
        aria-describedby={inputDescription}
        aria-errormessage={error ? `${resolvedId}-error` : inputProps?.['aria-errormessage']}
        aria-invalid={invalid || Boolean(error) || inputProps?.['aria-invalid']}
        aria-label={ariaLabel}
        autoFocus
        disabled={disabled || saving}
        invalid={invalid || Boolean(error)}
        onBlur={event => {
          inputProps?.onBlur?.(event);
          handleEditorBlur(event);
        }}
        onKeyDown={event => {
          inputProps?.onKeyDown?.(event);
          handleEditorKeyDown(event);
        }}
        onValueChange={updateValue}
        placeholder={placeholder}
        readOnly={readOnly}
        ref={editorRef as Ref<HTMLInputElement>}
        seed={`${resolvedSeed}-input`}
        value={currentValue}
      />;

  return <div {...props} className={classes('inkra-editable', className)} data-disabled={disabled || undefined} data-editing={isEditing || undefined} data-saving={saving || undefined} data-invalid={Boolean(error) || invalid || undefined} data-multiline={multiline || undefined} data-readonly={readOnly || undefined} data-size={resolvedSize} onBlur={event => {
    onRootBlur?.(event);
    handleEditorBlur(event);
  }} ref={rootRef}>
    <div className="inkra-editable__frame">
      {isEditing ? <div className="inkra-editable__editor" data-editable-editor="true">
        {editor == null ? defaultEditor : typeof editor === 'function' ? editor(editorProps) : editor}
        {error ? <PencilText as="div" className="inkra-editable__error" role="alert" id={`${resolvedId}-error`} seed={`${resolvedSeed}-error`}>{error}</PencilText> : null}
      </div> : <div className="inkra-editable__display-shell">
        <PencilSurface<'span'> aria-hidden="true" as="span" className="inkra-editable__display-surface" seed={`${resolvedSeed}-display`} variant="quiet" />
        <div className="inkra-editable__display" data-editable-display="true" onClick={handleDisplayClick}>{displayContent}</div>
      </div>}
      <Tooltip.Provider><div aria-label={isEditing ? `${saveLabel}, ${cancelLabel}` : startEditingLabel} className="inkra-editable__actions" role="group">
        {isEditing ? <>
          <Tooltip.Root><Tooltip.Trigger asChild><Button aria-label={saveLabel} className="inkra-editable__action" disabled={disabled || readOnly} loading={saving} onClick={() => void save()} size={actionSize} title={saveLabel} type="button" variant="primary"><PencilIcon decorative paths={checkIcon} seed={`${resolvedSeed}-save-icon`} size={actionIconSize} sourceSize={24} /></Button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content>{saveLabel}</Tooltip.Content></Tooltip.Portal></Tooltip.Root>
          <Tooltip.Root><Tooltip.Trigger asChild><Button aria-label={cancelLabel} className="inkra-editable__action" disabled={saving} onClick={() => cancel()} size={actionSize} title={cancelLabel} type="button" variant="ghost"><PencilIcon decorative paths={cancelIcon} seed={`${resolvedSeed}-cancel-icon`} size={actionIconSize} sourceSize={24} /></Button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content>{cancelLabel}</Tooltip.Content></Tooltip.Portal></Tooltip.Root>
        </> : <Tooltip.Root><Tooltip.Trigger asChild><Button aria-label={ariaLabel ?? startEditingLabel} className="inkra-editable__action inkra-editable__action--edit" disabled={disabled || readOnly} onClick={startEditing} ref={editButtonRef} size={actionSize} title={startEditingLabel} type="button" variant="ghost"><PencilIcon decorative paths={pencilIcon} seed={`${resolvedSeed}-edit-icon`} size={actionIconSize} sourceSize={24} /></Button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content>{startEditingLabel}</Tooltip.Content></Tooltip.Portal></Tooltip.Root>}
      </div></Tooltip.Provider>
    </div>
  </div>;
});

export type { InputProps, TextareaProps };
