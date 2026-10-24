import { Select as BaseSelect } from '@base-ui/react/select';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import type * as RadixSelect from '@radix-ui/react-select';
import { Children, createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, RefObject } from 'react';

import { PencilText } from '../PencilText.js';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectMultipleRootProps extends Omit<RadixSelect.SelectProps, 'value' | 'defaultValue' | 'onValueChange'> {
  multiple: true;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (values: string[]) => void;
  readOnly?: boolean;
  invalid?: boolean;
  items?: readonly SelectOption[];
}

interface MultipleState {
  values: string[];
  labels: ReadonlyMap<string, string>;
  disabled: boolean;
  readOnly: boolean;
  change: (values: string[]) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  contentEvents: RefObject<Pick<RadixSelect.SelectContentProps, 'onEscapeKeyDown' | 'onPointerDownOutside'>>;
}

export const MultipleSelectContext = createContext<MultipleState | null>(null);
const emptyValues: string[] = [];

export function MultipleSelectRoot({
  value, defaultValue = emptyValues, onValueChange, disabled = false, readOnly = false,
  dir, items, children, multiple: _multiple, invalid: _invalid, onOpenChange, ...props
}: SelectMultipleRootProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const values = value ?? uncontrolled;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultValueRef = useRef(defaultValue);
  defaultValueRef.current = defaultValue;
  const isControlled = value !== undefined;
  const contentEvents = useRef<Pick<RadixSelect.SelectContentProps, 'onEscapeKeyDown' | 'onPointerDownOutside'>>({});
  const labels = useMemo(() => new Map(items?.map(item => [item.value, item.label])), [items]);
  const change = useCallback((next: string[]) => {
    if (disabled || readOnly) return;
    if (!isControlled) setUncontrolled(next);
    onValueChange?.(next);
  }, [disabled, readOnly, isControlled, onValueChange]);
  const context = useMemo(() => ({ values, labels, disabled, readOnly, change, triggerRef, contentEvents }),
    [values, labels, disabled, readOnly, change]);

  useEffect(() => {
    if (isControlled) return;
    const form = inputRef.current?.form;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = (event: Event) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!event.defaultPrevented) setUncontrolled(defaultValueRef.current);
      }, 0);
    };
    form?.addEventListener('reset', reset);
    return () => { clearTimeout(timer); form?.removeEventListener('reset', reset); };
  }, [isControlled, props.form]);

  return (
    <MultipleSelectContext.Provider value={context}>
      <DirectionProvider direction={dir}>
        <BaseSelect.Root<string, true>
          {...props}
          multiple
          disabled={disabled}
          readOnly={readOnly}
          open={readOnly ? false : props.open}
          value={values}
          onValueChange={change}
          items={items}
          inputRef={inputRef}
          onOpenChange={(open, details) => {
            if (readOnly && open) details.cancel();
            if (details.reason === 'outside-press' || details.reason === 'cancel-open') {
              // Base UI may report mousedown/touchstart; preserve the actual source event.
              const outside = new CustomEvent('pointerDownOutside', { cancelable: true, detail: { originalEvent: details.event as PointerEvent } });
              contentEvents.current.onPointerDownOutside?.(outside);
              if (outside.defaultPrevented) {
                details.event.preventDefault();
                details.cancel();
              }
            }
            if (details.reason === 'escape-key' && details.event instanceof KeyboardEvent) {
              contentEvents.current.onEscapeKeyDown?.(details.event);
              if (details.event.defaultPrevented) details.cancel();
            }
            if (!details.isCanceled) onOpenChange?.(open);
          }}
        >
          {children}
        </BaseSelect.Root>
      </DirectionProvider>
    </MultipleSelectContext.Provider>
  );
}

// Keep the public compound API stable while Base UI owns the multiple-selection engine.
const Trigger = forwardRef<HTMLButtonElement, RadixSelect.SelectTriggerProps>(function Trigger({ asChild, children, ...props }, ref) {
  const { triggerRef } = useContext(MultipleSelectContext)!;
  const captureRef = useCallback((node: HTMLButtonElement | null) => {
    triggerRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref, triggerRef]);
  return <BaseSelect.Trigger {...props} ref={captureRef} render={asChild ? Children.only(children) as ReactElement : undefined}>{asChild ? undefined : children}</BaseSelect.Trigger>;
});

const Value = forwardRef<HTMLSpanElement, RadixSelect.SelectValueProps>(function Value({ asChild, children, placeholder, ...props }, ref) {
  const state = useContext(MultipleSelectContext)!;
  return <BaseSelect.Value {...props} ref={ref} render={asChild ? Children.only(children) as ReactElement : undefined} placeholder={placeholder}>
    {children ?? ((values: string[]) => values.length ? <PencilText className="inkra-select__value-copy" ellipsis>{values.map(value => state.labels.get(value) ?? value).join(', ')}</PencilText> : placeholder)}
  </BaseSelect.Value>;
});

const Icon = forwardRef<HTMLSpanElement, RadixSelect.SelectIconProps>(function Icon({ asChild, children, ...props }, ref) {
  return <BaseSelect.Icon {...props} ref={ref} render={asChild ? Children.only(children) as ReactElement : undefined}>{asChild ? undefined : children}</BaseSelect.Icon>;
});

function Portal({ container, children }: RadixSelect.SelectPortalProps) {
  // Both engines ultimately use React DOM portals; retain Radix's broader DOM-root API.
  return <BaseSelect.Portal container={container as HTMLElement | ShadowRoot | null | undefined}>{children}</BaseSelect.Portal>;
}

const Content = forwardRef<HTMLDivElement, RadixSelect.SelectContentProps>(function Content({
  asChild, children, position = 'popper', side = 'bottom', sideOffset = 4, align = 'start', alignOffset,
  avoidCollisions = true, collisionPadding = 8, collisionBoundary, sticky, arrowPadding,
  forceMount: _forceMount, updatePositionStrategy: _updatePositionStrategy,
  hideWhenDetached, onCloseAutoFocus, onEscapeKeyDown,
  onPointerDownOutside, ...props
}, ref) {
  const { contentEvents } = useContext(MultipleSelectContext)!;
  useEffect(() => {
    contentEvents.current = { onEscapeKeyDown, onPointerDownOutside };
    return () => { contentEvents.current = {}; };
  }, [contentEvents, onEscapeKeyDown, onPointerDownOutside]);
  return <BaseSelect.Positioner
    className="inkra-select__positioner"
    data-hide-when-detached={hideWhenDetached || undefined}
    sticky={sticky === 'always'}
    arrowPadding={arrowPadding}
    side={side} sideOffset={sideOffset} align={align} alignOffset={alignOffset}
    alignItemWithTrigger={position === 'item-aligned'} collisionPadding={collisionPadding}
    collisionBoundary={Array.isArray(collisionBoundary) ? collisionBoundary.filter((entry): entry is Element => entry != null) : collisionBoundary ?? undefined}
    collisionAvoidance={avoidCollisions ? undefined : { side: 'none', align: 'none' }}
  >
    <BaseSelect.Popup {...props} ref={ref} render={asChild ? Children.only(children) as ReactElement : undefined}
      finalFocus={onCloseAutoFocus ? () => { const event = new Event('closeAutoFocus', { cancelable: true }); onCloseAutoFocus(event); return !event.defaultPrevented; } : undefined}>
      {asChild ? undefined : children}
    </BaseSelect.Popup>
  </BaseSelect.Positioner>;
});

const Viewport = forwardRef<HTMLDivElement, RadixSelect.SelectViewportProps>(function Viewport({ asChild, children, nonce: _nonce, ...props }, ref) {
  return <BaseSelect.List {...props} ref={ref} render={asChild ? Children.only(children) as ReactElement : undefined}>{asChild ? undefined : children}</BaseSelect.List>;
});

const Group = forwardRef<HTMLDivElement, RadixSelect.SelectGroupProps>(function Group({ asChild, children, ...props }, ref) {
  return <BaseSelect.Group {...props} ref={ref} render={asChild ? Children.only(children) as ReactElement : undefined}>{asChild ? undefined : children}</BaseSelect.Group>;
});

const Label = forwardRef<HTMLDivElement, RadixSelect.SelectLabelProps>(function Label({ asChild, children, ...props }, ref) {
  return <BaseSelect.GroupLabel {...props} ref={ref} render={asChild ? Children.only(children) as ReactElement : undefined}>{asChild ? undefined : children}</BaseSelect.GroupLabel>;
});

const Item = forwardRef<HTMLDivElement, RadixSelect.SelectItemProps>(function Item({ asChild, children, textValue, ...props }, ref) {
  return <BaseSelect.Item {...props} label={textValue} ref={ref} render={asChild ? Children.only(children) as ReactElement : undefined}>{asChild ? undefined : children}</BaseSelect.Item>;
});

const ItemText = forwardRef<HTMLSpanElement, RadixSelect.SelectItemTextProps>(function ItemText({ asChild, children, ...props }, ref) {
  return <BaseSelect.ItemText {...props} ref={node => {
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }} render={asChild ? Children.only(children) as ReactElement : <span />}>{asChild ? undefined : children}</BaseSelect.ItemText>;
});

const ItemIndicator = forwardRef<HTMLSpanElement, RadixSelect.SelectItemIndicatorProps>(function ItemIndicator({ asChild, children, ...props }, ref) {
  return <BaseSelect.ItemIndicator {...props} ref={ref} render={asChild ? Children.only(children) as ReactElement : undefined}>{asChild ? undefined : children}</BaseSelect.ItemIndicator>;
});

const ScrollUpButton = forwardRef<HTMLDivElement, RadixSelect.SelectScrollUpButtonProps>(function ScrollUpButton({ asChild, children, ...props }, ref) {
  return <BaseSelect.ScrollUpArrow {...props} ref={ref} render={asChild ? Children.only(children) as ReactElement : undefined}>{asChild ? undefined : children}</BaseSelect.ScrollUpArrow>;
});

const ScrollDownButton = forwardRef<HTMLDivElement, RadixSelect.SelectScrollDownButtonProps>(function ScrollDownButton({ asChild, children, ...props }, ref) {
  return <BaseSelect.ScrollDownArrow {...props} ref={ref} render={asChild ? Children.only(children) as ReactElement : undefined}>{asChild ? undefined : children}</BaseSelect.ScrollDownArrow>;
});

const Separator = forwardRef<HTMLDivElement, RadixSelect.SelectSeparatorProps>(function Separator({ asChild, children, ...props }, ref) {
  return <BaseSelect.Separator {...props} ref={ref} render={asChild ? Children.only(children) as ReactElement : undefined}>{asChild ? undefined : children}</BaseSelect.Separator>;
});

export const MultipleSelect = { Trigger, Value, Icon, Portal, Content, Viewport, Group, Label, Item, ItemText, ItemIndicator, ScrollUpButton, ScrollDownButton, Separator };
