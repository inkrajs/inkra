export interface LogScrollMetrics {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

export function isNearLogBottom(metrics: LogScrollMetrics, threshold = 32): boolean {
  const safeThreshold = Number.isFinite(threshold) ? Math.max(0, threshold) : 32;
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <= safeThreshold;
}

export function isLogAppend(previous: readonly string[], next: readonly string[]): boolean {
  return previous.length < next.length && previous.every((id, index) => id === next[index]);
}

export function shouldFollowLogUpdate({
  initial,
  nearBottom,
  paused,
  previousItemIds,
  nextItemIds,
  previousVisibleIds,
  nextVisibleIds,
}: {
  initial: boolean;
  nearBottom: boolean;
  paused: boolean;
  previousItemIds: readonly string[];
  nextItemIds: readonly string[];
  previousVisibleIds: readonly string[];
  nextVisibleIds: readonly string[];
}): boolean {
  if (paused || !nearBottom) return false;
  return initial
    || (isLogAppend(previousItemIds, nextItemIds) && isLogAppend(previousVisibleIds, nextVisibleIds));
}
