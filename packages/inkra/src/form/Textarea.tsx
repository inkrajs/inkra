import { forwardRef, useId, useImperativeHandle, useRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';

import { PencilSurface } from '../PencilSurface.js';
import { useResolvedControlProps } from './controlProps.js';
import { EditablePencilText } from './EditablePencilText.js';
import type { FieldControlStateProps } from './types.js';

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    FieldControlStateProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    'aria-describedby': ariaDescribedBy,
    'aria-errormessage': ariaErrorMessage,
    'aria-invalid': ariaInvalid,
    className,
    disabled,
    id,
    invalid = false,
    readOnly,
    required,
    seed,
    size = 'md',
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);
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
  const resolvedSeed = seed ?? `inkra-textarea-${state.id ?? generatedId}`;
  const classes = ['inkra-textarea', className].filter(Boolean).join(' ');

  return (
    <span
      className="inkra-field-control-hit inkra-field-control-hit--textarea"
      data-disabled={state.disabled || undefined}
      data-invalid={state.invalid || undefined}
      data-readonly={state.readOnly || undefined}
      data-size={size}
    >
      <PencilSurface<'span'>
        as="span"
        className="inkra-field-control inkra-field-control--textarea"
        seed={resolvedSeed}
        variant={state.invalid ? 'danger' : 'outline'}
      >
        <textarea
          {...props}
          aria-describedby={state.describedBy}
          aria-errormessage={state.errorMessage}
          aria-invalid={state.ariaInvalid}
          className={classes}
          disabled={state.disabled}
          id={state.id}
          readOnly={state.readOnly}
          ref={textareaRef}
          required={state.required}
        />
        <EditablePencilText
          controlRef={textareaRef}
          defaultValue={props.defaultValue}
          multiline
          placeholder={props.placeholder}
          seed={`${resolvedSeed}-editable`}
          value={props.value}
        />
      </PencilSurface>
    </span>
  );
});
