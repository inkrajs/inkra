export type LoadingTipOrder = 'sequence' | 'random';

export function finiteDuration(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

export function normalizeLoadingMax(max: number | undefined): number {
  return typeof max === 'number' && Number.isFinite(max) && max > 0 ? max : 100;
}

export function normalizeLoadingProgress(value: number | null | undefined, max: number): number | null | undefined {
  if (value == null) return value;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, value));
}

export function normalizeTipIndex(index: number | undefined, length: number): number {
  if (length <= 0) return 0;
  if (typeof index !== 'number' || !Number.isFinite(index)) return 0;
  return ((Math.trunc(index) % length) + length) % length;
}

export function nextTipIndex(
  current: number,
  length: number,
  order: LoadingTipOrder,
  random: () => number = Math.random,
): number {
  if (length <= 1) return 0;
  const normalized = normalizeTipIndex(current, length);
  if (order === 'sequence') return (normalized + 1) % length;
  const offset = Math.min(length - 2, Math.max(0, Math.floor(random() * (length - 1))));
  return (normalized + 1 + offset) % length;
}
