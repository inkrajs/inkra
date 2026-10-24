export interface StepperModelItem {
  value: string;
  disabled?: boolean;
}

export function findAdjacentStepperItem<Item extends StepperModelItem>(
  items: readonly Item[],
  currentValue: string | null,
  direction: -1 | 1,
  loop: boolean,
): Item | undefined {
  if (items.length === 0) return undefined;
  const currentIndex = items.findIndex(item => item.value === currentValue);
  if (currentIndex < 0) {
    const ordered = direction < 0 ? [...items].reverse() : items;
    return ordered.find(item => !item.disabled);
  }
  for (let offset = 1; offset <= items.length; offset += 1) {
    let index = currentIndex + direction * offset;
    if (loop) index = (index + items.length) % items.length;
    else if (index < 0 || index >= items.length) return undefined;
    if (index === currentIndex) return undefined;
    const item = items[index];
    if (!item.disabled) return item;
  }
  return undefined;
}

export function findEdgeStepperItem<Item extends StepperModelItem>(
  items: readonly Item[],
  edge: 'first' | 'last',
): Item | undefined {
  const ordered = edge === 'last' ? [...items].reverse() : items;
  return ordered.find(item => !item.disabled);
}

export function resolveStepperNativeValue(
  items: readonly StepperModelItem[],
  value: string | null | undefined,
): string {
  return value != null && items.some(item => item.value === value) ? value : '';
}
