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

import { Button } from '../Button.js';
import { Input } from '../form/Input.js';
import { mergeAriaIds, useFieldContext } from '../form/context.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilText } from '../PencilText.js';
import { Popover } from '../overlay/index.js';
import { Tree } from '../tree/index.js';
import type { TreeKey, TreeSelection } from '../tree/index.js';
import {
  filterTreeSelectNodes,
  indexTreeSelectNodes,
  updateTreeSelectSelection,
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

export const TreeSelect = forwardRef<HTMLDivElement, TreeSelectProps>(function TreeSelect(props, ref) {
  const {
    items,
    branchSelection = 'leaf',
    selectionPropagation = 'none',
    renderLabel,
    renderValue,
    placeholder = 'Select an item',
    searchPlaceholder = 'Search tree',
    emptyContent = 'No matching items',
    clearable = true,
    clearLabel = 'Clear selection',
    treeLabel = 'Tree options',
    expandLabel = 'Expand item',
    collapseLabel = 'Collapse item',
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
  const defaultSelection = useRef(selectionFromProps(props));
  const controlledSelection = props.value !== undefined;
  const [uncontrolledSelection, setUncontrolledSelection] = useState<string[]>(defaultSelection.current);
  const selectedIds = controlledSelection ? selectionFromProps(props) : uncontrolledSelection;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = controlledOpen ?? uncontrolledOpen;
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState<string[]>(() => [...new Set(defaultExpandedIds)]);
  const baseExpanded = expandedIds ?? uncontrolledExpanded;
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterTreeSelectNodes(normalized.nodes, query), [normalized.nodes, query]);
  const effectiveExpanded = useMemo(
    () => new Set<TreeKey>([...baseExpanded, ...filtered.expandedIds]),
    [baseExpanded, filtered.expandedIds],
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const formAnchorRef = useRef<HTMLInputElement>(null);
  const selectedNodes = selectedIds
    .map(selectedId => normalized.byId.get(selectedId))
    .filter((node): node is TreeSelectNode => node !== undefined);

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
    if (controlledSelection) return;
    const currentForm = formAnchorRef.current?.form;
    if (!currentForm) return;
    const reset = () => {
      setUncontrolledSelection(defaultSelection.current);
      setQuery('');
      if (controlledOpen === undefined) setUncontrolledOpen(false);
    };
    currentForm.addEventListener('reset', reset);
    return () => currentForm.removeEventListener('reset', reset);
  }, [controlledOpen, controlledSelection]);

  const handleSelectionChange = (nextSelection: TreeSelection) => {
    if (resolvedDisabled || resolvedReadOnly) return;
    const nextKeys = new Set(keys(nextSelection));
    const added = [...nextKeys].find(item => !selectedSet.has(item));
    const removed = selectedIds.find(item => filtered.visibleIds.has(item) && !nextKeys.has(item));
    const toggledId = added ?? removed;
    if (!toggledId) return;
    const selected = added === toggledId;
    const next = updateTreeSelectSelection(normalized.nodes, selectedIds, toggledId, selected, {
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

  const renderNodes = (nodes: readonly TreeSelectNode[]): ReactNode => nodes.map(node => {
    const branch = Boolean(node.children?.length);
    const label = renderLabel?.(node, {
      branch,
      disabled: Boolean(node.disabled),
      selected: selectedSet.has(node.id),
      query,
    }) ?? node.label;
    return <Tree.Item
      className="inkra-tree-select__item"
      id={node.id}
      isDisabled={node.disabled}
      key={node.id}
      textValue={node.label}
    >
      <Tree.ItemContent collapseLabel={collapseLabel} expandLabel={expandLabel}>
        <Tree.ItemTitle>{label}</Tree.ItemTitle>
        {node.description ? <Tree.ItemDescription>{node.description}</Tree.ItemDescription> : null}
      </Tree.ItemContent>
      {node.children?.length ? renderNodes(node.children) : null}
    </Tree.Item>;
  });

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
      <div className="inkra-tree-select__control">
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
            variant="outline"
          >
            <span className="inkra-tree-select__value" data-placeholder={!selectedIds.length || undefined}>{valueContent}</span>
          </Button>
        </Popover.Trigger>
        {clearable ? <Button
          aria-label={clearLabel}
          className="inkra-tree-select__clear"
          data-visible={selectedIds.length > 0 || undefined}
          disabled={resolvedDisabled || resolvedReadOnly || selectedIds.length === 0}
          onClick={() => emitSelection([], { reason: 'clear' })}
          size={size === 'sm' ? 'icon-sm' : size === 'lg' ? 'icon-lg' : 'icon'}
          tabIndex={selectedIds.length ? undefined : -1}
          variant="ghost"
        ><PencilIcon paths={clearPaths} size={24} sourceSize={24} /></Button> : null}
      </div>
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
          <Tree.Root
            aria-label={treeLabel}
            className="inkra-tree-select__tree"
            emptyState={emptyContent}
            expandedKeys={effectiveExpanded}
            onExpandedChange={handleExpandedChange}
            onSelectionChange={handleSelectionChange}
            ref={treeRef}
            selectedKeys={new Set<TreeKey>(selectedIds)}
            selectionMode={props.multiple ? 'multiple' : 'single'}
          >
            {renderNodes(filtered.nodes)}
          </Tree.Root>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
    <input aria-hidden="true" className="inkra-tree-select__form-anchor" form={form} ref={formAnchorRef} tabIndex={-1} type="hidden" />
    {name && !resolvedDisabled ? selectedIds.map(selectedId => <input form={form} key={selectedId} name={name} type="hidden" value={selectedId} />) : null}
  </div>;
});

