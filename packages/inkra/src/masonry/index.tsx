import {
  forwardRef,
  useCallback,
  useEffect,
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

import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import {
  calculateMasonryLayout,
  normalizeMasonryColumnCount,
  normalizeMasonrySpacing,
  type MasonryDirection,
  type MasonryLayoutPosition,
  type MasonryStrategy,
} from './layout.js';

export type MasonryKey = string | number | bigint;

export interface MasonryRenderState<Item> {
  item: Item;
  index: number;
  key: MasonryKey;
}

export type MasonryItemProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'style'>;

export interface MasonryProps<Item> extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  items: readonly Item[];
  getItemKey: (item: Item, index: number) => MasonryKey;
  renderItem: (state: MasonryRenderState<Item>) => ReactNode;
  getItemProps?: (state: MasonryRenderState<Item>) => MasonryItemProps;
  columns?: number | 'auto';
  minColumnWidth?: number;
  maxColumns?: number;
  columnGap?: number;
  rowGap?: number;
  strategy?: MasonryStrategy;
  dir?: MasonryDirection;
  animated?: boolean;
}

interface MasonryEntry<Item> extends MasonryRenderState<Item> {
  internalKey: string;
}

interface MasonryLayoutState {
  signature: string;
  columnCount: number;
  height: number;
  positions: ReadonlyMap<string, MasonryLayoutPosition>;
  ready: boolean;
}

type MasonryRootStyle = CSSProperties & {
  '--inkra-masonry-column-gap'?: string;
  '--inkra-masonry-columns'?: number;
  '--inkra-masonry-min-column-width'?: string;
  '--inkra-masonry-row-gap'?: string;
};

function classes(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(' ');
}

function internalItemKey(key: MasonryKey): string {
  return `${typeof key}:${String(key)}`;
}

function assignRef<Element>(ref: ForwardedRef<Element>, value: Element | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

function cssPixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function samePositions(
  current: ReadonlyMap<string, MasonryLayoutPosition>,
  next: readonly MasonryLayoutPosition[],
): boolean {
  if (current.size !== next.length) return false;
  return next.every(position => {
    const existing = current.get(position.key);
    return existing !== undefined
      && existing.column === position.column
      && Math.abs(existing.x - position.x) < 0.25
      && Math.abs(existing.y - position.y) < 0.25
      && Math.abs(existing.width - position.width) < 0.25
      && Math.abs(existing.height - position.height) < 0.25;
  });
}

function emptyLayout(signature: string): MasonryLayoutState {
  return { signature, columnCount: 1, height: 0, positions: new Map(), ready: false };
}

function MasonryInner<Item>(
  {
    animated = true,
    className,
    columnGap = 16,
    columns = 'auto',
    dir,
    getItemKey,
    getItemProps,
    items,
    maxColumns,
    minColumnWidth = 240,
    renderItem,
    role,
    rowGap = 16,
    strategy = 'shortest',
    style,
    ...props
  }: MasonryProps<Item>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const frameRef = useRef<number | null>(null);
  const safeColumnGap = normalizeMasonrySpacing(columnGap, 16);
  const safeRowGap = normalizeMasonrySpacing(rowGap, 16);
  const safeMinColumnWidth = Number.isFinite(minColumnWidth) && minColumnWidth > 0
    ? minColumnWidth
    : 240;
  const safeMaxColumns = maxColumns === undefined
    ? undefined
    : Number.isFinite(maxColumns)
      ? normalizeMasonryColumnCount(maxColumns)
      : undefined;
  const fixedColumns = columns === 'auto' ? undefined : normalizeMasonryColumnCount(columns);

  const entries = useMemo(() => {
    const next = items.map((item, index): MasonryEntry<Item> => {
      const key = getItemKey(item, index);
      return { item, index, key, internalKey: internalItemKey(key) };
    });
    const keys = new Set<string>();
    for (const entry of next) {
      if (keys.has(entry.internalKey)) {
        throw new Error(`Masonry item keys must be unique. Received duplicate key: ${String(entry.key)}`);
      }
      keys.add(entry.internalKey);
    }
    return next;
  }, [getItemKey, items]);

  const signature = useMemo(() => JSON.stringify([
    fixedColumns ?? 'auto',
    safeMinColumnWidth,
    safeMaxColumns ?? null,
    safeColumnGap,
    safeRowGap,
    strategy,
    dir ?? null,
  ]), [
    dir,
    fixedColumns,
    safeColumnGap,
    safeMaxColumns,
    safeMinColumnWidth,
    safeRowGap,
    strategy,
  ]);
  const [layout, setLayout] = useState<MasonryLayoutState>(() => emptyLayout(signature));
  const effectiveLayout = layout.signature === signature ? layout : emptyLayout(signature);
  const ready = effectiveLayout.ready && entries.every(entry => effectiveLayout.positions.has(entry.internalKey));

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
    const rootStyle = getComputedStyle(root);
    const paddingLeft = cssPixels(rootStyle.paddingLeft);
    const paddingRight = cssPixels(rootStyle.paddingRight);
    const paddingTop = cssPixels(rootStyle.paddingTop);
    const paddingBottom = cssPixels(rootStyle.paddingBottom);
    const borderTop = cssPixels(rootStyle.borderTopWidth);
    const borderBottom = cssPixels(rootStyle.borderBottomWidth);
    const containerWidth = root.clientWidth - paddingLeft - paddingRight;
    if (!Number.isFinite(containerWidth) || containerWidth <= 0) return;

    const measuredItems = [];
    for (const entry of entries) {
      const node = itemRefs.current.get(entry.internalKey);
      if (!node) return;
      measuredItems.push({
        key: entry.internalKey,
        height: node.offsetHeight,
      });
    }
    const resolvedDirection = dir
      ?? (rootStyle.direction === 'rtl' ? 'rtl' : 'ltr');
    const next = calculateMasonryLayout({
      containerWidth,
      items: measuredItems,
      columns: fixedColumns,
      minColumnWidth: safeMinColumnWidth,
      maxColumns: safeMaxColumns,
      columnGap: safeColumnGap,
      rowGap: safeRowGap,
      strategy,
      direction: resolvedDirection,
    });
    const positions = next.positions.map(position => ({
      ...position,
      x: position.x + paddingLeft,
      y: position.y + paddingTop,
    }));
    const contentBlockSize = next.height;
    const blockSize = rootStyle.boxSizing === 'border-box'
      ? borderTop + paddingTop + contentBlockSize + paddingBottom + borderBottom
      : contentBlockSize;

    setLayout(current => current.signature === signature
      && current.ready
      && current.columnCount === next.columnCount
      && Math.abs(current.height - blockSize) < 0.25
      && samePositions(current.positions, positions)
      ? current
      : {
        signature,
        columnCount: next.columnCount,
        height: blockSize,
        positions: new Map(positions.map(position => [position.key, position])),
        ready: true,
      });
  }, [
    dir,
    entries,
    fixedColumns,
    safeColumnGap,
    safeMaxColumns,
    safeMinColumnWidth,
    safeRowGap,
    signature,
    strategy,
  ]);

  const scheduleLayout = useCallback(() => {
    if (frameRef.current !== null || typeof window === 'undefined') return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      updateLayout();
    });
  }, [updateLayout]);

  useBrowserLayoutEffect(() => {
    if (layout.signature === signature) return;
    setLayout(emptyLayout(signature));
  }, [layout.signature, signature]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleLayout);
    observer?.observe(root);
    itemRefs.current.forEach(node => observer?.observe(node));
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
  }, [entries, scheduleLayout, signature]);

  useEffect(() => {
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    if (!fonts?.addEventListener) return undefined;
    fonts.addEventListener('loadingdone', scheduleLayout);
    return () => fonts.removeEventListener('loadingdone', scheduleLayout);
  }, [scheduleLayout]);

  const rootStyle: MasonryRootStyle = {
    ...style,
    '--inkra-masonry-column-gap': `${safeColumnGap}px`,
    '--inkra-masonry-columns': fixedColumns ?? 1,
    '--inkra-masonry-min-column-width': `${safeMinColumnWidth}px`,
    '--inkra-masonry-row-gap': `${safeRowGap}px`,
    blockSize: ready ? `${effectiveLayout.height}px` : style?.blockSize,
  };

  return <div
    {...props}
    className={classes('inkra-masonry', className)}
    data-animated={animated || undefined}
    data-columns={ready ? effectiveLayout.columnCount : undefined}
    data-layout={ready ? 'ready' : 'fallback'}
    data-mode={fixedColumns === undefined ? 'adaptive' : 'fixed'}
    data-strategy={strategy}
    dir={dir}
    ref={setRootRef}
    role={role}
    style={rootStyle}
  >
    {entries.map(entry => {
      const state: MasonryRenderState<Item> = entry;
      const itemProps = getItemProps?.(state) ?? {};
      const { className: itemClassName, role: itemRole, ...nativeItemProps } = itemProps;
      const position = ready ? effectiveLayout.positions.get(entry.internalKey) : undefined;
      return <div
        {...nativeItemProps}
        aria-posinset={role === 'list' ? entry.index + 1 : undefined}
        aria-setsize={role === 'list' ? entries.length : undefined}
        className={classes('inkra-masonry__item', itemClassName)}
        data-column={position?.column}
        data-index={entry.index}
        data-masonry-key={String(entry.key)}
        data-positioned={position ? '' : undefined}
        key={entry.internalKey}
        ref={node => setItemRef(entry.internalKey, node)}
        role={itemRole ?? (role === 'list' ? 'listitem' : undefined)}
        style={position ? {
          inlineSize: `${position.width}px`,
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        } : undefined}
      >
        {renderItem(state)}
      </div>;
    })}
  </div>;
}

export const Masonry = forwardRef(MasonryInner) as <Item>(
  props: MasonryProps<Item> & RefAttributes<HTMLDivElement>,
) => ReactElement | null;

export type { MasonryDirection, MasonryStrategy } from './layout.js';
