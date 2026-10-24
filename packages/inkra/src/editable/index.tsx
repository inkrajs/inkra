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
import { Select } from '../select/index.js';
import type { SearchableSelectOption } from '../select/index.js';
import type { InputProps } from '../form/Input.js';
import type { TextareaProps } from '../form/Textarea.js';

export type EditableBlurBehavior = 'ignore' | 'save' | 'cancel';
export type EditableEditorType = 'input' | 'textarea' | 'select';
export interface EditableSelectProps {
  items: readonly SearchableSelectOption[];
  mode?: 'dropdown' | 'searchable' | 'stepper';
  size?: 'sm' | 'md' | 'lg';
  dir?: 'ltr' | 'rtl';
  searchPlaceholder?: string;
  emptyContent?: ReactNode;
  clearable?: boolean;
  clearLabel?: string;
  openLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  loop?: boolean;
}
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
  editorType?: EditableEditorType;
  selectProps?: EditableSelectProps;
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
    editorType,
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
    selectProps,
    submitOnEnter = true,
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
  const popupOpenRef = useRef(false);
  const popupFrameRef = useRef<number | undefined>(undefined);
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
  const resolvedEditorType = editorType ?? (multiline ? 'textarea' : 'input');
  const isMultiline = resolvedEditorType === 'textarea';
  const resolvedSize = resolvedEditorType === 'select' ? (selectProps?.size ?? 'md') : isMultiline ? (textareaProps?.size ?? 'md') : (inputProps?.size ?? 'md');
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
    const frame = requestAnimationFrame(() => {
      const control = editorRef.current ?? rootRef.current?.querySelector<HTMLElement>('[data-editable-editor] input:not([type="hidden"]), [data-editable-editor] textarea, [data-editable-editor] [role="combobox"], [data-editable-editor] [role="spinbutton"]');
      control?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [disabled, isEditing, readOnly]);

  useEffect(() => () => {
    if (blurFrameRef.current !== undefined) cancelAnimationFrame(blurFrameRef.current);
    if (popupFrameRef.current !== undefined) cancelAnimationFrame(popupFrameRef.current);
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
    popupOpenRef.current = false;
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
    if (event.key === 'Enter' && submitOnEnter && (!isMultiline || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void save();
    }
  };
  const handleEditorBlur = (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLDivElement>) => {
    if (event.defaultPrevented || popupOpenRef.current || rootRef.current?.contains(event.relatedTarget as Node | null)) return;
    if (blurFrameRef.current !== undefined) cancelAnimationFrame(blurFrameRef.current);
    blurFrameRef.current = requestAnimationFrame(() => {
      blurFrameRef.current = undefined;
      if (popupOpenRef.current || rootRef.current?.contains(document.activeElement) || savingRef.current || blurBehavior === 'ignore') return;
      if (blurBehavior === 'cancel') cancel(false);
      else void save(false);
    });
  };
  const displayValue = resolvedEditorType === 'select' ? (selectProps?.items.find(item => item.value === currentValue)?.label ?? currentValue) : currentValue;
  const displayContent = display == null
    ? <PencilText seed={`${resolvedSeed}-display-text`}>{displayValue || placeholder}</PencilText>
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
  const actions = <Tooltip.Provider><span aria-label={`${saveLabel}, ${cancelLabel}`} className="inkra-editable__actions" role="group">
    <Tooltip.Root><Tooltip.Trigger asChild><Button aria-label={saveLabel} className="inkra-editable__action" disabled={disabled || readOnly} loading={saving} onClick={() => void save()} size={actionSize} title={saveLabel} type="button" variant="ghost"><PencilIcon decorative paths={checkIcon} seed={`${resolvedSeed}-save-icon`} size={actionIconSize} sourceSize={24} /></Button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content>{saveLabel}</Tooltip.Content></Tooltip.Portal></Tooltip.Root>
    <Tooltip.Root><Tooltip.Trigger asChild><Button aria-label={cancelLabel} className="inkra-editable__action" disabled={disabled || saving} onClick={() => cancel()} size={actionSize} title={cancelLabel} type="button" variant="ghost"><PencilIcon decorative paths={cancelIcon} seed={`${resolvedSeed}-cancel-icon`} size={actionIconSize} sourceSize={24} /></Button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content>{cancelLabel}</Tooltip.Content></Tooltip.Portal></Tooltip.Root>
  </span></Tooltip.Provider>;
  const changePopupOpen = (open: boolean) => {
    if (popupFrameRef.current !== undefined) cancelAnimationFrame(popupFrameRef.current);
    if (open) popupOpenRef.current = true;
    else popupFrameRef.current = requestAnimationFrame(() => {
      popupOpenRef.current = false;
      if (!rootRef.current || rootRef.current.contains(document.activeElement) || document.activeElement === document.body || savingRef.current) return;
      if (blurBehavior === 'cancel') cancel(false);
      else if (blurBehavior === 'save') void save(false);
    });
  };
  const items = selectProps?.items ?? [];
  const selectState = {
    value: currentValue,
    onValueChange: (next: string | null) => updateValue(next ?? ''),
    disabled: disabled || saving,
    readOnly,
    size: resolvedSize,
    dir: selectProps?.dir,
    placeholder,
    'aria-label': ariaLabel ?? startEditingLabel,
    'aria-describedby': error ? `${resolvedId}-error` : undefined,
    'aria-errormessage': error ? `${resolvedId}-error` : undefined,
    invalid: invalid || Boolean(error),
  };
  const selectEditor = <div className="inkra-editable__select-row" onKeyDown={event => {
    if (event.defaultPrevented || popupOpenRef.current || event.target !== event.currentTarget.ownerDocument.activeElement) return;
    if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); cancel(); }
  }}>
    {selectProps?.mode === 'searchable' ? <Select.Searchable {...selectState} items={items}
      searchPlaceholder={selectProps.searchPlaceholder} emptyContent={selectProps.emptyContent}
      clearable={selectProps.clearable ?? false} clearLabel={selectProps.clearLabel} openLabel={selectProps.openLabel}
      onOpenChange={changePopupOpen} />
      : selectProps?.mode === 'stepper' ? <Select.Stepper {...selectState} items={items}
          loop={selectProps.loop} previousLabel={selectProps.previousLabel} nextLabel={selectProps.nextLabel} />
      : <Select.Root value={currentValue} onValueChange={updateValue} disabled={disabled || saving} readOnly={readOnly} dir={selectProps?.dir} onOpenChange={changePopupOpen}>
          <Select.Trigger aria-label={ariaLabel ?? startEditingLabel} aria-describedby={selectState['aria-describedby']} aria-errormessage={selectState['aria-errormessage']} invalid={selectState.invalid} size={resolvedSize}>
            <Select.Value placeholder={placeholder} />
          </Select.Trigger>
          <Select.Portal><Select.Content><Select.Viewport>
            {items.filter(item => item.value !== '').map(item => <Select.Item key={item.value} value={item.value} disabled={item.disabled}>
              <Select.ItemText>{item.label}</Select.ItemText><Select.ItemIndicator />
            </Select.Item>)}
          </Select.Viewport></Select.Content></Select.Portal>
        </Select.Root>}
    {actions}
  </div>;
  const defaultEditor = resolvedEditorType === 'select' ? selectEditor : isMultiline
    ? <Textarea
        variant="underline"
        {...textareaProps}
        endAction={<>{textareaProps?.endAction}{actions}</>}
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
        variant="underline"
        {...inputProps}
        endAction={<>{inputProps?.endAction}{actions}</>}
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

  return <div {...props} className={classes('inkra-editable', className)} data-disabled={disabled || undefined} data-editing={isEditing || undefined} data-saving={saving || undefined} data-invalid={Boolean(error) || invalid || undefined} data-multiline={isMultiline || undefined} data-editor-type={resolvedEditorType} data-readonly={readOnly || undefined} data-size={resolvedSize} onBlur={event => {
    onRootBlur?.(event);
    handleEditorBlur(event);
  }} ref={rootRef}>
    <div className="inkra-editable__frame">
      {isEditing ? <div className="inkra-editable__editor" data-editable-editor="true">
        {editor == null ? defaultEditor : <div className="inkra-editable__custom-row">{typeof editor === 'function' ? editor(editorProps) : editor}{actions}</div>}
        {error ? <PencilText as="div" className="inkra-editable__error" role="alert" id={`${resolvedId}-error`} seed={`${resolvedSeed}-error`}>{error}</PencilText> : null}
      </div> : <div className="inkra-editable__display-shell">
        <PencilSurface<'span'> aria-hidden="true" as="span" className="inkra-editable__focus-ring" seed={`${resolvedSeed}-focus`} variant="outline" />
        {display == null
          ? <button aria-label={ariaLabel ?? startEditingLabel} className="inkra-editable__display" data-editable-display="true" disabled={disabled || readOnly} onClick={startEditing} ref={editButtonRef} type="button">{displayContent}</button>
          : <><div className="inkra-editable__display" data-editable-display="true" onClick={handleDisplayClick}>{displayContent}</div>
              <button aria-label={ariaLabel ?? startEditingLabel} className="inkra-editable__custom-trigger" disabled={disabled || readOnly} onClick={startEditing} ref={editButtonRef} type="button">{startEditingLabel}</button></>}
      </div>}
    </div>
  </div>;
});

export type { InputProps, TextareaProps };
