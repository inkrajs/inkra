import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const moduleUrl = process.env.INKRA_NODE_GRAPH_MODULE
  ? new URL(process.env.INKRA_NODE_GRAPH_MODULE, import.meta.url).href
  : new URL('../dist/node-graph/index.js', import.meta.url).href;
const source = await readFile(new URL('../src/node-graph/index.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/node-graph/styles.css', import.meta.url), 'utf8');
const {
  NodeGraph,
  addNodeGraphEdge,
  applyNodeGraphEdgeChanges,
  applyNodeGraphNodeChanges,
} = await import(moduleUrl);

test('NodeGraph state helpers preserve controlled graph data', () => {
  const nodes = [
    { id: 'draft', position: { x: 0, y: 0 }, data: { label: 'Draft' } },
    { id: 'review', position: { x: 180, y: 0 }, data: { label: 'Review' } },
  ];
  const moved = applyNodeGraphNodeChanges([
    { id: 'draft', type: 'position', position: { x: 48, y: 24 }, dragging: false },
  ], nodes);
  assert.deepEqual(moved[0].position, { x: 48, y: 24 });
  assert.deepEqual(nodes[0].position, { x: 0, y: 0 });

  const connected = addNodeGraphEdge({ source: 'draft', target: 'review', sourceHandle: 'out', targetHandle: 'in' }, []);
  assert.equal(connected.length, 1);
  assert.equal(connected[0].source, 'draft');
  assert.equal(connected[0].target, 'review');

  const selected = applyNodeGraphEdgeChanges([{ id: connected[0].id, type: 'select', selected: true }], connected);
  assert.equal(selected[0].selected, true);
});

test('NodeGraph has an SSR-readable fallback without browser globals', () => {
  const html = renderToStaticMarkup(h(NodeGraph.Root, {
    'aria-label': 'Release workflow',
    nodes: [{ id: 'draft', position: { x: 0, y: 0 }, data: { label: 'Draft' } }],
    edges: [],
  }));
  assert.match(html, /aria-label="Release workflow"/);
  assert.match(html, /inkra-node-graph__ssr/);
  assert.match(html, />Draft</);
  assert.doesNotMatch(html, /react-flow__viewport/);
  assert.match(source, /const \[mounted, setMounted\] = useState\(false\)/);
  assert.match(source, /useEffect\(\(\) => setMounted\(true\), \[\]\)/);
  assert.match(source, /!mounted \? <SsrFallback/);
});

test('NodeGraph exposes a bounded engine wrapper and read-only mapping', () => {
  assert.match(source, /export interface NodeGraphRef/);
  assert.match(source, /fitView:/);
  assert.match(source, /zoomIn:/);
  assert.match(source, /zoomOut:/);
  assert.match(source, /getViewport:/);
  assert.match(source, /export interface NodeGraphControlLabels/);
  assert.match(source, /renderEdge\?:/);
  assert.doesNotMatch(source, /getInternalNode|useStoreApi|setNodes:|setEdges:/);
  assert.doesNotMatch(source, /export \{ Position|NodeGraphEnginePosition/);
  assert.match(source, /nodesDraggable=\{!readOnly\}/);
  assert.match(source, /nodesConnectable=\{!readOnly\}/);
  assert.match(source, /deleteKeyCode=\{readOnly \? null/);
  assert.match(source, /connectOnClick=\{connectOnClick && !readOnly\}/);
});

test('NodeGraph uses the mature engine for viewport, handles and path geometry', () => {
  assert.match(source, /from '@xyflow\/react'/);
  assert.match(source, /<ReactFlow/);
  assert.match(source, /<Handle/);
  assert.match(source, /useViewport/);
  assert.match(source, /--inkra-node-graph-port-scale/);
  assert.match(source, /getBezierPath/);
  assert.match(source, /applyFlowNodeChanges/);
  assert.match(source, /applyFlowEdgeChanges/);
  assert.match(source, /addFlowEdge/);
  assert.match(source, /function sampleSvgPath/);
  assert.match(source, /getTotalLength\(\)/);
  assert.match(source, /getPointAtLength\(/);
  assert.match(source, /pencilStroke\(context, points/);
  assert.match(source, /PENCIL_RENDERER_VERSION/);
  assert.match(source, /edgeCanvasMaxDimension\s*=\s*1024/);
  assert.match(source, /edgeCanvasMaxPixels\s*=\s*512 \* 512/);
  assert.match(source, /edgeMaxSampleSegments\s*=\s*1024/);
  assert.match(source, /Math\.min\(edgeMaxSampleSegments, Math\.max\(2, Math\.ceil\(total \/ 1\.4\)\)\)/);
  assert.match(source, /function edgeCanvasBudget/);
  assert.match(source, /Math\.sqrt\(edgeCanvasMaxPixels \/ cssPixels\)/);
  assert.match(source, /scale < edgeCanvasMinScale/);
  assert.match(source, /width > edgeCanvasMaxDimension \|\| height > edgeCanvasMaxDimension \|\| width \* height > edgeCanvasMaxPixels/);
  assert.match(source, /const budget = useMemo\(\(\) => bounds \? edgeCanvasBudget\(bounds, effectiveDpr\(2\)\) : null/);
  assert.match(source, /if \(!canvas \|\| !pathElement \|\| !bounds \|\| !budget\) return undefined/);
  assert.match(source, /image\.width = budget\.width;\s*image\.height = budget\.height/s);
  assert.match(source, /context\.scale\(budget\.scaleX, budget\.scaleY\)/);
  assert.match(source, /useLayoutEffect\(\(\) => \{\s*setReady\(false\);\s*\}, \[budget, path\]\)/s);
  assert.match(source, /data-pencil-ready=\{ready && budget \? true : undefined\}/);
  assert.match(source, /className="inkra-node-graph__edge-fallback"[\s\S]*\{bounds && budget && <foreignObject/);
  assert.match(source, /\{bounds && budget && <foreignObject/);
  assert.match(source, /canvas\.width = 0;\s*canvas\.height = 0;\s*setReady\(false\)/s);
  assert.doesNotMatch(source, /Math\.ceil\(bounds\.(?:width|height) \* dpr\)/);
  assert.doesNotMatch(source, /setPointerCapture|wheelDelta|touches\[/);
  assert.doesNotMatch(source, /strokeDasharray|strokeDashoffset|animateTransform|transform=\{?['"`]translate/);
});

test('NodeGraph styles keep tactile targets, pencil edges and fallbacks', () => {
  const normalStyles = styles.split('@media print, (forced-colors: active)')[0];
  assert.match(styles, /inline-size:\s*var\(--inkra-touch-target\)/);
  assert.match(styles, /block-size:\s*var\(--inkra-touch-target\)/);
  assert.match(styles, /scale\(var\(--inkra-node-graph-port-scale, 1\)\)/);
  assert.match(styles, /inkra-node-graph__edge-pencil/);
  assert.match(styles, /inkra-node-graph__edge-canvas/);
  assert.match(styles, /data-pencil-ready/);
  assert.match(styles, /inkra-node-graph__edge-fallback/);
  assert.match(source, /className="inkra-node-graph__port-mark"/);
  assert.match(source, /className="inkra-node-graph__node-focus"/);
  assert.match(source, /className="inkra-node-graph__control-focus"/);
  assert.match(source, /variant="outline"/);
  assert.doesNotMatch(normalStyles, /(?:border|outline):\s*(?!0(?:\s|;))[^;]*(?:solid|dashed|dotted)/i);
  assert.match(styles, /@media print, \(forced-colors: active\)/);
  assert.match(styles, /edge-canvas \{ visibility:\s*hidden/);
  assert.match(styles, /edge-fallback \{ visibility:\s*visible !important/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /border-radius:\s*999|background:\s*#[0-9a-f]{3,8}/i);
});
