import { useInkraLocale } from '../i18n/index.js';
import { forwardRef, useId, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { applyKeypadKey, getKeypadAction, getKeypadColumnCount } from './model.js';
import type { KeypadAction, KeypadKey, KeypadKeyVariant } from './model.js';

export interface KeypadPressDetails {
  action: KeypadAction;
  key: KeypadKey;
  previousValue: string;
  nextValue: string;
}

export interface KeypadProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'onKeyPress'> {
  layout: readonly (readonly KeypadKey[])[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string, details: KeypadPressDetails) => void;
  onKeyPress?: (details: KeypadPressDetails) => void;
  onConfirm?: (value: string, details: KeypadPressDetails) => void;
  disabled?: boolean;
  maxLength?: number;
  label?: string;
  emptyContent?: ReactNode;
}

function keyLabel(key: KeypadKey): string | undefined {
  if (key.ariaLabel) return key.ariaLabel;
  if (typeof key.label === 'string' || typeof key.label === 'number') return String(key.label);
  return undefined;
}

function keyVariant(key: KeypadKey): KeypadKeyVariant {
  if (key.variant) return key.variant;
  const action = getKeypadAction(key);
  if (action === 'confirm') return 'confirm';
  if (action === 'delete') return 'secondary';
  return 'default';
}

export const Keypad = forwardRef<HTMLDivElement, KeypadProps>(function Keypad(
  inkraProps,
  ref,
) {
  const { t } = useInkraLocale();
  const {
    'aria-label': ariaLabel,
    className,
    defaultValue = '',
    disabled = false,
    emptyContent = null,
    label = t('keypad.label'),
    layout,
    maxLength,
    onConfirm,
    onKeyPress,
    onValueChange,
    value,
    ...props
  } = inkraProps;
  const id = useId();
  const controlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const currentValue = controlled ? value : uncontrolledValue;
  const valueRef = useRef(currentValue);
  valueRef.current = currentValue;

  const columns = getKeypadColumnCount(layout);
  const classes = ['inkra-keypad', className].filter(Boolean).join(' ');
  const style = { '--inkra-keypad-columns': columns, ...props.style } as CSSProperties;

  const press = (key: KeypadKey) => {
    const previousValue = valueRef.current;
    const result = applyKeypadKey(previousValue, key, maxLength);
    const details: KeypadPressDetails = {
      action: getKeypadAction(key),
      key,
      previousValue,
      nextValue: result.nextValue,
    };
    if (result.changed) {
      if (!controlled) {
        valueRef.current = result.nextValue;
        setUncontrolledValue(result.nextValue);
      }
      onValueChange?.(result.nextValue, details);
    }
    onKeyPress?.(details);
    if (details.action === 'confirm') onConfirm?.(previousValue, details);
  };

  return (
    <div
      {...props}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel ?? label}
      className={classes}
      data-disabled={disabled || undefined}
      ref={ref}
      role="group"
      style={style}
    >
      {layout.length === 0 ? emptyContent : layout.map((row, rowIndex) => (
        <div className="inkra-keypad__row" key={`row-${rowIndex}`}>
          {row.map(key => {
            const action = getKeypadAction(key);
            const atLimit = action === 'input' && maxLength !== undefined && !applyKeypadKey(currentValue, key, maxLength).changed;
            const keyDisabled = disabled || key.disabled === true || atLimit;
            const accessibleName = keyLabel(key);
            return (
              <button
                aria-label={accessibleName}
                className="inkra-keypad__key"
                data-action={action}
                data-key-id={key.id}
                data-variant={keyVariant(key)}
                disabled={keyDisabled}
                key={key.id}
                onClick={() => press(key)}
                style={{ '--inkra-keypad-span': Math.max(1, Math.floor(key.span ?? 1)) } as CSSProperties}
                type="button"
              >
                <PencilSurface
                  as="span"
                  className="inkra-keypad__key-surface"
                  radius={6}
                  seed={`inkra-keypad-${id}-${key.id}`}
                  variant={keyVariant(key) === 'confirm' ? 'action' : keyVariant(key) === 'danger' ? 'danger' : keyVariant(key) === 'secondary' ? 'quiet' : 'outline'}
                >
                  <span className="inkra-keypad__key-label">
                    {typeof key.label === 'string' || typeof key.label === 'number'
                      ? <PencilText seed={`inkra-keypad-${id}-${key.id}-label`}>{String(key.label)}</PencilText>
                      : key.label}
                  </span>
                </PencilSurface>
                <PencilSurface aria-hidden="true" as="span" className="inkra-keypad__focus" seed={`inkra-keypad-${id}-${key.id}-focus`} variant="outline" />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});

export { applyKeypadKey, getKeypadAction, getKeypadColumnCount } from './model.js';
export type { KeypadAction, KeypadKey, KeypadKeyVariant, KeypadValueResult } from './model.js';

