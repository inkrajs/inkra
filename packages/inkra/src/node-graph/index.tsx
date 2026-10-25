import { useInkraLocale } from '../i18n/index.js';
import {
  EdgeLabelRenderer,
  Handle,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge as addFlowEdge,
  applyEdgeChanges as applyFlowEdgeChanges,
  applyNodeChanges as applyFlowNodeChanges,
  getBezierPath,
  useReactFlow,
  useViewport,
} from '@xyflow/react';
import type {
  Connection,
  ConnectionLineComponentProps,
  Edge,
  EdgeChange,
  EdgeProps,
  FitViewOptions,
  Node,
  NodeChange,
  NodeProps,
  OnConnect,
  ReactFlowInstance,
  Viewport,
} from '@xyflow/react';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  ForwardedRef,
  HTMLAttributes,
  ReactElement,
  ReactNode,
  RefAttributes,
} from 'react';

import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import {
  BoundedCache,
  PENCIL_RENDERER_VERSION,
  canvasByteCost,
  canvasIsUsable,
  effectiveDpr,
} from '../internal/cache.js';
import { observeCanvasRecovery } from '../internal/recovery.js';
import { seedToNumber } from '../internal/random.js';
import { maxStrokeRoughness, pencilRenderDefaults, readRenderToken } from '../internal/renderTokens.js';
import { pencilStroke } from '../internal/stroke.js';
import type { PencilPoint } from '../internal/stroke.js';

export type NodeGraphPortPosition = 'top' | 'right' | 'bottom' | 'left';

export interface NodeGraphPortDefinition {
  id: string;
  type: 'source' | 'target';
  position?: NodeGraphPortPosition;
  label: string;
  connectable?: boolean;
}

export interface NodeGraphNodeData extends Record<string, unknown> {
  label?: ReactNode;
  description?: ReactNode;
  content?: ReactNode;
  ports?: NodeGraphPortDefinition[];
}

export interface NodeGraphEdgeData extends Record<string, unknown> {
  tone?: 'neutral' | 'accent';
}

export type NodeGraphNode<Data extends Record<string, unknown> = NodeGraphNodeData> = Node<Data>;
export type NodeGraphEdge<Data extends Record<string, unknown> = NodeGraphEdgeData> = Edge<Data>;
export type NodeGraphNodeChange<NodeType extends NodeGraphNode = NodeGraphNode> = NodeChange<NodeType>;
export type NodeGraphEdgeChange<EdgeType extends NodeGraphEdge = NodeGraphEdge> = EdgeChange<EdgeType>;
export type NodeGraphConnection = Connection;
export type NodeGraphViewport = Viewport;

export interface NodeGraphRenderNodeProps<Data extends Record<string, unknown> = NodeGraphNodeData> {
  id: string;
  data: Data;
  selected: boolean;
  dragging: boolean;
  readOnly: boolean;
}

export interface NodeGraphRenderEdgeProps<EdgeType extends NodeGraphEdge = NodeGraphEdge> {
  id: string;
  edge: EdgeType;
  selected: boolean;
  path: string;
  labelX: number;
  labelY: number;
}

export interface NodeGraphRef {
  fitView: (options?: FitViewOptions) => Promise<boolean>;
  zoomIn: () => Promise<boolean>;
  zoomOut: () => Promise<boolean>;
  getViewport: () => NodeGraphViewport;
}

export interface NodeGraphControlLabels {
  zoomIn: string;
  zoomOut: string;
  fitView: string;
}

export interface NodeGraphRootProps<
  NodeType extends NodeGraphNode = NodeGraphNode,
  EdgeType extends NodeGraphEdge = NodeGraphEdge,
> extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onError'> {
  /** Immutable snapshots: replace the array and each changed node (including changed nested data). */
  nodes: NodeType[];
  /** Immutable snapshots: replace the array and each changed edge (including changed nested data). */
  edges: EdgeType[];
  onNodesChange?: (changes: NodeGraphNodeChange<NodeType>[]) => void;
  onEdgesChange?: (changes: NodeGraphEdgeChange<EdgeType>[]) => void;
  onConnect?: OnConnect;
  isValidConnection?: (connection: NodeGraphConnection | EdgeType) => boolean;
  renderNode?: (props: NodeGraphRenderNodeProps<NodeType['data']>) => ReactNode;
  renderEdge?: (props: NodeGraphRenderEdgeProps<EdgeType>) => ReactNode;
  renderEdgeLabel?: (edge: EdgeType) => ReactNode;
  readOnly?: boolean;
  emptyState?: ReactNode;
  controls?: boolean;
  controlLabels?: Partial<NodeGraphControlLabels>;
  fitView?: boolean;
  fitViewOptions?: FitViewOptions<NodeType>;
  defaultViewport?: NodeGraphViewport;
  viewport?: NodeGraphViewport;
  onViewportChange?: (viewport: NodeGraphViewport) => void;
  minZoom?: number;
  maxZoom?: number;
  panOnDrag?: boolean;
  zoomOnScroll?: boolean;
  zoomOnPinch?: boolean;
  connectOnClick?: boolean;
  onlyRenderVisibleElements?: boolean;
}

interface NodeRendererData extends NodeGraphNodeData {
  __inkraRenderNode?: NodeGraphRootProps['renderNode'];
  __inkraReadOnly?: boolean;
  __inkraData?: Record<string, unknown>;
}

type InternalNode = Node<NodeRendererData, 'inkra'>;
interface EdgeRendererData extends NodeGraphEdgeData {
  __inkraEdge?: NodeGraphEdge;
  __inkraRenderEdge?: NodeGraphRootProps['renderEdge'];
  __inkraRenderEdgeLabel?: NodeGraphRootProps['renderEdgeLabel'];
}
type InternalEdge = Edge<EdgeRendererData, 'inkra'>;

const positionMap: Record<NodeGraphPortPosition, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

const zoomInPaths = [
  { d: 'M 12 5 L 12 19' },
  { d: 'M 5 12 L 19 12' },
] as const;
const zoomOutPaths = [{ d: 'M 5 12 L 19 12' }] as const;
const fitViewPaths = [
  { d: 'M 9 5 L 5 5 L 5 9' },
  { d: 'M 15 5 L 19 5 L 19 9' },
  { d: 'M 5 15 L 5 19 L 9 19' },
  { d: 'M 19 15 L 19 19 L 15 19' },
] as const;

const edgeCanvasCache = new BoundedCache<HTMLCanvasElement>(96, 24 * 1024 * 1024);
const edgeCanvasPadding = 12;
const edgeCanvasMaxDimension = 1024;
const edgeCanvasMaxPixels = 512 * 512;
const edgeCanvasMinScale = 0.5;
const edgeMaxSampleSegments = 1024;

function readableLabel(value: ReactNode, fallback: string): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

export interface NodeGraphPortProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id' | 'children'> {
  id: string;
  type: 'source' | 'target';
  position?: NodeGraphPortPosition;
  label: string;
  connectable?: boolean;
}

const NodeGraphPort = forwardRef<HTMLDivElement, NodeGraphPortProps>(function NodeGraphPort({
  id,
  type,
  position = type === 'source' ? 'right' : 'left',
  label,
  connectable = true,
  className,
  style,
  ...props
}, ref) {
  const { zoom } = useViewport();
  const portStyle = {
    ...style,
    '--inkra-node-graph-port-scale': 1 / Math.max(zoom, 0.01),
  } as CSSProperties & Record<'--inkra-node-graph-port-scale', number>;
  return <Handle
    {...props}
    ref={ref}
    id={id}
    type={type}
    position={positionMap[position]}
    isConnectable={connectable}
    aria-label={label}
    className={['inkra-node-graph__port', className].filter(Boolean).join(' ')}
    data-port-position={position}
    style={portStyle}
  >
    <span aria-hidden="true" className="inkra-node-graph__port-visual">
      <PencilSurface
        as="span"
        className="inkra-node-graph__port-feedback"
        radius={8}
        seed={`node-graph-port-${type}-${id}-feedback`}
        variant="quiet"
      />
      <PencilSurface
        as="span"
        className="inkra-node-graph__port-mark"
        radius={8}
        seed={`node-graph-port-${type}-${id}`}
        variant="outline"
      />
    </span>
  </Handle>;
});

export interface NodeGraphNodeProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  dragging?: boolean;
  readOnly?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  ports?: NodeGraphPortDefinition[];
  children?: ReactNode;
  seed?: string;
}

const NodeGraphNode = forwardRef<HTMLDivElement, NodeGraphNodeProps>(function NodeGraphNode({
  selected = false,
  dragging = false,
  readOnly = false,
  label,
  description,
  ports = [],
  children,
  className,
  seed = 'node-graph-node',
  ...props
}, ref) {
  return <div
    {...props}
    ref={ref}
    className={['inkra-node-graph__node-shell', className].filter(Boolean).join(' ')}
    data-selected={selected || undefined}
    data-dragging={dragging || undefined}
    data-read-only={readOnly || undefined}
  >
    <PencilSurface className="inkra-node-graph__node-paper" variant="paper" radius={8} seed={seed}>
      {selected && <PencilSurface aria-hidden="true" className="inkra-node-graph__node-selection" variant="selection" seed={`${seed}-selection`} />}
      <PencilSurface aria-hidden="true" as="span" className="inkra-node-graph__node-focus" radius={8} seed={`${seed}-focus`} variant="outline" />
      <div className="inkra-node-graph__node-content">
        {label != null && <div className="inkra-node-graph__node-label">{typeof label === 'string' ? <PencilText>{label}</PencilText> : label}</div>}
        {description != null && <div className="inkra-node-graph__node-description">{description}</div>}
        {children != null && <div className="inkra-node-graph__node-body">{children}</div>}
      </div>
    </PencilSurface>
    {ports.map(port => <NodeGraphPort key={`${port.type}-${port.id}`} {...port} connectable={!readOnly && port.connectable !== false} />)}
  </div>;
});

const DefaultNodeRenderer = memo(function DefaultNodeRenderer({ id, data, selected, dragging }: NodeProps<InternalNode>) {
  const originalData = data.__inkraData ?? data;
  const custom = data.__inkraRenderNode?.({
    id,
    data: originalData,
    selected,
    dragging,
    readOnly: Boolean(data.__inkraReadOnly),
  });
  if (custom != null) return custom;
  return <NodeGraphNode
    label={(originalData as NodeGraphNodeData).label}
    description={(originalData as NodeGraphNodeData).description}
    ports={(originalData as NodeGraphNodeData).ports}
    selected={selected}
    dragging={dragging}
    readOnly={Boolean(data.__inkraReadOnly)}
    seed={`node-graph-${id}`}
  >
    {(originalData as NodeGraphNodeData).content}
  </NodeGraphNode>;
});

export interface NodeGraphEdgeProps {
  id: string;
  path: string;
  labelX?: number;
  labelY?: number;
  selected?: boolean;
  interactionWidth?: number;
  label?: ReactNode;
  className?: string;
}

interface EdgeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EdgeCanvasBudget {
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
}

function boundsEqual(previous: EdgeBounds | null, next: EdgeBounds): boolean {
  return previous != null
    && Math.abs(previous.x - next.x) < 0.01
    && Math.abs(previous.y - next.y) < 0.01
    && Math.abs(previous.width - next.width) < 0.01
    && Math.abs(previous.height - next.height) < 0.01;
}

function edgeCanvasBudget(bounds: EdgeBounds, requestedScale: number): EdgeCanvasBudget | null {
  const cssPixels = bounds.width * bounds.height;
  if (!Number.isFinite(cssPixels) || cssPixels <= 0) return null;
  const scale = Math.min(
    requestedScale,
    edgeCanvasMaxDimension / bounds.width,
    edgeCanvasMaxDimension / bounds.height,
    Math.sqrt(edgeCanvasMaxPixels / cssPixels),
  );
  if (!Number.isFinite(scale) || scale < edgeCanvasMinScale) return null;
  const width = Math.max(1, Math.floor(bounds.width * scale));
  const height = Math.max(1, Math.floor(bounds.height * scale));
  if (width > edgeCanvasMaxDimension || height > edgeCanvasMaxDimension || width * height > edgeCanvasMaxPixels) return null;
  return { width, height, scaleX: width / bounds.width, scaleY: height / bounds.height };
}

function sampleSvgPath(path: SVGPathElement, bounds: EdgeBounds): PencilPoint[] {
  const total = path.getTotalLength();
  if (!Number.isFinite(total) || total <= 0) return [];
  const count = Math.min(edgeMaxSampleSegments, Math.max(2, Math.ceil(total / 1.4)));
  return Array.from({ length: count + 1 }, (_, index) => {
    const point = path.getPointAtLength(total * index / count);
    return [point.x - bounds.x, point.y - bounds.y] as const;
  });
}

function PencilEdgeCanvas({ id, path, className, selected = false }: {
  id: string;
  path: string;
  className?: string;
  selected?: boolean;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bounds, setBounds] = useState<EdgeBounds | null>(null);
  const [ready, setReady] = useState(false);
  const budget = useMemo(() => bounds ? edgeCanvasBudget(bounds, effectiveDpr(2)) : null, [bounds]);
  const measure = useCallback(() => {
    const element = pathRef.current;
    if (!element) return;
    try {
      const box = element.getBBox();
      const next = {
        x: box.x - edgeCanvasPadding,
        y: box.y - edgeCanvasPadding,
        width: Math.max(1, box.width + edgeCanvasPadding * 2),
        height: Math.max(1, box.height + edgeCanvasPadding * 2),
      };
      setBounds(previous => boundsEqual(previous, next) ? previous : next);
    } catch {
      setBounds(null);
    }
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, path]);

  useLayoutEffect(() => {
    setReady(false);
  }, [budget, path]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const pathElement = pathRef.current;
    if (!canvas || !pathElement || !bounds || !budget) return undefined;
    let disposed = false;
    let frame = 0;
    let lastPaint = '';
    const paint = () => {
      frame = 0;
      if (disposed) return;
      try {
        const style = getComputedStyle(canvas);
        const width = readRenderToken(style, '--inkra-stroke-width', pencilRenderDefaults.strokeWidth, 0.3, 3);
        const roughness = readRenderToken(style, '--inkra-stroke-amplitude', pencilRenderDefaults.strokeRoughness, 0, maxStrokeRoughness);
        const numericSeed = seedToNumber(`node-graph-edge-${id}`);
        const key = JSON.stringify([
          PENCIL_RENDERER_VERSION, path, bounds, style.color, width, roughness, numericSeed, budget, selected,
        ]);
        if (key === lastPaint && canvasIsUsable(canvas)) return;
        let image = edgeCanvasCache.get(key);
        if (image && !canvasIsUsable(image)) {
          edgeCanvasCache.delete(key);
          image = undefined;
        }
        if (!image) {
          const points = sampleSvgPath(pathElement, bounds);
          if (points.length < 2) throw new Error('NodeGraph edge has no drawable path');
          image = document.createElement('canvas');
          image.width = budget.width;
          image.height = budget.height;
          const context = image.getContext('2d');
          if (!context) throw new Error('NodeGraph edge canvas unavailable');
          context.scale(budget.scaleX, budget.scaleY);
          pencilStroke(context, points, style.color, width * (selected ? 1.15 : 0.92), numericSeed, roughness, 3, false, {
            variation: 0.82,
            breaks: selected ? 0.16 : 0.25,
            grain: 0.7,
            gain: selected ? 2.5 : 2.1,
            step: 0.65,
            taperLength: 5,
            edgeGrain: true,
          });
          edgeCanvasCache.set(key, image, canvasByteCost(image));
        }
        const context = canvas.getContext('2d');
        if (!context || context.isContextLost?.()) throw new Error('NodeGraph edge canvas unavailable');
        canvas.width = image.width;
        canvas.height = image.height;
        context.drawImage(image, 0, 0);
        lastPaint = key;
        setReady(true);
      } catch {
        lastPaint = '';
        canvas.width = 0;
        canvas.height = 0;
        setReady(false);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const inheritedStyle = new MutationObserver(schedule);
    for (let element: Element | null = canvas; element; element = element.parentElement) {
      inheritedStyle.observe(element, { attributes: true, attributeFilter: ['style', 'class', 'data-theme', 'data-inkra-theme'] });
    }
    const scheme = matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', schedule);
    const stopRecovery = observeCanvasRecovery(() => { lastPaint = ''; schedule(); });
    paint();
    return () => {
      disposed = true;
      inheritedStyle.disconnect();
      scheme.removeEventListener('change', schedule);
      stopRecovery();
      cancelAnimationFrame(frame);
    };
  }, [bounds, budget, id, path, selected]);

  return <g
    className={['inkra-node-graph__edge-pencil', className].filter(Boolean).join(' ')}
    data-pencil-ready={ready && budget ? true : undefined}
    data-selected={selected || undefined}
  >
    <path ref={pathRef} d={path} className="inkra-node-graph__edge-measure" fill="none" />
    <path d={path} className="inkra-node-graph__edge-fallback" fill="none" />
    {bounds && budget && <foreignObject
      aria-hidden="true"
      className="inkra-node-graph__edge-foreign-object"
      height={bounds.height}
      pointerEvents="none"
      width={bounds.width}
      x={bounds.x}
      y={bounds.y}
    >
      <canvas
        ref={canvasRef}
        className="inkra-node-graph__edge-canvas"
        style={{ height: bounds.height, width: bounds.width }}
      />
    </foreignObject>}
  </g>;
}

const NodeGraphEdge = memo(function NodeGraphEdge({
  id,
  path,
  labelX,
  labelY,
  selected,
  interactionWidth = 24,
  label,
  className,
}: NodeGraphEdgeProps) {
  return <>
    {interactionWidth > 0 && <path d={path} className="inkra-node-graph__edge-hit" fill="none" stroke="transparent" strokeWidth={interactionWidth} />}
    <PencilEdgeCanvas id={id} path={path} className={className} selected={selected} />
    {label != null && Number.isFinite(labelX) && Number.isFinite(labelY) && <EdgeLabelRenderer>
      <PencilSurface
        className="inkra-node-graph__edge-label nodrag nopan"
        variant="paper"
        radius={6}
        seed={`edge-label-${id}`}
        style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
      >
        {label}
      </PencilSurface>
    </EdgeLabelRenderer>}
  </>;
});

function DefaultEdgeRenderer({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected = false,
  interactionWidth,
  data,
}: EdgeProps<InternalEdge>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const edge = data?.__inkraEdge;
  const custom = edge && data?.__inkraRenderEdge?.({ id, edge, selected, path, labelX, labelY });
  if (custom != null) return <>
    <path d={path} className="inkra-node-graph__edge-hit" fill="none" stroke="transparent" strokeWidth={interactionWidth ?? 24} />
    {custom}
  </>;
  const label = edge == null ? undefined : data?.__inkraRenderEdgeLabel?.(edge) ?? edge.label;
  return <NodeGraphEdge
    id={id}
    interactionWidth={interactionWidth}
    label={label}
    labelX={labelX}
    labelY={labelY}
    path={path}
    selected={selected}
  />;
}

const nodeTypes = { inkra: DefaultNodeRenderer };
const edgeTypes = { inkra: DefaultEdgeRenderer };

function NodeGraphConnectionLine({ fromX, fromY, toX, toY, fromPosition, toPosition }: ConnectionLineComponentProps) {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });
  return <PencilEdgeCanvas id="connection-preview" path={path} className="inkra-node-graph__connection-line" />;
}

export interface NodeGraphControlsProps extends HTMLAttributes<HTMLDivElement> {
  fitViewOptions?: FitViewOptions;
  zoomInLabel?: string;
  zoomOutLabel?: string;
  fitViewLabel?: string;
}

function NodeGraphControls(inkraProps: NodeGraphControlsProps) {
  const { t } = useInkraLocale();
  const {
  className,
  fitViewOptions,
  zoomInLabel = t('common.zoomIn'),
  zoomOutLabel = t('common.zoomOut'),
  fitViewLabel = t('graph.fit'),
  ...props
} = inkraProps;
  const flow = useReactFlow();
  const actions = [
    { label: zoomInLabel, paths: zoomInPaths, run: () => flow.zoomIn() },
    { label: zoomOutLabel, paths: zoomOutPaths, run: () => flow.zoomOut() },
    { label: fitViewLabel, paths: fitViewPaths, run: () => flow.fitView(fitViewOptions) },
  ] as const;
  return <div {...props} className={['inkra-node-graph__controls', 'nopan', className].filter(Boolean).join(' ')}>
    {actions.map(action => <PencilSurface
      as="button"
      aria-label={action.label}
      className="inkra-node-graph__control"
      data-tooltip={action.label}
      key={action.label}
      onClick={() => void action.run()}
      variant="paper"
    >
      <PencilSurface aria-hidden="true" as="span" className="inkra-node-graph__control-focus" radius={6} seed={`node-graph-${action.label}-focus`} variant="outline" />
      <PencilIcon decorative paths={action.paths} size={22} sourceSize={24} seed={`node-graph-${action.label}`} />
    </PencilSurface>)}
  </div>;
}

function SsrFallback<NodeType extends NodeGraphNode>({
  nodes,
  emptyState,
  label,
}: {
  nodes: NodeType[];
  emptyState: ReactNode;
  label: string;
}) {
  return <div className="inkra-node-graph__ssr" role="group" aria-label={label}>
    {nodes.length === 0 ? <div className="inkra-node-graph__empty">{emptyState}</div> : <ul>
      {nodes.map(node => <li key={node.id}>{readableLabel((node.data as NodeGraphNodeData).label, node.id)}</li>)}
    </ul>}
  </div>;
}

function NodeGraphRootInner<
  NodeType extends NodeGraphNode = NodeGraphNode,
  EdgeType extends NodeGraphEdge = NodeGraphEdge,
>(inkraProps: NodeGraphRootProps<NodeType, EdgeType>, forwardedRef: ForwardedRef<NodeGraphRef>) {
  const { t } = useInkraLocale();
  const {
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  renderNode,
  renderEdge,
  renderEdgeLabel,
  readOnly = false,
  emptyState = t('graph.empty'),
  controls = true,
  controlLabels,
  fitView = false,
  fitViewOptions,
  defaultViewport = { x: 0, y: 0, zoom: 1 },
  viewport,
  onViewportChange,
  minZoom = 0.25,
  maxZoom = 2,
  panOnDrag = true,
  zoomOnScroll = true,
  zoomOnPinch = true,
  connectOnClick = true,
  onlyRenderVisibleElements = false,
  className,
  style,
  'aria-label': ariaLabel = t('graph.label'),
  ...props
} = inkraProps;
  const [mounted, setMounted] = useState(false);
  const instanceRef = useRef<ReactFlowInstance<InternalNode, InternalEdge> | null>(null);
  useEffect(() => setMounted(true), []);
  useImperativeHandle(forwardedRef, () => ({
    fitView: options => instanceRef.current?.fitView(options as FitViewOptions<InternalNode>) ?? Promise.resolve(false),
    zoomIn: () => instanceRef.current?.zoomIn() ?? Promise.resolve(false),
    zoomOut: () => instanceRef.current?.zoomOut() ?? Promise.resolve(false),
    getViewport: () => instanceRef.current?.getViewport() ?? defaultViewport,
  }), [defaultViewport]);

  // Immutable node/edge updates should invalidate only the changed records. Weak
  // keys release removed records and changing render configuration resets the cache.
  const adaptNode = useMemo(() => {
    const cache = new WeakMap<NodeType, InternalNode>();
    return (node: NodeType): InternalNode => {
      const cached = cache.get(node);
      if (cached) return cached;
      const adapted = {
        ...node,
        type: 'inkra' as const,
        ariaLabel: node.ariaLabel ?? readableLabel((node.data as NodeGraphNodeData).label, node.id),
        data: {
          __inkraRenderNode: renderNode,
          __inkraReadOnly: readOnly,
          __inkraData: node.data,
        },
      } as InternalNode;
      cache.set(node, adapted);
      return adapted;
    };
  }, [readOnly, renderNode]);
  const adaptEdge = useMemo(() => {
    const cache = new WeakMap<EdgeType, InternalEdge>();
    return (edge: EdgeType): InternalEdge => {
      const cached = cache.get(edge);
      if (cached) return cached;
      const adapted = {
        ...edge,
        type: 'inkra' as const,
        ariaLabel: edge.ariaLabel ?? `Edge from ${edge.source} to ${edge.target}`,
        label: undefined,
        data: {
          ...edge.data,
          __inkraEdge: edge,
          __inkraRenderEdge: renderEdge,
          __inkraRenderEdgeLabel: renderEdgeLabel,
        },
      } as InternalEdge;
      cache.set(edge, adapted);
      return adapted;
    };
  }, [renderEdge, renderEdgeLabel]);
  const internalNodes = useMemo(() => nodes.map(adaptNode), [nodes, adaptNode]);
  const internalEdges = useMemo(() => edges.map(adaptEdge), [edges, adaptEdge]);
  const rootStyle = { minHeight: 320, ...style } as CSSProperties;

  return <div
    {...props}
    aria-label={ariaLabel}
    className={['inkra-node-graph', className].filter(Boolean).join(' ')}
    data-empty={nodes.length === 0 || undefined}
    data-read-only={readOnly || undefined}
    style={rootStyle}
  >
    {!mounted ? <SsrFallback nodes={nodes} emptyState={emptyState} label={ariaLabel} /> : <ReactFlowProvider>
      <ReactFlow<InternalNode, InternalEdge>
        aria-label={ariaLabel}
        ariaLabelConfig={{
          'node.a11yDescription.default': t('graph.nodeInstructions'),
          'node.a11yDescription.keyboardDisabled': t('graph.nodeMoveInstructions'),
          'node.a11yDescription.ariaLiveMessage': ({ x, y }) => t('graph.nodeMoved', { x, y }),
          'edge.a11yDescription.default': t('graph.edgeInstructions'),
          'handle.ariaLabel': t('graph.handle'),
        }}
        nodes={internalNodes}
        edges={internalEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={instance => { instanceRef.current = instance; }}
        onNodesChange={changes => onNodesChange?.(changes as NodeGraphNodeChange<NodeType>[])}
        onEdgesChange={changes => onEdgesChange?.(changes as NodeGraphEdgeChange<EdgeType>[])}
        onConnect={readOnly ? undefined : onConnect}
        isValidConnection={isValidConnection as ((connection: Connection | InternalEdge) => boolean) | undefined}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        edgesReconnectable={!readOnly}
        nodesFocusable
        edgesFocusable
        deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
        fitView={fitView}
        fitViewOptions={fitViewOptions as FitViewOptions<InternalNode>}
        defaultViewport={defaultViewport}
        viewport={viewport}
        onViewportChange={onViewportChange}
        minZoom={minZoom}
        maxZoom={maxZoom}
        panOnDrag={panOnDrag}
        zoomOnScroll={zoomOnScroll}
        zoomOnPinch={zoomOnPinch}
        connectOnClick={connectOnClick && !readOnly}
        connectionLineComponent={NodeGraphConnectionLine}
        onlyRenderVisibleElements={onlyRenderVisibleElements}
        noDragClassName="nodrag"
        noPanClassName="nopan"
      >
        {controls && <Panel position="bottom-left"><NodeGraphControls
          fitViewLabel={controlLabels?.fitView}
          fitViewOptions={fitViewOptions as FitViewOptions}
          zoomInLabel={controlLabels?.zoomIn}
          zoomOutLabel={controlLabels?.zoomOut}
        /></Panel>}
      </ReactFlow>
      {nodes.length === 0 && <div className="inkra-node-graph__empty" role="status">{emptyState}</div>}
    </ReactFlowProvider>}
  </div>;
}

const NodeGraphRoot = forwardRef(NodeGraphRootInner) as <
  NodeType extends NodeGraphNode = NodeGraphNode,
  EdgeType extends NodeGraphEdge = NodeGraphEdge,
>(props: NodeGraphRootProps<NodeType, EdgeType> & RefAttributes<NodeGraphRef>) => ReactElement | null;

export function applyNodeGraphNodeChanges<NodeType extends NodeGraphNode>(
  changes: NodeGraphNodeChange<NodeType>[],
  nodes: NodeType[],
): NodeType[] {
  return applyFlowNodeChanges(changes, nodes);
}

export function applyNodeGraphEdgeChanges<EdgeType extends NodeGraphEdge>(
  changes: NodeGraphEdgeChange<EdgeType>[],
  edges: EdgeType[],
): EdgeType[] {
  return applyFlowEdgeChanges(changes, edges);
}

export function addNodeGraphEdge<EdgeType extends NodeGraphEdge>(
  connection: NodeGraphConnection | EdgeType,
  edges: EdgeType[],
): EdgeType[] {
  return addFlowEdge(connection, edges);
}

export const NodeGraph = {
  Root: NodeGraphRoot,
  Node: NodeGraphNode,
  Port: NodeGraphPort,
  Edge: NodeGraphEdge,
  Controls: NodeGraphControls,
};

