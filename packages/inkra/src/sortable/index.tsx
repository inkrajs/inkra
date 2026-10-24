import { __iconData as gripIconData } from 'lucide-react/dist/esm/icons/grip-vertical.mjs';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  Announcements,
  CollisionDetection,
  DragCancelEvent,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardSensorOptions,
  MouseSensorOptions,
  TouchSensorOptions,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { PencilIcon } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import {
  cloneSortableContainers,
  findSortableLocation,
  projectSortableMove,
  sortableContainersEqual,
} from './model.js';
import type {
  SortableChangeDetails,
  SortableContainerData,
  SortableIdentifier,
  SortableLayout,
  SortableLocation,
} from './model.js';

export type {
  SortableChangeDetails,
  SortableContainerData,
  SortableIdentifier,
  SortableLayout,
  SortableLocation,
} from './model.js';

const gripIcon = gripIconData.node.map(([, attributes]) => {
  const { cx, cy, r } = attributes;
  const x = Number(cx);
  const y = Number(cy);
  const radius = Number(r);
  return { d: `M ${x - radius} ${y} A ${radius} ${radius} 0 1 0 ${x + radius} ${y} A ${radius} ${radius} 0 1 0 ${x - radius} ${y}` };
});

interface SortableEngineData {
  type: 'inkra-sortable-item' | 'inkra-sortable-container';
  containerId: SortableIdentifier;
  itemId?: SortableIdentifier;
  disabled?: boolean;
}

function engineItemId(id: SortableIdentifier): string {
  return `inkra-sortable-item:${typeof id}:${String(id)}`;
}

function engineContainerId(id: SortableIdentifier): string {
  return `inkra-sortable-container:${typeof id}:${String(id)}`;
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(
    'button, a, input, select, textarea, [contenteditable="true"], [data-sortable-no-drag]',
  ));
}

function filterItemActivatorProps(props: HTMLAttributes<HTMLElement>): HTMLAttributes<HTMLElement> {
  return {
    ...props,
    onKeyDown: (event) => {
      if (!isInteractiveTarget(event.target)) props.onKeyDown?.(event);
    },
    onMouseDown: (event) => {
      if (!isInteractiveTarget(event.target)) props.onMouseDown?.(event);
    },
    onTouchStart: (event) => {
      if (!isInteractiveTarget(event.target)) props.onTouchStart?.(event);
    },
  };
}

export interface SortableLabels {
  handle?: string;
  screenReaderInstructions?: string;
  pickedUp?: (item: string, container: string, position: number, count: number) => string;
  movedOver?: (item: string, container: string, position: number, count: number) => string;
  dropped?: (item: string, container: string, position: number, count: number) => string;
  cancelled?: (item: string) => string;
}

export interface SortableItemRenderState<Item> {
  item: Item;
  id: SortableIdentifier;
  containerId: SortableIdentifier;
  index: number;
  disabled: boolean;
  isDragging: boolean;
  isOverlay: boolean;
}

export interface SortableHandleRenderState<Item> extends SortableItemRenderState<Item> {
  props: ButtonHTMLAttributes<HTMLButtonElement> & { ref: (element: HTMLButtonElement | null) => void };
}

export interface SortableContainerRenderState<Item> {
  container: SortableContainerData<Item>;
  isOver: boolean;
  itemCount: number;
}

export interface SortableProps<Item> {
  containers: readonly SortableContainerData<Item>[];
  getItemId: (item: Item) => SortableIdentifier;
  renderItem: (state: SortableItemRenderState<Item>) => ReactNode;
  onChange: (containers: SortableContainerData<Item>[], details: SortableChangeDetails<Item>) => void;
  onReorder?: (details: SortableChangeDetails<Item>) => void;
  onMove?: (details: SortableChangeDetails<Item>) => void;
  renderContainerHeader?: (state: SortableContainerRenderState<Item>) => ReactNode;
  renderOverlay?: (state: SortableItemRenderState<Item>) => ReactNode;
  handle?: boolean | ((state: SortableHandleRenderState<Item>) => ReactNode);
  isItemDisabled?: (item: Item, container: SortableContainerData<Item>) => boolean;
  getItemLabel?: (item: Item) => string;
  getContainerLabel?: (container: SortableContainerData<Item>) => string;
  labels?: SortableLabels;
  className?: string;
  containerClassName?: string;
  itemClassName?: string;
  autoScroll?: boolean;
}

const defaultLabels: Required<SortableLabels> = {
  handle: 'Drag item',
  screenReaderInstructions: 'Press Space or Enter to pick up an item. Use the arrow keys to move it, Space or Enter to drop it, and Escape to cancel.',
  pickedUp: (item, container, position, count) => `Picked up ${item}, item ${position} of ${count} in ${container}.`,
  movedOver: (item, container, position, count) => `${item} is over position ${position} of ${count} in ${container}.`,
  dropped: (item, container, position, count) => `Dropped ${item} at position ${position} of ${count} in ${container}.`,
  cancelled: (item) => `Sorting cancelled. ${item} returned to its original position.`,
};

function getEngineData(value: { data: { current?: unknown } } | null): SortableEngineData | null {
  const data = value?.data.current as SortableEngineData | undefined;
  return data?.type === 'inkra-sortable-item' || data?.type === 'inkra-sortable-container' ? data : null;
}

function getCollisionEngineData(collision: { data?: { droppableContainer?: { data: { current?: unknown } } } }) {
  return collision.data?.droppableContainer
    ? getEngineData(collision.data.droppableContainer)
    : null;
}

function getDropProjection<Item>(
  containers: readonly SortableContainerData<Item>[],
  event: DragOverEvent | DragEndEvent,
  getItemId: (item: Item) => SortableIdentifier,
) {
  const activeData = getEngineData(event.active);
  const overData = getEngineData(event.over);
  if (activeData?.itemId === undefined || !overData || overData.disabled) return cloneSortableContainers(containers);
  const targetContainer = containers.find((container) => container.id === overData.containerId);
  const translated = event.active.rect.current.translated;
  const source = findSortableLocation(containers, activeData.itemId, getItemId);
  const target = overData.itemId === undefined ? null : findSortableLocation(containers, overData.itemId, getItemId);
  const keyboardDrag = typeof KeyboardEvent !== 'undefined' && event.activatorEvent instanceof KeyboardEvent;
  const insertAfter = keyboardDrag
    ? source !== null && target !== null && source.containerId === target.containerId && source.index < target.index
    : overData.itemId !== undefined && translated !== null && targetContainer?.layout === 'grid'
      ? translated.left + translated.width / 2 > event.over!.rect.left + event.over!.rect.width / 2
      : overData.itemId !== undefined && translated !== null
        && translated.top + translated.height / 2 > event.over!.rect.top + event.over!.rect.height / 2;
  return projectSortableMove(containers, activeData.itemId, getItemId, {
    overContainerId: overData.containerId,
    overItemId: overData.itemId,
    insertAfter,
  });
}

const collisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  const pointerItems = pointer.filter((collision) => getCollisionEngineData(collision)?.type === 'inkra-sortable-item');
  if (pointerItems.length > 0) return pointerItems;
  if (pointer.length > 0) return pointer;
  const intersections = rectIntersection(args);
  const intersectingItems = intersections.filter((collision) => getCollisionEngineData(collision)?.type === 'inkra-sortable-item');
  if (intersectingItems.length > 0) return intersectingItems;
  return intersections.length > 0 ? intersections : closestCenter(args);
};

function SortableContainer<Item>({
  container,
  getItemId,
  renderItem,
  renderContainerHeader,
  handle,
  isItemDisabled,
  itemClassName,
  containerClassName,
  activeId,
  handleLabel,
  getItemLabel,
}: {
  container: SortableContainerData<Item>;
  getItemId: (item: Item) => SortableIdentifier;
  renderItem: (state: SortableItemRenderState<Item>) => ReactNode;
  renderContainerHeader?: (state: SortableContainerRenderState<Item>) => ReactNode;
  handle?: SortableProps<Item>['handle'];
  isItemDisabled?: SortableProps<Item>['isItemDisabled'];
  itemClassName?: string;
  containerClassName?: string;
  activeId: SortableIdentifier | null;
  handleLabel: string;
  getItemLabel: (item: Item) => string;
}) {
  const disabled = container.disabled === true;
  const { isOver, setNodeRef } = useDroppable({
    id: engineContainerId(container.id),
    data: { type: 'inkra-sortable-container', containerId: container.id, disabled } satisfies SortableEngineData,
  });
  const ids = useMemo(() => container.items.map((item) => engineItemId(getItemId(item))), [container.items, getItemId]);
  const layout = container.layout ?? 'list';
  const acceptingOver = isOver && !disabled;
  return <PencilSurface
    as="section"
    className={['inkra-sortable__container', containerClassName].filter(Boolean).join(' ')}
    data-disabled={disabled || undefined}
    data-layout={layout}
    data-over={acceptingOver || undefined}
    aria-disabled={disabled || undefined}
    aria-label={container.label ?? String(container.id)}
    ref={setNodeRef}
    seed={`sortable-container-${String(container.id)}`}
    variant="paper"
  >
    {acceptingOver && <PencilSurface
      aria-hidden="true"
      as="span"
      className="inkra-sortable__container-target"
      seed={`sortable-container-${String(container.id)}-target`}
      variant="selection"
    />}
    {(renderContainerHeader || container.label) && <div className="inkra-sortable__container-header">
      <div className="inkra-sortable__container-title">
        {renderContainerHeader
          ? renderContainerHeader({ container, isOver: acceptingOver, itemCount: container.items.length })
          : container.label ? <PencilText>{container.label}</PencilText> : null}
      </div>
      <PencilLine aria-hidden="true" className="inkra-sortable__container-divider" seed={`sortable-container-${String(container.id)}-divider`} />
    </div>}
    <SortableContext items={ids} strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}>
      <div className="inkra-sortable__items">
        {container.items.map((item, index) => {
          const id = getItemId(item);
          return <SortableItem
            key={engineItemId(id)}
            activeId={activeId}
            container={container}
            disabled={disabled || isItemDisabled?.(item, container) === true}
            handle={handle}
            handleLabel={`${handleLabel}: ${getItemLabel(item)}`}
            id={id}
            index={index}
            item={item}
            itemClassName={itemClassName}
            renderItem={renderItem}
          />;
        })}
        {container.items.length === 0 && <div className="inkra-sortable__empty" aria-hidden="true" />}
      </div>
    </SortableContext>
  </PencilSurface>;
}

function SortableItem<Item>({
  activeId,
  container,
  disabled,
  handle,
  handleLabel,
  id,
  index,
  item,
  itemClassName,
  renderItem,
}: {
  activeId: SortableIdentifier | null;
  container: SortableContainerData<Item>;
  disabled: boolean;
  handle?: SortableProps<Item>['handle'];
  handleLabel: string;
  id: SortableIdentifier;
  index: number;
  item: Item;
  itemClassName?: string;
  renderItem: SortableProps<Item>['renderItem'];
}) {
  const hasHandle = handle === true || typeof handle === 'function';
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: engineItemId(id),
    disabled: disabled ? { draggable: true, droppable: false } : false,
    data: { type: 'inkra-sortable-item', containerId: container.id, itemId: id, disabled } satisfies SortableEngineData,
  });
  const state: SortableItemRenderState<Item> = {
    item,
    id,
    containerId: container.id,
    index,
    disabled,
    isDragging,
    isOverlay: false,
  };
  const activatorProps = { ...attributes, ...listeners } as ButtonHTMLAttributes<HTMLButtonElement>;
  const itemActivatorProps = filterItemActivatorProps({ ...attributes, ...listeners });
  const setItemRef = (element: HTMLDivElement | null) => {
    setNodeRef(element);
    if (!hasHandle) setActivatorNodeRef(element);
  };
  return <div
    {...(!hasHandle ? itemActivatorProps : {})}
    aria-disabled={disabled || undefined}
    aria-label={!hasHandle ? handleLabel : undefined}
    className={['inkra-sortable__item', itemClassName].filter(Boolean).join(' ')}
    data-disabled={disabled || undefined}
    data-dragging={isDragging || undefined}
    data-handle={hasHandle || undefined}
    data-sortable-id={String(id)}
    ref={setItemRef}
    style={{ transform: CSS.Transform.toString(transform), transition } as CSSProperties}
  >
    <PencilSurface aria-hidden="true" as="span" className="inkra-sortable__item-surface" seed={`sortable-item-${String(id)}`} variant="paper" />
    <PencilSurface aria-hidden="true" as="span" className="inkra-sortable__focus" seed={`sortable-focus-${String(id)}`} variant="outline" />
    {activeId === id && <PencilSurface aria-hidden="true" as="span" className="inkra-sortable__placeholder" seed={`sortable-placeholder-${String(id)}`} variant="selection" />}
    <div className="inkra-sortable__item-content">{renderItem(state)}</div>
    {hasHandle && <div className="inkra-sortable__handle-slot">
      {typeof handle === 'function'
        ? handle({ ...state, props: { ...activatorProps, 'aria-label': handleLabel, disabled, ref: setActivatorNodeRef } })
        : <button
          {...activatorProps}
          aria-label={handleLabel}
          className="inkra-sortable__handle"
          data-sortable-handle=""
          disabled={disabled}
          ref={setActivatorNodeRef}
          type="button"
        ><PencilIcon aria-hidden="true" paths={gripIcon} size={24} sourceSize={24} /></button>}
    </div>}
  </div>;
}

export function Sortable<Item>({
  autoScroll = true,
  className,
  containerClassName,
  containers,
  getContainerLabel = (container) => container.label ?? String(container.id),
  getItemId,
  getItemLabel = (item) => String(getItemId(item)),
  handle = false,
  isItemDisabled,
  itemClassName,
  labels: labelsProp,
  onChange,
  onMove,
  onReorder,
  renderContainerHeader,
  renderItem,
  renderOverlay,
}: SortableProps<Item>) {
  const labels = { ...defaultLabels, ...labelsProp };
  const [activeId, setActiveId] = useState<SortableIdentifier | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);
  const [projected, setProjected] = useState<SortableContainerData<Item>[] | null>(null);
  const initialRef = useRef<SortableContainerData<Item>[]>([]);
  const projectedRef = useRef<SortableContainerData<Item>[]>([]);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } } satisfies MouseSensorOptions),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } } satisfies TouchSensorOptions),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates } satisfies KeyboardSensorOptions),
  );
  const visibleContainers = projected ?? containers;
  const activeLocation = activeId === null ? null : findSortableLocation(visibleContainers, activeId, getItemId);
  const activeContainer = activeLocation === null
    ? null
    : visibleContainers.find((container) => container.id === activeLocation.containerId) ?? null;
  const activeItem = activeContainer && activeLocation
    ? activeContainer.items[activeLocation.index]
    : undefined;

  const announcements = useMemo<Announcements>(() => ({
    onDragStart({ active }) {
      const data = getEngineData(active);
      if (data?.itemId === undefined) return undefined;
      const location = findSortableLocation(containers, data.itemId, getItemId);
      const container = location && containers.find((entry) => entry.id === location.containerId);
      const item = container && location ? container.items[location.index] : undefined;
      return container && location && item !== undefined
        ? labels.pickedUp(getItemLabel(item), getContainerLabel(container), location.index + 1, container.items.length)
        : undefined;
    },
    onDragOver({ active, over }) {
      const data = getEngineData(active);
      const overData = getEngineData(over);
      if (data?.itemId === undefined || !overData || overData.disabled) return undefined;
      const current = projectedRef.current.length > 0 ? projectedRef.current : containers;
      const location = findSortableLocation(current, data.itemId, getItemId);
      const container = location && current.find((entry) => entry.id === location.containerId);
      const item = container && location ? container.items[location.index] : undefined;
      return container && location && item !== undefined
        ? labels.movedOver(getItemLabel(item), getContainerLabel(container), location.index + 1, container.items.length)
        : undefined;
    },
    onDragEnd({ active, over }) {
      const data = getEngineData(active);
      const overData = getEngineData(over);
      if (data?.itemId === undefined || !over) return undefined;
      if (overData?.disabled) {
        const location = findSortableLocation(initialRef.current, data.itemId, getItemId);
        const container = location && initialRef.current.find((entry) => entry.id === location.containerId);
        const item = container && location ? container.items[location.index] : undefined;
        return item === undefined ? undefined : labels.cancelled(getItemLabel(item));
      }
      const current = projectedRef.current;
      const location = findSortableLocation(current, data.itemId, getItemId);
      const container = location && current.find((entry) => entry.id === location.containerId);
      const item = container && location ? container.items[location.index] : undefined;
      return container && location && item !== undefined
        ? labels.dropped(getItemLabel(item), getContainerLabel(container), location.index + 1, container.items.length)
        : undefined;
    },
    onDragCancel({ active }) {
      const data = getEngineData(active);
      if (data?.itemId === undefined) return undefined;
      const location = findSortableLocation(initialRef.current, data.itemId, getItemId);
      const container = location && initialRef.current.find((entry) => entry.id === location.containerId);
      const item = container && location ? container.items[location.index] : undefined;
      return item === undefined ? undefined : labels.cancelled(getItemLabel(item));
    },
  }), [containers, getContainerLabel, getItemId, getItemLabel, labels]);

  function resetDrag() {
    setActiveId(null);
    setActiveWidth(null);
    setProjected(null);
    projectedRef.current = [];
  }

  function handleDragStart(event: DragStartEvent) {
    const data = getEngineData(event.active);
    if (data?.itemId === undefined) return;
    const snapshot = cloneSortableContainers(containers);
    initialRef.current = snapshot;
    projectedRef.current = snapshot;
    setProjected(snapshot);
    setActiveId(data.itemId);
    setActiveWidth(event.active.rect.current.initial?.width ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const overData = getEngineData(event.over);
    if (!event.over || overData?.disabled) {
      if (sortableContainersEqual(projectedRef.current, initialRef.current, getItemId)) return;
      const restored = cloneSortableContainers(initialRef.current);
      projectedRef.current = restored;
      setProjected(restored);
      return;
    }
    const next = getDropProjection(projectedRef.current, event, getItemId);
    if (sortableContainersEqual(projectedRef.current, next, getItemId)) return;
    projectedRef.current = next;
    setProjected(next);
  }

  function handleDragEnd(event: DragEndEvent) {
    const data = getEngineData(event.active);
    const overData = getEngineData(event.over);
    if (data?.itemId === undefined || !event.over || overData?.disabled) {
      resetDrag();
      return;
    }
    const next = projectedRef.current;
    const from = findSortableLocation(initialRef.current, data.itemId, getItemId);
    const to = findSortableLocation(next, data.itemId, getItemId);
    const sourceContainer = from && initialRef.current.find((container) => container.id === from.containerId);
    const item = sourceContainer && from ? sourceContainer.items[from.index] : undefined;
    if (from && to && item !== undefined && !sortableContainersEqual(initialRef.current, next, getItemId)) {
      const details: SortableChangeDetails<Item> = {
        activeId: data.itemId,
        overId: overData?.itemId ?? null,
        from,
        to,
        item,
        type: from.containerId === to.containerId ? 'reorder' : 'move',
      };
      onChange(next, details);
      if (details.type === 'reorder') onReorder?.(details);
      else onMove?.(details);
    }
    resetDrag();
  }

  function handleDragCancel(_event: DragCancelEvent) {
    resetDrag();
  }

  return <DndContext
    accessibility={{
      announcements,
      screenReaderInstructions: { draggable: labels.screenReaderInstructions },
    }}
    autoScroll={autoScroll}
    collisionDetection={collisionDetection}
    onDragCancel={handleDragCancel}
    onDragEnd={handleDragEnd}
    onDragOver={handleDragOver}
    onDragStart={handleDragStart}
    sensors={sensors}
  >
    <div className={['inkra-sortable', className].filter(Boolean).join(' ')} data-dragging={activeId !== null || undefined}>
      {visibleContainers.map((container) => <SortableContainer
        key={container.id}
        activeId={activeId}
        container={container}
        containerClassName={containerClassName}
        getItemId={getItemId}
        getItemLabel={getItemLabel}
        handle={handle}
        handleLabel={labels.handle}
        isItemDisabled={isItemDisabled}
        itemClassName={itemClassName}
        renderContainerHeader={renderContainerHeader}
        renderItem={renderItem}
      />)}
    </div>
    <DragOverlay dropAnimation={null}>
      {activeItem !== undefined && activeContainer && activeLocation ? <div
        className="inkra-sortable__overlay"
        style={activeWidth === null ? undefined : { '--inkra-sortable-overlay-width': `${activeWidth}px` } as CSSProperties}
      >
        <PencilSurface aria-hidden="true" as="span" className="inkra-sortable__overlay-surface" seed={`sortable-overlay-${String(activeId)}`} variant="paper" />
        <div className="inkra-sortable__item-content">{(renderOverlay ?? renderItem)({
          item: activeItem,
          id: activeId!,
          containerId: activeContainer.id,
          index: activeLocation.index,
          disabled: false,
          isDragging: true,
          isOverlay: true,
        })}</div>
      </div> : null}
    </DragOverlay>
  </DndContext>;
}
