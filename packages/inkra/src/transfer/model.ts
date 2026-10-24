export type TransferDirection = 'to-target' | 'to-source';
export type TransferSide = 'source' | 'target';
export type TransferFocusIntent = 'wait' | 'cancel' | 'focus';
export type TransferValueResolution = 'unchanged' | 'accepted' | 'mismatch';

export interface TransferIdentity {
  id: string;
}

export function resolveTransferFocusIntent(
  valueResolution: TransferValueResolution,
  originOwnsFocus: boolean,
  originUnavailable: boolean,
): TransferFocusIntent {
  if (valueResolution === 'mismatch') return 'cancel';
  if (valueResolution === 'unchanged') return originOwnsFocus || originUnavailable ? 'wait' : 'cancel';
  return originOwnsFocus || originUnavailable ? 'focus' : 'cancel';
}

export function transferKeysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

export function uniqueTransferItems<Item extends TransferIdentity>(items: readonly Item[]): Item[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function normalizeTargetKeys<Item extends TransferIdentity>(
  items: readonly Item[],
  targetKeys: readonly string[],
): string[] {
  const uniqueItems = uniqueTransferItems(items);
  const requested = new Set(targetKeys);
  const knownIds = new Set(uniqueItems.map(item => item.id));
  const orderedKnown = uniqueItems.filter(item => requested.has(item.id)).map(item => item.id);
  const unknown = targetKeys.filter((key, index) => !knownIds.has(key) && targetKeys.indexOf(key) === index);
  return [...orderedKnown, ...unknown];
}

export function splitTransferItems<Item extends TransferIdentity>(
  items: readonly Item[],
  targetKeys: readonly string[],
): { source: Item[]; target: Item[] } {
  const target = new Set(targetKeys);
  const uniqueItems = uniqueTransferItems(items);
  return {
    source: uniqueItems.filter(item => !target.has(item.id)),
    target: uniqueItems.filter(item => target.has(item.id)),
  };
}

export function moveTransferKeys<Item extends TransferIdentity>(
  items: readonly Item[],
  targetKeys: readonly string[],
  movedKeys: readonly string[],
  direction: TransferDirection,
): string[] {
  const next = new Set(targetKeys);
  if (direction === 'to-target') movedKeys.forEach(key => next.add(key));
  else movedKeys.forEach(key => next.delete(key));
  return normalizeTargetKeys(items, [...next]);
}

