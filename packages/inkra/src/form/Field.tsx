import { useId } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

import { PencilText } from '../PencilText.js';
import { FieldContext } from './context.js';

function fieldCopy(value: ReactNode, seed: string) {
  return typeof value === 'string' ? <PencilText seed={seed}>{value}</PencilText> : value;
}

export interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id'> {
  id?: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  children: ReactNode;
}

export function Field({
  children,
  className,
  description,
  disabled = false,
  error,
  id,
  invalid = false,
  label,
  readOnly = false,
  required = false,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? `inkra-field-${generatedId}`;
  const hasDescription = description !== undefined && description !== null;
  const hasError = error !== undefined && error !== null;
  const resolvedInvalid = invalid || hasError;
  const descriptionId = hasDescription ? `${controlId}-description` : undefined;
  const errorId = hasError ? `${controlId}-error` : undefined;
  const classes = ['inkra-field', className].filter(Boolean).join(' ');

  return (
    <FieldContext.Provider value={{
      controlId,
      descriptionId,
      errorId,
      required,
      invalid: resolvedInvalid,
      disabled,
      readOnly,
    }}>
      <div
        {...props}
        className={classes}
        data-disabled={disabled || undefined}
        data-invalid={resolvedInvalid || undefined}
        data-readonly={readOnly || undefined}
        data-required={required || undefined}
      >
        <label className="inkra-field__label" htmlFor={controlId}>
          <span>{fieldCopy(label, `${controlId}-label`)}</span>
          {required ? <span aria-hidden="true" className="inkra-field__required">*</span> : null}
        </label>
        <div className="inkra-field__control">{children}</div>
        {hasDescription ? (
          <div className="inkra-field__description" id={descriptionId}>
            {fieldCopy(description, `${controlId}-description`)}
          </div>
        ) : null}
        {hasError ? (
          <div className="inkra-field__error" id={errorId}>
            {fieldCopy(error, `${controlId}-error`)}
          </div>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}
