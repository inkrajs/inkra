import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactElement, type ReactNode, type RefAttributes } from 'react';
import { Handle, Position, useNodesInitialized, useReactFlow } from '@xyflow/react';
import { NodeGraph, type NodeGraphNode, type NodeGraphEdge as GraphEdge, type NodeGraphRootProps, type NodeGraphRef } from '../node-graph/index.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { PencilIcon } from '../PencilIcon.js';
import { useInkraLocale } from '../i18n/index.js';
import { layoutDependencyGraph, getDependencyGraphHighlight, type DependencyGraphNode, type DependencyGraphEdge, type DependencyGraphStatus, type DependencyGraphDirection } from './model.js';
export * from './model.js';

export type DependencyGraphRef = NodeGraphRef;
export interface DependencyGraphNodeRenderState {
  selected: boolean;
  highlighted: boolean;
  activate: () => void;
  /** Wrap each animated face so its paper, border and selection move together. */
  renderSurface: (children: ReactNode) => ReactElement;
}
function NodeFrame({ bare, seed, variant, ...props }: HTMLAttributes<HTMLDivElement> & {
  bare: boolean; seed: string; variant: 'paper' | 'action';
}) {
  return bare ? <div {...props} /> : <PencilSurface {...props} seed={seed} variant={variant} />;
}
function NodeText({ children, className, ellipsis }: { children: ReactNode; className?: string; ellipsis?: boolean }) {
  return typeof children === 'string' || typeof children === 'number'
    ? <PencilText className={className} ellipsis={ellipsis}>{String(children)}</PencilText>
    : <span className={className}>{children}</span>;
}
export interface DependencyGraphRootProps<Data = unknown> extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect' | 'children'> {
  nodes: DependencyGraphNode<Data>[];
  edges: DependencyGraphEdge[];
  direction?: DependencyGraphDirection;
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
  /** Activation does not infer or mutate business unlock rules. */
  onNodeActivate?: (node: DependencyGraphNode<Data>) => void;
  highlight?: 'ancestors' | 'descendants' | 'both' | 'none';
  nodeWidth?: number;
  nodeHeight?: number;
  rankGap?: number;
  nodeGap?: number;
  nodeVariant?: 'card' | 'icon';
  renderNode?: (node: DependencyGraphNode<Data>, state: DependencyGraphNodeRenderState) => ReactNode;
  statusLabels?: Partial<Record<DependencyGraphStatus, string>>;
  onIssues?: (issues: ReturnType<typeof layoutDependencyGraph>['issues']) => void;
  controls?: NodeGraphRootProps['controls'];
  extraControls?: NodeGraphRootProps['extraControls'];
  fitView?: boolean;
  minZoom?: number;
  maxZoom?: number;
  panOnDrag?: boolean;
  zoomOnScroll?: boolean;
  zoomOnPinch?: boolean;
  onlyRenderVisibleElements?: boolean;
  hideAttribution?: boolean;
  emptyState?: ReactNode;
  controlLabels?: NodeGraphRootProps['controlLabels'];
}

// The arrow follows the final tangent of the very same curve drawn by NodeGraph.
// Both the open and filled silhouettes remain actual pencil geometry.
function DirectionArrow({ path }: { path: string }) {
  const measure = useRef<SVGPathElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; angle: number } | null>(null);
  useLayoutEffect(() => {
    const node = measure.current;
    if (!node) return;
    try {
      const length = node.getTotalLength();
      if (!Number.isFinite(length) || length < 1) { setTip(null); return; }
      const end = node.getPointAtLength(length);
      const before = node.getPointAtLength(Math.max(0, length - 4));
      const angle = Math.atan2(end.y - before.y, end.x - before.x);
      if (![end.x, end.y, angle].every(Number.isFinite)) { setTip(null); return; }
      setTip({ x: end.x - Math.cos(angle) * 7, y: end.y - Math.sin(angle) * 7, angle: angle * 180 / Math.PI });
    } catch { setTip(null); }
  }, [path]);
  return <g aria-hidden="true" pointerEvents="none">
    <path ref={measure} d={path} fill="none" stroke="none" />
    {tip && <g transform={`translate(${tip.x} ${tip.y}) rotate(${tip.angle})`}>
      <foreignObject x={-10} y={-10} width={20} height={20} overflow="visible">
        <PencilIcon decorative size={20} sourceSize={40} strokeWidth={1.8} breaks={0} paths={[{ d: 'M6 8L34 20L6 32' }]}
          filledPaths={[{ d: 'M6 6L34 20L6 34L4 30L24 20L4 10Z' }]} seed="dependency-direction" />
      </foreignObject>
    </g>}
  </g>;
}

interface Anchor {
  id: string;
  type: 'source' | 'target';
  position: Position;
  x: number;
  y: number;
}
function anchorFraction(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}
function DependencyViewport({ layoutKey, enabled, onFit }: { layoutKey: string; enabled: boolean; onFit: (key: string) => void }) {
  const initialized = useNodesInitialized();
  const { fitView } = useReactFlow();
  const fitted = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !initialized || fitted.current === layoutKey) return;
    fitted.current = layoutKey;
    let cancelled = false;
    void fitView().then(success => { if (success && !cancelled) onFit(layoutKey); });
    return () => { cancelled = true; if (fitted.current === layoutKey) fitted.current = null; };
  }, [enabled, initialized, layoutKey, fitView, onFit]);
  return null;
}

function DependencyGraphRootInner<Data>(props: DependencyGraphRootProps<Data>, ref: React.ForwardedRef<DependencyGraphRef>) {
  const { t } = useInkraLocale();
  const { nodes, edges, direction = 'LR', selectedId, defaultSelectedId = null, onSelectedIdChange,
    onNodeActivate, highlight = 'ancestors', nodeVariant = 'card', nodeWidth = nodeVariant === 'icon' ? 80 : 200,
    nodeHeight = nodeVariant === 'icon' ? 80 : 104, rankGap = 96, nodeGap = 40,
    renderNode, statusLabels, onIssues, className, fitView = true, onlyRenderVisibleElements = false, hideAttribution = true, ...rest } = props;
  const [internalSelected, setInternalSelected] = useState(defaultSelectedId);
  const [fittedLayout, setFittedLayout] = useState<string | null>(null);
  const graphRef = useRef<NodeGraphRef>(null);
  useImperativeHandle(ref, () => ({
    fitView: options => graphRef.current?.fitView(options) ?? Promise.resolve(false),
    zoomIn: () => graphRef.current?.zoomIn() ?? Promise.resolve(false),
    zoomOut: () => graphRef.current?.zoomOut() ?? Promise.resolve(false),
    getViewport: () => graphRef.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 },
  }), []);
  const candidate = selectedId === undefined ? internalSelected : selectedId;
  const activeId = nodes.some(node => node.id === candidate) ? candidate : null;
  const layout = useMemo(() => layoutDependencyGraph(nodes, edges, { direction, nodeWidth, nodeHeight, rankGap, nodeGap }),
    [nodes, edges, direction, nodeWidth, nodeHeight, rankGap, nodeGap]);
  const issuesCallback = useRef(onIssues);
  issuesCallback.current = onIssues;
  useEffect(() => { issuesCallback.current?.(layout.issues); }, [layout.issues]);
  const layoutKey = layout.nodes.map(node => `${node.id}:${node.position.x}:${node.position.y}:${node.width}:${node.height}`).join('|');
  const highlighted = useMemo(() => getDependencyGraphHighlight(nodes, layout.edges, activeId, highlight), [nodes, layout.edges, activeId, highlight]);
  const graphNodes = useMemo(() => {
    const byId = new Map<string, DependencyGraphNode<Data>>();
    nodes.forEach(node => { if (!byId.has(node.id)) byId.set(node.id, node); });
    const sourcePosition = ({ LR: Position.Right, RL: Position.Left, TB: Position.Bottom, BT: Position.Top })[direction];
    const targetPosition = ({ LR: Position.Left, RL: Position.Right, TB: Position.Top, BT: Position.Bottom })[direction];
    const positions = new Map(layout.nodes.map(node => [node.id, node]));
    const incoming = new Map(layout.nodes.map(node => [node.id, [] as DependencyGraphEdge[]]));
    const outgoing = new Map(layout.nodes.map(node => [node.id, [] as DependencyGraphEdge[]]));
    layout.edges.forEach(edge => { incoming.get(edge.target)!.push(edge); outgoing.get(edge.source)!.push(edge); });
    const crossAxis = direction === 'LR' || direction === 'RL' ? 'y' : 'x';
    return layout.nodes.map(positioned => {
      const original = byId.get(positioned.id)!;
      const anchors: Anchor[] = [];
      for (const type of ['source', 'target'] as const) {
        const position = type === 'source' ? sourcePosition : targetPosition;
        const connected = [...(type === 'source' ? outgoing : incoming).get(positioned.id)!];
        const neighbor = (edge: DependencyGraphEdge) => positions.get(type === 'source' ? edge.target : edge.source)!.position[crossAxis];
        connected.sort((a, b) => neighbor(a) - neighbor(b));
        connected.forEach((edge, index) => {
          const fraction = (index + 1) / (connected.length + 1);
          const key = type === 'source' ? 'sourceAnchor' : 'targetAnchor';
          const custom = edge[key] ?? original[key];
          const side = custom?.position;
          const anchorPosition = side === 'left' || side === 'right' || side === 'top' || side === 'bottom'
            ? side as Position : position;
          const defaultX = position === Position.Left ? 0 : position === Position.Right ? 1 : fraction;
          const defaultY = position === Position.Top ? 0 : position === Position.Bottom ? 1 : fraction;
          anchors.push({ id: `${type}-${edge.id}`, type, position: anchorPosition,
            x: positioned.width * anchorFraction(custom?.x, defaultX),
            y: positioned.height * anchorFraction(custom?.y, defaultY) });
        });
      }
      return { ...positioned, focusable: false,
        measured: { width: positioned.width, height: positioned.height },
        handles: anchors.map(anchor => ({ ...anchor, width: 0, height: 0 })),
        sourcePosition, targetPosition, data: {
        label: original.label, original, anchors,
      } } as NodeGraphNode;
    });
  }, [nodes, layout.nodes, layout.edges, direction]);
  const graphEdges = useMemo(() => layout.edges.map(edge => ({ ...edge, focusable: false, selectable: false,
    sourceHandle: `source-${edge.id}`, targetHandle: `target-${edge.id}`, data: { highlighted: highlighted.edgeIds.has(edge.id) } })), [layout.edges, highlighted]);
  const renderGraphNode = ({ id, data }: { id: string; data: Record<string, unknown> }) => {
    const node = data.original as DependencyGraphNode<Data>;
    const selected = id === activeId;
    const related = highlighted.nodeIds.has(id);
    const status = node.status;
    const label = typeof node.label === 'string' || typeof node.label === 'number' ? String(node.label) : id;
    const activate = () => {
      if (node.disabled) return;
      if (selectedId === undefined) setInternalSelected(id);
      onSelectedIdChange?.(id);
      onNodeActivate?.(node);
    };
    const decoration = <>
      {(selected || related) && <PencilSurface as="span" aria-hidden="true" variant="outline" className="inkra-dependency-graph__highlight" seed={`dependency-outline-${id}`} />}
      <PencilSurface as="span" aria-hidden="true" variant="outline" className="inkra-dependency-graph__focus" seed={`dependency-focus-${id}`} />
    </>;
    const renderSurface = (children: ReactNode) => <PencilSurface variant={selected ? 'action' : 'paper'}
      seed={`dependency-${id}`} className="inkra-dependency-graph__card inkra-dependency-graph__card--custom">
      {decoration}{children}
    </PencilSurface>;
    return <div className="inkra-dependency-graph__node" data-status={status} data-selected={selected || undefined}
      data-highlighted={related || undefined} data-disabled={node.disabled || undefined}
      data-dimmed={activeId !== null && highlight !== 'none' && !related && !selected || undefined}>
      {!renderNode && nodeVariant === 'icon'
        ? <PencilSurface as="button" type="button" variant={selected ? 'action' : 'paper'}
          className="inkra-dependency-graph__icon-button nodrag nopan" disabled={node.disabled} aria-label={label}
          title={label} aria-pressed={selected} seed={`dependency-${id}`} onClick={activate}>
          {decoration}{node.icon ?? <NodeText>{label.slice(0, 1)}</NodeText>}
        </PencilSurface>
        : <NodeFrame bare={Boolean(renderNode)} variant={selected ? 'action' : 'paper'} seed={`dependency-${id}`}
          className={`inkra-dependency-graph__card nodrag nopan${renderNode ? ' inkra-dependency-graph__card--custom' : ''}`}
          role="group" aria-label={label} aria-disabled={node.disabled || undefined}
          tabIndex={renderNode && !node.disabled ? 0 : undefined}
          onClick={event => {
            if (!(event.target instanceof Element) || event.target.closest('button,a,input,select,textarea,[role="button"],[contenteditable="true"]')) return;
            activate();
          }}
          onKeyDown={event => {
            if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault(); activate();
            }
          }}>
          {!renderNode && decoration}
          {renderNode ? renderNode(node, { selected, highlighted: related, activate, renderSurface }) : <>
            <div className="inkra-dependency-graph__header">
              {node.icon != null && <span className="inkra-dependency-graph__icon" aria-hidden="true">{node.icon}</span>}
              <button type="button" className="inkra-dependency-graph__title" disabled={node.disabled}
                aria-pressed={selected} onClick={activate}><NodeText ellipsis>{node.label}</NodeText></button>
              {node.actions != null && <div className="inkra-dependency-graph__actions">{node.actions}</div>}
            </div>
            {(node.content ?? node.description) != null && <div className="inkra-dependency-graph__body nowheel">
              {typeof (node.content ?? node.description) === 'string' || typeof (node.content ?? node.description) === 'number'
                ? <NodeText>{node.content ?? node.description}</NodeText> : node.content ?? node.description}
            </div>}
            {status && <PencilText className="inkra-dependency-graph__status">{statusLabels?.[status] ?? t(`dependency.${status}`)}</PencilText>}
            {node.footer != null && <div className="inkra-dependency-graph__footer">{node.footer}</div>}
          </>}
        </NodeFrame>}
      {(data.anchors as Anchor[]).map(anchor => <Handle key={anchor.id} id={anchor.id} type={anchor.type}
        position={anchor.position} isConnectable={false} aria-hidden="true"
        className="inkra-dependency-graph__anchor" style={{ left: anchor.x, top: anchor.y }} />)}
      {id === layout.nodes[0]?.id && <DependencyViewport layoutKey={layoutKey} enabled={fitView} onFit={setFittedLayout} />}
    </div>;
  };
  const renderGraphEdge = ({ id, edge, path, labelX, labelY }: { id: string; edge: GraphEdge; path: string; labelX: number; labelY: number }) => {
    const related = Boolean(edge.data?.highlighted);
    return <g className="inkra-dependency-graph__edge" data-highlighted={related || undefined}
      data-dimmed={activeId !== null && highlight !== 'none' && !related || undefined}>
      <NodeGraph.Edge id={id} path={path} label={typeof edge.label === 'string' || typeof edge.label === 'number' ? <PencilText>{String(edge.label)}</PencilText> : edge.label} labelX={labelX} labelY={labelY} interactionWidth={0}
        className={related ? 'inkra-dependency-graph__edge--highlighted' : undefined} />
      <DirectionArrow path={path} />
    </g>;
  };
  return <NodeGraph.Root {...rest} ref={graphRef} nodes={graphNodes} edges={graphEdges} readOnly fitView={false} hideAttribution={hideAttribution}
    onlyRenderVisibleElements={onlyRenderVisibleElements && (!fitView || fittedLayout === layoutKey)}
    onKeyDown={event => {
      props.onKeyDown?.(event);
      if (event.key === 'Escape' && activeId !== null && !event.defaultPrevented) {
        event.preventDefault();
        event.stopPropagation();
        if (selectedId === undefined) setInternalSelected(null);
        onSelectedIdChange?.(null);
      }
    }}
    aria-label={props['aria-label'] ?? t('dependency.label')}
    className={['inkra-dependency-graph', className].filter(Boolean).join(' ')}
    renderNode={renderGraphNode} renderEdge={renderGraphEdge} />;
}

export const DependencyGraphRoot = forwardRef(DependencyGraphRootInner) as <Data = unknown>(props: DependencyGraphRootProps<Data> & RefAttributes<DependencyGraphRef>) => ReactElement;
export const DependencyGraph = { Root: DependencyGraphRoot };
