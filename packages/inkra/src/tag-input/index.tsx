import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ChangeEvent,
  ClipboardEvent,
  HTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent,
  MouseEvent,
} from 'react';

import { PencilIcon } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { useResolvedControlProps } from '../form/controlProps.js';
import type { FieldControlSize, FieldControlStateProps } from '../form/types.js';
import {
  createDefaultTag,
  defaultTagInputDelimiters,
  defaultTagValueKey,
  normalizeTagInputValue,
  splitTagInputValue,
} from './model.js';
import type { TagInputIdentity } from './model.js';

export interface TagInputTag extends TagInputIdentity {
  label?: string;
}

export type TagInputVariant = 'underline' | 'outline' | 'soft';
export type TagInputCommitReason = 'enter' | 'delimiter' | 'paste';
export type TagInputChangeReason = 'add' | 'remove' | 'clear';
export type TagInputValidationCode = 'duplicate' | 'max-tags' | 'invalid';
export type TagInputValidationResult = boolean | string | null | undefined;

export interface TagInputChangeDetails {
  reason: TagInputChangeReason;
  tags: readonly TagInputTag[];
  inputReason?: TagInputCommitReason;
}

export interface TagInputDraftChangeDetails {
  reason: 'input' | 'commit' | 'clear';
}

export interface TagInputValidationContext {
  tags: readonly TagInputTag[];
  reason: TagInputCommitReason;
}

export interface TagInputValidationDetails extends TagInputValidationContext {
  candidate: string;
  code: TagInputValidationCode;
}

export interface TagInputLabels {
  tagList: string;
  removeTag: (tag: TagInputTag) => string;
  clearAll: string;
  duplicate: (candidate: string) => string;
  maxTags: (maximum: number) => string;
  invalid: (candidate: string) => string;
}

export type TagInputClassNames = Partial<Record<
  'root' | 'control' | 'list' | 'tag' | 'input' | 'clear' | 'message',
  string
>>;

export interface TagInputCreateContext extends TagInputValidationContext {}

export interface TagInputProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue' | 'onChange'>,
    FieldControlStateProps {
  value?: readonly TagInputTag[];
  defaultValue?: readonly TagInputTag[];
  onValueChange?: (value: readonly TagInputTag[], details: TagInputChangeDetails) => void;
  inputValue?: string;
  defaultInputValue?: string;
  onInputValueChange?: (value: string, details: TagInputDraftChangeDetails) => void;
  createTag?: (candidate: string, context: TagInputCreateContext) => TagInputTag | null | undefined;
  validateTag?: (candidate: string, context: TagInputValidationContext) => TagInputValidationResult;
  onValidationError?: (message: string, details: TagInputValidationDetails) => void;
  validationMessage?: string;
  getTagValueKey?: (value: string) => string;
  delimiters?: readonly string[];
  maxTags?: number;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  name?: string;
  form?: string;
  placeholder?: string;
  clearable?: boolean;
  fullWidth?: boolean;
  variant?: TagInputVariant;
  labels?: Partial<TagInputLabels>;
  inputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'defaultValue' | 'disabled' | 'form' | 'id' | 'name' | 'placeholder' | 'readOnly' | 'required' | 'size' | 'value'
  >;
  classNames?: TagInputClassNames;
}

interface PendingFocusInput { input: true }
interface PendingFocusTag { tagId: string }
type PendingFocus = PendingFocusInput | PendingFocusTag | null;

const removePaths = [{ d: 'M18 6 6 18' }, { d: 'm6 6 12 12' }] as const;
const clearPaths = [{ d: 'M4 7h16' }, { d: 'M9 7V4h6v3' }, { d: 'm7 7 1 13h8l1-13' }] as const;
const classes = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(' ');

const defaultLabels: TagInputLabels = {
  tagList: 'Selected tags',
  removeTag: tag => `Remove ${tag.label ?? tag.value}`,
  clearAll: 'Clear all tags',
  duplicate: candidate => `${candidate} is already added.`,
  maxTags: maximum => `You can add up to ${maximum} tags.`,
  invalid: candidate => `${candidate} is not a valid tag.`,
};

function joinAriaIds(...values: (string | undefined)[]) {
  const ids = values.flatMap(value => value?.split(/\s+/).filter(Boolean) ?? []);
  return [...new Set(ids)].join(' ') || undefined;
}

function resolvedLabels(labels: Partial<TagInputLabels> | undefined): TagInputLabels {
  return {
    tagList: labels?.tagList ?? defaultLabels.tagList,
    removeTag: labels?.removeTag ?? defaultLabels.removeTag,
    clearAll: labels?.clearAll ?? defaultLabels.clearAll,
    duplicate: labels?.duplicate ?? defaultLabels.duplicate,
    maxTags: labels?.maxTags ?? defaultLabels.maxTags,
    invalid: labels?.invalid ?? defaultLabels.invalid,
  };
}

function validationText(result: TagInputValidationResult, fallback: string): string | undefined {
  if (typeof result === 'string') return result || fallback;
  if (result === false) return fallback;
  return undefined;
}

export const TagInput = forwardRef<HTMLInputElement, TagInputProps>(function TagInput(
  {
    'aria-describedby': ariaDescribedBy,
    'aria-errormessage': ariaErrorMessage,
    'aria-invalid': ariaInvalid,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    className,
    classNames = {},
    clearable = true,
    createTag,
    defaultInputValue = '',
    defaultValue = [],
    delimiters = defaultTagInputDelimiters,
    disabled,
    form,
    fullWidth = true,
    getTagValueKey = defaultTagValueKey,
    id,
    inputProps = {},
    inputValue,
    invalid = false,
    labels,
    maxTags,
    name,
    onClick,
    onInputValueChange,
    onValidationError,
    onValueChange,
    placeholder,
    readOnly,
    required,
    seed,
    size = 'md',
    validationMessage,
    validateTag,
    value,
    variant = 'outline',
    ...rootProps
  },
  forwardedRef,
) {
  const generatedId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const removeRefs = useRef(new Map<string, HTMLButtonElement>());
  const composingRef = useRef(false);
  const defaultTagsRef = useRef(defaultValue);
  const defaultDraftRef = useRef(defaultInputValue);
  const [uncontrolledTags, setUncontrolledTags] = useState<TagInputTag[]>(() => [...defaultValue]);
  const [uncontrolledDraft, setUncontrolledDraft] = useState(defaultInputValue);
  const [localValidationMessage, setLocalValidationMessage] = useState<string>();
  const [focusWithin, setFocusWithin] = useState(false);
  const [pendingFocus, setPendingFocus] = useState<PendingFocus>(null);
  const tagsControlled = value !== undefined;
  const draftControlled = inputValue !== undefined;
  const currentTags = tagsControlled ? value : uncontrolledTags;
  const currentDraft = draftControlled ? inputValue : uncontrolledDraft;
  const copy = useMemo(() => resolvedLabels(labels), [labels]);
  const activeValidationMessage = validationMessage ?? localValidationMessage;
  const messageId = activeValidationMessage ? `inkra-tag-input-${generatedId}-message` : undefined;
  const state = useResolvedControlProps({
    id,
    required,
    disabled,
    readOnly,
    invalid: invalid || Boolean(activeValidationMessage),
    'aria-describedby': joinAriaIds(ariaDescribedBy, messageId),
    'aria-errormessage': activeValidationMessage ? messageId : ariaErrorMessage,
    'aria-invalid': ariaInvalid,
  });
  const resolvedSeed = seed ?? `inkra-tag-input-${state.id ?? generatedId}`;
  const limit = typeof maxTags === 'number' && Number.isFinite(maxTags)
    ? Math.max(0, Math.floor(maxTags))
    : Number.POSITIVE_INFINITY;
  const atLimit = currentTags.length >= limit;
  const canEdit = !state.disabled && !state.readOnly;
  const surfaceVariant = state.invalid
    ? 'danger'
    : variant === 'soft'
      ? 'quiet'
      : variant === 'underline'
        ? 'ghost'
        : 'outline';

  defaultTagsRef.current = defaultValue;
  defaultDraftRef.current = defaultInputValue;
  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

  useEffect(() => {
    if (!pendingFocus) return;
    const target = 'input' in pendingFocus
      ? inputRef.current
      : removeRefs.current.get(pendingFocus.tagId) ?? inputRef.current;
    target?.focus({ preventScroll: true });
    setPendingFocus(null);
  }, [currentTags, pendingFocus]);

  useEffect(() => {
    const input = inputRef.current;
    const ownerForm = input?.form;
    if (!input || !ownerForm || (tagsControlled && draftControlled)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = (event: Event) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (event.defaultPrevented) return;
        if (!tagsControlled) setUncontrolledTags([...defaultTagsRef.current]);
        if (!draftControlled) setUncontrolledDraft(defaultDraftRef.current);
        setLocalValidationMessage(undefined);
      }, 0);
    };
    ownerForm.addEventListener('reset', reset);
    return () => {
      clearTimeout(timer);
      ownerForm.removeEventListener('reset', reset);
    };
  }, [draftControlled, form, tagsControlled]);

  const updateDraft = (next: string, details: TagInputDraftChangeDetails) => {
    if (!draftControlled) setUncontrolledDraft(next);
    onInputValueChange?.(next, details);
  };

  const commitTags = (next: readonly TagInputTag[], details: TagInputChangeDetails) => {
    if (!tagsControlled) setUncontrolledTags([...next]);
    onValueChange?.(next, details);
  };

  const reportValidation = (
    candidate: string,
    reason: TagInputCommitReason,
    code: TagInputValidationCode,
    message: string,
    tags: readonly TagInputTag[],
  ) => {
    setLocalValidationMessage(message);
    onValidationError?.(message, { candidate, code, reason, tags });
  };

  const commitCandidates = (candidates: readonly string[], reason: TagInputCommitReason) => {
    if (!canEdit) return false;
    const working = [...currentTags];
    const valueKeys = new Set(currentTags.map(tag => getTagValueKey(tag.value)));
    const ids = new Set(currentTags.map(tag => tag.id));
    const added: TagInputTag[] = [];
    let rejected: { candidate: string; code: TagInputValidationCode; message: string } | undefined;

    for (const rawCandidate of candidates) {
      const candidate = normalizeTagInputValue(rawCandidate);
      if (!candidate) continue;
      if (working.length >= limit) {
        rejected = { candidate, code: 'max-tags', message: copy.maxTags(limit) };
        break;
      }
      if (valueKeys.has(getTagValueKey(candidate))) {
        rejected = { candidate, code: 'duplicate', message: copy.duplicate(candidate) };
        break;
      }

      const context = { tags: working, reason } satisfies TagInputValidationContext;
      const message = validationText(validateTag?.(candidate, context), copy.invalid(candidate));
      if (message) {
        rejected = { candidate, code: 'invalid', message };
        break;
      }

      const tag = createTag ? createTag(candidate, context) : createDefaultTag(candidate);
      if (!tag || !tag.id || !normalizeTagInputValue(tag.value)) {
        rejected = { candidate, code: 'invalid', message: copy.invalid(candidate) };
        break;
      }
      if (ids.has(tag.id) || valueKeys.has(getTagValueKey(tag.value))) {
        rejected = { candidate, code: 'duplicate', message: copy.duplicate(candidate) };
        break;
      }
      working.push(tag);
      ids.add(tag.id);
      valueKeys.add(getTagValueKey(tag.value));
      added.push(tag);
    }

    if (added.length > 0) commitTags(working, { reason: 'add', tags: added, inputReason: reason });
    if (rejected) {
      updateDraft(rejected.candidate, { reason: 'commit' });
      reportValidation(rejected.candidate, reason, rejected.code, rejected.message, working);
      inputRef.current?.focus({ preventScroll: true });
      return false;
    }
    setLocalValidationMessage(undefined);
    updateDraft('', { reason: 'commit' });
    inputRef.current?.focus({ preventScroll: true });
    return added.length > 0;
  };

  const commitDraft = (reason: TagInputCommitReason) => {
    const parsed = splitTagInputValue(currentDraft, delimiters);
    return commitCandidates(parsed.parts, reason);
  };

  const removeTag = (index: number, focus: PendingFocus = null) => {
    if (!canEdit) return;
    const tag = currentTags[index];
    if (!tag) return;
    const next = currentTags.filter((_, tagIndex) => tagIndex !== index);
    const nextFocus = focus ?? (currentTags[index + 1]
      ? { tagId: currentTags[index + 1].id }
      : currentTags[index - 1]
        ? { tagId: currentTags[index - 1].id }
        : { input: true });
    setLocalValidationMessage(undefined);
    commitTags(next, { reason: 'remove', tags: [tag] });
    setPendingFocus(nextFocus);
  };

  const clearAll = () => {
    if (!canEdit || currentTags.length === 0) return;
    const removed = [...currentTags];
    setLocalValidationMessage(undefined);
    commitTags([], { reason: 'clear', tags: removed });
    updateDraft('', { reason: 'clear' });
    setPendingFocus({ input: true });
  };

  const focusRemoveButton = (index: number) => {
    const tag = currentTags[index];
    if (tag) removeRefs.current.get(tag.id)?.focus({ preventScroll: true });
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    inputProps.onChange?.(event);
    if (event.defaultPrevented) return;
    setLocalValidationMessage(undefined);
    updateDraft(event.currentTarget.value, { reason: 'input' });
  };

  const handleInputPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    inputProps.onPaste?.(event);
    if (event.defaultPrevented || !canEdit || composingRef.current) return;
    const pasted = event.clipboardData.getData('text');
    const start = event.currentTarget.selectionStart ?? currentDraft.length;
    const end = event.currentTarget.selectionEnd ?? start;
    const combined = `${currentDraft.slice(0, start)}${pasted}${currentDraft.slice(end)}`;
    const parsed = splitTagInputValue(combined, delimiters);
    if (!parsed.hasDelimiter) return;
    event.preventDefault();
    commitCandidates(parsed.parts, 'paste');
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    inputProps.onKeyDown?.(event);
    if (event.defaultPrevented || !canEdit) return;
    const nativeEvent = event.nativeEvent;
    if (composingRef.current || nativeEvent.isComposing || nativeEvent.keyCode === 229) return;

    const direction = getComputedStyle(event.currentTarget).direction;
    const previousKey = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === previousKey && event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0) {
      if (currentTags.length > 0 && !state.readOnly) {
        event.preventDefault();
        focusRemoveButton(currentTags.length - 1);
      }
      return;
    }
    if (event.key === 'Backspace' && currentDraft.length === 0 && currentTags.length > 0) {
      event.preventDefault();
      removeTag(currentTags.length - 1, { input: true });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      commitDraft('enter');
      return;
    }
    if (delimiters.includes(event.key)) {
      event.preventDefault();
      commitDraft('delimiter');
    }
  };

  const handleTagKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.defaultPrevented || !canEdit) return;
    const direction = getComputedStyle(event.currentTarget).direction;
    const previousKey = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const nextKey = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    if (event.key === previousKey) {
      event.preventDefault();
      focusRemoveButton(Math.max(0, index - 1));
    } else if (event.key === nextKey) {
      event.preventDefault();
      if (index >= currentTags.length - 1) inputRef.current?.focus({ preventScroll: true });
      else focusRemoveButton(index + 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusRemoveButton(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      inputRef.current?.focus({ preventScroll: true });
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      removeTag(index);
    }
  };

  return (
    <div
      {...rootProps}
      className={classes('inkra-field-control-hit', 'inkra-tag-input', className, classNames.root)}
      data-disabled={state.disabled || undefined}
      data-draft-empty={currentDraft.length === 0 || undefined}
      data-focus-within={focusWithin || undefined}
      data-full-width={fullWidth}
      data-has-placeholder={Boolean(placeholder) || undefined}
      data-has-tags={currentTags.length > 0 || undefined}
      data-invalid={state.invalid || undefined}
      data-max-reached={atLimit || undefined}
      data-readonly={state.readOnly || undefined}
      data-size={size}
      data-variant={variant}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
        rootProps.onBlurCapture?.(event);
      }}
      onClick={event => {
        onClick?.(event);
        if (event.defaultPrevented || state.disabled) return;
        const target = event.target as HTMLElement;
        if (!target.closest('button, input')) inputRef.current?.focus({ preventScroll: true });
      }}
      onFocusCapture={event => {
        setFocusWithin(true);
        rootProps.onFocusCapture?.(event);
      }}
    >
      <PencilSurface<'div'>
        as="div"
        className={classes('inkra-field-control', 'inkra-tag-input__control', classNames.control)}
        radius={8}
        seed={resolvedSeed}
        variant={surfaceVariant}
      >
        <ul aria-label={copy.tagList} className={classes('inkra-tag-input__list', classNames.list)}>
          {currentTags.map((tag, index) => (
            <PencilSurface<'li'>
              as="li"
              className={classes('inkra-tag-input__tag', classNames.tag)}
              data-tag-id={tag.id}
              key={`${tag.id}-${index}`}
              radius={6}
              seed={`${resolvedSeed}-tag-${tag.id}`}
              variant="quiet"
            >
              <span className="inkra-tag-input__tag-label">{tag.label ?? tag.value}</span>
              {!state.readOnly ? (
                <button
                  aria-label={copy.removeTag(tag)}
                  className="inkra-tag-input__remove"
                  disabled={state.disabled}
                  onClick={() => removeTag(index)}
                  onKeyDown={event => handleTagKeyDown(event, index)}
                  ref={node => {
                    if (node) removeRefs.current.set(tag.id, node);
                    else removeRefs.current.delete(tag.id);
                  }}
                  title={copy.removeTag(tag)}
                  type="button"
                >
                  <PencilIcon decorative paths={removePaths} seed={`${resolvedSeed}-remove-${tag.id}`} size={18} sourceSize={24} />
                </button>
              ) : null}
            </PencilSurface>
          ))}
        </ul>
        <input
          {...inputProps}
          aria-describedby={state.describedBy}
          aria-errormessage={state.errorMessage}
          aria-invalid={state.ariaInvalid}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-readonly={state.readOnly || undefined}
          aria-required={state.required || undefined}
          autoComplete={inputProps.autoComplete ?? 'off'}
          className={classes('inkra-input', 'inkra-tag-input__input', inputProps.className, classNames.input)}
          disabled={state.disabled}
          form={form}
          id={state.id}
          onChange={handleInputChange}
          onCompositionEnd={event => {
            composingRef.current = false;
            inputProps.onCompositionEnd?.(event);
          }}
          onCompositionStart={event => {
            composingRef.current = true;
            inputProps.onCompositionStart?.(event);
          }}
          onKeyDown={handleInputKeyDown}
          onPaste={handleInputPaste}
          placeholder={placeholder}
          readOnly={state.readOnly}
          ref={inputRef}
          required={state.required && currentTags.length === 0}
          spellCheck={inputProps.spellCheck ?? false}
          type="text"
          value={currentDraft}
        />
        {clearable && currentTags.length > 0 && !state.readOnly ? (
          <button
            aria-label={copy.clearAll}
            className={classes('inkra-tag-input__clear', classNames.clear)}
            disabled={state.disabled}
            onClick={clearAll}
            onPointerDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()}
            title={copy.clearAll}
            type="button"
          >
            <PencilIcon decorative paths={clearPaths} seed={`${resolvedSeed}-clear`} size={20} sourceSize={24} />
          </button>
        ) : null}
        {variant === 'underline' ? (
          <PencilLine
            className="inkra-tag-input__underline"
            seed={`${resolvedSeed}-underline`}
            weight={(focusWithin ? 1.5 : 1) + (state.invalid ? 0.1 : 0)}
          />
        ) : null}
      </PencilSurface>
      {name ? currentTags.map((tag, index) => (
        <input disabled={state.disabled} form={form} key={`${tag.id}-${index}`} name={name} type="hidden" value={tag.value} />
      )) : null}
      {activeValidationMessage ? (
        <PencilText
          as="span"
          className={classes('inkra-tag-input__message', classNames.message)}
          id={messageId}
          role="alert"
          seed={`${resolvedSeed}-message`}
        >
          {activeValidationMessage}
        </PencilText>
      ) : null}
    </div>
  );
});

export {
  createDefaultTag,
  defaultTagInputDelimiters,
  defaultTagValueKey,
  normalizeTagInputValue,
  splitTagInputValue,
};
export { hasTagValue } from './model.js';
export type { FieldControlSize, TagInputIdentity };
