import type { ReactNode } from 'react';

export type DependencyGraphDirection = 'LR' | 'RL' | 'TB' | 'BT';
export type DependencyGraphStatus = 'locked' | 'available' | 'active' | 'completed';

/** A point in the node's local box. Coordinates are fractions clamped to 0..1.
 * position controls the curve tangent; explicit points do not rotate with direction.
 */
export interface DependencyGraphAnchor {
  x: number;
  y: number;
  position?: 'left' | 'right' | 'top' | 'bottom';
}

export interface DependencyGraphNode<Data = unknown> {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  content?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  description?: ReactNode;
  status?: DependencyGraphStatus;
  disabled?: boolean;
  sourceAnchor?: DependencyGraphAnchor;
  targetAnchor?: DependencyGraphAnchor;
  data?: Data;
}

export interface DependencyGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: ReactNode;
  /** Overrides the source node's default anchor for this edge. */
  sourceAnchor?: DependencyGraphAnchor;
  /** Overrides the target node's default anchor for this edge. */
  targetAnchor?: DependencyGraphAnchor;
}

export interface DependencyGraphIssue {
  type: 'duplicate-node' | 'duplicate-edge' | 'missing-node' | 'cycle';
  ids: string[];
}

export interface DependencyGraphLayoutOptions {
  direction?: DependencyGraphDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  rankGap?: number;
  nodeGap?: number;
}

function normalize<Data>(nodes: readonly DependencyGraphNode<Data>[], edges: readonly DependencyGraphEdge[]) {
  const unique = new Map<string, DependencyGraphNode<Data>>();
  const issues: DependencyGraphIssue[] = [];
  for (const node of nodes) {
    if (unique.has(node.id)) issues.push({ type: 'duplicate-node', ids: [node.id] });
    else unique.set(node.id, node);
  }
  const edgeIds = new Set<string>();
  const valid: DependencyGraphEdge[] = [];
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) {
      issues.push({ type: 'duplicate-edge', ids: [edge.id] });
      continue;
    }
    edgeIds.add(edge.id);
    const missing = [edge.source, edge.target].filter(id => !unique.has(id));
    if (missing.length) issues.push({ type: 'missing-node', ids: [edge.id, ...new Set(missing)] });
    else valid.push(edge);
  }
  return { ids: [...unique.keys()], edges: valid, issues };
}

function adjacency(ids: readonly string[], edges: readonly DependencyGraphEdge[], reverse = false) {
  const result = new Map(ids.map(id => [id, [] as string[]]));
  for (const edge of edges) result.get(reverse ? edge.target : edge.source)!.push(reverse ? edge.source : edge.target);
  return result;
}

// Iterative Kosaraju traversal avoids a call-stack limit on long dependency chains.
function components(ids: string[], edges: readonly DependencyGraphEdge[]) {
  const forward = adjacency(ids, edges);
  const backward = adjacency(ids, edges, true);
  const visited = new Set<string>();
  const finished: string[] = [];
  for (const id of ids) {
    if (visited.has(id)) continue;
    visited.add(id);
    const stack: Array<{ id: string; next: number }> = [{ id, next: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const neighbors = forward.get(frame.id)!;
      if (frame.next >= neighbors.length) {
        finished.push(frame.id);
        stack.pop();
      } else {
        const next = neighbors[frame.next++];
        if (!visited.has(next)) {
          visited.add(next);
          stack.push({ id: next, next: 0 });
        }
      }
    }
  }
  const membership = new Map<string, number>();
  const groups: string[][] = [];
  for (let index = finished.length - 1; index >= 0; index--) {
    const id = finished[index];
    if (membership.has(id)) continue;
    const group = groups.length;
    const stack = [id];
    membership.set(id, group);
    const members: string[] = [];
    while (stack.length) {
      const current = stack.pop()!;
      members.push(current);
      for (const previous of backward.get(current)!) {
        if (membership.has(previous)) continue;
        membership.set(previous, group);
        stack.push(previous);
      }
    }
    groups.push(members);
  }
  return { membership, groups };
}

function dimension(value: number | undefined, fallback: number, minimum: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(minimum, Math.min(2000, value)) : fallback;
}

/** Stable input order within each rank; edge direction is source prerequisite → target.
 * Duplicate IDs keep their first entry. Missing endpoints and intra-cycle edges
 * are omitted and reported through issues; downstream dependencies remain intact.
 */
export function layoutDependencyGraph<Data>(
  nodes: readonly DependencyGraphNode<Data>[],
  inputEdges: readonly DependencyGraphEdge[],
  options: DependencyGraphLayoutOptions = {},
) {
  const normalized = normalize(nodes, inputEdges);
  const { ids, issues } = normalized;
  const { membership, groups } = components(ids, normalized.edges);
  const cyclic = new Set<number>();
  for (const edge of normalized.edges) {
    const group = membership.get(edge.source)!;
    if (group === membership.get(edge.target) && (groups[group].length > 1 || edge.source === edge.target)) cyclic.add(group);
  }
  // A downstream node is not itself cyclic. Report only actual SCC members.
  const cycleMembers = new Map<number, string[]>();
  for (const id of ids) {
    const group = membership.get(id)!;
    if (!cyclic.has(group)) continue;
    const members = cycleMembers.get(group) ?? [];
    members.push(id);
    cycleMembers.set(group, members);
  }
  for (const group of cyclic) issues.push({ type: 'cycle', ids: cycleMembers.get(group)! });
  const edges = normalized.edges.filter(edge => {
    const group = membership.get(edge.source)!;
    return !cyclic.has(group) || membership.get(edge.target) !== group;
  });
  const children = adjacency(ids, edges);
  const indegree = new Map(ids.map(id => [id, 0]));
  const rank = new Map(ids.map(id => [id, 0]));
  for (const edge of edges) indegree.set(edge.target, indegree.get(edge.target)! + 1);
  const queue = ids.filter(id => indegree.get(id) === 0);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor];
    for (const child of children.get(id)!) {
      rank.set(child, Math.max(rank.get(child)!, rank.get(id)! + 1));
      const remaining = indegree.get(child)! - 1;
      indegree.set(child, remaining);
      if (!remaining) queue.push(child);
    }
  }
  const layers = new Map<number, string[]>();
  for (const id of ids) {
    const level = rank.get(id)!;
    const layer = layers.get(level) ?? [];
    layer.push(id);
    layers.set(level, layer);
  }
  const width = dimension(options.nodeWidth, 200, 80);
  const height = dimension(options.nodeHeight, 104, 44);
  const rankGap = dimension(options.rankGap, 96, 0);
  const nodeGap = dimension(options.nodeGap, 40, 0);
  const direction = options.direction ?? 'LR';
  const horizontal = direction === 'LR' || direction === 'RL';
  let maxRank = 0;
  let maxCount = 0;
  for (const [level, layer] of layers) {
    maxRank = Math.max(maxRank, level);
    maxCount = Math.max(maxCount, layer.length);
  }
  const positions = new Map<string, { x: number; y: number }>();
  for (const [level, layer] of layers) {
    const mainLevel = direction === 'RL' || direction === 'BT' ? maxRank - level : level;
    const main = mainLevel * ((horizontal ? width : height) + rankGap);
    const step = (horizontal ? height : width) + nodeGap;
    const offset = (maxCount - layer.length) * step / 2;
    layer.forEach((id, index) => {
      const cross = offset + index * step;
      positions.set(id, horizontal ? { x: main, y: cross } : { x: cross, y: main });
    });
  }
  return { nodes: ids.map(id => ({ id, position: positions.get(id)!, width, height })), edges, issues };
}

/** Traversal is independent of layout and terminates even for invalid cyclic input. */
export function getDependencyGraphHighlight<Data>(
  nodes: readonly DependencyGraphNode<Data>[],
  edges: readonly DependencyGraphEdge[],
  selectedId: string | null,
  mode: 'ancestors' | 'descendants' | 'both' | 'none',
) {
  const valid = normalize(nodes, edges);
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  if (selectedId === null || !valid.ids.includes(selectedId)) return { nodeIds, edgeIds };
  nodeIds.add(selectedId);
  if (mode === 'none') return { nodeIds, edgeIds };
  const walk = (reverse: boolean) => {
    const adjacent = new Map(valid.ids.map(id => [id, [] as DependencyGraphEdge[]]));
    for (const edge of valid.edges) adjacent.get(reverse ? edge.target : edge.source)!.push(edge);
    const visited = new Set([selectedId]);
    const stack = [selectedId];
    while (stack.length) {
      const current = stack.pop()!;
      for (const edge of adjacent.get(current)!) {
        const next = reverse ? edge.source : edge.target;
        edgeIds.add(edge.id);
        nodeIds.add(next);
        if (!visited.has(next)) { visited.add(next); stack.push(next); }
      }
    }
  };
  if (mode === 'ancestors' || mode === 'both') walk(true);
  if (mode === 'descendants' || mode === 'both') walk(false);
  return { nodeIds, edgeIds };
}
