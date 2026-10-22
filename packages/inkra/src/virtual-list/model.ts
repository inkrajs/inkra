export type VirtualListKey = string | number | bigint;

export function normalizeVirtualListSize(value: number, fallback = 44): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function normalizeVirtualListOverscan(value: number | undefined, fallback = 4): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value!));
}

export function normalizeVirtualListSpacing(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value!) : 0;
}

export function getVirtualListSsrIndexes(length: number, requested: number | undefined): number[] {
  const safeLength = Math.max(0, Math.floor(length));
  const defaultCount = Math.min(safeLength, 12);
  const count = Number.isFinite(requested)
    ? Math.min(safeLength, Math.max(0, Math.floor(requested!)))
    : defaultCount;
  return Array.from({ length: count }, (_, index) => index);
}

export function clampVirtualListIndex(index: number, count: number): number | null {
  if (count <= 0 || !Number.isFinite(index)) return null;
  return Math.min(count - 1, Math.max(0, Math.floor(index)));
}

export function virtualListKeyAttribute(key: VirtualListKey): string {
  return String(key);
}
