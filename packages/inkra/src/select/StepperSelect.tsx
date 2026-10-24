import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import type { AriaAttributes, ButtonHTMLAttributes, KeyboardEvent } from 'react';

import { Button } from '../Button.js';
import { InputAction } from '../form/InputAction.js';
import { useResolvedControlProps } from '../form/controlProps.js';
import type { FieldControlSize } from '../form/types.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { findAdjacentStepperItem, findEdgeStepperItem, resolveStepperNativeValue } from './stepperModel.js';

export interface SelectStepperItem {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectStepperProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'defaultValue' | 'dir' | 'form' | 'name' | 'onChange' | 'readOnly' | 'required' | 'size' | 'value'
> {
  items: readonly SelectStepperItem[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  loop?: boolean;
  placeholder?: string;
  previousLabel?: string;
  nextLabel?: string;
  size?: FieldControlSize;
  fullWidth?: boolean;
  name?: string;
  form?: string;
  dir?: 'ltr' | 'rtl';
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
  'aria-errormessage'?: string;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
}

const previousPaths = [{ d: 'M15 18l-6-6 6-6' }];
const nextPaths = [{ d: 'M9 18l6-6-6-6' }];

export const SelectStepper = forwardRef<HTMLButtonElement, SelectStepperProps>(function SelectStepper(
  {
    'aria-describedby': ariaDescribedBy,
    'aria-errormessage': ariaErrorMessage,
    'aria-invalid': ariaInvalid,
    className,
    defaultValue = null,
    dir,
    disabled,
    form,
    fullWidth = true,
    id,
    invalid,
    items,
    loop = false,
    name,
    nextLabel = 'Select next option',
    onKeyDown,
    onValueChange,
    placeholder = 'Select an option',
    previousLabel = 'Select previous option',
    readOnly,
    required,
    size = 'md',
    value,
    ...props
  },
  forwardedRef,
) {
  const generatedId = useId();
  const controlRef = useRef<HTMLButtonElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const itemsRef = useRef(items);
  const defaultValueRef = useRef(defaultValue);
  const latestValueRef = useRef(value);
  const controlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState<string | null>(defaultValue);
  const currentValue = controlled ? value ?? null : uncontrolledValue;
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
  const controlId = state.id ?? generatedId;
  const currentItemIndex = items.findIndex(item => item.value === currentValue);
  const currentItem = currentItemIndex < 0 ? undefined : items[currentItemIndex];
  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 26 : 22;
  const buttonSize = size === 'sm' ? 'icon-sm' : size === 'lg' ? 'icon-lg' : 'icon';
  defaultValueRef.current = defaultValue;
  itemsRef.current = items;
  latestValueRef.current = value;

  useEffect(() => {
    const select = selectRef.current;
    const formElement = select?.form;
    if (!select || !formElement) return undefined;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    const reset = (event: Event) => {
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        if (event.defaultPrevented) return;
        if (controlled) {
          select.value = resolveStepperNativeValue(itemsRef.current, latestValueRef.current);
        } else {
          const restored = defaultValueRef.current;
          // Native reset may restore the first option before React can render. Write the
          // effective default even when setState bails out because state already matches.
          select.value = resolveStepperNativeValue(itemsRef.current, restored);
          setUncontrolledValue(restored);
        }
      }, 0);
    };
    formElement.addEventListener('reset', reset);
    return () => {
      clearTimeout(resetTimer);
      formElement.removeEventListener('reset', reset);
    };
  }, [controlled, form]);

  function adjacentItem(direction: -1 | 1) {
    return findAdjacentStepperItem(items, currentValue, direction, loop);
  }

  function change(next: SelectStepperItem | undefined) {
    if (!next || state.disabled || state.readOnly) return;
    if (!controlled) setUncontrolledValue(next.value);
    onValueChange?.(next.value);
    controlRef.current?.focus({ preventScroll: true });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || state.disabled || state.readOnly) return;
    const rtl = dir === 'rtl' || (dir == null && getComputedStyle(event.currentTarget).direction === 'rtl');
    let next: SelectStepperItem | undefined;
    if (event.key === 'ArrowUp') next = adjacentItem(-1);
    else if (event.key === 'ArrowDown') next = adjacentItem(1);
    else if (event.key === 'ArrowLeft') next = adjacentItem(rtl ? 1 : -1);
    else if (event.key === 'ArrowRight') next = adjacentItem(rtl ? -1 : 1);
    else if (event.key === 'Home') next = findEdgeStepperItem(items, 'first');
    else if (event.key === 'End') next = findEdgeStepperItem(items, 'last');
    else return;
    event.preventDefault();
    change(next);
  }

  const previous = adjacentItem(-1);
  const next = adjacentItem(1);
  const interactionDisabled = state.disabled || state.readOnly;
  const visibleLabel = currentItem?.label ?? placeholder;
  const nativeValue = resolveStepperNativeValue(items, currentValue);
  const seed = `inkra-select-stepper-${controlId}`;

  return (
    <span
      className={['inkra-field-control-hit', 'inkra-input-root', 'inkra-select-stepper', className].filter(Boolean).join(' ')}
      data-disabled={state.disabled || undefined}
      data-full-width={fullWidth}
      data-invalid={state.invalid || undefined}
      data-readonly={state.readOnly || undefined}
      data-size={size}
      dir={dir}
    >
      <PencilSurface<'div'>
        as="div"
        className="inkra-field-control inkra-field-control--input inkra-select-stepper__control"
        clipContent
        seed={seed}
        variant={state.invalid ? 'danger' : 'outline'}
      >
        <InputAction disabled={interactionDisabled || previous == null} position="start" seed={`${seed}-previous`}>
          <Button
            aria-label={previousLabel}
            className="inkra-select-stepper__button inkra-select-stepper__button--previous"
            disabled={interactionDisabled || previous == null}
            onClick={() => change(previous)}
            size={buttonSize}
            type="button"
            variant="ghost"
          >
            <PencilIcon paths={previousPaths} size={iconSize} sourceSize={24} />
          </Button>
        </InputAction>
        <button
          {...props}
          aria-describedby={state.describedBy}
          aria-errormessage={state.errorMessage}
          aria-invalid={state.ariaInvalid}
          aria-readonly={state.readOnly || undefined}
          aria-required={state.required || undefined}
          aria-valuemax={items.length ? items.length - 1 : undefined}
          aria-valuemin={items.length ? 0 : undefined}
          aria-valuenow={currentItemIndex < 0 ? undefined : currentItemIndex}
          aria-valuetext={visibleLabel}
          className="inkra-select-stepper__value"
          data-placeholder={currentItem == null || undefined}
          disabled={state.disabled}
          id={controlId}
          onKeyDown={handleKeyDown}
          ref={node => {
            controlRef.current = node;
            if (typeof forwardedRef === 'function') forwardedRef(node);
            else if (forwardedRef) forwardedRef.current = node;
          }}
          role="spinbutton"
          type="button"
        >
          <PencilText ellipsis seed={`${seed}-value`}>{visibleLabel}</PencilText>
        </button>
        <InputAction disabled={interactionDisabled || next == null} seed={`${seed}-next`}>
          <Button
            aria-label={nextLabel}
            className="inkra-select-stepper__button inkra-select-stepper__button--next"
            disabled={interactionDisabled || next == null}
            onClick={() => change(next)}
            size={buttonSize}
            type="button"
            variant="ghost"
          >
            <PencilIcon paths={nextPaths} size={iconSize} sourceSize={24} />
          </Button>
        </InputAction>
        <select
          aria-hidden="true"
          className="inkra-select-stepper__native"
          disabled={state.disabled}
          form={form}
          name={name}
          onChange={() => undefined}
          onInvalid={event => {
            event.preventDefault();
            controlRef.current?.focus({ preventScroll: true });
          }}
          ref={selectRef}
          required={state.required && !state.readOnly}
          tabIndex={-1}
          value={nativeValue}
        >
          <option value="" />
          {items.map(item => <option disabled={item.disabled} key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </PencilSurface>
    </span>
  );
});
