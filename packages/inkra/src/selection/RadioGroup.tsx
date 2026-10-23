import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ChangeEvent,
  FieldsetHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';

import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { useSelectionDrawing } from '../internal/useSelectionDrawing.js';

const ringPaths = [
  { d: 'M 12 2 C 18 2 22 6 22 12 C 22 18 18 22 12 22 C 6 22 2 18 2 12 C 2 6 6 2 12 2 Z' },
] as const;

const selectedPaths = [
  ...ringPaths,
  { d: 'M 12 7 C 15 7 17 9 17 12 C 17 15 15 17 12 17 C 9 17 7 15 7 12 C 7 9 9 7 12 7 Z', mode: 'wash' as const },
  { d: 'M 12 7 C 15 7 17 9 17 12 C 17 15 15 17 12 17 C 9 17 7 15 7 12 C 7 9 9 7 12 7 Z' },
] as const;

interface RadioGroupContextValue {
  controlled: boolean;
  defaultValue?: string;
  disabled: boolean;
  form?: string;
  name: string;
  onItemChange: (event: ChangeEvent<HTMLInputElement>) => void;
  required: boolean;
  variant: RadioGroupVariant;
  value?: string;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export type RadioGroupVariant = 'radio' | 'segmented';
export type RadioGroupOrientation = 'horizontal' | 'vertical';

export interface RadioGroupProps
  extends Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, 'defaultValue' | 'onChange'> {
  name: string;
  value?: string;
  defaultValue?: string;
  label?: ReactNode;
  description?: ReactNode;
  onValueChange?: (value: string) => void;
  orientation?: RadioGroupOrientation;
  required?: boolean;
  variant?: RadioGroupVariant;
}

export interface RadioGroupItemProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'checked' | 'children' | 'defaultChecked' | 'name' | 'type'> {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  seed?: string | number;
}

function ids(...values: Array<string | undefined>): string | undefined {
  const value = values.filter(Boolean).join(' ');
  return value || undefined;
}

export const RadioGroup = forwardRef<HTMLFieldSetElement, RadioGroupProps>(function RadioGroup(
  {
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    children,
    className,
    defaultValue,
    description,
    disabled = false,
    form,
    label,
    name,
    onValueChange,
    orientation = 'vertical',
    required = false,
    value,
    variant = 'radio',
    ...props
  },
  forwardedRef,
) {
  const generatedId = useId();
  const descriptionId = description == null ? undefined : `inkra-radio-group-${generatedId}-description`;
  const rootRef = useRef<HTMLFieldSetElement>(null);
  const initialDefaultValueRef = useRef(defaultValue);
  useImperativeHandle(forwardedRef, () => rootRef.current as HTMLFieldSetElement);
  const controlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(initialDefaultValueRef.current);
  const currentValue = controlled ? value : uncontrolledValue;

  useEffect(() => {
    const root = rootRef.current;
    const ownerForm = root?.form;
    if (!root || !ownerForm || controlled) return undefined;
    const handleReset = () => {
      queueMicrotask(() => {
        const checkedInput = root.querySelector<HTMLInputElement>('input[type="radio"]:checked');
        setUncontrolledValue(checkedInput?.value);
      });
    };
    ownerForm.addEventListener('reset', handleReset);
    return () => ownerForm.removeEventListener('reset', handleReset);
  }, [controlled]);

  const context = useMemo<RadioGroupContextValue>(() => ({
    controlled,
    defaultValue: initialDefaultValueRef.current,
    disabled,
    form,
    name,
    onItemChange(event) {
      if (!event.currentTarget.checked) return;
      if (!controlled) setUncontrolledValue(event.currentTarget.value);
      onValueChange?.(event.currentTarget.value);
    },
    required,
    variant,
    value: currentValue,
  }), [controlled, disabled, form, name, onValueChange, required, variant, currentValue]);

  return (
    <RadioGroupContext.Provider value={context}>
      <fieldset
        {...props}
        aria-describedby={ids(ariaDescribedBy, descriptionId)}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={['inkra-radio-group', className].filter(Boolean).join(' ')}
        data-orientation={orientation}
        data-variant={variant}
        disabled={disabled}
        form={form}
        ref={rootRef}
      >
        {label == null ? null : typeof label === 'string' ? (
          <PencilText as="legend" className="inkra-radio-group__label" seed={`inkra-radio-group-${generatedId}-label`}>
            {label}
          </PencilText>
        ) : <legend className="inkra-radio-group__label">{label}</legend>}
        {description == null ? null : (
          <span className="inkra-radio-group__description" id={descriptionId}>{description}</span>
        )}
        {variant === 'segmented' ? (
          <PencilSurface
            className="inkra-radio-group__frame"
            radius={8}
            seed={`inkra-radio-group-${generatedId}-frame`}
            variant="outline"
          >
            <div className="inkra-radio-group__items" data-orientation={orientation}>{children}</div>
          </PencilSurface>
        ) : <div className="inkra-radio-group__items" data-orientation={orientation}>{children}</div>}
      </fieldset>
    </RadioGroupContext.Provider>
  );
});

export const RadioGroupItem = forwardRef<HTMLInputElement, RadioGroupItemProps>(function RadioGroupItem(
  {
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    className,
    description,
    disabled = false,
    form,
    icon,
    id,
    label,
    onChange,
    required = false,
    seed,
    value,
    ...props
  },
  ref,
) {
  const context = useContext(RadioGroupContext);
  if (!context) throw new Error('RadioGroupItem must be rendered inside RadioGroup');
  const generatedId = useId();
  const inputId = id ?? `inkra-radio-${generatedId}`;
  const labelId = `${inputId}-label`;
  const descriptionId = description == null ? undefined : `${inputId}-description`;
  const resolvedLabelledBy = ariaLabel == null && ariaLabelledBy == null ? labelId : ariaLabelledBy;
  const selected = context.value === value;
  const selectionRef = useRef<HTMLSpanElement>(null);
  useSelectionDrawing(selectionRef, selected);
  const itemDisabled = context.disabled || disabled;
  const resolvedSeed = seed ?? inputId;
  const visibleLabel = typeof label === 'string' ? (
    <PencilText as="span" className="inkra-selection-control__label" id={labelId} seed={`${resolvedSeed}-label`}>
      {label}
    </PencilText>
  ) : <span className="inkra-selection-control__label" id={labelId}>{label}</span>;
  const visibleDescription = description == null ? null : (
    <span className="inkra-selection-control__description" id={descriptionId}>{description}</span>
  );

  return (
    <label
      className={['inkra-selection-control', 'inkra-radio-group__item', className].filter(Boolean).join(' ')}
      data-checked={selected || undefined}
      data-disabled={itemDisabled || undefined}
      htmlFor={inputId}
    >
      <input
        {...props}
        aria-describedby={ids(ariaDescribedBy, descriptionId)}
        aria-label={ariaLabel}
        aria-labelledby={resolvedLabelledBy}
        checked={context.controlled ? selected : undefined}
        className="inkra-selection-control__input"
        defaultChecked={context.controlled ? undefined : context.defaultValue === value}
        disabled={itemDisabled}
        form={form ?? context.form}
        id={inputId}
        name={context.name}
        onChange={(event) => {
          onChange?.(event);
          context.onItemChange(event);
        }}
        ref={ref}
        required={required || context.required}
        type="radio"
        value={value}
      />
      {context.variant === 'segmented' ? (
        <span className="inkra-radio-group__segment">
          <PencilSurface
            aria-hidden="true"
            as="span"
            className="inkra-radio-segment__surface inkra-radio-segment__surface--selection"
            ref={selectionRef}
            seed={`${resolvedSeed}-segment-selection`}
            variant="selection"
          />
          <span className="inkra-radio-segment__content">
            {icon == null ? null : <span aria-hidden="true" className="inkra-radio-group__icon">{icon}</span>}
            <span className="inkra-selection-control__copy">
              {visibleLabel}
              {visibleDescription}
            </span>
          </span>
        </span>
      ) : (
        <>
          <span
            aria-hidden="true"
            className="inkra-selection-control__mark inkra-radio-group__mark"
          >
            <PencilIcon
              className="inkra-selection-control__glyph"
              paths={selected ? selectedPaths : ringPaths}
              seed={`${resolvedSeed}-${selected ? 'selected' : 'ring'}`}
              size={24}
              sourceSize={24}
            />
          </span>
          {icon == null ? null : <span aria-hidden="true" className="inkra-radio-group__icon">{icon}</span>}
          <span className="inkra-selection-control__copy">
            {visibleLabel}
            {visibleDescription}
          </span>
        </>
      )}
    </label>
  );
});
