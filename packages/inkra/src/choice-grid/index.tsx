import { useInkraLocale } from '../i18n/index.js';
import {
  Children,
  createContext,
  forwardRef,
  memo,
  isValidElement,
  useContext,
  useCallback,
  useMemo,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  ChangeEvent,
  FieldsetHTMLAttributes,
  ForwardedRef,
  ImgHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  ReactElement,
} from 'react';
import { Button } from '../Button.js';

import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { Checkbox } from '../selection/Checkbox.js';
import { RadioGroup, RadioGroupItem } from '../selection/RadioGroup.js';

const classes = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ');
const noPagedOptions: ReactNode[] = [];

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
  /** Opt-in paging for controlled, direct non-required ChoiceGridOption children. */
  pageSize?: number;
  previousPageLabel?: string;
  nextPageLabel?: string;
  pageLabel?: (page: number, pages: number) => ReactNode;
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
  values?: ReadonlySet<string>;
  defaultValues?: ReadonlySet<string>;
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

export const ChoiceGrid = memo(forwardRef<HTMLFieldSetElement, ChoiceGridProps>(function ChoiceGrid(
  props,
  forwardedRef,
) {
  const { t } = useInkraLocale();
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
    pageSize,
    previousPageLabel = t('common.previousPage'),
    nextPageLabel = t('common.nextPage'),
    pageLabel = (page, pages) => `${page} / ${pages}`,
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
  const multipleValues = props.type === 'multiple' ? props.values : undefined;
  const multipleDefaults = props.type === 'multiple' ? props.defaultValues : undefined;
  const onValuesChange = props.type === 'multiple' ? props.onValuesChange : undefined;
  const values = useMemo(() => multipleValues === undefined ? undefined : new Set(multipleValues), [multipleValues]);
  const defaultValues = useMemo(() => multipleDefaults === undefined ? undefined : new Set(multipleDefaults), [multipleDefaults]);
  const [page, setPage] = useState(0);
  const directOptions = useMemo(() => pageSize === undefined ? noPagedOptions : Children.toArray(children), [children, pageSize]);
  const controlled = props.type === 'multiple' ? props.values !== undefined : props.value !== undefined;
  const paged = controlled && pageSize !== undefined && Number.isFinite(pageSize) && directOptions.length > 0
    && directOptions.every(child => isValidElement<ChoiceGridOptionProps>(child) && child.type === ChoiceGridOption && !child.props.required);
  const pageLength = paged ? Math.max(1, Math.floor(pageSize!)) : 1;
  const pageCount = paged ? Math.ceil(directOptions.length / pageLength) : 0;
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const pageChildren = paged ? directOptions.map((child, index) => {
    const option = child as ReactElement<ChoiceGridOptionProps>;
    if (index >= currentPage * pageLength && index < (currentPage + 1) * pageLength) return child;
    const selected = props.type === 'multiple' ? values?.has(option.props.value) : props.value === option.props.value;
    return selected ? <input key={option.key} type="hidden" name={name} value={option.props.value}
      disabled={disabled || option.props.disabled} form={option.props.form ?? form} /> : null;
  }) : children;
  const pageControls = paged ? <nav aria-label={typeof label === 'string' ? label : undefined}>
    <Button size="sm" variant="ghost" aria-label={previousPageLabel} disabled={disabled || currentPage === 0} onClick={() => setPage(currentPage - 1)}>{previousPageLabel}</Button>
    <span aria-live="polite">{pageLabel(currentPage + 1, pageCount)}</span>
    <Button size="sm" variant="ghost" aria-label={nextPageLabel} disabled={disabled || currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>{nextPageLabel}</Button>
  </nav> : null;
  const pagingValues = paged ? values : undefined;
  const onMultipleChange = useCallback((optionValue: string, checked: boolean) => {
    if (!onValuesChange) return;
    if (paged) {
      onValuesChange((directOptions as ReactElement<ChoiceGridOptionProps>[]).filter(option => option.props.value === optionValue ? checked : pagingValues?.has(option.props.value)).map(option => option.props.value));
      return;
    }
    const selected = Array.from(
      rootRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-choice-grid-value]') ?? [],
    ).filter(input => input.value === optionValue ? checked : input.checked)
      .map(input => input.value);
    onValuesChange(selected);
  }, [onValuesChange, paged, directOptions, pagingValues]);
  const context = useMemo<ChoiceGridContextValue>(() => ({
    defaultValues, disabled, form, mode: type, name, onMultipleChange, values,
  }), [defaultValues, disabled, form, type, name, onMultipleChange, values]);

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
        <ChoiceGridContext.Provider value={context}>
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
            {pageChildren}
          </RadioGroup>
          {pageControls}
        </ChoiceGridContext.Provider>
        <GroupMessages description={description} descriptionId={descriptionId} error={error} errorId={errorId} />
      </div>
    );
  }

  const {
    defaultValues: _defaultValues,
    onValuesChange: _onValuesChange,
    values: _values,
    ...multipleFieldsetProps
  } = rest as typeof rest & Pick<MultipleChoiceGridProps, 'defaultValues' | 'onValuesChange' | 'values'>;

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
        <div className="inkra-choice-grid__items">{pageChildren}</div>
        {pageControls}
      </ChoiceGridContext.Provider>
      <GroupMessages description={description} descriptionId={descriptionId} error={error} errorId={errorId} />
    </fieldset>
  );
}));

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

interface ChoiceGridOptionViewProps extends ChoiceGridOptionProps {
  mode: 'single' | 'multiple';
  inputRef: ForwardedRef<HTMLInputElement>;
  groupName: string;
  multipleChecked?: boolean;
  multipleDefaultChecked?: boolean;
  onMultipleChange?: ChoiceGridContextValue['onMultipleChange'];
}

// Resolve context in a small adapter. A membership change must not rebuild the
// paper, text and controls of every option whose own checked state is unchanged.
const ChoiceGridOptionView = memo(function ChoiceGridOptionView({
  className,
  description,
  disabled = false,
  form,
  icon,
  id,
  image,
  label,
  mode,
  inputRef,
  groupName,
  multipleChecked,
  multipleDefaultChecked,
  onMultipleChange,
  onChange,
  required = false,
  seed,
  value,
  ...props
}: ChoiceGridOptionViewProps) {
  const generatedId = useId();
  const inputId = id ?? `inkra-choice-grid-option-${generatedId}`;
  const resolvedSeed = seed ?? inputId;
  const itemDisabled = disabled;
  const content = (
    <>
      <OptionMedia icon={icon} image={image} />
      <span className="inkra-choice-grid__option-label">
        {typeof label === 'string'
          ? <PencilText seed={`${resolvedSeed}-label`}>{label}</PencilText>
          : label}
      </span>
    </>
  );
  const control = mode === 'single' ? (
    <RadioGroupItem
      {...props}
      className="inkra-choice-grid__control"
      description={description}
      disabled={itemDisabled}
      form={form}
      id={inputId}
      label={content}
      onChange={onChange}
      ref={inputRef}
      required={required}
      seed={resolvedSeed}
      value={value}
    />
  ) : (
    <Checkbox
      {...props}
      checked={multipleChecked}
      className="inkra-choice-grid__control"
      data-choice-grid-value=""
      defaultChecked={multipleDefaultChecked}
      description={description}
      disabled={itemDisabled}
      form={form}
      id={inputId}
      label={content}
      name={groupName}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        onChange?.(event);
        onMultipleChange?.(value, event.currentTarget.checked);
      }}
      ref={inputRef}
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
      <PencilSurface
        aria-hidden="true"
        as="span"
        className="inkra-choice-grid__focus"
        radius={8}
        seed={`${resolvedSeed}-focus`}
        variant="outline"
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

export const ChoiceGridOption = forwardRef<HTMLInputElement, ChoiceGridOptionProps>(function ChoiceGridOption(props, ref) {
  const context = useContext(ChoiceGridContext);
  if (!context) throw new Error('ChoiceGridOption must be rendered inside ChoiceGrid');
  return <ChoiceGridOptionView
    {...props}
    disabled={context.disabled || props.disabled}
    form={props.form ?? context.form}
    groupName={context.name}
    mode={context.mode}
    multipleChecked={context.values === undefined ? undefined : context.values.has(props.value)}
    multipleDefaultChecked={context.values === undefined ? context.defaultValues?.has(props.value) : undefined}
    onMultipleChange={context.onMultipleChange}
    inputRef={ref}
  />;
});
