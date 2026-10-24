export interface TreeSelectNode {
  id: string;
  label: string;
  description?: string;
  keywords?: string;
  disabled?: boolean;
  children?: readonly TreeSelectNode[];
}

export type TreeSelectBranchSelection = 'leaf' | 'all';
export type TreeSelectSelectionPropagation = 'none' | 'down' | 'both';

export interface TreeSelectIndex {
  nodes: readonly TreeSelectNode[];
  orderedIds: readonly string[];
  byId: ReadonlyMap<string, TreeSelectNode>;
  parentById: ReadonlyMap<string, string | null>;
  branchIds: ReadonlySet<string>;
  disabledIds: ReadonlySet<string>;
}

export interface FilteredTreeSelectNodes {
  nodes: readonly TreeSelectNode[];
  visibleIds: ReadonlySet<string>;
  expandedIds: ReadonlySet<string>;
}

interface TreeSelectSelectionOptions {
  multiple: boolean;
  branchSelection: TreeSelectBranchSelection;
  selectionPropagation: TreeSelectSelectionPropagation;
}

export function normalizeTreeSelectNodes(nodes: readonly TreeSelectNode[]): readonly TreeSelectNode[] {
  const result: TreeSelectNode[] = [];
  const seen = new Set<string>();
  const stack: Array<{
    nodes: readonly TreeSelectNode[];
    position: number;
    result: TreeSelectNode[];
    parent?: TreeSelectNode;
  }> = [{ nodes, position: 0, result }];

  // Preserve preorder duplicate handling without using the JavaScript call stack.
  while (stack.length) {
    const frame = stack[stack.length - 1];
    if (frame.position === frame.nodes.length) {
      if (frame.parent && frame.result.length) frame.parent.children = frame.result;
      stack.pop();
      continue;
    }
    const node = frame.nodes[frame.position++];
    if (!node.id || seen.has(node.id)) continue;
    seen.add(node.id);
    const copy: TreeSelectNode = { ...node, children: undefined };
    frame.result.push(copy);
    if (node.children?.length) stack.push({ nodes: node.children, position: 0, result: [], parent: copy });
  }
  return result;
}

export function indexTreeSelectNodes(nodes: readonly TreeSelectNode[]): TreeSelectIndex {
  const normalized = normalizeTreeSelectNodes(nodes);
  const orderedIds: string[] = [];
  const byId = new Map<string, TreeSelectNode>();
  const parentById = new Map<string, string | null>();
  const branchIds = new Set<string>();
  const disabledIds = new Set<string>();
  const stack = normalized.map(node => ({ node, parentId: null as string | null })).reverse();

  while (stack.length) {
    const { node, parentId } = stack.pop()!;
    orderedIds.push(node.id);
    byId.set(node.id, node);
    parentById.set(node.id, parentId);
    if (node.disabled) disabledIds.add(node.id);
    if (node.children?.length) {
      branchIds.add(node.id);
      for (let position = node.children.length - 1; position >= 0; position--) {
        stack.push({ node: node.children[position], parentId: node.id });
      }
    }
  }
  return { nodes: normalized, orderedIds, byId, parentById, branchIds, disabledIds };
}

function addVisibleSubtree(node: TreeSelectNode, visibleIds: Set<string>, expandedIds?: Set<string>) {
  const stack = [node];
  while (stack.length) {
    const current = stack.pop()!;
    visibleIds.add(current.id);
    if (current.children?.length) {
      expandedIds?.add(current.id);
      for (let position = current.children.length - 1; position >= 0; position--) {
        stack.push(current.children[position]);
      }
    }
  }
}

function filterNormalizedTreeSelectNodes(
  nodes: readonly TreeSelectNode[],
  query: string,
): FilteredTreeSelectNodes {
  const needle = query.trim().toLocaleLowerCase();
  const visibleIds = new Set<string>();
  const expandedIds = new Set<string>();
  if (!needle) {
    for (const node of nodes) addVisibleSubtree(node, visibleIds);
    return { nodes, visibleIds, expandedIds };
  }

  const result: TreeSelectNode[] = [];
  const stack: Array<{
    node: TreeSelectNode;
    destination: TreeSelectNode[];
    children?: TreeSelectNode[];
  }> = nodes.map(node => ({ node, destination: result })).reverse();
  while (stack.length) {
    const { node, destination, children } = stack.pop()!;
    if (children) {
      if (children.length) {
        visibleIds.add(node.id);
        expandedIds.add(node.id);
        destination.push({ ...node, children });
      }
      continue;
    }
    const haystack = `${node.label} ${node.keywords ?? ''}`.toLocaleLowerCase();
    if (haystack.includes(needle)) {
      addVisibleSubtree(node, visibleIds, expandedIds);
      destination.push(node);
    } else if (node.children?.length) {
      const matches: TreeSelectNode[] = [];
      stack.push({ node, destination, children: matches });
      for (let position = node.children.length - 1; position >= 0; position--) {
        stack.push({ node: node.children[position], destination: matches });
      }
    }
  }
  return { nodes: result, visibleIds, expandedIds };
}

export function filterTreeSelectNodes(
  nodes: readonly TreeSelectNode[],
  query: string,
): FilteredTreeSelectNodes {
  return filterNormalizedTreeSelectNodes(normalizeTreeSelectNodes(nodes), query);
}

/** Reuse the component's index instead of cloning every node on each search. */
export function filterTreeSelectNodesFromIndex(index: TreeSelectIndex, query: string): FilteredTreeSelectNodes {
  return filterNormalizedTreeSelectNodes(index.nodes, query);
}

function isSelectable(
  index: TreeSelectIndex,
  id: string,
  branchSelection: TreeSelectBranchSelection,
) {
  return index.byId.has(id)
    && !index.disabledIds.has(id)
    && (branchSelection === 'all' || !index.branchIds.has(id));
}

function orderedSelection(index: TreeSelectIndex, selected: ReadonlySet<string>, previous: readonly string[]) {
  const known = index.orderedIds.filter(id => selected.has(id));
  const unknown = [...new Set(previous)].filter(id => !index.byId.has(id));
  return [...known, ...unknown];
}

export function updateTreeSelectSelection(
  nodes: readonly TreeSelectNode[],
  current: readonly string[],
  toggledId: string,
  selected: boolean,
  options: TreeSelectSelectionOptions,
): string[] {
  return updateTreeSelectSelectionFromIndex(indexTreeSelectNodes(nodes), current, toggledId, selected, options);
}

/** Reuse the component's index for selection and aggregate each subtree once. */
export function updateTreeSelectSelectionFromIndex(
  index: TreeSelectIndex,
  current: readonly string[],
  toggledId: string,
  selected: boolean,
  options: TreeSelectSelectionOptions,
): string[] {
  if (!isSelectable(index, toggledId, options.branchSelection)) return [...current];
  if (!options.multiple) return selected ? [toggledId] : [];

  const next = new Set(current);
  const stack = [index.byId.get(toggledId)!];
  while (stack.length) {
    const node = stack.pop()!;
    if (isSelectable(index, node.id, options.branchSelection)) {
      if (selected) next.add(node.id);
      else next.delete(node.id);
    }
    if (options.selectionPropagation !== 'none' && node.children?.length) {
      for (const child of node.children) stack.push(child);
    }
  }

  if (options.selectionPropagation === 'both' && options.branchSelection === 'all') {
    const summaries = new Map<string, { count: number; unselected: number }>();
    // Reverse preorder visits children before parents. Include descendants under
    // disabled branches, but never count a disabled node itself as selectable.
    for (let position = index.orderedIds.length - 1; position >= 0; position--) {
      const id = index.orderedIds[position];
      const summary = summaries.get(id) ?? { count: 0, unselected: 0 };
      const enabled = !index.disabledIds.has(id);
      if (enabled && summary.count > 0) {
        if (summary.unselected === 0) next.add(id);
        else next.delete(id);
      }
      const parentId = index.parentById.get(id);
      if (parentId != null) {
        const parent = summaries.get(parentId) ?? { count: 0, unselected: 0 };
        parent.count += summary.count + (enabled ? 1 : 0);
        parent.unselected += summary.unselected + (enabled && !next.has(id) ? 1 : 0);
        summaries.set(parentId, parent);
      }
    }
  }

  return orderedSelection(index, next, current);
}
