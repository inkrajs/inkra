import { useVirtualizer, type ScrollToOptions } from '@tanstack/react-virtual';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ForwardedRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react';

import { PencilSurface } from '../PencilSurface.js';
import { PencilLine } from '../PencilLine.js';
import {
  clampVirtualListIndex,
  getVirtualListSsrIndexes,
  normalizeVirtualListOverscan,
  normalizeVirtualListSize,
  normalizeVirtualListSpacing,
  virtualListKeyAttribute,
  type VirtualListKey,
} from './model.js';

export type VirtualListScrollAlignment = 'start' | 'center' | 'end' | 'auto';
export type VirtualListScrollBehavior = 'auto' | 'smooth' | 'instant';

export interface VirtualListScrollOptions {
  align?: VirtualListScrollAlignment;
  behavior?: VirtualListScrollBehavior;
}

export interface VirtualListItemState<Item> {
  item: Item;
  index: number;
  key: VirtualListKey;
  isScrolling: boolean;
}

export type VirtualListItemProps = Omit<HTMLAttributes<HTMLLIElement>, 'children' | 'style'>;

export interface VirtualListHandle {
  scrollToIndex: (index: number, options?: VirtualListScrollOptions) => void;
  scrollToOffset: (offset: number, options?: VirtualListScrollOptions) => void;
  measure: () => void;
  getScrollElement: () => HTMLElement | null;
}

export interface VirtualListProps<Item> extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  items: readonly Item[];
  itemKey: (item: Item, index: number) => VirtualListKey;
  estimateSize: number | ((item: Item, index: number) => number);
  renderItem: (state: VirtualListItemState<Item>) => ReactNode;
  getItemProps?: (state: VirtualListItemState<Item>) => VirtualListItemProps;
  measureItems?: boolean;
  overscan?: number;
  gap?: number;
  paddingStart?: number;
  paddingEnd?: number;
  scrollMargin?: number;
  initialOffset?: number;
  height?: CSSProperties['blockSize'];
  getScrollElement?: () => HTMLElement | null;
  ssrItemCount?: number;
  empty?: ReactNode;
  emptyLabel?: string;
  listLabel?: string;
  listRole?: HTMLAttributes<HTMLUListElement>['role'];
}

interface PendingIndexScroll {
  index: number;
  options?: VirtualListScrollOptions;
}

function classes(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(' ');
}

function toEngineScrollOptions(options: VirtualListScrollOptions | undefined) {
  return options as ScrollToOptions | undefined;
}

function VirtualListInner<Item>(
  {
    'aria-label': ariaLabel,
    className,
    empty,
    emptyLabel = 'No items',
    estimateSize,
    gap,
    getItemProps,
    getScrollElement,
    height,
    initialOffset = 0,
    itemKey,
    items,
    listLabel,
    listRole = 'list',
    measureItems = false,
    onKeyDown,
    overscan,
    paddingEnd,
    paddingStart,
    renderItem,
    role: roleProp,
    scrollMargin,
    ssrItemCount,
    style,
    tabIndex,
    ...props
  }: VirtualListProps<Item>,
  forwardedRef: ForwardedRef<VirtualListHandle>,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [hydrated, setHydrated] = useState(false);
  const pendingIndexScrollRef = useRef<PendingIndexScroll | null>(null);
  const externalScroll = getScrollElement !== undefined;
  const role = roleProp ?? (ariaLabel ? 'region' : undefined);
  const safeScrollMargin = normalizeVirtualListSpacing(scrollMargin);
  const safeGap = normalizeVirtualListSpacing(gap);
  const safePaddingStart = normalizeVirtualListSpacing(paddingStart);
  const safePaddingEnd = normalizeVirtualListSpacing(paddingEnd);

  useEffect(() => setHydrated(true), []);

  const resolveScrollElement = useCallback(
    () => getScrollElement?.() ?? rootRef.current,
    [getScrollElement],
  );
  const resolveItemKey = useCallback(
    (index: number) => itemKey(itemsRef.current[index], index),
    [itemKey],
  );
  const resolveEstimateSize = useCallback((index: number) => {
    const item = itemsRef.current[index];
    const value = typeof estimateSize === 'function' ? estimateSize(item, index) : estimateSize;
    return normalizeVirtualListSize(value);
  }, [estimateSize]);

  const virtualizer = useVirtualizer<HTMLElement, HTMLLIElement>({
    count: items.length,
    enabled: hydrated && items.length > 0,
    estimateSize: resolveEstimateSize,
    gap: safeGap,
    getItemKey: resolveItemKey,
    getScrollElement: resolveScrollElement,
    initialOffset,
    overscan: normalizeVirtualListOverscan(overscan),
    paddingEnd: safePaddingEnd,
    paddingStart: safePaddingStart,
    scrollMargin: safeScrollMargin,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const virtualized = hydrated && virtualRows.length > 0;

  useEffect(() => {
    if (hydrated) virtualizer.measure();
  }, [hydrated, measureItems, virtualizer]);

  useEffect(() => {
    const pending = pendingIndexScrollRef.current;
    if (!virtualized || !pending) return;
    pendingIndexScrollRef.current = null;
    virtualizer.scrollToIndex(pending.index, toEngineScrollOptions(pending.options));
  }, [virtualized, virtualizer]);

  useImperativeHandle(forwardedRef, () => ({
    getScrollElement: resolveScrollElement,
    measure: () => virtualizer.measure(),
    scrollToIndex: (requestedIndex, options) => {
      const index = clampVirtualListIndex(requestedIndex, itemsRef.current.length);
      if (index === null) return;
      if (!virtualized) {
        pendingIndexScrollRef.current = { index, options };
        return;
      }
      virtualizer.scrollToIndex(index, toEngineScrollOptions(options));
    },
    scrollToOffset: (offset, options) => {
      if (!Number.isFinite(offset)) return;
      virtualizer.scrollToOffset(Math.max(0, offset), toEngineScrollOptions(options));
    },
  }), [resolveScrollElement, virtualized, virtualizer]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || externalScroll || event.target !== event.currentTarget || items.length === 0) return;
    if (event.key === 'Home') {
      event.preventDefault();
      virtualizer.scrollToIndex(0, { align: 'start' });
    } else if (event.key === 'End') {
      event.preventDefault();
      virtualizer.scrollToIndex(items.length - 1, { align: 'end' });
    }
  }

  const fallbackIndexes = getVirtualListSsrIndexes(items.length, ssrItemCount);
  const renderedRows = virtualized
    ? virtualRows.map(row => ({ index: row.index, key: row.key as VirtualListKey, start: row.start }))
    : fallbackIndexes.map(index => ({ index, key: itemKey(items[index], index), start: null }));
  const rootStyle = externalScroll ? style : { blockSize: height, ...style };

  const content = <>
    <ul
      aria-label={listLabel}
      className="inkra-virtual-list__items"
      role={listRole}
      style={virtualized ? { blockSize: `${virtualizer.getTotalSize()}px` } : undefined}
    >
      {renderedRows.map(row => {
        const item = items[row.index];
        const state: VirtualListItemState<Item> = {
          item,
          index: row.index,
          key: row.key,
          isScrolling: virtualized && virtualizer.isScrolling,
        };
        const itemProps = getItemProps?.(state) ?? {};
        const { className: itemClassName, role: itemRole, ...nativeItemProps } = itemProps;
        return <li
          {...nativeItemProps}
          aria-posinset={row.index + 1}
          aria-setsize={items.length}
          className={classes('inkra-virtual-list__item', itemClassName)}
          data-index={row.index}
          data-item-key={virtualListKeyAttribute(row.key)}
          key={row.key}
          ref={virtualized && measureItems ? virtualizer.measureElement : undefined}
          role={itemRole ?? 'listitem'}
          style={row.start === null ? undefined : {
            transform: `translateY(${row.start - safeScrollMargin}px)`,
          }}
        >
          {row.index > 0 && <PencilLine
            className="inkra-virtual-list__separator"
            seed={`virtual-list-separator-${virtualListKeyAttribute(row.key)}`}
            weight={0.75}
          />}
          {renderItem(state)}
        </li>;
      })}
    </ul>
    {items.length === 0 && <div className="inkra-virtual-list__empty" role="status">
      {empty ?? emptyLabel}
    </div>}
  </>;
  const rootProps = {
    ...props,
    'aria-label': ariaLabel,
    className: classes('inkra-virtual-list', className),
    'data-external-scroll': externalScroll || undefined,
    'data-virtualized': virtualized || undefined,
    onKeyDown: handleKeyDown,
    role,
    style: rootStyle,
    tabIndex: externalScroll ? tabIndex : (tabIndex ?? 0),
  };

  return externalScroll
    ? <div {...rootProps} ref={rootRef}>{content}</div>
    : <PencilSurface {...rootProps} as="div" radius={8} ref={rootRef} seed="virtual-list" variant="paper">
      {content}
    </PencilSurface>;
}

export const VirtualList = forwardRef(VirtualListInner) as <Item>(
  props: VirtualListProps<Item> & RefAttributes<VirtualListHandle>,
) => ReactElement | null;

export type { VirtualListKey } from './model.js';
