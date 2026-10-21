import { forwardRef, useId, useImperativeHandle, useRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { useNativeChecked } from './useNativeChecked.js';

const checkPaths = [{ d: 'M 5 12 L 10 17 L 19 7' }] as const;
const mixedPaths = [{ d: 'M 5 12 L 19 12' }] as const;

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children' | 'type'> {
  label: ReactNode;
  description?: ReactNode;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  seed?: string | number;
}

function ids(...values: Array<string | undefined>): string | undefined {
  const value = values.filter(Boolean).join(' ');
  return value || undefined;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    checked,
    className,
    defaultChecked,
    description,
    disabled = false,
    id,
    indeterminate = false,
    label,
    onChange,
    onCheckedChange,
    seed,
    ...props
  },
  forwardedRef,
) {
  const generatedId = useId();
  const inputId = id ?? `inkra-checkbox-${generatedId}`;
  const labelId = `${inputId}-label`;
  const descriptionId = description == null ? undefined : `${inputId}-description`;
  const resolvedLabelledBy = ariaLabel == null && ariaLabelledBy == null ? labelId : ariaLabelledBy;
  const resolvedSeed = seed ?? inputId;
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);
  const { controlled, syncUncontrolled, visualChecked } = useNativeChecked({
    checked,
    defaultChecked,
    indeterminate,
    inputRef,
  });
  const selected = visualChecked || indeterminate;

  return (
    <label
      className={['inkra-selection-control', 'inkra-checkbox', className].filter(Boolean).join(' ')}
      data-checked={visualChecked || undefined}
      data-disabled={disabled || undefined}
      data-indeterminate={indeterminate || undefined}
      htmlFor={inputId}
    >
      <input
        {...props}
        aria-checked={indeterminate ? 'mixed' : undefined}
        aria-describedby={ids(ariaDescribedBy, descriptionId)}
        aria-label={ariaLabel}
        aria-labelledby={resolvedLabelledBy}
        checked={controlled ? checked : undefined}
        className="inkra-selection-control__input"
        defaultChecked={controlled ? undefined : defaultChecked}
        disabled={disabled}
        id={inputId}
        onChange={(event) => {
          const nextChecked = event.currentTarget.checked;
          event.currentTarget.indeterminate = indeterminate;
          if (!controlled) syncUncontrolled(nextChecked);
          onChange?.(event);
          onCheckedChange?.(nextChecked);
        }}
        ref={inputRef}
        type="checkbox"
      />
      <PencilSurface
        aria-hidden="true"
        as="span"
        className="inkra-selection-control__mark inkra-checkbox__mark"
        radius={3}
        seed={`${resolvedSeed}-mark`}
        variant={selected ? 'quiet' : 'outline'}
      >
        {selected ? (
          <PencilIcon
            className="inkra-selection-control__glyph"
            paths={indeterminate ? mixedPaths : checkPaths}
            seed={`${resolvedSeed}-${indeterminate ? 'mixed' : 'check'}`}
            size={18}
            sourceSize={24}
          />
        ) : null}
      </PencilSurface>
      <span className="inkra-selection-control__copy">
        {typeof label === 'string' ? (
          <PencilText as="span" className="inkra-selection-control__label" id={labelId} seed={`${resolvedSeed}-label`}>
            {label}
          </PencilText>
        ) : <span className="inkra-selection-control__label" id={labelId}>{label}</span>}
        {description == null ? null : (
          <span className="inkra-selection-control__description" id={descriptionId}>{description}</span>
        )}
      </span>
    </label>
  );
});
