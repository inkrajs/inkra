import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { createContext, forwardRef, useCallback, useContext, useId, useRef, useState } from 'react';
import type { ComponentRef, ReactNode, Ref } from 'react';

import { PencilIcon } from '../PencilIcon.js';
import type { PencilIconPath } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';

const chevronDownPaths: readonly PencilIconPath[] = [
  { d: 'M6 9L12 15L18 9' },
];

type AccordionOrientation = 'horizontal' | 'vertical';

const AccordionOrientationContext = createContext<AccordionOrientation>('vertical');
const AccordionOpenValuesContext = createContext<ReadonlySet<string>>(new Set());
const AccordionItemOpenContext = createContext(false);

function classes(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function assignRef<Value>(ref: Ref<Value> | undefined, value: Value | null): void | (() => void) {
  if (typeof ref === 'function') return ref(value);
  if (ref) ref.current = value;
}

function values(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export type AccordionRootProps =
  | AccordionPrimitive.AccordionSingleProps
  | AccordionPrimitive.AccordionMultipleProps;

export const AccordionRoot = forwardRef<
  ComponentRef<typeof AccordionPrimitive.Root>,
  AccordionRootProps
>(function AccordionRoot({ className, orientation = 'vertical', ...props }, ref) {
  const controlled = props.value !== undefined;
  const [uncontrolledValues, setUncontrolledValues] = useState(() => values(props.defaultValue));
  const currentValues = controlled ? values(props.value) : uncontrolledValues;
  const handleValueChange = (nextValue: string | string[]) => {
    if (!controlled) setUncontrolledValues(values(nextValue));
    if (props.type === 'single') props.onValueChange?.(nextValue as string);
    else props.onValueChange?.(nextValue as string[]);
  };

  return (
    <AccordionOrientationContext.Provider value={orientation}>
      <AccordionOpenValuesContext.Provider value={new Set(currentValues)}>
        {props.type === 'single' ? (
          <AccordionPrimitive.Root
            {...props}
            className={classes('inkra-accordion', className)}
            onValueChange={handleValueChange}
            orientation={orientation}
            ref={ref}
          />
        ) : (
          <AccordionPrimitive.Root
            {...props}
            className={classes('inkra-accordion', className)}
            onValueChange={handleValueChange}
            orientation={orientation}
            ref={ref}
          />
        )}
      </AccordionOpenValuesContext.Provider>
    </AccordionOrientationContext.Provider>
  );
});

export interface AccordionItemProps extends AccordionPrimitive.AccordionItemProps {
  dividerSeed?: string | number;
  showDivider?: boolean;
}

export const AccordionItem = forwardRef<
  ComponentRef<typeof AccordionPrimitive.Item>,
  AccordionItemProps
>(function AccordionItem(
  { children, className, dividerSeed, showDivider = true, value, ...props },
  ref,
) {
  const orientation = useContext(AccordionOrientationContext);
  const open = useContext(AccordionOpenValuesContext).has(value);

  return (
    <AccordionItemOpenContext.Provider value={open}>
      <AccordionPrimitive.Item
        {...props}
        className={classes('inkra-accordion__item', className)}
        ref={ref}
        value={value}
      >
        {children}
        {showDivider ? (
          <PencilLine
            className="inkra-accordion__divider"
            orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
            seed={dividerSeed ?? `inkra-accordion-divider-${value}`}
            weight={0.8}
          />
        ) : null}
      </AccordionPrimitive.Item>
    </AccordionItemOpenContext.Provider>
  );
});

export type AccordionHeaderProps = AccordionPrimitive.AccordionHeaderProps;

export const AccordionHeader = forwardRef<
  ComponentRef<typeof AccordionPrimitive.Header>,
  AccordionHeaderProps
>(function AccordionHeader({ className, ...props }, ref) {
  return (
    <AccordionPrimitive.Header
      {...props}
      className={classes('inkra-accordion__header', className)}
      ref={ref}
    />
  );
});

export interface AccordionTriggerProps extends AccordionPrimitive.AccordionTriggerProps {
  icon?: ReactNode;
  seed?: string | number;
}

export const AccordionTrigger = forwardRef<
  ComponentRef<typeof AccordionPrimitive.Trigger>,
  AccordionTriggerProps
>(function AccordionTrigger({ children, className, icon, seed, ...props }, ref) {
  const generatedId = useId();
  const resolvedSeed = seed ?? `inkra-accordion-trigger-${generatedId}`;
  const triggerIcon = icon === undefined ? (
    <PencilIcon
      className="inkra-accordion__trigger-glyph"
      paths={chevronDownPaths}
      seed={`${resolvedSeed}-chevron`}
      size={16}
      sourceSize={24}
    />
  ) : icon;

  return (
    <AccordionPrimitive.Trigger
      {...props}
      className={classes('inkra-accordion__trigger', className)}
      ref={ref}
    >
      <PencilSurface<'span'>
        aria-hidden="true"
        as="span"
        className="inkra-accordion__focus-ring"
        radius={6}
        seed={`${resolvedSeed}-focus`}
        variant="outline"
      />
      <span className="inkra-accordion__trigger-label">
        {typeof children === 'string' ? (
          <PencilText seed={`${resolvedSeed}-text`}>{children}</PencilText>
        ) : children}
      </span>
      {triggerIcon == null ? null : (
        <span aria-hidden="true" className="inkra-accordion__trigger-icon">
          {triggerIcon}
        </span>
      )}
    </AccordionPrimitive.Trigger>
  );
});

export interface AccordionContentProps extends AccordionPrimitive.AccordionContentProps {
  contentClassName?: string;
}

export const AccordionContent = forwardRef<
  ComponentRef<typeof AccordionPrimitive.Content>,
  AccordionContentProps
>(function AccordionContent({ children, className, contentClassName, ...props }, ref) {
  const open = useContext(AccordionItemOpenContext);
  const contentRef = useRef<HTMLDivElement>(null);
  const focusWithinRef = useRef(false);
  const callerAriaHidden = props['aria-hidden'];
  const callerInert = props.inert;
  const callerOnBlurCapture = props.onBlurCapture;
  const callerOnFocusCapture = props.onFocusCapture;
  const setContentRef = useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node;
    const cleanup = assignRef(ref, node);
    return () => {
      contentRef.current = null;
      if (typeof cleanup === 'function') cleanup();
      else assignRef(ref, null);
    };
  }, [ref]);

  useBrowserLayoutEffect(() => {
    const content = contentRef.current;
    if (open || !content || !focusWithinRef.current) return;
    focusWithinRef.current = false;
    const triggerId = content.getAttribute('aria-labelledby');
    if (triggerId) content.ownerDocument.getElementById(triggerId)?.focus({ preventScroll: true });
  }, [open]);

  return (
    <AccordionPrimitive.Content
      {...props}
      aria-hidden={open ? callerAriaHidden : true}
      className={classes('inkra-accordion__content', className)}
      inert={open ? callerInert : true}
      onBlurCapture={event => {
        callerOnBlurCapture?.(event);
        if (open && !event.currentTarget.contains(event.relatedTarget)) focusWithinRef.current = false;
      }}
      onFocusCapture={event => {
        focusWithinRef.current = true;
        callerOnFocusCapture?.(event);
      }}
      ref={setContentRef}
    >
      <div className={classes('inkra-accordion__content-body', contentClassName)}>{children}</div>
    </AccordionPrimitive.Content>
  );
});

export const Accordion = /* @__PURE__ */ Object.freeze({
  Root: AccordionRoot,
  Item: AccordionItem,
  Header: AccordionHeader,
  Trigger: AccordionTrigger,
  Content: AccordionContent,
});
