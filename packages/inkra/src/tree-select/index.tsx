import { useInkraLocale } from '../i18n/index.js';
import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from 'react';

import { Button, ButtonGroup } from '../Button.js';
import { Input } from '../form/Input.js';
import { mergeAriaIds, useFieldContext } from '../form/context.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilText } from '../PencilText.js';
import { Popover } from '../overlay/index.js';
import { Tree } from '../tree/index.js';
import type { TreeKey, TreeSelection } from '../tree/index.js';
import {
  filterTreeSelectNodesFromIndex,
  indexTreeSelectNodes,
  updateTreeSelectSelectionFromIndex,
} from './model.js';
import type {
  TreeSelectBranchSelection,
  TreeSelectNode,
  TreeSelectSelectionPropagation,
} from './model.js';

export type {
  TreeSelectBranchSelection,
  TreeSelectNode,
  TreeSelectSelectionPropagation,
} from './model.js';

export interface TreeSelectRenderLabelState {
  branch: boolean;
  disabled: boolean;
  selected: boolean;
  query: string;
}

export interface TreeSelectChangeDetails {
  id?: string;
  node?: TreeSelectNode;
  reason: 'select' | 'clear';
  selected?: boolean;
}

interface TreeSelectCommonProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'defaultValue' | 'onChange' | 'children'
> {
  items: readonly TreeSelectNode[];
  branchSelection?: TreeSelectBranchSelection;
  selectionPropagation?: TreeSelectSelectionPropagation;
  renderLabel?: (node: TreeSelectNode, state: TreeSelectRenderLabelState) => ReactNode;
  renderValue?: (nodes: readonly TreeSelectNode[], ids: readonly string[]) => ReactNode;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyContent?: ReactNode;
  clearable?: boolean;
  clearLabel?: string;
  treeLabel?: string;
  expandLabel?: string;
  collapseLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  name?: string;
  form?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  expandedIds?: readonly string[];
  defaultExpandedIds?: readonly string[];
  onExpandedIdsChange?: (ids: string[]) => void;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  collisionPadding?: number;
}

export type TreeSelectProps = TreeSelectCommonProps & (
  | {
    multiple?: false;
    value?: string | null;
    defaultValue?: string | null;
    onValueChange?: (value: string | null, details: TreeSelectChangeDetails) => void;
  }
  | {
    multiple: true;
    value?: readonly string[];
    defaultValue?: readonly string[];
    onValueChange?: (value: string[], details: TreeSelectChangeDetails) => void;
  }
);

const chevronPaths = [{ d: 'M6 9l6 6 6-6' }] as const;
const clearPaths = [{ d: 'M6 6l12 12M18 6L6 18' }] as const;
const searchPaths = [{ d: 'M21 21l-4.5-4.5' }, { d: 'M18 10a8 8 0 1 1-16 0a8 8 0 1 1 16 0' }] as const;

function selectionFromProps(props: TreeSelectProps, fallback: readonly string[] = []): string[] {
  const raw = props.value !== undefined ? props.value : props.defaultValue;
  if (props.multiple) return Array.isArray(raw) ? [...new Set(raw)] : [...fallback];
  return typeof raw === 'string' && raw ? [raw] : raw === null ? [] : [...fallback];
}

function keys(selection: TreeSelection): string[] {
  return selection === 'all' ? [] : [...selection].map(String);
}

interface TreeSelectTreeProps {
  nodes: readonly TreeSelectNode[];
  renderLabel?: TreeSelectCommonProps['renderLabel'];
  selectedSet: Set<TreeKey>;
  query: string;
  collapseLabel: string;
  expandLabel: string;
  treeLabel: string;
  emptyContent: ReactNode;
  effectiveExpanded: Set<TreeKey>;
  onExpandedChange: (keys: Set<TreeKey>) => void;
  onSelectionChange: (selection: TreeSelection) => void;
  multiple: boolean;
}

// The portal owns mounting (including its exit animation). Keep collection
// construction here rather than doing work for content the portal never mounts.
const TreeSelectTree = forwardRef<HTMLDivElement, TreeSelectTreeProps>(function TreeSelectTree({
  nodes, renderLabel, selectedSet, query, collapseLabel, expandLabel, treeLabel,
  emptyContent, effectiveExpanded, onExpandedChange, onSelectionChange, multiple,
}, ref) {
  // Default labels are selection-independent; only custom label renderers need
  // a new collection when the selected keys change.
  const labelSelection = renderLabel ? selectedSet : undefined;
  const treeItems = useMemo(() => {
    // Construct the same nested tree without growing the JavaScript call stack.
    // Enter jobs keep renderLabel callbacks in the original depth-first order.
    const result: ReactNode[] = [];
    type Job = { node: TreeSelectNode; output: ReactNode[]; finish?: { label: ReactNode; children: ReactNode[] } };
    const stack: Job[] = [];
    for (let index = nodes.length - 1; index >= 0; index--) stack.push({ node: nodes[index], output: result });
    while (stack.length) {
      const { node, output, finish } = stack.pop()!;
      if (finish) {
        output.push(<Tree.Item
          className="inkra-tree-select__item"
          id={node.id}
          isDisabled={node.disabled}
          key={node.id}
          textValue={node.label}
        >
          <Tree.ItemContent collapseLabel={collapseLabel} expandLabel={expandLabel}>
            <Tree.ItemTitle>{finish.label}</Tree.ItemTitle>
            {node.description ? <Tree.ItemDescription>{node.description}</Tree.ItemDescription> : null}
          </Tree.ItemContent>
          {node.children?.length ? finish.children : null}
        </Tree.Item>);
        continue;
      }
      const label = renderLabel?.(node, {
        branch: Boolean(node.children?.length),
        disabled: Boolean(node.disabled),
        selected: labelSelection?.has(node.id) ?? false,
        query,
      }) ?? node.label;
      const children: ReactNode[] = [];
      stack.push({ node, output, finish: { label, children } });
      for (let index = (node.children?.length ?? 0) - 1; index >= 0; index--) {
        stack.push({ node: node.children![index], output: children });
      }
    }
    return result;
  }, [nodes, renderLabel, labelSelection, query, collapseLabel, expandLabel]);

  return <Tree.Root
    aria-label={treeLabel}
    className="inkra-tree-select__tree"
    emptyState={emptyContent}
    expandedKeys={effectiveExpanded}
    onExpandedChange={onExpandedChange}
    onSelectionChange={onSelectionChange}
    ref={ref}
    selectedKeys={selectedSet}
    selectionMode={multiple ? 'multiple' : 'single'}
  >{treeItems}</Tree.Root>;
});

export const TreeSelect = forwardRef<HTMLDivElement, TreeSelectProps>(function TreeSelect(props, ref) {
  const { t } = useInkraLocale();
  const {
    items,
    branchSelection = 'leaf',
    selectionPropagation = 'none',
    renderLabel,
    renderValue,
    placeholder = t('treeSelect.placeholder'),
    searchPlaceholder = t('treeSelect.search'),
    emptyContent = t('treeSelect.empty'),
    clearable = true,
    clearLabel = t('select.clear'),
    treeLabel = t('treeSelect.options'),
    expandLabel = t('tree.expand'),
    collapseLabel = t('tree.collapse'),
    size = 'md',
    name,
    form,
    disabled,
    readOnly,
    required,
    invalid,
    open: controlledOpen,
    defaultOpen = false,
    onOpenChange,
    expandedIds,
    defaultExpandedIds = [],
    onExpandedIdsChange,
    side = 'bottom',
    align = 'start',
    sideOffset = 8,
    collisionPadding = 8,
    id,
    className,
    multiple: _multiple,
    value: _value,
    defaultValue: _defaultValue,
    onValueChange: _onValueChange,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    ...rest
  } = props;
  const field = useFieldContext();
  const generatedId = useId();
  const controlId = field?.controlId ?? id ?? `inkra-tree-select-${generatedId}`;
  const resolvedDisabled = Boolean(disabled || field?.disabled);
  const resolvedReadOnly = Boolean(readOnly || field?.readOnly);
  const resolvedRequired = Boolean(required || field?.required);
  const resolvedInvalid = Boolean(invalid || field?.invalid);
  const describedBy = mergeAriaIds(ariaDescribedBy, field?.descriptionId, field?.errorId);
  const normalized = useMemo(() => indexTreeSelectNodes(items), [items]);
  const controlledSelection = props.value !== undefined;
  const [uncontrolledSelection, setUncontrolledSelection] = useState<string[]>(() => selectionFromProps(props));
  const defaultSelection = useRef(uncontrolledSelection);
  const selectedIds = useMemo(
    () => controlledSelection ? selectionFromProps(props) : uncontrolledSelection,
    [controlledSelection, props.value, props.multiple, uncontrolledSelection],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = controlledOpen ?? uncontrolledOpen;
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState<string[]>(() => [...new Set(defaultExpandedIds)]);
  const baseExpanded = expandedIds ?? uncontrolledExpanded;
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterTreeSelectNodesFromIndex(normalized, query), [normalized, query]);
  const effectiveExpanded = useMemo(
    () => new Set<TreeKey>([...baseExpanded, ...filtered.expandedIds]),
    [baseExpanded, filtered.expandedIds],
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const formAnchorRef = useRef<HTMLInputElement>(null);
  const selectedNodes = useMemo(() => selectedIds
    .map(selectedId => normalized.byId.get(selectedId))
    .filter((node): node is TreeSelectNode => node !== undefined), [selectedIds, normalized]);

  const setOpen = (next: boolean) => {
    if (resolvedDisabled || resolvedReadOnly) return;
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    if (!next) setQuery('');
    onOpenChange?.(next);
  };

  const emitSelection = (next: string[], details: TreeSelectChangeDetails) => {
    if (!controlledSelection) setUncontrolledSelection(next);
    if (props.multiple) props.onValueChange?.(next, details);
    else props.onValueChange?.(next[0] ?? null, details);
  };

  useEffect(() => {
    const currentForm = formAnchorRef.current?.form;
    if (!currentForm) return;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    const reset = (event: Event) => {
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        if (event.defaultPrevented) return;
        if (!controlledSelection) setUncontrolledSelection(defaultSelection.current);
        setQuery('');
        if (controlledOpen === undefined) setUncontrolledOpen(false);
      }, 0);
    };
    currentForm.addEventListener('reset', reset);
    return () => {
      clearTimeout(resetTimer);
      currentForm.removeEventListener('reset', reset);
    };
  }, [controlledOpen, controlledSelection, form]);

  const handleSelectionChange = (nextSelection: TreeSelection) => {
    if (resolvedDisabled || resolvedReadOnly) return;
    const nextKeys = new Set(keys(nextSelection));
    const added = [...nextKeys].find(item => !selectedSet.has(item));
    const removed = selectedIds.find(item => filtered.visibleIds.has(item) && !nextKeys.has(item));
    const toggledId = added ?? removed;
    if (!toggledId) return;
    const selected = added === toggledId;
    const next = updateTreeSelectSelectionFromIndex(normalized, selectedIds, toggledId, selected, {
      multiple: Boolean(props.multiple),
      branchSelection,
      selectionPropagation,
    });
    if (next.length === selectedIds.length && next.every((item, index) => item === selectedIds[index])) return;
    emitSelection(next, {
      id: toggledId,
      node: normalized.byId.get(toggledId),
      reason: 'select',
      selected,
    });
    if (!props.multiple && selected) setOpen(false);
  };

  const handleExpandedChange = (nextKeys: Set<TreeKey>) => {
    const next = [...nextKeys].map(String).filter(item => !filtered.expandedIds.has(item) || baseExpanded.includes(item));
    if (expandedIds === undefined) setUncontrolledExpanded(next);
    onExpandedIdsChange?.(next);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowDown' || filtered.nodes.length === 0) return;
    event.preventDefault();
    treeRef.current?.focus();
  };


  const fallbackValue = selectedIds.map(selectedId => normalized.byId.get(selectedId)?.label ?? selectedId).join(', ');
  const valueContent = renderValue?.(selectedNodes, selectedIds)
    ?? (fallbackValue ? <PencilText ellipsis>{fallbackValue}</PencilText> : <PencilText ellipsis>{placeholder}</PencilText>);
  const indicatorSize = size === 'sm' ? 24 : size === 'lg' ? 32 : 28;
  const exposedOpen = resolvedDisabled || resolvedReadOnly ? false : isOpen;

  return <div
    {...rest}
    className={['inkra-tree-select', className].filter(Boolean).join(' ')}
    data-disabled={resolvedDisabled || undefined}
    data-invalid={resolvedInvalid || undefined}
    data-readonly={resolvedReadOnly || undefined}
    data-size={size}
    ref={ref}
  >
    <Popover.Root open={exposedOpen} onOpenChange={setOpen}>
      <ButtonGroup
        aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : treeLabel)}
        aria-labelledby={ariaLabelledBy}
        className="inkra-tree-select__control"
        data-size={size}
        disabled={resolvedDisabled}
        fullWidth
        size={size}
        variant="outline"
      >
        <Popover.Trigger asChild>
          <Button
            aria-describedby={describedBy}
            aria-invalid={resolvedInvalid || undefined}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-readonly={resolvedReadOnly || undefined}
            aria-required={resolvedRequired || undefined}
            className="inkra-tree-select__trigger"
            disabled={resolvedDisabled}
            endIcon={<PencilIcon paths={chevronPaths} size={indicatorSize} sourceSize={24} />}
            fullWidth
            id={controlId}
            ref={triggerRef}
            size={size}
          >
            <span className="inkra-tree-select__value" data-placeholder={!selectedIds.length || undefined}>{valueContent}</span>
          </Button>
        </Popover.Trigger>
        {clearable ? <Button
          aria-hidden={!selectedIds.length || undefined}
          aria-label={clearLabel}
          className="inkra-tree-select__clear"
          disabled={resolvedDisabled || resolvedReadOnly || selectedIds.length === 0}
          onPointerDown={event => event.preventDefault()}
          onClick={() => {
            emitSelection([], { reason: 'clear' });
            setOpen(false);
            triggerRef.current?.focus({ preventScroll: true });
          }}
          size={size === 'sm' ? 'icon-sm' : size === 'lg' ? 'icon-lg' : 'icon'}
          tabIndex={selectedIds.length ? undefined : -1}
          variant="ghost"
        ><PencilIcon paths={clearPaths} size={24} sourceSize={24} /></Button> : null}
      </ButtonGroup>
      <Popover.Portal>
        <Popover.Content
          align={align}
          aria-label={treeLabel}
          className="inkra-tree-select__popover"
          collisionPadding={collisionPadding}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            searchRef.current?.focus();
          }}
          side={side}
          sideOffset={sideOffset}
        >
          <div className="inkra-tree-select__search">
            <Input
              aria-label={searchPlaceholder}
              clearable
              clearButtonLabel={clearLabel}
              onKeyDown={handleSearchKeyDown}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
              ref={searchRef}
              size={size}
              startIcon={<PencilIcon paths={searchPaths} size={22} sourceSize={24} />}
              type="search"
              value={query}
              variant="underline"
            />
          </div>
          <TreeSelectTree
            collapseLabel={collapseLabel}
            effectiveExpanded={effectiveExpanded}
            emptyContent={emptyContent}
            expandLabel={expandLabel}
            multiple={Boolean(props.multiple)}
            nodes={filtered.nodes}
            onExpandedChange={handleExpandedChange}
            onSelectionChange={handleSelectionChange}
            query={query}
            ref={treeRef}
            renderLabel={renderLabel}
            selectedSet={selectedSet}
            treeLabel={treeLabel}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
    <input aria-hidden="true" className="inkra-tree-select__form-anchor" form={form} ref={formAnchorRef} tabIndex={-1} type="hidden" />
    {name && !resolvedDisabled ? selectedIds.map(selectedId => <input form={form} key={selectedId} name={name} type="hidden" value={selectedId} />) : null}
  </div>;
});

