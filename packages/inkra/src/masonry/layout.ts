export type MasonryStrategy = 'shortest' | 'sequential';
export type MasonryDirection = 'ltr' | 'rtl';

export interface MasonryLayoutItem {
  key: string;
  height: number;
}

export interface MasonryLayoutOptions {
  containerWidth: number;
  items: readonly MasonryLayoutItem[];
  columns?: number;
  minColumnWidth?: number;
  maxColumns?: number;
  columnGap?: number;
  rowGap?: number;
  strategy?: MasonryStrategy;
  direction?: MasonryDirection;
}

export interface MasonryLayoutPosition {
  key: string;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MasonryLayoutResult {
  columnCount: number;
  columnWidth: number;
  height: number;
  positions: readonly MasonryLayoutPosition[];
}

const DEFAULT_MIN_COLUMN_WIDTH = 240;
const MAX_COLUMN_COUNT = 100;

export function normalizeMasonrySpacing(value: number | undefined, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, value!) : fallback;
}

export function normalizeMasonryColumnCount(value: number | undefined, fallback = 1): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_COLUMN_COUNT, Math.max(1, Math.floor(value!)));
}

export function resolveMasonryColumnCount({
  columns,
  containerWidth,
  columnGap = 0,
  maxColumns,
  minColumnWidth = DEFAULT_MIN_COLUMN_WIDTH,
}: Pick<MasonryLayoutOptions, 'columns' | 'containerWidth' | 'columnGap' | 'maxColumns' | 'minColumnWidth'>): number {
  if (columns !== undefined) return normalizeMasonryColumnCount(columns);
  const width = Number.isFinite(containerWidth) ? Math.max(0, containerWidth) : 0;
  const gap = normalizeMasonrySpacing(columnGap);
  const minimum = Number.isFinite(minColumnWidth) && minColumnWidth! > 0
    ? minColumnWidth!
    : DEFAULT_MIN_COLUMN_WIDTH;
  const available = Math.max(0, width + gap);
  const adaptive = Math.max(1, Math.floor(available / (minimum + gap)));
  return Math.min(adaptive, normalizeMasonryColumnCount(maxColumns, MAX_COLUMN_COUNT));
}

export function calculateMasonryLayout(options: MasonryLayoutOptions): MasonryLayoutResult {
  const containerWidth = Number.isFinite(options.containerWidth)
    ? Math.max(0, options.containerWidth)
    : 0;
  const columnGap = normalizeMasonrySpacing(options.columnGap);
  const rowGap = normalizeMasonrySpacing(options.rowGap);
  const requestedColumnCount = resolveMasonryColumnCount({
    columns: options.columns,
    containerWidth,
    columnGap,
    maxColumns: options.maxColumns,
    minColumnWidth: options.minColumnWidth,
  });
  const columnCount = options.columns === undefined && options.items.length > 0
    ? Math.min(requestedColumnCount, options.items.length)
    : requestedColumnCount;
  const effectiveColumnGap = columnCount > 1
    ? Math.min(columnGap, containerWidth / (columnCount - 1))
    : 0;
  const columnWidth = Math.max(0, (containerWidth - effectiveColumnGap * (columnCount - 1)) / columnCount);
  const columnHeights = Array.from({ length: columnCount }, () => 0);
  const strategy = options.strategy ?? 'shortest';
  const direction = options.direction ?? 'ltr';

  const positions = options.items.map((item, index): MasonryLayoutPosition => {
    let column = strategy === 'shortest' ? 0 : index % columnCount;
    if (strategy === 'shortest') {
      for (let candidate = 1; candidate < columnCount; candidate += 1) {
        if (columnHeights[candidate] < columnHeights[column]) column = candidate;
      }
    }
    const height = Number.isFinite(item.height) ? Math.max(0, item.height) : 0;
    const y = columnHeights[column] === 0 ? 0 : columnHeights[column] + rowGap;
    const logicalX = column * (columnWidth + effectiveColumnGap);
    const x = direction === 'rtl' ? containerWidth - columnWidth - logicalX : logicalX;
    columnHeights[column] = y + height;
    return { key: item.key, column, x, y, width: columnWidth, height };
  });

  return {
    columnCount,
    columnWidth,
    height: Math.max(0, ...columnHeights),
    positions,
  };
}
