import { forwardRef, useId, useImperativeHandle, useRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { useNativeChecked } from './useNativeChecked.js';

const thumbPaths = [
  { d: 'M 20 3 C 30 3 37 10 37 20 C 37 30 30 37 20 37 C 10 37 3 30 3 20 C 3 10 10 3 20 3 Z', mode: 'wash' as const },
  { d: 'M 20 3 C 30 3 37 10 37 20 C 37 30 30 37 20 37 C 10 37 3 30 3 20 C 3 10 10 3 20 3 Z' },
] as const;

export interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children' | 'role' | 'type'> {
  label: ReactNode;
  description?: ReactNode;
  onCheckedChange?: (checked: boolean) => void;
  seed?: string | number;
}

function ids(...values: Array<string | undefined>): string | undefined {
  const value = values.filter(Boolean).join(' ');
  return value || undefined;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  {
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    checked,
    className,
    defaultChecked,
    description,
    disabled = false,
    form,
    id,
    label,
    onChange,
    onCheckedChange,
    seed,
    ...props
  },
  forwardedRef,
) {
  const generatedId = useId();
  const inputId = id ?? `inkra-switch-${generatedId}`;
  const labelId = `${inputId}-label`;
  const descriptionId = description == null ? undefined : `${inputId}-description`;
  const resolvedLabelledBy = ariaLabel == null && ariaLabelledBy == null ? labelId : ariaLabelledBy;
  const resolvedSeed = seed ?? inputId;
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);
  const { controlled, syncUncontrolled, visualChecked } = useNativeChecked({
    checked,
    defaultChecked,
    form,
    inputRef,
  });

  return (
    <label
      className={['inkra-selection-control', 'inkra-switch', className].filter(Boolean).join(' ')}
      data-checked={visualChecked || undefined}
      data-disabled={disabled || undefined}
      htmlFor={inputId}
    >
      <input
        {...props}
        aria-describedby={ids(ariaDescribedBy, descriptionId)}
        aria-label={ariaLabel}
        aria-labelledby={resolvedLabelledBy}
        checked={controlled ? checked : undefined}
        className="inkra-selection-control__input"
        defaultChecked={controlled ? undefined : defaultChecked}
        disabled={disabled}
        form={form}
        id={inputId}
        onChange={(event) => {
          const nextChecked = event.currentTarget.checked;
          if (!controlled) syncUncontrolled(nextChecked);
          onChange?.(event);
          onCheckedChange?.(nextChecked);
        }}
        ref={inputRef}
        role="switch"
        type="checkbox"
      />
      <PencilSurface
        aria-hidden="true"
        as="span"
        className="inkra-switch__track"
        radius={8}
        seed={`${resolvedSeed}-track`}
        variant={visualChecked ? 'quiet' : 'outline'}
      >
        <PencilSurface as="span" aria-hidden="true" className="inkra-selection-control__focus-ring"
          seed={`${resolvedSeed}-focus`} variant="outline" />
        <PencilIcon
          className="inkra-switch__thumb"
          paths={thumbPaths}
          seed={`${resolvedSeed}-thumb`}
          size={24}
          sourceSize={40}
        />
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
