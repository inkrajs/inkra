import type { InventoryCell } from './model.js';

type Edge = { start: InventoryCell; end: InventoryCell; direction: number };
const key = ({ x, y }: InventoryCell) => `${x}:${y}`;

/** Trace occupied-cell boundaries, keeping holes and disconnected islands separate. */
export function inventoryOutline(cells: readonly InventoryCell[], size: number, inset = 3) {
  const occupied = new Set(cells.map(key));
  const outgoing = new Map<string, Edge[]>();
  const remaining = new Set<Edge>();
  function edge(start: InventoryCell, end: InventoryCell, direction: number) {
    const value = { start, end, direction };
    outgoing.set(key(start), [...(outgoing.get(key(start)) ?? []), value]);
    remaining.add(value);
  }
  for (const { x, y } of cells) {
    if (!occupied.has(key({ x, y: y - 1 }))) edge({ x, y }, { x: x + 1, y }, 0);
    if (!occupied.has(key({ x: x + 1, y }))) edge({ x: x + 1, y }, { x: x + 1, y: y + 1 }, 1);
    if (!occupied.has(key({ x, y: y + 1 }))) edge({ x: x + 1, y: y + 1 }, { x, y: y + 1 }, 2);
    if (!occupied.has(key({ x: x - 1, y }))) edge({ x, y: y + 1 }, { x, y }, 3);
  }
  const contours: InventoryCell[][] = [];
  const turnPriority = [1, 0, 3, 2];
  while (remaining.size) {
    const first = remaining.values().next().value!;
    const loop: Edge[] = [];
    let current: Edge | undefined = first;
    while (current) {
      loop.push(current);
      remaining.delete(current);
      if (key(current.end) === key(first.start)) break;
      const direction: number = current.direction;
      // At a diagonal contact, follow the same occupied island instead of bridging it.
      current = (outgoing.get(key(current.end)) ?? [])
        .filter(candidate => remaining.has(candidate))
        .sort((a, b) => turnPriority.indexOf((a.direction - direction + 4) % 4)
          - turnPriority.indexOf((b.direction - direction + 4) % 4))[0];
    }
    const corners = loop.filter((value, index) =>
      value.direction !== loop[(index + loop.length - 1) % loop.length].direction);
    contours.push(corners.map((value, index) => {
      const previous = corners[(index + corners.length - 1) % corners.length];
      const normal = (direction: number) => [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }][direction];
      const before = normal(previous.direction);
      const after = normal(value.direction);
      return { x: value.start.x * size + (before.x + after.x) * inset,
        y: value.start.y * size + (before.y + after.y) * inset };
    }));
  }
  return {
    path: contours.map(points => `M${points.map(point => `${point.x},${point.y}`).join('L')}Z`).join(''),
    segments: contours.flatMap(points => points.map((start, index) => ({ start, end: points[(index + 1) % points.length] }))),
  };
}
