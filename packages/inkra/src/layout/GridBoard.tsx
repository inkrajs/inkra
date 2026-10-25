import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode, Ref } from 'react';
import { GridItem, useContainerWidth, useGridLayout } from 'react-grid-layout';
import { cloneLayout, correctBounds, getCompactor, moveElement } from 'react-grid-layout/core';
import type { Layout, LayoutItem } from 'react-grid-layout';
import { __iconData as moveIcon } from 'lucide-react/dist/esm/icons/move.mjs';
import { __iconData as resizeIcon } from 'lucide-react/dist/esm/icons/move-diagonal-2.mjs';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { useInkraLocale } from '../i18n/index.js';

export type GridBoardLayout = Layout;
export type GridBoardLayoutItem = LayoutItem;
export interface GridBoardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'> {
  layout?: GridBoardLayout;
  defaultLayout?: GridBoardLayout;
  onLayoutChange?: (layout: GridBoardLayout) => void;
  columns?: number;
  rowHeight?: number;
  gap?: number;
  draggable?: boolean;
  resizable?: boolean;
  disabled?: boolean;
  /** Container width below which cards become a non-editable single column. 0 disables stacking. */
  stackAt?: number;
  compact?: 'vertical' | 'horizontal' | null;
  getItemLabel?: (id: string) => string;
  getActionLabel?: (action: 'move' | 'resize', id: string) => string;
  children: (item: GridBoardLayoutItem) => ReactNode;
}

const paths = (icon: typeof moveIcon) => icon.node.flatMap(([tag, attrs]) => tag === 'path' && typeof attrs.d === 'string' ? [{ d: attrs.d }] : []);
const movePaths = paths(moveIcon);
const resizePaths = paths(resizeIcon);
const same = (a: Layout, b: Layout) => a.length === b.length && a.every((item, index) => {
  const other = b[index];
  return other && item.i === other.i && item.x === other.x && item.y === other.y && item.w === other.w && item.h === other.h;
});
const sameConfiguration = (a: Layout, b: Layout) => same(a, b) && a.every((item, index) => {
  const other = b[index];
  return ['minW', 'minH', 'maxW', 'maxH', 'isDraggable', 'isResizable', 'isBounded'].every(key =>
    item[key as keyof LayoutItem] === other[key as keyof LayoutItem])
    && Boolean(item.static) === Boolean(other.static)
    && item.constraints === other.constraints
    && (item.resizeHandles ?? []).join(',') === (other.resizeHandles ?? []).join(',');
});

function validateBoardLayout(value: Layout) {
  if (!Array.isArray(value)) throw new TypeError('Grid.Board layout must be an array.');
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item.i !== 'string' || !item.i.trim() || ids.has(item.i)) {
      throw new TypeError('Grid.Board layout items must have unique, non-empty string ids (i).');
    }
    ids.add(item.i);
    for (const key of ['x', 'y', 'w', 'h'] as const) {
      const minimum = key === 'w' || key === 'h' ? 1 : 0;
      if (!Number.isSafeInteger(item[key]) || item[key] < minimum) {
        throw new RangeError(`Grid.Board item "${item.i}" ${key} must be a finite integer >= ${minimum}.`);
      }
    }
    for (const key of ['minW', 'minH', 'maxW', 'maxH'] as const) {
      const size = item[key];
      if (size !== undefined && !(key.startsWith('max') && size === Infinity) && (!Number.isSafeInteger(size) || size < 1)) {
        throw new RangeError(`Grid.Board item "${item.i}" ${key} must be a positive integer (or Infinity for a maximum).`);
      }
    }
    if ((item.minW ?? 1) > (item.maxW ?? Infinity) || (item.minH ?? 1) > (item.maxH ?? Infinity)) {
      throw new RangeError(`Grid.Board item "${item.i}" minimum size cannot exceed its maximum.`);
    }
  }
}

export function GridBoard({ layout, defaultLayout = [], onLayoutChange, columns = 12, rowHeight = 48,
  gap = 12, draggable = true, resizable = true, disabled = false, stackAt = 480,
  compact = 'vertical', getItemLabel = id => id, getActionLabel, children, className, style, ...props
}: GridBoardProps) {
  const { t } = useInkraLocale();
  const [local, setLocal] = useState(defaultLayout);
  const current = layout ?? local;
  const cols = Number.isFinite(columns) ? Math.max(1, Math.min(48, Math.trunc(columns) || 12)) : 12;
  const height = Number.isFinite(rowHeight) ? Math.max(24, rowHeight) : 48;
  const spacing = Number.isFinite(gap) ? Math.max(0, gap) : 12;
  const { width, mounted, containerRef } = useContainerWidth({ initialWidth: 800 });
  const stacked = mounted && stackAt > 0 && width < stackAt;
  const compactor = getCompactor(compact);
  const resolved = useMemo(() => {
    validateBoardLayout(current);
    return compactor.compact(correctBounds(cloneLayout(current), { cols }), cols);
  }, [current, cols, compactor]);
  const engine = useGridLayout({ layout: resolved, cols, compactor });
  const pending = useRef(false);
  const latest = useRef({ current, layout, onLayoutChange });
  latest.current = { current: resolved, layout, onLayoutChange };

  useEffect(() => {
    if (engine.isInteracting || !pending.current) return;
    pending.current = false;
    const state = latest.current;
    if (!same(engine.layout, state.current)) {
      const next = cloneLayout(engine.layout);
      if (state.layout === undefined) setLocal(next);
      state.onLayoutChange?.(next);
    }
    // Controlled values are requests, including when the owner rejects an update.
    if (state.layout !== undefined) engine.setLayout(state.current);
  }, [engine.layout, engine.isInteracting, engine.setLayout]);

  useEffect(() => {
    if (!engine.isInteracting && !pending.current && !sameConfiguration(resolved, engine.layout)) engine.setLayout(resolved);
  }, [resolved, engine.layout, engine.isInteracting, engine.setLayout]);

  const actionLabel = (action: 'move' | 'resize', id: string) => getActionLabel?.(action, id)
    ?? `${t(action === 'move' ? 'sortable.handle' : 'resizable.label')}: ${getItemLabel(id)}`;
  const keyAdjust = (event: KeyboardEvent, item: LayoutItem, resize: boolean) => {
    const delta = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[event.key];
    if (!delta || disabled || stacked || item.static || (resize ? !resizable || item.isResizable === false : !draggable || item.isDraggable === false)) return;
    event.preventDefault();
    pending.current = true;
    const [dx, dy] = delta;
    if (resize) {
      const w = Math.min(item.maxW ?? cols, cols - item.x, Math.max(item.minW ?? 1, item.w + dx));
      const h = Math.min(item.maxH ?? Infinity, Math.max(item.minH ?? 1, item.h + dy));
      engine.onResizeStop(item.i, w, h);
    } else {
      const next = cloneLayout(engine.layout);
      const target = next.find(value => value.i === item.i)!;
      engine.setLayout(moveElement(next, target, Math.max(0, Math.min(cols - item.w, item.x + dx)), Math.max(0, item.y + dy), true, false, compact, cols));
    }
  };
  return <div {...props} ref={containerRef} className={['inkra-grid-board', className].filter(Boolean).join(' ')}
    data-stacked={stacked || undefined} style={{ '--inkra-grid-board-gap': `${spacing}px`, ...style } as CSSProperties}>
    <div className="inkra-grid-board__canvas" style={{ height: stacked ? undefined : Math.max(0, engine.containerHeight * (height + spacing) - spacing) }}>
      {engine.layout.map(item => {
        const canMove = draggable && !disabled && !stacked && !item.static && item.isDraggable !== false;
        const canResize = resizable && !disabled && !stacked && !item.static && item.isResizable !== false;
        return <GridItem key={item.i} {...item} cols={cols} containerWidth={width} rowHeight={height}
          margin={[spacing, spacing]} containerPadding={[0, 0]} maxRows={Infinity} isBounded={false}
          isDraggable={canMove} isResizable={canResize} allowMobileScroll dragThreshold={4}
          handle=".inkra-grid-board__move" cancel=".inkra-grid-board__content" resizeHandles={['se']}
          className="inkra-grid-board__item" usePercentages={!mounted} useCSSTransforms={mounted}
          onDragStart={(id, x, y) => { pending.current = true; engine.onDragStart(id, x, y); }}
          onDrag={engine.onDrag} onDragStop={engine.onDragStop}
          onResizeStart={id => { pending.current = true; engine.onResizeStart(id); }}
          onResize={(id, w, h) => engine.onResize(id, w, h)} onResizeStop={engine.onResizeStop}
          resizeHandle={(axis, ref) => <button ref={ref as Ref<HTMLButtonElement>} type="button"
            className={`react-resizable-handle react-resizable-handle-${axis} inkra-grid-board__resize`}
            disabled={!canResize} tabIndex={canResize ? 0 : -1} aria-label={actionLabel('resize', item.i)}
            onKeyDown={event => keyAdjust(event, item, true)}>
            <PencilSurface as="span" variant="outline" aria-hidden="true" className="inkra-grid-board__focus" />
            <PencilIcon paths={resizePaths} size={18} />
          </button>}>
          <div data-grid-item={item.i}>
            <PencilSurface variant="paper" className="inkra-grid-board__surface">
              <header className="inkra-grid-board__header">
                <PencilText className="inkra-grid-board__title">{getItemLabel(item.i)}</PencilText>
                {canMove && <button type="button" className="inkra-grid-board__move" aria-label={actionLabel('move', item.i)}
                  onKeyDown={event => keyAdjust(event, item, false)}>
                  <PencilSurface as="span" variant="outline" aria-hidden="true" className="inkra-grid-board__focus" />
                  <PencilIcon paths={movePaths} size={18} /></button>}
              </header>
              <div className="inkra-grid-board__content">{children(item)}</div>
            </PencilSurface>
          </div>
        </GridItem>;
      })}
    </div>
  </div>;
}
