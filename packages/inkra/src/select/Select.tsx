import * as SelectPrimitive from '@radix-ui/react-select';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AriaAttributes,
  ButtonHTMLAttributes,
  ComponentRef,
  ReactNode,
} from 'react';

import { Button } from '../Button.js';
import { SearchableSelect } from './SearchableSelect.js';
import { SelectStepper } from './StepperSelect.js';
import { MultipleSelect, MultipleSelectContext, MultipleSelectRoot } from './MultipleSelect.js';
import type { SelectMultipleRootProps } from './MultipleSelect.js';
import { mergeAriaIds, useFieldContext } from '../form/context.js';
import { PencilIcon } from '../PencilIcon.js';
import type { PencilIconPath } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import type { PencilSurfaceVariant } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import {
  PortalThemeBridge,
  PortalThemeProvider,
  usePortalTriggerRef,
} from '../overlay/themeBridge.js';

const chevronDownPaths: readonly PencilIconPath[] = [
  { d: 'M6 9L12 15L18 9' },
];

const chevronUpPaths: readonly PencilIconPath[] = [
  { d: 'M6 15L12 9L18 15' },
];

const checkPaths: readonly PencilIconPath[] = [
  { d: 'M5 12.5L10 17L19 7' },
];

function classes(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function isAriaInvalid(value: AriaAttributes['aria-invalid']): boolean {
  return value === true || value === 'true' || value === 'grammar' || value === 'spelling';
}

function useItemAppearanceVersion() {
  const copyRef = useRef<HTMLElement>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const item = copyRef.current?.closest<HTMLElement>('[role="option"]');
    if (!item || typeof MutationObserver === 'undefined') return undefined;
    const observer = new MutationObserver(() => setVersion(current => current + 1));
    observer.observe(item, {
      attributes: true,
      attributeFilter: ['data-highlighted', 'data-state', 'data-selected'],
    });
    return () => observer.disconnect();
  }, []);

  return { copyRef, version };
}

interface SelectFieldState {
  captureDirectionNode: (node: HTMLElement | null) => void;
  controlId?: string;
  descriptionId?: string;
  errorId?: string;
  disabled: boolean;
  readOnly: boolean;
  invalid: boolean;
  required: boolean;
}

const SelectFieldContext = createContext<SelectFieldState | null>(null);

export type SelectSingleRootProps = SelectPrimitive.SelectProps & {
  multiple?: false;
  readOnly?: boolean;
  invalid?: boolean;
};

export type SelectRootProps = SelectSingleRootProps | SelectMultipleRootProps;
export type { SelectMultipleRootProps, SelectOption } from './MultipleSelect.js';

export function SelectRoot({ dir, disabled, invalid = false, readOnly, required, ...props }: SelectRootProps) {
  const field = useFieldContext();
  const [directionNode, setDirectionNode] = useState<HTMLElement | null>(null);
  const [inferredDirection, setInferredDirection] = useState<'ltr' | 'rtl'>();
  const captureDirectionNode = useCallback((node: HTMLElement | null) => {
    setDirectionNode(node);
  }, []);

  useEffect(() => {
    if (dir || !directionNode || typeof window === 'undefined') return undefined;
    const refresh = () => {
      const directionSource = directionNode.parentElement ?? directionNode;
      const direction = getComputedStyle(directionSource).direction === 'rtl' ? 'rtl' : 'ltr';
      setInferredDirection(current => current === direction ? current : direction);
    };
    refresh();
    if (typeof MutationObserver === 'undefined') return undefined;
    const observer = new MutationObserver(refresh);
    for (
      let target: HTMLElement | null = directionNode.parentElement;
      target;
      target = target.parentElement
    ) {
      observer.observe(target, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'data-inkra-theme', 'dir', 'style'],
      });
    }
    return () => observer.disconnect();
  }, [dir, directionNode]);

  const state = useMemo<SelectFieldState>(() => ({
    captureDirectionNode,
    controlId: field?.controlId,
    descriptionId: field?.descriptionId,
    errorId: field?.errorId,
    disabled: Boolean(disabled || field?.disabled),
    readOnly: Boolean(readOnly || field?.readOnly),
    invalid: Boolean(invalid || field?.invalid),
    required: Boolean(required || field?.required),
  }), [captureDirectionNode, disabled, field, invalid, readOnly, required]);

  return (
    <PortalThemeProvider>
      <SelectFieldContext.Provider value={state}>
        {props.multiple ? <MultipleSelectRoot
          {...props}
          dir={dir ?? inferredDirection}
          disabled={state.disabled}
          readOnly={state.readOnly}
          required={state.required}
        /> : <SelectPrimitive.Root
          {...props}
          dir={dir ?? inferredDirection}
          disabled={state.disabled}
          required={state.required}
          onValueChange={value => { if (!state.readOnly) props.onValueChange?.(value); }}
          onOpenChange={open => { if (!state.readOnly) props.onOpenChange?.(open); }}
          open={state.readOnly ? false : props.open}
        />}
      </SelectFieldContext.Provider>
    </PortalThemeProvider>
  );
}

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectTriggerProps extends SelectPrimitive.SelectTriggerProps {
  /** Decorative slots inside the shared trigger surface. */
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  /** Replaces the dropdown indicator; null removes it. */
  icon?: ReactNode;
  hideValue?: boolean;
  hideIndicator?: boolean;
  /** Shows startIcon, then endIcon, then the indicator as a square control. */
  iconOnly?: boolean;
  fullWidth?: boolean;
  textAlign?: 'start' | 'center' | 'end';
  invalid?: boolean;
  seed?: string | number;
  size?: SelectSize;
}

export const SelectTrigger = forwardRef<
  ComponentRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(function SelectTrigger(
  {
    'aria-describedby': ariaDescribedBy,
    'aria-errormessage': ariaErrorMessage,
    'aria-invalid': ariaInvalid,
    children,
    className,
    disabled = false,
    icon,
    startIcon,
    endIcon,
    hideValue = false,
    hideIndicator = false,
    iconOnly = false,
    fullWidth = true,
    textAlign = 'start',
    id,
    invalid = false,
    seed,
    size = 'md',
    ...props
  },
  forwardedRef,
) {
  const generatedId = useId();
  const multiple = useContext(MultipleSelectContext);
  const Trigger = multiple ? MultipleSelect.Trigger : SelectPrimitive.Trigger;
  const Icon = multiple ? MultipleSelect.Icon : SelectPrimitive.Icon;
  const field = useContext(SelectFieldContext);
  const resolvedId = field?.controlId ?? id;
  const resolvedDisabled = Boolean(disabled || field?.disabled);
  const resolvedInvalid = Boolean(invalid || field?.invalid || isAriaInvalid(ariaInvalid));
  const resolvedSeed = seed ?? `inkra-select-${resolvedId ?? generatedId}`;
  const valueHidden = hideValue || iconOnly;
  const valueId = `${generatedId}-value`;
  const describedBy = mergeAriaIds(
    ariaDescribedBy,
    field?.descriptionId,
    field?.errorId,
    valueHidden ? valueId : undefined,
  );
  const errorMessage = mergeAriaIds(
    ariaErrorMessage,
    resolvedInvalid ? field?.errorId : undefined,
  );
  const portalRef = usePortalTriggerRef(forwardedRef);
  const captureDirectionNode = field?.captureDirectionNode;
  const ref = useCallback((node: ComponentRef<typeof SelectPrimitive.Trigger> | null) => {
    portalRef(node);
    captureDirectionNode?.(node);
  }, [captureDirectionNode, portalRef]);
  const defaultIndicator = (
    <PencilIcon
      className="inkra-select__trigger-glyph"
      paths={chevronDownPaths}
      seed={`${resolvedSeed}-chevron`}
      size={size === 'sm' ? 24 : size === 'lg' ? 32 : 28}
      sourceSize={24}
    />
  );
  const triggerIcon = icon === undefined ? defaultIndicator : icon;

  return (
    <Trigger
      {...props}
      aria-describedby={describedBy}
      aria-errormessage={errorMessage}
      aria-invalid={resolvedInvalid ? true : ariaInvalid}
      aria-readonly={field?.readOnly || undefined}
      className={classes('inkra-select__trigger', className)}
      data-invalid={resolvedInvalid || undefined}
      data-size={size}
      data-icon-only={iconOnly || undefined}
      data-full-width={fullWidth}
      data-text-align={textAlign}
      disabled={resolvedDisabled}
      id={resolvedId}
      ref={ref}
      onKeyDown={event => {
        props.onKeyDown?.(event);
        if (field?.readOnly && event.key !== 'Tab' && !event.ctrlKey && !event.metaKey) event.preventDefault();
      }}
      onPointerDown={event => {
        props.onPointerDown?.(event);
        if (field?.readOnly) event.preventDefault();
      }}
    >
      <PencilSurface<'span'>
        as="span"
        className="inkra-select__trigger-surface"
        radius={8}
        seed={resolvedSeed}
        variant={resolvedInvalid ? 'danger' : 'outline'}
      >
        <PencilSurface<'span'>
          aria-hidden="true"
          as="span"
          className="inkra-select__focus-ring"
          radius={8}
          seed={`${resolvedSeed}-focus`}
          variant="outline"
        />
        {iconOnly ? (
          <span className="inkra-select__trigger-slot" aria-hidden="true">{startIcon ?? endIcon ?? triggerIcon ?? defaultIndicator}</span>
        ) : startIcon != null ? (
          <span className="inkra-select__trigger-slot" aria-hidden="true">{startIcon}</span>
        ) : null}
        <span id={valueId} className={valueHidden ? 'inkra-select__trigger-value-hidden' : 'inkra-select__trigger-value'}>{children}</span>
        {!iconOnly && endIcon != null && <span className="inkra-select__trigger-slot" aria-hidden="true">{endIcon}</span>}
        {iconOnly || hideIndicator || triggerIcon == null ? null : (
          <Icon asChild>
            <span className="inkra-select__trigger-icon">{triggerIcon}</span>
          </Icon>
        )}
      </PencilSurface>
    </Trigger>
  );
});

export interface SelectValueProps extends Omit<
  SelectPrimitive.SelectValueProps,
  'placeholder'
> {
  placeholder?: ReactNode;
  seed?: string | number;
}

export const SelectValue = forwardRef<
  ComponentRef<typeof SelectPrimitive.Value>,
  SelectValueProps
>(function SelectValue({ children, placeholder, seed, ...props }, ref) {
  const generatedId = useId();
  const Value = useContext(MultipleSelectContext) ? MultipleSelect.Value : SelectPrimitive.Value;
  const copy = (value: ReactNode, suffix: string) => typeof value === 'string' ? (
    <PencilText
      className="inkra-select__value-copy"
      ellipsis
      seed={seed ?? `inkra-select-value-${generatedId}-${suffix}`}
    >
      {value}
    </PencilText>
  ) : value;

  return (
    <Value
      {...props}
      placeholder={copy(placeholder, 'placeholder')}
      ref={ref}
    >
      {copy(children, 'value')}
    </Value>
  );
});

export type SelectPortalProps = SelectPrimitive.SelectPortalProps;

export function SelectPortal({ children, ...props }: SelectPortalProps) {
  const Portal = useContext(MultipleSelectContext) ? MultipleSelect.Portal : SelectPrimitive.Portal;
  return (
    <Portal {...props}>
      <PortalThemeBridge>{children}</PortalThemeBridge>
    </Portal>
  );
}

export interface SelectContentProps extends SelectPrimitive.SelectContentProps {
  seed?: string | number;
  surfaceClassName?: string;
  surfaceRadius?: number;
  surfaceVariant?: PencilSurfaceVariant;
}

export const SelectContent = forwardRef<
  ComponentRef<typeof SelectPrimitive.Content>,
  SelectContentProps
>(function SelectContent(
  {
    children,
    className,
    seed,
    surfaceClassName,
    surfaceRadius = 8,
    surfaceVariant = 'paper',
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const Content = useContext(MultipleSelectContext) ? MultipleSelect.Content : SelectPrimitive.Content;

  return (
    <Content
      {...props}
      className={classes('inkra-select__content', className)}
      ref={ref}
    >
      <PencilSurface
        className={classes('inkra-select__content-surface', surfaceClassName)}
        radius={surfaceRadius}
        seed={seed ?? `inkra-select-content-${generatedId}`}
        variant={surfaceVariant}
      >
        {children}
      </PencilSurface>
    </Content>
  );
});

export type SelectViewportProps = SelectPrimitive.SelectViewportProps;

export const SelectViewport = forwardRef<
  ComponentRef<typeof SelectPrimitive.Viewport>,
  SelectViewportProps
>(function SelectViewport({ className, ...props }, ref) {
  const Viewport = useContext(MultipleSelectContext) ? MultipleSelect.Viewport : SelectPrimitive.Viewport;
  return (
    <Viewport
      {...props}
      className={classes('inkra-select__viewport', className)}
      ref={ref}
    />
  );
});

export type SelectGroupProps = SelectPrimitive.SelectGroupProps;

export const SelectGroup = forwardRef<
  ComponentRef<typeof SelectPrimitive.Group>,
  SelectGroupProps
>(function SelectGroup({ className, ...props }, ref) {
  const Group = useContext(MultipleSelectContext) ? MultipleSelect.Group : SelectPrimitive.Group;
  return (
    <Group
      {...props}
      className={classes('inkra-select__group', className)}
      ref={ref}
    />
  );
});

export interface SelectLabelProps extends Omit<
  SelectPrimitive.SelectLabelProps,
  'children'
> {
  children: string;
  seed?: string | number;
}

export const SelectLabel = forwardRef<
  ComponentRef<typeof SelectPrimitive.Label>,
  SelectLabelProps
>(function SelectLabel({ children, className, seed, ...props }, ref) {
  const generatedId = useId();
  const Label = useContext(MultipleSelectContext) ? MultipleSelect.Label : SelectPrimitive.Label;
  return (
    <Label
      {...props}
      className={classes('inkra-select__label', className)}
      ref={ref}
    >
      <PencilText seed={seed ?? `inkra-select-label-${generatedId}`}>{children}</PencilText>
    </Label>
  );
});

export interface SelectItemProps extends SelectPrimitive.SelectItemProps {
  seed?: string | number;
  surfaceClassName?: string;
}

export const SelectItem = forwardRef<
  ComponentRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(function SelectItem(
  { children, className, seed, surfaceClassName, value, ...props },
  ref,
) {
  const Item = useContext(MultipleSelectContext) ? MultipleSelect.Item : SelectPrimitive.Item;
  return (
    <Item
      {...props}
      className={classes('inkra-select__item', className)}
      ref={ref}
      value={value}
    >
      <PencilSurface
        className={classes('inkra-select__item-surface', surfaceClassName)}
        seed={seed ?? `inkra-select-item-${value}`}
        variant="selection"
      >
        {children}
      </PencilSurface>
    </Item>
  );
});

export interface SelectItemTextProps extends Omit<
  SelectPrimitive.SelectItemTextProps,
  'children'
> {
  children: string;
  seed?: string | number;
}

export const SelectItemText = forwardRef<
  ComponentRef<typeof SelectPrimitive.ItemText>,
  SelectItemTextProps
>(function SelectItemText({ children, seed, ...props }, ref) {
  const generatedId = useId();
  const ItemText = useContext(MultipleSelectContext) ? MultipleSelect.ItemText : SelectPrimitive.ItemText;
  const { copyRef, version } = useItemAppearanceVersion();
  return (
    <ItemText {...props} ref={ref}>
      <PencilText
        className="inkra-select__item-text-copy"
        key={version}
        ref={copyRef}
        seed={seed ?? `inkra-select-item-text-${generatedId}`}
      >
        {children}
      </PencilText>
    </ItemText>
  );
});

export interface SelectItemIndicatorProps extends SelectPrimitive.SelectItemIndicatorProps {
  seed?: string | number;
}

export const SelectItemIndicator = forwardRef<
  ComponentRef<typeof SelectPrimitive.ItemIndicator>,
  SelectItemIndicatorProps
>(function SelectItemIndicator({ children, className, seed, ...props }, ref) {
  const generatedId = useId();
  const ItemIndicator = useContext(MultipleSelectContext) ? MultipleSelect.ItemIndicator : SelectPrimitive.ItemIndicator;
  return (
    <ItemIndicator
      {...props}
      className={classes('inkra-select__item-indicator', className)}
      ref={ref}
    >
      {children ?? (
        <PencilIcon
          paths={checkPaths}
          seed={seed ?? `inkra-select-indicator-${generatedId}`}
          size={16}
          sourceSize={24}
        />
      )}
    </ItemIndicator>
  );
});

export type SelectScrollUpButtonProps = SelectPrimitive.SelectScrollUpButtonProps & {
  seed?: string | number;
};

export const SelectScrollUpButton = forwardRef<
  ComponentRef<typeof SelectPrimitive.ScrollUpButton>,
  SelectScrollUpButtonProps
>(function SelectScrollUpButton({ children, className, seed, ...props }, ref) {
  const generatedId = useId();
  const ScrollUpButton = useContext(MultipleSelectContext) ? MultipleSelect.ScrollUpButton : SelectPrimitive.ScrollUpButton;
  return (
    <ScrollUpButton
      {...props}
      className={classes('inkra-select__scroll-button', className)}
      ref={ref}
    >
      {children ?? (
        <PencilIcon
          paths={chevronUpPaths}
          seed={seed ?? `inkra-select-scroll-up-${generatedId}`}
          size={16}
          sourceSize={24}
        />
      )}
    </ScrollUpButton>
  );
});

export type SelectScrollDownButtonProps = SelectPrimitive.SelectScrollDownButtonProps & {
  seed?: string | number;
};

export const SelectScrollDownButton = forwardRef<
  ComponentRef<typeof SelectPrimitive.ScrollDownButton>,
  SelectScrollDownButtonProps
>(function SelectScrollDownButton({ children, className, seed, ...props }, ref) {
  const generatedId = useId();
  const ScrollDownButton = useContext(MultipleSelectContext) ? MultipleSelect.ScrollDownButton : SelectPrimitive.ScrollDownButton;
  return (
    <ScrollDownButton
      {...props}
      className={classes('inkra-select__scroll-button', className)}
      ref={ref}
    >
      {children ?? (
        <PencilIcon
          paths={chevronDownPaths}
          seed={seed ?? `inkra-select-scroll-down-${generatedId}`}
          size={16}
          sourceSize={24}
        />
      )}
    </ScrollDownButton>
  );
});

export interface SelectSeparatorProps extends Omit<
  SelectPrimitive.SelectSeparatorProps,
  'children'
> {
  seed?: string | number;
}

export const SelectSeparator = forwardRef<
  ComponentRef<typeof SelectPrimitive.Separator>,
  SelectSeparatorProps
>(function SelectSeparator({ className, seed, ...props }, ref) {
  const generatedId = useId();
  const Separator = useContext(MultipleSelectContext) ? MultipleSelect.Separator : SelectPrimitive.Separator;
  return (
    <Separator
      {...props}
      className={classes('inkra-select__separator', className)}
      ref={ref}
    >
      <PencilLine seed={seed ?? `inkra-select-separator-${generatedId}`} weight={0.8} />
    </Separator>
  );
});

export interface SelectClearProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  seed?: string | number;
}

export const SelectClear = forwardRef<HTMLButtonElement, SelectClearProps>(function SelectClear({
  children, className, disabled, onClick, ...props
}, ref) {
  const state = useContext(MultipleSelectContext);
  if (!state) throw new Error('Select.Clear must be used inside Select.Root with multiple.');
  return <Button {...props} className={classes('inkra-select__clear', className)} ref={ref} type="button" variant="ghost"
    disabled={disabled || state.disabled || state.readOnly || state.values.length === 0}
    onClick={event => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      state.change([]);
      state.triggerRef.current?.focus({ preventScroll: true });
    }}>{children ?? 'Clear'}</Button>;
});

export const Select = /* @__PURE__ */ Object.freeze({
  Searchable: SearchableSelect,
  Stepper: SelectStepper,
  Root: SelectRoot,
  Trigger: SelectTrigger,
  Value: SelectValue,
  Portal: SelectPortal,
  Content: SelectContent,
  Viewport: SelectViewport,
  Group: SelectGroup,
  Label: SelectLabel,
  Item: SelectItem,
  ItemText: SelectItemText,
  ItemIndicator: SelectItemIndicator,
  ScrollUpButton: SelectScrollUpButton,
  ScrollDownButton: SelectScrollDownButton,
  Separator: SelectSeparator,
  Clear: SelectClear,
});
