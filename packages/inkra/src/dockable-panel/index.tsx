import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from 'react';

import { Button } from '../Button.js';
import { PencilIcon, type PencilIconPath } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import {
  clampDockablePanelPosition,
  placeDockablePanel,
  promoteDockablePanel,
} from './model.js';
import type {
  DockablePanelBounds,
  DockablePanelPosition,
  DockablePanelSnapEdge,
} from './model.js';

export type {
  DockablePanelBounds,
  DockablePanelPlacement,
  DockablePanelPosition,
  DockablePanelSize,
  DockablePanelSnapEdge,
} from './model.js';

export type DockablePanelPositionReason = 'drag' | 'keyboard' | 'reset' | 'viewport';

export interface DockablePanelPositionChangeDetails {
  reason: DockablePanelPositionReason;
  snappedEdges: readonly DockablePanelSnapEdge[];
}

export interface DockablePanelLabels {
  move?: string;
  collapse?: string;
  expand?: string;
  reset?: string;
  keyboardInstructions?: string;
}

export interface DockablePanelWorkspaceProps extends HTMLAttributes<HTMLDivElement> {
  activeId?: string | null;
  defaultActiveId?: string | null;
  onActiveChange?: (id: string) => void;
  baseZIndex?: number;
  boundaryPadding?: number;
  snapThreshold?: number;
  titleBarVisibility?: number;
}

interface WorkspaceContextValue {
  activeId: string | null;
  activate: (id: string) => void;
  bounds: Omit<DockablePanelBounds, 'titleBarHeight'>;
  commitDrag: (id: string, callback: ((delta: DockablePanelPosition) => void) | null) => void;
  layer: (id: string) => number;
  register: (id: string) => () => void;
  snapThreshold: number;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export const DockablePanelWorkspace = forwardRef<HTMLDivElement, DockablePanelWorkspaceProps>(
  function DockablePanelWorkspace(
    {
      activeId,
      baseZIndex = 0,
      boundaryPadding = 8,
      children,
      className,
      defaultActiveId = null,
      onActiveChange,
      snapThreshold = 12,
      titleBarVisibility = 56,
      ...props
    },
    forwardedRef,
  ) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const dragCallbacks = useRef(new Map<string, (delta: DockablePanelPosition) => void>());
    const [order, setOrder] = useState<string[]>([]);
    const [uncontrolledActiveId, setUncontrolledActiveId] = useState<string | null>(defaultActiveId);
    const resolvedActiveId = activeId === undefined ? uncontrolledActiveId : activeId;
    const [size, setSize] = useState({ width: 0, height: 0 });
    const sensors = useSensors(
      useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
      useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    );

    const setRoot = useCallback((node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    }, [forwardedRef]);

    useBrowserLayoutEffect(() => {
      const root = rootRef.current;
      if (!root) return undefined;
      const update = () => setSize(current => {
        const next = { width: root.clientWidth, height: root.clientHeight };
        return current.width === next.width && current.height === next.height ? current : next;
      });
      update();
      if (typeof ResizeObserver === 'undefined') return undefined;
      const observer = new ResizeObserver(update);
      observer.observe(root);
      return () => observer.disconnect();
    }, []);

    const activate = useCallback((id: string) => {
      setOrder(current => current[current.length - 1] === id ? current : promoteDockablePanel(current, id));
      if (activeId === undefined) setUncontrolledActiveId(id);
      if (resolvedActiveId !== id) onActiveChange?.(id);
    }, [activeId, onActiveChange, resolvedActiveId]);

    useEffect(() => {
      if (activeId != null) setOrder(current => current[current.length - 1] === activeId ? current : promoteDockablePanel(current, activeId));
    }, [activeId]);

    const register = useCallback((id: string) => {
      setOrder(current => current.includes(id) ? current : [...current, id]);
      return () => {
        dragCallbacks.current.delete(id);
        setOrder(current => current.filter(value => value !== id));
      };
    }, []);

    const commitDrag = useCallback((id: string, callback: ((delta: DockablePanelPosition) => void) | null) => {
      if (callback) dragCallbacks.current.set(id, callback);
      else dragCallbacks.current.delete(id);
    }, []);
    const bounds = useMemo(() => ({
      height: size.height,
      padding: boundaryPadding,
      titleBarVisibility,
      width: size.width,
    }), [boundaryPadding, size.height, size.width, titleBarVisibility]);
    const layers = useMemo(() => new Map(order.map((id, index) => [id, index])), [order]);

    const context = useMemo<WorkspaceContextValue>(() => ({
      activeId: resolvedActiveId,
      activate,
      bounds,
      commitDrag,
      layer(id) {
        return baseZIndex + (resolvedActiveId === id ? order.length : (layers.get(id) ?? 0));
      },
      register,
      snapThreshold,
    }), [activate, baseZIndex, bounds, commitDrag, layers, order.length, register, resolvedActiveId, snapThreshold]);

    function handleDragEnd(event: DragEndEvent) {
      const id = String(event.active.id);
      dragCallbacks.current.get(id)?.({ x: event.delta.x, y: event.delta.y });
    }

    return <WorkspaceContext.Provider value={context}>
      <DndContext sensors={sensors} onDragStart={(event: DragStartEvent) => activate(String(event.active.id))} onDragEnd={handleDragEnd}>
        <div {...props} className={classes('inkra-dockable-panel-workspace', className)} ref={setRoot}>
          {children}
        </div>
      </DndContext>
    </WorkspaceContext.Provider>;
  },
);

export interface DockablePanelProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange' | 'title'> {
  id: string;
  title: ReactNode;
  position?: DockablePanelPosition;
  defaultPosition?: DockablePanelPosition;
  onPositionChange?: (position: DockablePanelPosition, details: DockablePanelPositionChangeDetails) => void;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  collapsible?: boolean;
  movable?: boolean;
  keyboardStep?: number;
  headerActions?: ReactNode;
  labels?: DockablePanelLabels;
}

const collapsePaths: readonly PencilIconPath[] = [{ d: 'M6 12h12' }];
const expandPaths: readonly PencilIconPath[] = [{ d: 'M6 9h12M12 3v12' }];
const resetPaths: readonly PencilIconPath[] = [
  { d: 'M4 12a8 8 0 1 0 2.34-5.66L4 8.68' },
  { d: 'M4 4v4.68h4.68' },
];

const defaultLabels: Required<DockablePanelLabels> = {
  move: 'Move panel',
  collapse: 'Collapse panel',
  expand: 'Expand panel',
  reset: 'Restore panel position',
  keyboardInstructions: 'Use the arrow keys to move this panel. Hold Shift for larger steps. Press Home to restore its position.',
};

function renderTitle(title: ReactNode) {
  return typeof title === 'string' ? <PencilText>{title}</PencilText> : title;
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(
    'button, a, input, select, textarea, [contenteditable="true"], [data-dockable-panel-no-drag]',
  ));
}

export const DockablePanel = forwardRef<HTMLElement, DockablePanelProps>(function DockablePanel(
  {
    children,
    className,
    collapsed,
    collapsible = true,
    defaultCollapsed = false,
    defaultPosition = { x: 8, y: 8 },
    headerActions,
    id,
    keyboardStep = 8,
    labels: labelOverrides,
    movable = true,
    onCollapsedChange,
    onFocusCapture,
    onPointerDown,
    onPositionChange,
    position,
    style,
    title,
    ...props
  },
  forwardedRef,
) {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error('DockablePanel must be rendered inside DockablePanelWorkspace.');
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const instructionsId = `${generatedId}-instructions`;
  const panelRef = useRef<HTMLElement | null>(null);
  const titleBarRef = useRef<HTMLDivElement | null>(null);
  const [uncontrolledPosition, setUncontrolledPosition] = useState(defaultPosition);
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(defaultCollapsed);
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0, titleBarHeight: 44 });
  const resolvedPosition = position ?? uncontrolledPosition;
  const resolvedCollapsed = collapsed ?? uncontrolledCollapsed;
  const positionRef = useRef(resolvedPosition);
  positionRef.current = resolvedPosition;
  const labels = { ...defaultLabels, ...labelOverrides };
  const {
    activate,
    bounds,
    commitDrag,
    layer,
    register,
    snapThreshold,
  } = workspace;
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef, transform } = useDraggable({
    id,
    disabled: !movable,
    attributes: { role: 'button', roleDescription: labels.move, tabIndex: 0 },
  });

  const setPanelRef = useCallback((node: HTMLElement | null) => {
    panelRef.current = node;
    setNodeRef(node);
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef, setNodeRef]);

  const changePosition = useCallback((next: DockablePanelPosition, reason: DockablePanelPositionReason, snap: boolean) => {
    const panel = panelRef.current;
    const titleBar = titleBarRef.current;
    if (!panel || !titleBar || bounds.width <= 0 || bounds.height <= 0) return;
    const measuredBounds = { ...bounds, titleBarHeight: titleBar.offsetHeight };
    const placement = snap
      ? placeDockablePanel(next, { width: panel.offsetWidth, height: panel.offsetHeight }, measuredBounds, snapThreshold)
      : { position: clampDockablePanelPosition(next, { width: panel.offsetWidth, height: panel.offsetHeight }, measuredBounds), snappedEdges: [] };
    if (placement.position.x === positionRef.current.x && placement.position.y === positionRef.current.y) return;
    if (position === undefined) setUncontrolledPosition(placement.position);
    positionRef.current = placement.position;
    onPositionChange?.(placement.position, { reason, snappedEdges: placement.snappedEdges });
  }, [bounds, onPositionChange, position, snapThreshold]);

  useEffect(() => register(id), [id, register]);

  useEffect(() => {
    commitDrag(id, delta => changePosition({
      x: positionRef.current.x + delta.x,
      y: positionRef.current.y + delta.y,
    }, 'drag', true));
    return () => commitDrag(id, null);
  }, [changePosition, commitDrag, id]);

  useBrowserLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => {
      const titleBarHeight = titleBarRef.current?.offsetHeight ?? 44;
      const next = { width: panel.offsetWidth, height: panel.offsetHeight, titleBarHeight };
      setPanelSize(current => current.width === next.width
        && current.height === next.height
        && current.titleBarHeight === next.titleBarHeight ? current : next);
      changePosition(positionRef.current, 'viewport', false);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [changePosition]);

  useBrowserLayoutEffect(() => {
    changePosition(positionRef.current, 'viewport', false);
  }, [bounds.height, bounds.width, changePosition, resolvedPosition.x, resolvedPosition.y]);

  function resetPosition() {
    activate(id);
    changePosition(defaultPosition, 'reset', false);
    titleBarRef.current?.focus();
  }

  function changeCollapsed(next: boolean) {
    if (collapsed === undefined) setUncontrolledCollapsed(next);
    onCollapsedChange?.(next);
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!movable || event.defaultPrevented || isInteractiveTarget(event.target)) return;
    if (event.key === 'Home') {
      event.preventDefault();
      resetPosition();
      return;
    }
    const direction = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    activate(id);
    const step = Math.max(1, keyboardStep) * (event.shiftKey ? 4 : 1);
    changePosition({
      x: positionRef.current.x + direction.x * step,
      y: positionRef.current.y + direction.y * step,
    }, 'keyboard', false);
  }

  const nativeListeners = movable ? listeners : undefined;
  const translatedPosition = {
    x: resolvedPosition.x + (transform?.x ?? 0),
    y: resolvedPosition.y + (transform?.y ?? 0),
  };
  const visualPosition = panelSize.width > 0 && panelSize.height > 0 && bounds.width > 0 && bounds.height > 0
    ? clampDockablePanelPosition(translatedPosition, panelSize, { ...bounds, titleBarHeight: panelSize.titleBarHeight })
    : translatedPosition;
  const panelStyle = {
    ...style,
    '--inkra-dockable-panel-x': `${visualPosition.x}px`,
    '--inkra-dockable-panel-y': `${visualPosition.y}px`,
    zIndex: layer(id),
  } as CSSProperties;

  return <PencilSurface<'section'>
    {...props}
    as="section"
    aria-labelledby={titleId}
    className={classes('inkra-dockable-panel', className)}
    data-active={workspace.activeId === id || undefined}
    data-collapsed={resolvedCollapsed || undefined}
    data-dragging={isDragging || undefined}
    onFocusCapture={event => {
      onFocusCapture?.(event);
      if (!event.defaultPrevented) activate(id);
    }}
    onPointerDown={event => {
      onPointerDown?.(event);
      if (!event.defaultPrevented) activate(id);
    }}
    ref={setPanelRef}
    style={panelStyle}
    variant="paper"
  >
    <div className="inkra-dockable-panel__header">
      <div
        {...attributes}
        {...nativeListeners}
        aria-describedby={movable ? instructionsId : undefined}
        aria-label={labels.move}
        className="inkra-dockable-panel__handle"
        data-dockable-panel-handle
        onKeyDown={handleTitleKeyDown}
        onMouseDown={event => {
          if (!isInteractiveTarget(event.target)) nativeListeners?.onMouseDown?.(event);
        }}
        onTouchStart={event => {
          if (!isInteractiveTarget(event.target)) nativeListeners?.onTouchStart?.(event);
        }}
        ref={node => {
          titleBarRef.current = node;
          setActivatorNodeRef(node);
        }}
      >
        <span className="inkra-dockable-panel__title" id={titleId}>{renderTitle(title)}</span>
      </div>
      <div className="inkra-dockable-panel__actions" data-dockable-panel-no-drag>
        {headerActions}
        {movable && <Button aria-label={labels.reset} data-dockable-panel-reset size="icon-xs" variant="ghost" onClick={resetPosition}>
          <PencilIcon decorative paths={resetPaths} size={18} sourceSize={24} />
        </Button>}
        {collapsible && <Button
          aria-expanded={!resolvedCollapsed}
          aria-label={resolvedCollapsed ? labels.expand : labels.collapse}
          data-dockable-panel-collapse
          size="icon-xs"
          variant="ghost"
          onClick={() => changeCollapsed(!resolvedCollapsed)}
        >
          <PencilIcon decorative paths={resolvedCollapsed ? expandPaths : collapsePaths} size={18} sourceSize={24} />
        </Button>}
      </div>
    </div>
    <PencilLine className="inkra-dockable-panel__divider" />
    {!resolvedCollapsed && <div className="inkra-dockable-panel__body">{children}</div>}
    {movable && <span className="inkra-visually-hidden" id={instructionsId}>{labels.keyboardInstructions}</span>}
  </PencilSurface>;
});
