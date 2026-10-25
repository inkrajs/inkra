export interface InventoryCell { x: number; y: number }
export type InventoryRotation = 0 | 90 | 180 | 270;
export interface InventoryItem {
  /** Unique across all containers. */
  id: string;
  label?: string;
  cells: readonly InventoryCell[];
  position: InventoryCell;
  rotation?: InventoryRotation;
  disabled?: boolean;
  rotatable?: boolean;
}
export interface InventoryContainer<Item extends InventoryItem = InventoryItem> {
  id: string;
  label?: string;
  columns: number;
  rows: number;
  items: readonly Item[];
  disabledCells?: readonly InventoryCell[];
  disabled?: boolean;
}
export interface InventoryPlacement {
  itemId: string;
  containerId: string;
  position: InventoryCell;
  rotation: InventoryRotation;
}
export interface InventoryPlacementContext<Item extends InventoryItem = InventoryItem> {
  item: Item;
  source: InventoryContainer<Item>;
  target: InventoryContainer<Item>;
  placement: InventoryPlacement;
  cells: readonly InventoryCell[];
  containers: readonly InventoryContainer<Item>[];
}
export type InventoryPlacementRule<Item extends InventoryItem = InventoryItem> = (context: InventoryPlacementContext<Item>) => boolean;
export type InventoryPlacementResult = { valid: true } | { valid: false; reason: 'missing' | 'disabled' | 'shape' | 'bounds' | 'blocked' | 'occupied' | 'rule' };
export interface InventoryChangeDetails {
  type: 'move' | 'transfer' | 'rotate';
  from: InventoryPlacement;
  to: InventoryPlacement;
}

const key = ({ x, y }: InventoryCell) => `${x},${y}`;
const isCell = ({ x, y }: InventoryCell) => Number.isSafeInteger(x) && Number.isSafeInteger(y);

/** Rotations retain the top-left occupied bounding-box anchor. */
export function rotateInventoryCells(cells: readonly InventoryCell[], rotation: InventoryRotation = 0): InventoryCell[] {
  if (!cells.length || cells.length > 4096 || !cells.every(isCell) || ![0, 90, 180, 270].includes(rotation)) return [];
  const rotated = cells.map(({ x, y }) => rotation === 90 ? { x: -y, y: x }
    : rotation === 180 ? { x: -x, y: -y } : rotation === 270 ? { x: y, y: -x } : { x, y });
  const minX = Math.min(...rotated.map(cell => cell.x));
  const minY = Math.min(...rotated.map(cell => cell.y));
  return [...new Map(rotated.map(cell => {
    const normalized = { x: cell.x - minX, y: cell.y - minY };
    return [key(normalized), normalized];
  })).values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function assertInventoryContainers<Item extends InventoryItem>(containers: readonly InventoryContainer<Item>[]): void {
  const containerIds = new Set<string>();
  const itemIds = new Set<string>();
  for (const container of containers) {
    if (!container.id.trim()) throw new Error('InventoryGrid: container ids must not be empty.');
    if (containerIds.has(container.id)) throw new Error(`InventoryGrid: duplicate container id "${container.id}".`);
    containerIds.add(container.id);
    if (!Number.isSafeInteger(container.columns) || !Number.isSafeInteger(container.rows)
      || container.columns < 1 || container.rows < 1 || container.columns * container.rows > 4096) {
      throw new Error('InventoryGrid: containers require positive integer dimensions and at most 4096 cells.');
    }
    const occupied = new Set((container.disabledCells ?? []).map(cell => {
      if (!isCell(cell) || cell.x < 0 || cell.y < 0 || cell.x >= container.columns || cell.y >= container.rows) {
        throw new Error('InventoryGrid: disabled cells must be inside their container.');
      }
      return key(cell);
    }));
    for (const item of container.items) {
      if (!item.id.trim()) throw new Error('InventoryGrid: item ids must not be empty.');
      if (itemIds.has(item.id)) throw new Error(`InventoryGrid: duplicate item id "${item.id}".`);
      itemIds.add(item.id);
      const cells = rotateInventoryCells(item.cells, item.rotation);
      if (!cells.length || !isCell(item.position)) throw new Error(`InventoryGrid: invalid shape or position for "${item.id}".`);
      for (const cell of cells) {
        const x = cell.x + item.position.x;
        const y = cell.y + item.position.y;
        if (x < 0 || y < 0 || x >= container.columns || y >= container.rows || occupied.has(key({ x, y }))) {
          throw new Error(`InventoryGrid: overlapping, blocked or out-of-bounds item "${item.id}".`);
        }
        occupied.add(key({ x, y }));
      }
    }
  }
}

export function validateInventoryPlacement<Item extends InventoryItem>(
  containers: readonly InventoryContainer<Item>[], placement: InventoryPlacement, canPlace?: InventoryPlacementRule<Item>,
): InventoryPlacementResult {
  const source = containers.find(container => container.items.some(item => item.id === placement.itemId));
  const item = source?.items.find(entry => entry.id === placement.itemId);
  const target = containers.find(container => container.id === placement.containerId);
  if (!source || !item || !target) return { valid: false, reason: 'missing' };
  if (source.disabled || target.disabled || item.disabled || (item.rotatable === false && placement.rotation !== (item.rotation ?? 0))) return { valid: false, reason: 'disabled' };
  const shape = rotateInventoryCells(item.cells, placement.rotation);
  if (!shape.length || !isCell(placement.position)) return { valid: false, reason: 'shape' };
  const cells = shape.map(cell => ({ x: cell.x + placement.position.x, y: cell.y + placement.position.y }));
  if (cells.some(cell => cell.x < 0 || cell.y < 0 || cell.x >= target.columns || cell.y >= target.rows)) return { valid: false, reason: 'bounds' };
  const blocked = new Set(target.disabledCells?.map(key));
  if (cells.some(cell => blocked.has(key(cell)))) return { valid: false, reason: 'blocked' };
  const occupied = new Set(target.items.filter(entry => entry.id !== item.id).flatMap(entry =>
    rotateInventoryCells(entry.cells, entry.rotation).map(cell => key({ x: cell.x + entry.position.x, y: cell.y + entry.position.y }))));
  if (cells.some(cell => occupied.has(key(cell)))) return { valid: false, reason: 'occupied' };
  if (canPlace && !canPlace({ item, source, target, placement, cells, containers })) return { valid: false, reason: 'rule' };
  return { valid: true };
}

/** A rejected move preserves the caller's reference and never removes an item. */
export function projectInventoryMove<Item extends InventoryItem>(
  containers: readonly InventoryContainer<Item>[], placement: InventoryPlacement, canPlace?: InventoryPlacementRule<Item>,
): readonly InventoryContainer<Item>[] {
  if (!validateInventoryPlacement(containers, placement, canPlace).valid) return containers;
  const source = containers.find(container => container.items.some(item => item.id === placement.itemId))!;
  const item = source.items.find(entry => entry.id === placement.itemId)!;
  if (source.id === placement.containerId && item.position.x === placement.position.x && item.position.y === placement.position.y
    && (item.rotation ?? 0) === placement.rotation) return containers;
  const moved = { ...item, position: { ...placement.position }, rotation: placement.rotation };
  return containers.map(container => container.id === source.id && container.id === placement.containerId
    ? { ...container, items: container.items.map(entry => entry.id === item.id ? moved : entry) }
    : container.id === source.id ? { ...container, items: container.items.filter(entry => entry.id !== item.id) }
      : container.id === placement.containerId ? { ...container, items: [...container.items, moved] } : container);
}
