import { useInkraLocale } from '../i18n/index.js';
import * as Primitive from '@radix-ui/react-tabs';
import { createContext, forwardRef, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { __iconData as chevronLeft } from 'lucide-react/dist/esm/icons/chevron-left.mjs';
import { __iconData as chevronRight } from 'lucide-react/dist/esm/icons/chevron-right.mjs';
import { Button } from '../Button.js';
import { DropdownMenu } from '../dropdown-menu/index.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { PencilLine } from '../PencilLine.js';
import { useSelectionDrawing } from '../internal/useSelectionDrawing.js';
import { revealTab, useTabsOverflow, type TabsOverflow } from './useOverflow.js';

export type { TabsOverflow } from './useOverflow.js';
const leftPaths = chevronLeft.node.flatMap(([, attributes]) => attributes.d ? [{ d: attributes.d }] : []);
const rightPaths = chevronRight.node.flatMap(([, attributes]) => attributes.d ? [{ d: attributes.d }] : []);

function OverflowIcon({ left = false, down = false }: { left?: boolean; down?: boolean }) {
  const paths = left ? leftPaths : rightPaths;
  return <span className="inkra-tabs__overflow-icon" data-down={down || undefined} aria-hidden="true">
    <PencilIcon size={32} sourceSize={24} paths={paths} />
    <svg viewBox="0 0 40 40" focusable="false"><g transform="translate(8 8)" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths.map((path, index) => <path key={index} d={path.d} />)}
    </g></svg>
  </span>;
}

export interface TabsProps extends Primitive.TabsProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}
export interface TabsListProps extends Primitive.TabsListProps {
  align?: 'start' | 'center' | 'end';
  fullWidth?: boolean;
  divided?: boolean;
  /** Horizontal overflow interaction. Vertical lists retain native scrolling. */
  overflow?: TabsOverflow;
  moreLabel?: string;
  scrollPreviousLabel?: string;
  scrollNextLabel?: string;
}
export interface TabsTriggerProps extends Omit<Primitive.TabsTriggerProps, 'asChild'> {
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  /** Plain text used by the overflow menu for a custom trigger label. */
  overflowLabel?: string;
}
export type TabsContentProps = Primitive.TabsContentProps;

const ValueContext = createContext<string | undefined>(undefined);
const AnimatedContext = createContext(true);
const OrientationContext = createContext<'horizontal' | 'vertical'>('horizontal');
const DividedContext = createContext(false);
const ChangeContext = createContext<(value: string) => void>(() => {});
const HiddenContext = createContext<ReadonlySet<string>>(new Set());

const Root = forwardRef<HTMLDivElement, TabsProps>(function TabsRoot(
  { value, defaultValue, onValueChange, className, size = 'md', animated = true, orientation = 'horizontal', ...props }, ref,
) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value === undefined ? internal : value;
  const pendingRequest = useRef<string | null>(null);
  const change = (next: string) => {
      // Radix pointer activation can request once from focus and once from pointer down.
      // Deduplicate only that synchronous interaction so a rejected controlled value can retry.
      if (pendingRequest.current === next) return;
      pendingRequest.current = next;
      queueMicrotask(() => {
        if (pendingRequest.current === next) pendingRequest.current = null;
      });
      if (value === undefined) setInternal(next);
      onValueChange?.(next);
  };
  return <ValueContext.Provider value={current}><ChangeContext.Provider value={change}><AnimatedContext.Provider value={animated}><OrientationContext.Provider value={orientation}>
    <Primitive.Root {...props} orientation={orientation} ref={ref} data-size={size} className={['inkra-tabs', className].filter(Boolean).join(' ')} value={current ?? ''} onValueChange={change} />
  </OrientationContext.Provider></AnimatedContext.Provider></ChangeContext.Provider></ValueContext.Provider>;
});

const List = forwardRef<HTMLDivElement, TabsListProps>(function TabsList(inkraProps, ref) {
  const { t } = useInkraLocale();
  const {
  className, align = 'start', fullWidth = false, divided = false, overflow = 'scroll',
  moreLabel = t('tabs.more'), scrollPreviousLabel = t('tabs.previous'), scrollNextLabel = t('tabs.next'),
  onFocusCapture, ...props
} = inkraProps;
  const current = useContext(ValueContext);
  const change = useContext(ChangeContext);
  const mode = useContext(OrientationContext) === 'horizontal' ? overflow : 'scroll';
  const state = useTabsOverflow(mode, current);
  const { listRef } = state;
  const hidden = useMemo(() => new Set(mode === 'menu' ? state.items.map(item => item.value) : []), [mode, state.items]);
  const selectionPending = useRef(false);
  const setRef = useCallback((node: HTMLDivElement | null) => {
    listRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [listRef, ref]);
  const list = <Primitive.List {...props} ref={setRef} data-overflow={mode} data-align={align} data-full-width={fullWidth || undefined} data-divided={divided || undefined} className={['inkra-tabs__list', className].filter(Boolean).join(' ')} onFocusCapture={event => {
    onFocusCapture?.(event);
    if (!event.defaultPrevented && mode !== 'menu') revealTab(listRef.current, (event.target as HTMLElement).closest<HTMLElement>('[data-tabs-value]'));
  }} />;
  const directionIcon = (previous: boolean) => <OverflowIcon left={previous !== state.rtl} />;
  return <DividedContext.Provider value={divided}><HiddenContext.Provider value={hidden}>
    {mode === 'scroll' ? list : <div className="inkra-tabs__overflow" data-overflow={mode} data-has-overflow={state.overflowing || undefined} ref={state.containerRef}>
      {mode === 'buttons' && state.overflowing && <Button size="icon" variant="ghost" className="inkra-tabs__scroll-button" aria-label={scrollPreviousLabel} title={scrollPreviousLabel} disabled={!state.previous} onClick={() => state.scroll(-1)}>{directionIcon(true)}</Button>}
      {list}
      {mode === 'buttons' && state.overflowing && <Button size="icon" variant="ghost" className="inkra-tabs__scroll-button" aria-label={scrollNextLabel} title={scrollNextLabel} disabled={!state.next} onClick={() => state.scroll(1)}>{directionIcon(false)}</Button>}
      {mode === 'menu' && state.overflowing && <DropdownMenu.Root dir={state.rtl ? 'rtl' : 'ltr'}>
        <DropdownMenu.Trigger asChild><Button ref={state.moreRef} size="icon" variant="ghost" className="inkra-tabs__more" aria-label={moreLabel} title={moreLabel}>
          <OverflowIcon down />
        </Button></DropdownMenu.Trigger>
        <DropdownMenu.Portal><DropdownMenu.Content align="end" aria-label={moreLabel} onCloseAutoFocus={event => {
          if (!selectionPending.current) return;
          selectionPending.current = false;
          const selected = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[data-tabs-value]') ?? [])
            .find(node => node.dataset.tabsValue === current && !node.hasAttribute('data-overflow-hidden') && !node.disabled);
          if (selected) { event.preventDefault(); selected.focus({ preventScroll: true }); }
        }}>
          <DropdownMenu.RadioGroup value={current ?? ''} onValueChange={next => { selectionPending.current = true; change(next); }}>
            {state.items.map(item => <DropdownMenu.RadioItem key={item.value} value={item.value} disabled={item.disabled}>{item.label}</DropdownMenu.RadioItem>)}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content></DropdownMenu.Portal>
      </DropdownMenu.Root>}
    </div>}
  </HiddenContext.Provider></DividedContext.Provider>;
});

const Trigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(function TabsTrigger({ value, className, children, startIcon, endIcon, overflowLabel, ...props }, ref) {
  const current = useContext(ValueContext);
  const divided = useContext(DividedContext);
  const orientation = useContext(OrientationContext);
  const hidden = useContext(HiddenContext).has(value);
  const surface = useRef<HTMLSpanElement>(null);
  useSelectionDrawing(surface, current === value, useContext(AnimatedContext));
  return <Primitive.Trigger {...props} value={value} ref={ref} data-tabs-value={value} data-overflow-label={overflowLabel} data-overflow-hidden={hidden || undefined} aria-hidden={hidden || props['aria-hidden']} inert={hidden || undefined} className={['inkra-tabs__trigger', className].filter(Boolean).join(' ')}>
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
