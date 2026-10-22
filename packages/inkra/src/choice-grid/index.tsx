import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useImperativeHandle,
  useRef,
} from 'react';
import type {
  CSSProperties,
  ChangeEvent,
  FieldsetHTMLAttributes,
  ImgHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';

import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { Checkbox } from '../selection/Checkbox.js';
import { RadioGroup, RadioGroupItem } from '../selection/RadioGroup.js';

const classes = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ');

function mergeIds(...values: Array<string | undefined>): string | undefined {
  const merged = Array.from(new Set(values.flatMap(value => value?.split(/\s+/).filter(Boolean) ?? [])));
  return merged.length ? merged.join(' ') : undefined;
}

export interface ChoiceGridImage extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'children'> {
  /** Choice images are decorative; the option label supplies the accessible name. */
  alt?: '';
}

export type ChoiceGridColumns = 1 | 2 | 3 | 4;

interface ChoiceGridCommonProps
  extends Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, 'defaultValue' | 'onChange'> {
  name: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  columns?: ChoiceGridColumns;
  minItemWidth?: string;
}

export interface SingleChoiceGridProps extends ChoiceGridCommonProps {
  type?: 'single';
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export interface MultipleChoiceGridProps extends ChoiceGridCommonProps {
  type: 'multiple';
  values?: readonly string[];
  defaultValues?: readonly string[];
  onValuesChange?: (values: string[]) => void;
}

export type ChoiceGridProps = SingleChoiceGridProps | MultipleChoiceGridProps;

export interface ChoiceGridOptionProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'checked' | 'children' | 'defaultChecked' | 'name' | 'type'> {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  image?: ChoiceGridImage;
  seed?: string | number;
}

interface ChoiceGridContextValue {
  disabled: boolean;
  form?: string;
  mode: 'single' | 'multiple';
  name: string;
  values?: readonly string[];
  defaultValues?: readonly string[];
  onMultipleChange?: (value: string, checked: boolean) => void;
}

const ChoiceGridContext = createContext<ChoiceGridContextValue | null>(null);

function GroupMessages({ description, descriptionId, error, errorId }: {
  description?: ReactNode;
  descriptionId?: string;
  error?: ReactNode;
  errorId?: string;
}) {
  return description == null && error == null ? null : (
    <div className="inkra-choice-grid__messages">
      {description == null ? null : (
        <div className="inkra-choice-grid__description" id={descriptionId}>
          {typeof description === 'string'
            ? <PencilText seed={`${descriptionId}-text`}>{description}</PencilText>
            : description}
        </div>
      )}
      {error == null ? null : (
        <div className="inkra-choice-grid__error" id={errorId}>
          {typeof error === 'string'
            ? <PencilText seed={`${errorId}-text`}>{error}</PencilText>
            : error}
        </div>
      )}
    </div>
  );
}

function gridStyle(style: CSSProperties | undefined, columns: ChoiceGridColumns | undefined, minItemWidth: string) {
  return {
    ...style,
    '--inkra-choice-grid-columns': columns,
    '--inkra-choice-grid-min-item': minItemWidth,
  } as CSSProperties;
}

export const ChoiceGrid = forwardRef<HTMLFieldSetElement, ChoiceGridProps>(function ChoiceGrid(
  props,
  forwardedRef,
) {
  const {
    'aria-describedby': ariaDescribedBy,
    'aria-errormessage': ariaErrorMessage,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    children,
    className,
    columns,
    description,
    disabled = false,
    error,
    form,
    label,
    minItemWidth = '13rem',
    name,
    style,
    type = 'single',
    ...rest
  } = props;
  const generatedId = useId();
  const descriptionId = description == null ? undefined : `inkra-choice-grid-${generatedId}-description`;
  const errorId = error == null ? undefined : `inkra-choice-grid-${generatedId}-error`;
  const describedBy = mergeIds(ariaDescribedBy, descriptionId, errorId);
  const errorMessage = mergeIds(ariaErrorMessage, errorId);
  const invalid = Boolean(error) || rest['aria-invalid'] === true || rest['aria-invalid'] === 'true';
  const rootRef = useRef<HTMLFieldSetElement>(null);
  useImperativeHandle(forwardedRef, () => rootRef.current as HTMLFieldSetElement);

  if (type === 'single') {
    const single = props as SingleChoiceGridProps;
    const {
      defaultValue: _defaultValue,
      onValueChange: _onValueChange,
      value: _value,
      ...singleFieldsetProps
    } = rest as typeof rest & Pick<SingleChoiceGridProps, 'defaultValue' | 'onValueChange' | 'value'>;
    return (
      <div
        className={classes('inkra-choice-grid', className)}
        data-columns={columns}
        data-disabled={disabled || undefined}
        data-invalid={invalid || undefined}
        data-type="single"
        style={gridStyle(style, columns, minItemWidth)}
      >
        <ChoiceGridContext.Provider value={{ disabled, form, mode: 'single', name }}>
          <RadioGroup
            {...singleFieldsetProps}
            aria-describedby={describedBy}
            aria-errormessage={errorMessage}
            aria-invalid={invalid || undefined}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            defaultValue={single.defaultValue}
            disabled={disabled}
            form={form}
            label={label}
            name={name}
            onValueChange={single.onValueChange}
            ref={rootRef}
            value={single.value}
          >
            {children}
          </RadioGroup>
        </ChoiceGridContext.Provider>
        <GroupMessages description={description} descriptionId={descriptionId} error={error} errorId={errorId} />
      </div>
    );
  }

  const multiple = props as MultipleChoiceGridProps;
  const {
    defaultValues: _defaultValues,
    onValuesChange: _onValuesChange,
    values: _values,
    ...multipleFieldsetProps
  } = rest as typeof rest & Pick<MultipleChoiceGridProps, 'defaultValues' | 'onValuesChange' | 'values'>;
  const onMultipleChange = (optionValue: string, checked: boolean) => {
    if (!multiple.onValuesChange) return;
    const selected = Array.from(
      rootRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-choice-grid-value]') ?? [],
    ).filter(input => input.value === optionValue ? checked : input.checked)
      .map(input => input.value);
    multiple.onValuesChange(selected);
  };
  const context: ChoiceGridContextValue = {
    defaultValues: multiple.defaultValues,
    disabled,
    form,
    mode: 'multiple',
    name,
    onMultipleChange,
    values: multiple.values,
  };

  return (
    <fieldset
      {...multipleFieldsetProps}
      aria-describedby={describedBy}
      aria-errormessage={errorMessage}
      aria-invalid={invalid || undefined}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={classes('inkra-choice-grid', className)}
      data-columns={columns}
      data-disabled={disabled || undefined}
      data-invalid={invalid || undefined}
      data-type="multiple"
      disabled={disabled}
      form={form}
      ref={rootRef}
      style={gridStyle(style, columns, minItemWidth)}
    >
      {label == null ? null : typeof label === 'string' ? (
        <PencilText as="legend" className="inkra-choice-grid__legend" seed={`inkra-choice-grid-${generatedId}-label`}>
          {label}
        </PencilText>
      ) : <legend className="inkra-choice-grid__legend">{label}</legend>}
      <ChoiceGridContext.Provider value={context}>
        <div className="inkra-choice-grid__items">{children}</div>
      </ChoiceGridContext.Provider>
      <GroupMessages description={description} descriptionId={descriptionId} error={error} errorId={errorId} />
    </fieldset>
  );
});

function OptionMedia({ icon, image }: Pick<ChoiceGridOptionProps, 'icon' | 'image'>) {
  if (image) {
    return (
      <span aria-hidden="true" className="inkra-choice-grid__media" data-kind="image">
        <img {...image} alt="" />
      </span>
    );
  }
  if (icon != null) {
    return <span aria-hidden="true" className="inkra-choice-grid__media" data-kind="icon">{icon}</span>;
  }
  return null;
}

export const ChoiceGridOption = forwardRef<HTMLInputElement, ChoiceGridOptionProps>(function ChoiceGridOption(
  {
    className,
    description,
    disabled = false,
    form,
    icon,
    id,
    image,
    label,
    onChange,
    required = false,
    seed,
    value,
    ...props
  },
  ref,
) {
  const context = useContext(ChoiceGridContext);
  if (!context) throw new Error('ChoiceGridOption must be rendered inside ChoiceGrid');
  const generatedId = useId();
  const inputId = id ?? `inkra-choice-grid-option-${generatedId}`;
  const resolvedSeed = seed ?? inputId;
  const itemDisabled = context.disabled || disabled;
  const content = (
    <>
      <OptionMedia icon={icon} image={image} />
      <span className="inkra-choice-grid__option-label">{label}</span>
    </>
  );
  const control = context.mode === 'single' ? (
    <RadioGroupItem
      {...props}
      className="inkra-choice-grid__control"
      description={description}
      disabled={itemDisabled}
      form={form ?? context.form}
      id={inputId}
      label={content}
      onChange={onChange}
      ref={ref}
      required={required}
      seed={resolvedSeed}
      value={value}
    />
  ) : (
    <Checkbox
      {...props}
      checked={context.values === undefined ? undefined : context.values.includes(value)}
      className="inkra-choice-grid__control"
      data-choice-grid-value=""
      defaultChecked={context.values === undefined ? context.defaultValues?.includes(value) : undefined}
      description={description}
      disabled={itemDisabled}
      form={form ?? context.form}
      id={inputId}
      label={content}
      name={context.name}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        onChange?.(event);
        context.onMultipleChange?.(value, event.currentTarget.checked);
      }}
      ref={ref}
      required={required}
      seed={resolvedSeed}
      value={value}
    />
  );

  return (
    <PencilSurface
      as="div"
      className={classes('inkra-choice-grid__option', className)}
      data-disabled={itemDisabled || undefined}
      radius={8}
      seed={`${resolvedSeed}-paper`}
      variant="paper"
    >
      <PencilSurface
        aria-hidden="true"
        as="span"
        className="inkra-choice-grid__selection"
        radius={8}
        seed={`${resolvedSeed}-selection`}
        variant="selection"
      />
      {control}
      <PencilSurface
        aria-hidden="true"
        as="span"
        className="inkra-choice-grid__outline"
        radius={8}
        seed={`${resolvedSeed}-outline`}
        variant="outline"
      />
    </PencilSurface>
  );
});

