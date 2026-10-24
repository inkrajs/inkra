import * as Primitive from '@radix-ui/react-tabs';
import { createContext, forwardRef, useContext, useRef, useState, type ReactNode } from 'react';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { PencilLine } from '../PencilLine.js';
import { useSelectionDrawing } from '../internal/useSelectionDrawing.js';

export interface TabsProps extends Primitive.TabsProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}
export interface TabsListProps extends Primitive.TabsListProps {
  align?: 'start' | 'center' | 'end';
  fullWidth?: boolean;
  divided?: boolean;
}
export interface TabsTriggerProps extends Omit<Primitive.TabsTriggerProps, 'asChild'> {
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}
export type TabsContentProps = Primitive.TabsContentProps;

const ValueContext = createContext<string | undefined>(undefined);
const AnimatedContext = createContext(true);
const OrientationContext = createContext<'horizontal' | 'vertical'>('horizontal');
const DividedContext = createContext(false);

const Root = forwardRef<HTMLDivElement, TabsProps>(function TabsRoot(
  { value, defaultValue, onValueChange, className, size = 'md', animated = true, orientation = 'horizontal', ...props }, ref,
) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value === undefined ? internal : value;
  const pendingRequest = useRef<string | null>(null);
  return <ValueContext.Provider value={current}><AnimatedContext.Provider value={animated}><OrientationContext.Provider value={orientation}>
    <Primitive.Root {...props} orientation={orientation} ref={ref} data-size={size} className={['inkra-tabs', className].filter(Boolean).join(' ')} value={current ?? ''} onValueChange={next => {
      // Radix pointer activation can request once from focus and once from pointer down.
      // Deduplicate only that synchronous interaction so a rejected controlled value can retry.
      if (pendingRequest.current === next) return;
      pendingRequest.current = next;
      queueMicrotask(() => {
        if (pendingRequest.current === next) pendingRequest.current = null;
      });
      if (value === undefined) setInternal(next);
      onValueChange?.(next);
    }} />
  </OrientationContext.Provider></AnimatedContext.Provider></ValueContext.Provider>;
});

const List = forwardRef<HTMLDivElement, TabsListProps>(function TabsList({ className, align = 'start', fullWidth = false, divided = false, ...props }, ref) {
  return <DividedContext.Provider value={divided}><Primitive.List {...props} ref={ref} data-align={align} data-full-width={fullWidth || undefined} data-divided={divided || undefined} className={['inkra-tabs__list', className].filter(Boolean).join(' ')} /></DividedContext.Provider>;
});

const Trigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(function TabsTrigger({ value, className, children, startIcon, endIcon, ...props }, ref) {
  const current = useContext(ValueContext);
  const divided = useContext(DividedContext);
  const orientation = useContext(OrientationContext);
  const surface = useRef<HTMLSpanElement>(null);
  useSelectionDrawing(surface, current === value, useContext(AnimatedContext));
  return <Primitive.Trigger {...props} value={value} ref={ref} className={['inkra-tabs__trigger', className].filter(Boolean).join(' ')}>
    {divided && <PencilLine className="inkra-tabs__divider" orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'} seed={`tab-divider-${value}`} />}
    <PencilSurface as="span" aria-hidden="true" className="inkra-tabs__selection" variant="selection" seed={`tab-${value}`} ref={surface} />
    <PencilSurface as="span" aria-hidden="true" className="inkra-tabs__focus-ring" variant="outline" seed={`tab-${value}-focus`} />
    {startIcon && <span className="inkra-tabs__icon" aria-hidden="true">{startIcon}</span>}
    <span className="inkra-tabs__label">{typeof children === 'string' ? <PencilText>{children}</PencilText> : children}</span>
    {endIcon && <span className="inkra-tabs__icon" aria-hidden="true">{endIcon}</span>}
  </Primitive.Trigger>;
});

const Content = forwardRef<HTMLDivElement, TabsContentProps>(function TabsContent({ className, value, ...props }, ref) {
  const current = useContext(ValueContext);
  return <Primitive.Content {...props} value={value} ref={ref} hidden={current !== value} className={['inkra-tabs__content', className].filter(Boolean).join(' ')} />;
});

export const Tabs = { Root, List, Trigger, Content };
