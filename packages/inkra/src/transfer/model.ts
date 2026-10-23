export type TransferDirection = 'to-target' | 'to-source';
export type TransferSide = 'source' | 'target';

export interface TransferIdentity {
  id: string;
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
  const requested = new Set(targetKeys);
  const knownIds = new Set<string>();
  const orderedKnown: string[] = [];
  for (const item of items) {
    if (knownIds.has(item.id)) continue;
    knownIds.add(item.id);
    if (requested.has(item.id)) orderedKnown.push(item.id);
  }
  // Set iteration preserves the first occurrence of unknown controlled keys,
  // without scanning the entire key array for each unknown key.
  for (const key of requested) {
    if (!knownIds.has(key)) orderedKnown.push(key);
  }
  return orderedKnown;
}

export function splitTransferItems<Item extends TransferIdentity>(
  items: readonly Item[],
  targetKeys: readonly string[],
): { source: Item[]; target: Item[] } {
  const targetKeysSet = new Set(targetKeys);
  const seen = new Set<string>();
  const source: Item[] = [];
  const target: Item[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    (targetKeysSet.has(item.id) ? target : source).push(item);
  }
  return { source, target };
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

