export interface ImageViewerIdentifiable {
  id: string;
}

export interface ImageViewerSelection {
  activeId: string | null;
  index: number;
}

export function resolveImageViewerSelection(
  items: readonly ImageViewerIdentifiable[],
  requestedId: string | null | undefined,
  previousIndex = 0,
): ImageViewerSelection {
  if (items.length === 0) return { activeId: null, index: -1 };
  const requestedIndex = requestedId == null ? -1 : items.findIndex(item => item.id === requestedId);
  const index = requestedIndex >= 0
    ? requestedIndex
    : Math.min(Math.max(0, previousIndex), items.length - 1);
  return { activeId: items[index].id, index };
}

export function nextImageViewerIndex(
  length: number,
  index: number,
  direction: -1 | 1,
  loop: boolean,
): number {
  if (length <= 0) return -1;
  const current = Math.min(Math.max(0, index), length - 1);
  const next = current + direction;
  if (loop) return (next + length) % length;
  return Math.min(Math.max(0, next), length - 1);
}
