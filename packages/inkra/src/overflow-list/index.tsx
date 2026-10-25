import { useInkraLocale } from '../i18n/index.js';
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  ForwardedRef,
  HTMLAttributes,
  ReactElement,
  ReactNode,
  RefAttributes,
} from 'react';

import { Button } from '../Button.js';
import type { ButtonProps } from '../Button.js';
import { DropdownMenu } from '../dropdown-menu/index.js';
import { PencilIcon } from '../PencilIcon.js';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import { calculateOverflowListLayout } from './layout.js';
import type { OverflowListStrategy } from './layout.js';

const ellipsisPaths = [{ d: 'M5 12h.01M12 12h.01M19 12h.01' }] as const;

export type { OverflowListStrategy } from './layout.js';

export interface OverflowListItem {
  id: string | number;
  label: ReactNode;
  disabled?: boolean;
  priority?: number;
  measureKey?: string | number;
}

export interface OverflowListRenderContext {
  id: string | number;
  index: number;
}

export interface OverflowListOverflowContext<Item extends OverflowListItem> {
  count: number;
  items: readonly Item[];
}

export interface OverflowListChange<Item extends OverflowListItem> {
  visibleItems: readonly Item[];
  overflowItems: readonly Item[];
}

type OverflowButtonProps = Omit<ButtonProps, 'aria-label' | 'children' | 'ref'>;

export interface OverflowListProps<Item extends OverflowListItem = OverflowListItem>
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'> {
  items: readonly Item[];
  strategy?: OverflowListStrategy;
  measurementKey?: string | number;
  gap?: CSSProperties['gap'];
  renderItem?: (item: Item, context: OverflowListRenderContext) => ReactNode;
  renderOverflowItem?: (item: Item, context: OverflowListRenderContext) => ReactNode;
  renderOverflow?: (context: OverflowListOverflowContext<Item>) => ReactNode;
  getOverflowItemIcon?: (item: Item, context: OverflowListRenderContext) => ReactNode;
  overflowLabel?: string | ((count: number) => string);
  overflowButtonProps?: OverflowButtonProps;
  onOverflowItemSelect?: (item: Item, event: Event) => void;
  onOverflowChange?: (change: OverflowListChange<Item>) => void;
}

interface LayoutState {
  signature: string;
  visibleKeys: ReadonlySet<string>;
  needsOverflow: boolean;
  measuring: boolean;
}

type OverflowListStyle = CSSProperties & { '--inkra-overflow-list-gap'?: string };

function itemKey(id: string | number): string {
  return `${typeof id}:${String(id)}`;
}

function finitePriority(value: number | undefined): number {
  if (value === Number.POSITIVE_INFINITY) return Number.MAX_SAFE_INTEGER;
  if (value === Number.NEGATIVE_INFINITY) return Number.MIN_SAFE_INTEGER;
  return Number.isFinite(value) ? value! : 0;
}

function sameKeys(current: ReadonlySet<string>, next: readonly string[]): boolean {
  if (current.size !== next.length) return false;
  return next.every(key => current.has(key));
}

function assignRef<Element>(ref: ForwardedRef<Element>, value: Element | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

function OverflowListInner<Item extends OverflowListItem>(
  {
    'aria-label': ariaLabel,
    className,
    gap,
    getOverflowItemIcon,
    items,
    measurementKey = '',
    onOverflowChange,
    onOverflowItemSelect,
    overflowButtonProps,
    overflowLabel: overflowLabelProp,
    renderItem,
    renderOverflow,
    renderOverflowItem,
    role,
    strategy = 'end',
    style,
    ...props
  }: OverflowListProps<Item>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  const { t } = useInkraLocale();
  const overflowLabel = overflowLabelProp ?? ((count: number) => t('overflow.more', { count }));
  const generatedId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const widthCache = useRef(new Map<string, number>());
  const frameRef = useRef<number | null>(null);
  const focusOverflowRef = useRef(false);
  const lastChangeRef = useRef('');
  const onOverflowChangeRef = useRef(onOverflowChange);
  onOverflowChangeRef.current = onOverflowChange;

  const entries = useMemo(() => {
    const nextEntries = items.map((item, index) => ({
      item,
      index,
      key: itemKey(item.id),
      priority: finitePriority(item.priority),
    }));
    const duplicateCheck = new Set<string>();
    for (const entry of nextEntries) {
      if (duplicateCheck.has(entry.key)) {
        throw new Error(`OverflowList item ids must be unique. Received duplicate id: ${String(entry.item.id)}`);
      }
      duplicateCheck.add(entry.key);
    }
    return nextEntries;
  }, [items]);

  const signature = useMemo(() => JSON.stringify([
    measurementKey,
    strategy,
    entries.map(entry => [entry.key, entry.item.measureKey ?? entry.key, entry.priority]),
  ]), [entries, measurementKey, strategy]);
  const allKeys = useMemo(() => entries.map(entry => entry.key), [entries]);
  const [layout, setLayout] = useState<LayoutState>(() => ({
    signature,
    visibleKeys: new Set(allKeys),
    needsOverflow: false,
    measuring: true,
  }));
  const effectiveLayout = layout.signature === signature
    ? layout
    : { signature, visibleKeys: new Set(allKeys), needsOverflow: false, measuring: true };
  const visibleEntries = useMemo(() => effectiveLayout.measuring
    ? entries
    : entries.filter(entry => effectiveLayout.visibleKeys.has(entry.key)), [effectiveLayout.measuring, effectiveLayout.visibleKeys, entries]);
  const overflowEntries = useMemo(() => effectiveLayout.measuring
    ? []
    : entries.filter(entry => !effectiveLayout.visibleKeys.has(entry.key)), [effectiveLayout.measuring, effectiveLayout.visibleKeys, entries]);

  const setRootRef = useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node;
    assignRef(forwardedRef, node);
  }, [forwardedRef]);

  const setItemRef = useCallback((key: string, node: HTMLDivElement | null) => {
    if (node) itemRefs.current.set(key, node);
    else itemRefs.current.delete(key);
  }, []);

  const updateLayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const containerWidth = root.getBoundingClientRect().width;
    if (containerWidth <= 0) return;
    const computedGap = Number.parseFloat(getComputedStyle(root).columnGap) || 0;

    for (const entry of entries) {
      const node = itemRefs.current.get(entry.key);
      if (!node) continue;
      const width = node.getBoundingClientRect().width;
      if (width > 0) widthCache.current.set(entry.key, width);
    }
    if (entries.some(entry => !widthCache.current.has(entry.key))) return;

    const triggerWidth = triggerRef.current?.getBoundingClientRect().width;
    const result = calculateOverflowListLayout({
      containerWidth,
      gap: computedGap,
      items: entries.map(entry => ({
        key: entry.key,
        priority: entry.priority,
        width: widthCache.current.get(entry.key) ?? 0,
      })),
      strategy,
      triggerWidth,
    });

    if (result.needsTriggerMeasurement) {
      setLayout(current => current.signature === signature
        && current.needsOverflow
        && current.measuring
        && sameKeys(current.visibleKeys, allKeys)
        ? current
        : { signature, visibleKeys: new Set(allKeys), needsOverflow: true, measuring: true });
      return;
    }

    const activeElement = typeof document === 'undefined' ? null : document.activeElement;
    if (activeElement && result.overflowKeys.some(key => itemRefs.current.get(key)?.contains(activeElement))) {
      focusOverflowRef.current = true;
    }

    setLayout(current => current.signature === signature
      && !current.measuring
      && current.needsOverflow === (result.overflowKeys.length > 0)
      && sameKeys(current.visibleKeys, result.visibleKeys)
      ? current
      : {
        signature,
        visibleKeys: new Set(result.visibleKeys),
        needsOverflow: result.overflowKeys.length > 0,
        measuring: false,
      });
  }, [allKeys, entries, signature, strategy]);

  const scheduleLayout = useCallback(() => {
    if (frameRef.current !== null || typeof window === 'undefined') return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      updateLayout();
    });
  }, [updateLayout]);

  useBrowserLayoutEffect(() => {
    if (layout.signature === signature) return;
    widthCache.current.clear();
    setLayout({ signature, visibleKeys: new Set(allKeys), needsOverflow: false, measuring: true });
  }, [allKeys, layout.signature, signature]);

  // Keep observer targets in sync when a resize reveals or hides items without
  // changing whether an overflow trigger is needed. Memoized visibleEntries
  // leaves the observer intact during unrelated parent updates.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleLayout);
    observer?.observe(root);
    itemRefs.current.forEach(node => observer?.observe(node));
    if (triggerRef.current) observer?.observe(triggerRef.current);
    if (!observer) window.addEventListener('resize', scheduleLayout);
    scheduleLayout();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', scheduleLayout);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [effectiveLayout.measuring, effectiveLayout.needsOverflow, scheduleLayout, signature, visibleEntries]);

  useEffect(() => {
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    if (!fonts?.addEventListener) return undefined;
    const remeasure = () => {
      widthCache.current.clear();
      setLayout({ signature, visibleKeys: new Set(allKeys), needsOverflow: effectiveLayout.needsOverflow, measuring: true });
    };
    fonts.addEventListener('loadingdone', remeasure);
    return () => fonts.removeEventListener('loadingdone', remeasure);
  }, [allKeys, effectiveLayout.needsOverflow, signature]);

  useBrowserLayoutEffect(() => {
    if (!focusOverflowRef.current || !effectiveLayout.needsOverflow || effectiveLayout.measuring) return;
    focusOverflowRef.current = false;
    triggerRef.current?.focus();
  }, [effectiveLayout.measuring, effectiveLayout.needsOverflow, effectiveLayout.visibleKeys]);

  useEffect(() => {
    if (effectiveLayout.measuring) return;
    const changeKey = JSON.stringify([signature, visibleEntries.map(entry => entry.key)]);
    if (lastChangeRef.current === changeKey) return;
    lastChangeRef.current = changeKey;
    onOverflowChangeRef.current?.({
      visibleItems: visibleEntries.map(entry => entry.item),
      overflowItems: overflowEntries.map(entry => entry.item),
    });
  }, [effectiveLayout.measuring, overflowEntries, signature, visibleEntries]);

  const resolvedLabel = typeof overflowLabel === 'function'
    ? overflowLabel(overflowEntries.length)
    : overflowLabel;
  const overflowContext = useMemo<OverflowListOverflowContext<Item>>(() => ({
    count: overflowEntries.length,
    items: overflowEntries.map(entry => entry.item),
  }), [overflowEntries]);
  const {
    className: overflowButtonClassName,
    size: overflowButtonSize,
    title: overflowButtonTitle,
    variant: overflowButtonVariant,
    ...overflowButtonRest
  } = overflowButtonProps ?? {};
  const resolvedStyle: OverflowListStyle = {
    ...style,
    ...(gap !== undefined ? { '--inkra-overflow-list-gap': typeof gap === 'number' ? `${gap}px` : String(gap) } : {}),
  };

  return <div
    {...props}
    aria-label={ariaLabel}
    className={['inkra-overflow-list', className].filter(Boolean).join(' ')}
    data-measuring={effectiveLayout.measuring || undefined}
    ref={setRootRef}
    role={role}
    style={resolvedStyle}
  >
    {visibleEntries.map(({ item, index, key }) => <div
      className="inkra-overflow-list__item"
      data-overflow-list-item={String(item.id)}
      key={key}
      ref={node => setItemRef(key, node)}
    >
      {renderItem
        ? renderItem(item, { id: item.id, index })
        : <span className="inkra-overflow-list__default-item">{item.label}</span>}
    </div>)}
    {effectiveLayout.needsOverflow ? <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          {...overflowButtonRest}
          aria-label={resolvedLabel}
          className={['inkra-overflow-list__trigger', overflowButtonClassName].filter(Boolean).join(' ')}
          ref={triggerRef}
          size={overflowButtonSize ?? (renderOverflow ? 'sm' : 'icon-sm')}
          title={overflowButtonTitle ?? resolvedLabel}
          variant={overflowButtonVariant ?? 'outline'}
        >
          {renderOverflow
            ? renderOverflow(overflowContext)
            : <PencilIcon paths={ellipsisPaths} seed={`${generatedId}-overflow`} size={16} sourceSize={24} />}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" aria-label={resolvedLabel}>
          {overflowEntries.map(({ item, index, key }) => <DropdownMenu.Item
            disabled={item.disabled}
            icon={getOverflowItemIcon?.(item, { id: item.id, index })}
            key={key}
            onSelect={event => onOverflowItemSelect?.(item, event)}
          >
            {renderOverflowItem
              ? renderOverflowItem(item, { id: item.id, index })
              : item.label}
          </DropdownMenu.Item>)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root> : null}
  </div>;
}

export const OverflowList = forwardRef(OverflowListInner) as <Item extends OverflowListItem = OverflowListItem>(
  props: OverflowListProps<Item> & RefAttributes<HTMLDivElement>,
) => ReactElement;
