import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import type { CollisionDetection, DragMoveEvent, KeyboardCoordinateGetter } from '@dnd-kit/core';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { __iconData as rotateIconData } from 'lucide-react/dist/esm/icons/rotate-cw.mjs';
import { Button } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { useInkraLocale } from '../i18n/index.js';
import { PortalThemeBridge, PortalThemeProvider, usePortalTriggerRef } from '../overlay/themeBridge.js';
import { assertInventoryContainers, projectInventoryMove, rotateInventoryCells, validateInventoryPlacement } from './model.js';
import type { InventoryCell, InventoryChangeDetails, InventoryContainer, InventoryItem, InventoryPlacement, InventoryPlacementRule, InventoryRotation } from './model.js';
import { inventoryOutline } from './outline.js';
export { assertInventoryContainers, projectInventoryMove, rotateInventoryCells, validateInventoryPlacement } from './model.js';
export type { InventoryCell, InventoryChangeDetails, InventoryContainer, InventoryItem, InventoryPlacement, InventoryPlacementContext, InventoryPlacementResult, InventoryPlacementRule, InventoryRotation } from './model.js';

export interface InventoryGridLabels {
  instructions?: string;
  rotate?: string;
  pickedUp?: (item: string) => string;
  position?: (item: string, container: string, column: number, row: number, rotation: number) => string;
  invalid?: string;
  requested?: (item: string) => string;
  cancelled?: (item: string) => string;
}
export interface InventoryItemRenderState {
  selected: boolean;
  dragging: boolean;
  rotation: InventoryRotation;
  overlay: boolean;
}
export interface InventoryGridProps<Item extends InventoryItem = InventoryItem> {
  containers: readonly InventoryContainer<Item>[];
  onChange: (containers: readonly InventoryContainer<Item>[], details: InventoryChangeDetails) => void;
  canPlace?: InventoryPlacementRule<Item>;
  /** Content is placed inside the first occupied cell; keep it non-interactive. */
  renderItem?: (item: Item, state: InventoryItemRenderState) => ReactNode;
  getItemLabel?: (item: Item) => string;
  cellSize?: number;
  disabled?: boolean;
  readOnly?: boolean;
  allowRotation?: boolean;
  labels?: InventoryGridLabels;
  className?: string;
  'aria-label'?: string;
}

const rotateIcon = rotateIconData.node.map(([, attributes]) => ({ d: String(attributes.d) }));
const boardId = (id: string) => `inkra-inventory-board:${id}`;
const itemId = (id: string) => `inkra-inventory-item:${id}`;
const bounds = (cells: readonly InventoryCell[]) => ({ width: Math.max(...cells.map(cell => cell.x)) + 1, height: Math.max(...cells.map(cell => cell.y)) + 1 });
const collisionDetection: CollisionDetection = args => args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);

function Shape({ cells, size, seed, children }: {
  cells: readonly InventoryCell[]; size: number; seed: string; children?: ReactNode;
}) {
  const outline = useMemo(() => inventoryOutline(cells, size), [cells, size]);
  const box = bounds(cells);
  return <>
    <span className="inkra-inventory-grid__shape" aria-hidden="true"
      style={{ width: box.width * size, height: box.height * size }}>
      <PencilSurface as="span" variant="full" seed={seed} className="inkra-inventory-grid__shape-fill"
        style={{ clipPath: `path("${outline.path}")` }}>
        <PencilSurface as="span" variant="selection" seed={`${seed}-wash`} className="inkra-inventory-grid__shape-wash" />
      </PencilSurface>
      <svg className="inkra-inventory-grid__shape-fallback" width="100%" height="100%">
        <path d={outline.path} fill="none" stroke="currentColor" />
      </svg>
      {outline.segments.map(({ start, end }, index) => {
        const vertical = start.x === end.x;
        const style = { left: Math.min(start.x, end.x) - (vertical ? 4 : 1),
          top: Math.min(start.y, end.y) - (vertical ? 1 : 4),
          width: vertical ? 8 : Math.abs(end.x - start.x) + 2,
          height: vertical ? Math.abs(end.y - start.y) + 2 : 8 };
        return <PencilLine key={index} orientation={vertical ? 'vertical' : 'horizontal'}
          seed={`${seed}-edge-${index}`} className="inkra-inventory-grid__shape-edge" style={style} />;
      })}
    </span>
    {cells.map((cell, index) => <span key={`${cell.x}:${cell.y}`} className="inkra-inventory-grid__cell"
    style={{ left: cell.x * size, top: cell.y * size, width: size, height: size }}>
    {index === 0 && <span className="inkra-inventory-grid__item-content">{children}</span>}
  </span>)}</>;
}

function ItemView<Item extends InventoryItem>({ item, container, size, disabled, selected, onSelect, onRotate, renderItem, getItemLabel, allowRotation }: {
  item: Item; container: InventoryContainer<Item>; size: number; disabled: boolean; selected: boolean;
  onSelect: (id: string) => void; onRotate: (id: string) => void;
  renderItem: NonNullable<InventoryGridProps<Item>['renderItem']>;
  getItemLabel: (item: Item) => string; allowRotation: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: itemId(item.id), disabled,
    data: { itemId: item.id, containerId: container.id } });
  const cells = rotateInventoryCells(item.cells, item.rotation);
  const box = bounds(cells);
  return <div {...attributes} {...listeners} ref={setNodeRef} role="button" tabIndex={disabled ? -1 : 0}
    aria-label={getItemLabel(item)} title={getItemLabel(item)} aria-disabled={disabled || undefined}
    className="inkra-inventory-grid__item" data-inventory-item={item.id} data-selected={selected || undefined}
    data-dragging={isDragging || undefined} data-disabled={disabled || undefined} data-rotation={item.rotation ?? 0}
    style={{ left: item.position.x * size, top: item.position.y * size, width: box.width * size, height: box.height * size }}
    onFocus={() => onSelect(item.id)} onClick={() => { if (!disabled) onSelect(item.id); }}
    onKeyDown={event => {
      if (!isDragging && allowRotation && !disabled && event.key.toLowerCase() === 'r') {
        event.preventDefault(); onRotate(item.id);
      } else listeners?.onKeyDown?.(event);
    }}>
    <Shape cells={cells} size={size} seed={item.id}>{renderItem(item, { selected, dragging: isDragging, rotation: item.rotation ?? 0, overlay: false })}</Shape>
  </div>;
}

function ContainerView<Item extends InventoryItem>({ container, size, disabled, selectedId, onSelect, onRotate, renderItem, getItemLabel, allowRotation, projection, activeItem, valid, rotateLabel }: {
  container: InventoryContainer<Item>; size: number; disabled: boolean; selectedId: string | null;
  onSelect: (id: string) => void; onRotate: (id: string) => void;
  renderItem: NonNullable<InventoryGridProps<Item>['renderItem']>; getItemLabel: (item: Item) => string;
  allowRotation: boolean; projection: InventoryPlacement | null; activeItem: Item | undefined; valid: boolean; rotateLabel: string;
}) {
  const { setNodeRef } = useDroppable({ id: boardId(container.id), disabled: disabled || container.disabled,
    data: { containerId: container.id, columns: container.columns, rows: container.rows } });
  const selected = container.items.find(item => item.id === selectedId);
  const projectedCells = projection && activeItem ? rotateInventoryCells(activeItem.cells, projection.rotation) : [];
  return <section className="inkra-inventory-grid__container" aria-label={container.label ?? container.id} data-disabled={container.disabled || undefined}>
    <div className="inkra-inventory-grid__header">
      <PencilText>{container.label ?? container.id}</PencilText>
      {allowRotation && <Button variant="ghost" size="icon" aria-label={rotateLabel} title={rotateLabel}
        disabled={disabled || container.disabled || !selected || selected.disabled || selected.rotatable === false}
        onClick={() => { if (selected) onRotate(selected.id); }}>
        <PencilIcon paths={rotateIcon} size={24} />
      </Button>}
    </div>
    <div className="inkra-inventory-grid__scroll" tabIndex={0} role="region" aria-label={container.label ?? container.id}>
      <div ref={setNodeRef} className="inkra-inventory-grid__board" data-inventory-container={container.id}
        style={{ width: container.columns * size, height: container.rows * size }}>
        <div className="inkra-inventory-grid__lines" aria-hidden="true">
          {Array.from({ length: container.columns + 1 }, (_, index) => <PencilLine key={`x${index}`} orientation="vertical" seed={`${container.id}-x${index}`}
            style={{ left: index * size - 4, top: -1, width: 8, height: container.rows * size + 2 }} />)}
          {Array.from({ length: container.rows + 1 }, (_, index) => <PencilLine key={`y${index}`} seed={`${container.id}-y${index}`}
            style={{ top: index * size - 4, left: -1, height: 8, width: container.columns * size + 2 }} />)}
        </div>
        {container.disabledCells?.map(cell => <span key={`${cell.x}:${cell.y}`} aria-hidden="true" className="inkra-inventory-grid__blocked"
          style={{ left: cell.x * size, top: cell.y * size, width: size, height: size }}><PencilIcon size={24} paths={[{ d: 'M5 5l14 14M19 5L5 19' }]} /></span>)}
        {container.items.map(item => <ItemView key={item.id} item={item} container={container} size={size}
          disabled={disabled || Boolean(container.disabled) || Boolean(item.disabled)} selected={selectedId === item.id}
          onSelect={onSelect} onRotate={onRotate} renderItem={renderItem} getItemLabel={getItemLabel} allowRotation={allowRotation} />)}
        {projection && projection.containerId === container.id && <div aria-hidden="true" className="inkra-inventory-grid__preview" data-valid={valid}
          style={{ left: projection.position.x * size, top: projection.position.y * size }}>
          <Shape cells={projectedCells} size={size} seed="inventory-preview" />
        </div>}
      </div>
    </div>
  </section>;
}

export function InventoryGrid<Item extends InventoryItem>(props: InventoryGridProps<Item>) {
  return <PortalThemeProvider><InventoryGridContent {...props} /></PortalThemeProvider>;
}

function InventoryGridContent<Item extends InventoryItem>({ containers, onChange, canPlace, renderItem = item => <PencilText>{item.label ?? item.id}</PencilText>,
  getItemLabel = item => item.label ?? item.id, cellSize = 48, disabled = false, readOnly = false, allowRotation = true,
  labels: suppliedLabels, className, 'aria-label': ariaLabel }: InventoryGridProps<Item>) {
  useMemo(() => assertInventoryContainers(containers), [containers]);
  const { t } = useInkraLocale();
  const labels = {
    instructions: t('inventoryGrid.instructions'), rotate: t('inventoryGrid.rotate'),
    pickedUp: (item: string) => t('inventoryGrid.pickedUp', { item }),
    position: (item: string, container: string, column: number, row: number, rotation: number) => t('inventoryGrid.position', { item, container, column, row, rotation }),
    invalid: t('inventoryGrid.invalid'), requested: (item: string) => t('inventoryGrid.requested', { item }),
    cancelled: (item: string) => t('inventoryGrid.cancelled', { item }), ...suppliedLabels,
  };
  const size = Number.isFinite(cellSize) ? Math.max(44, Math.min(128, cellSize)) : 48;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projection, setProjection] = useState<InventoryPlacement | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const rotationRef = useRef<InventoryRotation>(0);
  const eventRef = useRef<DragMoveEvent | null>(null);
  const projectionRef = useRef<InventoryPlacement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const captureRoot = usePortalTriggerRef(rootRef);
  const overlayScale = useRef({ x: 1, y: 1 });
  const activeItem = containers.flatMap(container => container.items).find(item => item.id === activeId);
  const unavailable = disabled || readOnly;
  const valid = projection !== null && !unavailable && validateInventoryPlacement(containers, projection, canPlace).valid;
  useEffect(() => {
    if (activeId && (unavailable || !activeItem || activeItem.disabled || containers.find(container => container.items.some(item => item.id === activeId))?.disabled)) {
      // End the mature sensor through its cancellation event before hiding the drag.
      // Unmounting DndContext alone does not detach an active document sensor.
      const document = rootRef.current?.ownerDocument;
      const KeyboardEvent = document?.defaultView?.KeyboardEvent;
      if (document && KeyboardEvent) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', cancelable: true }));
      reset();
    }
    if (selectedId && !containers.some(container => container.items.some(item => item.id === selectedId))) setSelectedId(null);
  }, [activeId, activeItem, containers, selectedId, unavailable]);

  const coordinates: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
    const target = context.over?.data.current;
    const rectangle = context.over?.rect;
    const stepX = rectangle && target?.columns ? rectangle.width / target.columns : size;
    const stepY = rectangle && target?.rows ? rectangle.height / target.rows : size;
    const directions: Record<string, { x: number; y: number }> = {
      ArrowRight: { x: stepX, y: 0 }, ArrowLeft: { x: -stepX, y: 0 }, ArrowDown: { x: 0, y: stepY }, ArrowUp: { x: 0, y: -stepY },
    };
    if (directions[event.code]) { event.preventDefault(); return { x: currentCoordinates.x + directions[event.code].x, y: currentCoordinates.y + directions[event.code].y }; }
    if (event.code === 'PageDown' || event.code === 'PageUp') {
      event.preventDefault();
      const available = containers.filter(container => !container.disabled);
      const index = available.findIndex(container => container.id === target?.containerId);
      const next = available[(index + (event.code === 'PageDown' ? 1 : -1) + available.length) % available.length];
      const nextRect = next && context.droppableRects.get(boardId(next.id));
      const currentRect = context.collisionRect;
      if (nextRect && currentRect) return { x: currentCoordinates.x + nextRect.left - currentRect.left, y: currentCoordinates.y + nextRect.top - currentRect.top };
    }
    return undefined;
  };
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: coordinates }));

  function updateProjection(event: DragMoveEvent) {
    eventRef.current = event;
    const targetId = event.over?.data.current?.containerId as string | undefined;
    const target = containers.find(container => container.id === targetId);
    const initial = event.active.rect.current.initial;
    const id = event.active.data.current?.itemId as string | undefined;
    if (!target || !initial || !id || !event.over) { projectionRef.current = null; setProjection(null); return; }
    const next: InventoryPlacement = { itemId: id, containerId: target.id, rotation: rotationRef.current,
      position: { x: Math.round((initial.left + event.delta.x - event.over.rect.left) / (event.over.rect.width / target.columns)),
        y: Math.round((initial.top + event.delta.y - event.over.rect.top) / (event.over.rect.height / target.rows)) } };
    projectionRef.current = next; setProjection(next);
    const item = containers.flatMap(container => container.items).find(entry => entry.id === id);
    if (item) setAnnouncement(`${labels.position(getItemLabel(item), target.label ?? target.id, next.position.x + 1, next.position.y + 1, next.rotation)}${validateInventoryPlacement(containers, next, canPlace).valid ? '' : ` ${labels.invalid}`}`);
  }
  function reset() { setActiveId(null); setProjection(null); projectionRef.current = null; eventRef.current = null; }
  function commit(next: InventoryPlacement) {
    if (unavailable) return;
    const source = containers.find(container => container.items.some(item => item.id === next.itemId));
    const item = source?.items.find(entry => entry.id === next.itemId);
    const updated = projectInventoryMove(containers, next, canPlace);
    if (!source || !item || !validateInventoryPlacement(containers, next, canPlace).valid) { setAnnouncement(labels.invalid); return; }
    if (updated === containers) { setAnnouncement(labels.position(getItemLabel(item), source.label ?? source.id, item.position.x + 1, item.position.y + 1, item.rotation ?? 0)); return; }
    const from = { itemId: item.id, containerId: source.id, position: { ...item.position }, rotation: item.rotation ?? 0 };
    onChange(updated, { from, to: next, type: from.containerId !== next.containerId ? 'transfer' : from.rotation !== next.rotation ? 'rotate' : 'move' });
    setAnnouncement(labels.requested(getItemLabel(item)));
    requestAnimationFrame(() => {
      const node = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-inventory-item]') ?? []).find(element => element.dataset.inventoryItem === item.id);
      node?.focus({ preventScroll: true });
    });
  }
  function rotate(id: string) {
    if (!allowRotation || unavailable) return;
    const source = containers.find(container => container.items.some(item => item.id === id));
    const item = source?.items.find(entry => entry.id === id);
    if (!item || !source || item.disabled || item.rotatable === false || source.disabled) return;
    const rotation = (((activeId === id ? rotationRef.current : item.rotation ?? 0) + 90) % 360) as InventoryRotation;
    if (activeId === id) {
      rotationRef.current = rotation;
      if (eventRef.current) updateProjection(eventRef.current);
      else {
        const next = { ...(projectionRef.current ?? { itemId: id, containerId: source.id, position: item.position }), rotation };
        projectionRef.current = next; setProjection(next);
      }
    }
    else commit({ itemId: id, containerId: source.id, position: item.position, rotation });
  }
  return <DndContext sensors={sensors} collisionDetection={collisionDetection}
    accessibility={{ screenReaderInstructions: { draggable: labels.instructions }, announcements: {
      onDragStart: () => undefined, onDragOver: () => undefined, onDragEnd: () => undefined, onDragCancel: () => undefined,
    } }}
    onDragStart={event => {
      const id = event.active.data.current?.itemId as string;
      const item = containers.flatMap(container => container.items).find(entry => entry.id === id);
      if (!item || unavailable) return;
      const node = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-inventory-item]') ?? []).find(element => element.dataset.inventoryItem === id);
      const rect = node?.getBoundingClientRect();
      // The portal is outside any ancestor transform; keep the pickup's visual size.
      overlayScale.current = { x: rect && node?.offsetWidth ? rect.width / node.offsetWidth : 1,
        y: rect && node?.offsetHeight ? rect.height / node.offsetHeight : 1 };
      rotationRef.current = item.rotation ?? 0; setActiveId(id); setSelectedId(id); setAnnouncement(labels.pickedUp(getItemLabel(item)));
      const container = containers.find(entry => entry.items.some(value => value.id === id))!;
      const initial = { itemId: id, containerId: container.id, position: item.position, rotation: item.rotation ?? 0 };
      projectionRef.current = initial; setProjection(initial);
    }}
    onDragMove={updateProjection} onDragOver={updateProjection}
    onDragEnd={event => { updateProjection(event); const next = projectionRef.current; if (next) commit(next); else if (activeItem) setAnnouncement(labels.cancelled(getItemLabel(activeItem))); reset(); }}
    onDragCancel={() => { if (activeItem) setAnnouncement(labels.cancelled(getItemLabel(activeItem))); reset(); }}>
    <div className={['inkra-inventory-grid', className].filter(Boolean).join(' ')} ref={captureRoot} role="group" aria-label={ariaLabel}
      data-readonly={readOnly || undefined} data-disabled={disabled || undefined}
      onKeyDownCapture={event => { if (activeId && event.key.toLowerCase() === 'r') { event.preventDefault(); event.stopPropagation(); rotate(activeId); } }}>
      {containers.map(container => <ContainerView key={container.id} container={container} size={size} disabled={unavailable}
        selectedId={selectedId} onSelect={setSelectedId} onRotate={rotate} renderItem={renderItem} getItemLabel={getItemLabel}
        allowRotation={allowRotation} projection={projection} activeItem={activeItem} valid={valid} rotateLabel={labels.rotate} />)}
      <span className="inkra-inventory-grid__announcement" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    </div>
    {rootRef.current && createPortal(<PortalThemeBridge><DragOverlay dropAnimation={null}>{activeItem && <div className="inkra-inventory-grid__overlay" aria-hidden="true"
      style={{ width: bounds(rotateInventoryCells(activeItem.cells, rotationRef.current)).width * size, height: bounds(rotateInventoryCells(activeItem.cells, rotationRef.current)).height * size,
        transform: `scale(${overlayScale.current.x}, ${overlayScale.current.y})`, transformOrigin: '0 0' } as CSSProperties}>
      <Shape cells={rotateInventoryCells(activeItem.cells, rotationRef.current)} size={size} seed={activeItem.id}>
        {renderItem(activeItem, { selected: true, dragging: true, rotation: rotationRef.current, overlay: true })}
      </Shape>
    </div>}</DragOverlay></PortalThemeBridge>, rootRef.current.ownerDocument.body)}
  </DndContext>;
}
