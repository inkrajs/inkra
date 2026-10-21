import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { createContext, forwardRef, useContext, useId } from 'react';
import type { ComponentRef, ReactNode } from 'react';

import { PencilIcon } from '../PencilIcon.js';
import type { PencilIconPath } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';

const chevronDownPaths: readonly PencilIconPath[] = [
  { d: 'M6 9L12 15L18 9' },
];

type AccordionOrientation = 'horizontal' | 'vertical';

const AccordionOrientationContext = createContext<AccordionOrientation>('vertical');

function classes(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export type AccordionRootProps =
  | AccordionPrimitive.AccordionSingleProps
  | AccordionPrimitive.AccordionMultipleProps;

export const AccordionRoot = forwardRef<
  ComponentRef<typeof AccordionPrimitive.Root>,
  AccordionRootProps
>(function AccordionRoot({ className, orientation = 'vertical', ...props }, ref) {
  return (
    <AccordionOrientationContext.Provider value={orientation}>
      <AccordionPrimitive.Root
        {...(props as AccordionPrimitive.AccordionSingleProps)}
        className={classes('inkra-accordion', className)}
        orientation={orientation}
        ref={ref}
      />
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

  return (
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
  return (
    <AccordionPrimitive.Content
      {...props}
      className={classes('inkra-accordion__content', className)}
      ref={ref}
    >
      <div className={classes('inkra-accordion__content-body', contentClassName)}>{children}</div>
    </AccordionPrimitive.Content>
  );
});

export const Accordion = Object.freeze({
  Root: AccordionRoot,
  Item: AccordionItem,
  Header: AccordionHeader,
  Trigger: AccordionTrigger,
  Content: AccordionContent,
});
