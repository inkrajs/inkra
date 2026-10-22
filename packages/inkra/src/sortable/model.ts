export type SortableIdentifier = string | number;

export type SortableLayout = 'list' | 'grid';

export interface SortableContainerData<Item> {
  id: SortableIdentifier;
  items: readonly Item[];
  label?: string;
  disabled?: boolean;
  layout?: SortableLayout;
}

export interface SortableLocation {
  containerId: SortableIdentifier;
  index: number;
}

export interface SortableChangeDetails<Item> {
  activeId: SortableIdentifier;
  overId: SortableIdentifier | null;
  from: SortableLocation;
  to: SortableLocation;
  item: Item;
  type: 'reorder' | 'move';
}

export interface SortableProjectionOptions {
  overContainerId: SortableIdentifier;
  overItemId?: SortableIdentifier;
  insertAfter?: boolean;
}

export function cloneSortableContainers<Item>(
  containers: readonly SortableContainerData<Item>[],
): SortableContainerData<Item>[] {
  return containers.map((container) => ({ ...container, items: [...container.items] }));
}

export function findSortableLocation<Item>(
  containers: readonly SortableContainerData<Item>[],
  itemId: SortableIdentifier,
  getItemId: (item: Item) => SortableIdentifier,
): SortableLocation | null {
  for (const container of containers) {
    const index = container.items.findIndex((item) => getItemId(item) === itemId);
    if (index >= 0) return { containerId: container.id, index };
  }
  return null;
}

export function projectSortableMove<Item>(
  containers: readonly SortableContainerData<Item>[],
  activeId: SortableIdentifier,
  getItemId: (item: Item) => SortableIdentifier,
  options: SortableProjectionOptions,
): SortableContainerData<Item>[] {
  const source = findSortableLocation(containers, activeId, getItemId);
  const targetContainerIndex = containers.findIndex((container) => container.id === options.overContainerId);
  if (!source || targetContainerIndex < 0 || containers[targetContainerIndex]?.disabled) {
    return cloneSortableContainers(containers);
  }
  if (options.overItemId === activeId) return cloneSortableContainers(containers);

  const sourceContainerIndex = containers.findIndex((container) => container.id === source.containerId);
  const result = cloneSortableContainers(containers);
  const sourceItems = [...result[sourceContainerIndex]!.items];
  const [activeItem] = sourceItems.splice(source.index, 1);
  if (activeItem === undefined) return result;

  if (sourceContainerIndex === targetContainerIndex) {
    const originalTargetIndex = options.overItemId === undefined
      ? sourceItems.length
      : containers[targetContainerIndex]!.items.findIndex((item) => getItemId(item) === options.overItemId);
    if (originalTargetIndex < 0) return result;
    let targetIndex = originalTargetIndex;
    if (source.index < originalTargetIndex) targetIndex -= 1;
    if (options.insertAfter) targetIndex += 1;
    targetIndex = Math.max(0, Math.min(targetIndex, sourceItems.length));
    sourceItems.splice(targetIndex, 0, activeItem);
    result[sourceContainerIndex] = { ...result[sourceContainerIndex]!, items: sourceItems };
    return result;
  }

  const targetItems = [...result[targetContainerIndex]!.items];
  let targetIndex = options.overItemId === undefined
    ? targetItems.length
    : targetItems.findIndex((item) => getItemId(item) === options.overItemId);
  if (targetIndex < 0) targetIndex = targetItems.length;
  if (options.insertAfter) targetIndex += 1;
  targetIndex = Math.max(0, Math.min(targetIndex, targetItems.length));
  targetItems.splice(targetIndex, 0, activeItem);
  result[sourceContainerIndex] = { ...result[sourceContainerIndex]!, items: sourceItems };
  result[targetContainerIndex] = { ...result[targetContainerIndex]!, items: targetItems };
  return result;
}

export function sortableContainersEqual<Item>(
  left: readonly SortableContainerData<Item>[],
  right: readonly SortableContainerData<Item>[],
  getItemId: (item: Item) => SortableIdentifier,
): boolean {
  return left.length === right.length && left.every((container, containerIndex) => {
    const other = right[containerIndex];
    return other !== undefined
      && container.id === other.id
      && container.items.length === other.items.length
      && container.items.every((item, itemIndex) => getItemId(item) === getItemId(other.items[itemIndex]!));
  });
}
