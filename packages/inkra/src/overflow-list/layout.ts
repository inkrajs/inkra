export type OverflowListStrategy = 'end' | 'start' | 'priority';

export interface OverflowListLayoutItem {
  key: string;
  priority: number;
  width: number;
}

export interface OverflowListLayoutInput {
  items: readonly OverflowListLayoutItem[];
  containerWidth: number;
  gap: number;
  strategy: OverflowListStrategy;
  triggerWidth?: number;
}

export interface OverflowListLayoutResult {
  visibleKeys: string[];
  overflowKeys: string[];
  needsTriggerMeasurement: boolean;
}

const finiteSize = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;

function itemsWidth(items: readonly OverflowListLayoutItem[], gap: number): number {
  if (items.length === 0) return 0;
  return items.reduce((total, item) => total + finiteSize(item.width), 0)
    + finiteSize(gap) * (items.length - 1);
}

function candidateOrder(items: readonly OverflowListLayoutItem[], strategy: OverflowListStrategy) {
  const indexed = items.map((item, index) => ({ item, index }));
  if (strategy === 'start') return indexed.reverse();
  if (strategy === 'priority') {
    return indexed.sort((left, right) => right.item.priority - left.item.priority || left.index - right.index);
  }
  return indexed;
}

export function calculateOverflowListLayout({
  containerWidth,
  gap,
  items,
  strategy,
  triggerWidth,
}: OverflowListLayoutInput): OverflowListLayoutResult {
  const availableWidth = finiteSize(containerWidth);
  const resolvedGap = finiteSize(gap);
  const allKeys = items.map(item => item.key);

  if (itemsWidth(items, resolvedGap) <= availableWidth + 0.5) {
    return { visibleKeys: allKeys, overflowKeys: [], needsTriggerMeasurement: false };
  }

  if (triggerWidth === undefined || !Number.isFinite(triggerWidth) || triggerWidth <= 0) {
    return { visibleKeys: allKeys, overflowKeys: [], needsTriggerMeasurement: true };
  }

  const visible = new Set<string>();
  let occupied = finiteSize(triggerWidth);

  for (const { item } of candidateOrder(items, strategy)) {
    const nextWidth = occupied + resolvedGap + finiteSize(item.width);
    if (nextWidth > availableWidth + 0.5) {
      if (strategy === 'priority') continue;
      break;
    }
    visible.add(item.key);
    occupied = nextWidth;
  }

  return {
    visibleKeys: allKeys.filter(key => visible.has(key)),
    overflowKeys: allKeys.filter(key => !visible.has(key)),
    needsTriggerMeasurement: false,
  };
}
