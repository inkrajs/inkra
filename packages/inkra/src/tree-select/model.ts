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

function normalizeCopy(
  nodes: readonly TreeSelectNode[],
  seen: Set<string>,
): TreeSelectNode[] {
  const result: TreeSelectNode[] = [];
  for (const node of nodes) {
    if (!node.id || seen.has(node.id)) continue;
    seen.add(node.id);
    const children = normalizeCopy(node.children ?? [], seen);
    result.push({ ...node, children: children.length ? children : undefined });
  }
  return result;
}

export function normalizeTreeSelectNodes(nodes: readonly TreeSelectNode[]): readonly TreeSelectNode[] {
  return normalizeCopy(nodes, new Set());
}

export function indexTreeSelectNodes(nodes: readonly TreeSelectNode[]): TreeSelectIndex {
  const normalized = normalizeTreeSelectNodes(nodes);
  const orderedIds: string[] = [];
  const byId = new Map<string, TreeSelectNode>();
  const parentById = new Map<string, string | null>();
  const branchIds = new Set<string>();
  const disabledIds = new Set<string>();

  const visit = (items: readonly TreeSelectNode[], parentId: string | null) => {
    for (const node of items) {
      orderedIds.push(node.id);
      byId.set(node.id, node);
      parentById.set(node.id, parentId);
      if (node.disabled) disabledIds.add(node.id);
      if (node.children?.length) {
        branchIds.add(node.id);
        visit(node.children, node.id);
      }
    }
  };
  visit(normalized, null);
  return { nodes: normalized, orderedIds, byId, parentById, branchIds, disabledIds };
}

function addVisibleSubtree(node: TreeSelectNode, visibleIds: Set<string>, expandedIds: Set<string>) {
  visibleIds.add(node.id);
  if (node.children?.length) {
    expandedIds.add(node.id);
    for (const child of node.children) addVisibleSubtree(child, visibleIds, expandedIds);
  }
}

export function filterTreeSelectNodes(
  nodes: readonly TreeSelectNode[],
  query: string,
): FilteredTreeSelectNodes {
  const normalized = normalizeTreeSelectNodes(nodes);
  const needle = query.trim().toLocaleLowerCase();
  const visibleIds = new Set<string>();
  const expandedIds = new Set<string>();
  if (!needle) {
    for (const node of normalized) addVisibleSubtree(node, visibleIds, new Set());
    return { nodes: normalized, visibleIds, expandedIds };
  }

  const visit = (node: TreeSelectNode): TreeSelectNode | null => {
    const haystack = `${node.label} ${node.keywords ?? ''}`.toLocaleLowerCase();
    if (haystack.includes(needle)) {
      addVisibleSubtree(node, visibleIds, expandedIds);
      return node;
    }
    const children = (node.children ?? []).map(visit).filter((child): child is TreeSelectNode => child !== null);
    if (!children.length) return null;
    visibleIds.add(node.id);
    expandedIds.add(node.id);
    return { ...node, children };
  };

  return {
    nodes: normalized.map(visit).filter((node): node is TreeSelectNode => node !== null),
    visibleIds,
    expandedIds,
  };
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

function descendants(index: TreeSelectIndex, id: string): string[] {
  const node = index.byId.get(id);
  if (!node?.children?.length) return [];
  const result: string[] = [];
  const visit = (items: readonly TreeSelectNode[]) => {
    for (const child of items) {
      result.push(child.id);
      if (child.children?.length) visit(child.children);
    }
  };
  visit(node.children);
  return result;
}

function orderedSelection(index: TreeSelectIndex, selected: ReadonlySet<string>, previous: readonly string[]) {
  const known = index.orderedIds.filter(id => selected.has(id));
  const unknown = previous.filter((id, position) => !index.byId.has(id) && previous.indexOf(id) === position);
  return [...known, ...unknown];
}

export function updateTreeSelectSelection(
  nodes: readonly TreeSelectNode[],
  current: readonly string[],
  toggledId: string,
  selected: boolean,
  options: {
    multiple: boolean;
    branchSelection: TreeSelectBranchSelection;
    selectionPropagation: TreeSelectSelectionPropagation;
  },
): string[] {
  const index = indexTreeSelectNodes(nodes);
  if (!isSelectable(index, toggledId, options.branchSelection)) return [...current];
  if (!options.multiple) return selected ? [toggledId] : [];

  const next = new Set(current);
  const affected = [toggledId];
  if (options.selectionPropagation !== 'none' && index.branchIds.has(toggledId)) {
    affected.push(...descendants(index, toggledId));
  }
  for (const id of affected) {
    if (!isSelectable(index, id, options.branchSelection)) continue;
    if (selected) next.add(id);
    else next.delete(id);
  }

  if (options.selectionPropagation === 'both' && options.branchSelection === 'all') {
    const branches = index.orderedIds.filter(id => index.branchIds.has(id)).reverse();
    for (const branchId of branches) {
      if (index.disabledIds.has(branchId)) continue;
      const selectableDescendants = descendants(index, branchId)
        .filter(id => isSelectable(index, id, options.branchSelection));
      if (!selectableDescendants.length) continue;
      if (selectableDescendants.every(id => next.has(id))) next.add(branchId);
      else next.delete(branchId);
    }
  }

  return orderedSelection(index, next, current);
}

