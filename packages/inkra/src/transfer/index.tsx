import { useInkraLocale, type InkraTranslate } from '../i18n/index.js';
import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

import { Button } from '../Button.js';
import { Input } from '../form/Input.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { Checkbox } from '../selection/Checkbox.js';
import {
  moveTransferKeys,
  normalizeTargetKeys,
  resolveTransferFocusIntent,
  splitTransferItems,
  transferKeysEqual,
  uniqueTransferItems,
} from './model.js';
import type { TransferDirection, TransferSide } from './model.js';

const searchPaths = [
  { d: 'M 11 4 A 7 7 0 1 0 11 18 A 7 7 0 1 0 11 4 M 16 16 L 21 21' },
] as const;
const rightPaths = [{ d: 'M 5 12 L 19 12 M 13 6 L 19 12 L 13 18' }] as const;

export interface TransferItem {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  keywords?: readonly string[];
  searchText?: string;
  disabled?: boolean;
}

export interface TransferLabels {
  sourceTitle?: ReactNode;
  targetTitle?: ReactNode;
  sourceSearchLabel?: string;
  targetSearchLabel?: string;
  sourceClearSearch?: string;
  targetClearSearch?: string;
  sourceSearchPlaceholder?: string;
  targetSearchPlaceholder?: string;
  selectAllSource?: string;
  selectAllTarget?: string;
  sourceEmpty?: ReactNode;
  targetEmpty?: ReactNode;
  sourceNoResults?: ReactNode;
  targetNoResults?: ReactNode;
  moveToTarget?: string;
  moveToSource?: string;
  moveSelectedToTarget?: string;
  moveSelectedToSource?: string;
  batchActions?: string;
  previousPage?: string;
  nextPage?: string;
}

export interface TransferCountDetails {
  side: TransferSide;
  visible: number;
  total: number;
  selected: number;
}

export interface TransferItemRenderState {
  side: TransferSide;
  selected: boolean;
  disabled: boolean;
  query: string;
}

export interface TransferChangeDetails {
  direction: TransferDirection;
  action: 'single' | 'batch';
  movedKeys: string[];
  movedItems: TransferItem[];
}

export interface TransferProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  items: readonly TransferItem[];
  targetKeys?: readonly string[];
  defaultTargetKeys?: readonly string[];
  onTargetKeysChange?: (targetKeys: string[], details: TransferChangeDetails) => void;
  disabled?: boolean;
  searchable?: boolean;
  labels?: TransferLabels;
  filterItem?: (item: TransferItem, query: string, side: TransferSide) => boolean;
  renderItem?: (item: TransferItem, state: TransferItemRenderState) => ReactNode;
  formatCount?: (details: TransferCountDetails) => ReactNode;
  /** Opt-in panel pagination. All items remain searchable and movable. */
  pageSize?: number;
  pageLabel?: (page: number, pageCount: number) => ReactNode;
}

const defaultLabels = (t: InkraTranslate): Required<TransferLabels> => ({
  sourceTitle: t('transfer.available'),
  targetTitle: t('common.selected'),
  sourceSearchLabel: t('transfer.sourceSearch'),
  targetSearchLabel: t('transfer.targetSearch'),
  sourceClearSearch: t('transfer.sourceClear'),
  targetClearSearch: t('transfer.targetClear'),
  sourceSearchPlaceholder: t('transfer.sourcePlaceholder'),
  targetSearchPlaceholder: t('transfer.targetPlaceholder'),
  selectAllSource: t('transfer.allSource'),
  selectAllTarget: t('transfer.allTarget'),
  sourceEmpty: t('transfer.sourceEmpty'),
  targetEmpty: t('transfer.targetEmpty'),
  sourceNoResults: t('transfer.sourceNoResults'),
  targetNoResults: t('transfer.targetNoResults'),
  moveToTarget: t('transfer.toTarget'),
  moveToSource: t('transfer.toSource'),
  moveSelectedToTarget: t('transfer.selectedToTarget'),
  moveSelectedToSource: t('transfer.selectedToSource'),
  batchActions: t('transfer.batch'),
  previousPage: t('common.previousPage'),
  nextPage: t('common.nextPage'),
});

function searchableText(item: TransferItem): string {
  const parts = [
    item.searchText,
    typeof item.label === 'string' || typeof item.label === 'number' ? String(item.label) : undefined,
    typeof item.description === 'string' || typeof item.description === 'number' ? String(item.description) : undefined,
    ...(item.keywords ?? []),
  ];
  return parts.filter(Boolean).join(' ').toLocaleLowerCase();
}

function filterPanelItems(
  items: TransferItem[],
  query: string,
  side: TransferSide,
  filterItem: TransferProps['filterItem'],
): TransferItem[] {
  if (query.length === 0) return items;
  if (filterItem) return items.filter(item => filterItem(item, query, side));
  const needle = query.trim().toLocaleLowerCase();
  return items.filter(item => searchableText(item).includes(needle));
}

function defaultCount({ visible, total, selected }: TransferCountDetails, t: InkraTranslate): ReactNode {
  return selected > 0 ? t('transfer.count', { selected, visible, total }) : `${visible}/${total}`;
}

function itemCopy(item: TransferItem) {
  return <span className="inkra-transfer__item-copy">
    <span className="inkra-transfer__item-label">
      {typeof item.label === 'string' || typeof item.label === 'number'
        ? <PencilText>{String(item.label)}</PencilText>
        : item.label}
    </span>
    {item.description == null ? null : <span className="inkra-transfer__item-description">{item.description}</span>}
  </span>;
}

export const Transfer = forwardRef<HTMLDivElement, TransferProps>(function Transfer(
  {
    className,
    defaultTargetKeys = [],
    disabled = false,
    filterItem,
    formatCount: formatCountProp,
    items,
    labels: labelOverrides,
    onTargetKeysChange,
    pageSize,
    pageLabel = (page, count) => `${page} / ${count}`,
    renderItem,
    searchable = true,
    targetKeys,
    ...props
  },
  ref,
) {
  const { t } = useInkraLocale();
  const formatCount = formatCountProp ?? ((details: TransferCountDetails) => defaultCount(details, t));
  const generatedId = useId();
  const controlled = targetKeys !== undefined;
  const uniqueItems = useMemo(() => uniqueTransferItems(items), [items]);
  const [uncontrolledTargetKeys, setUncontrolledTargetKeys] = useState(() => normalizeTargetKeys(items, defaultTargetKeys));
  const requestedTargetKeys = controlled ? targetKeys : uncontrolledTargetKeys;
  const currentTargetKeys = useMemo(() => normalizeTargetKeys(uniqueItems, requestedTargetKeys), [uniqueItems, requestedTargetKeys]);
  const currentTargetSet = useMemo(() => new Set(currentTargetKeys), [currentTargetKeys]);
  const itemsById = useMemo(() => new Map(uniqueItems.map(item => [item.id, item])), [uniqueItems]);
  const panels = useMemo(() => splitTransferItems(uniqueItems, currentTargetKeys), [uniqueItems, currentTargetKeys]);
  const labels = { ...defaultLabels(t), ...labelOverrides };
  const [queries, setQueries] = useState<Record<TransferSide, string>>({ source: '', target: '' });
  const [pages, setPages] = useState<Record<TransferSide, number>>({ source: 0, target: 0 });
  const pageLength = pageSize !== undefined && Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : undefined;
  const [selected, setSelected] = useState<Record<TransferSide, Set<string>>>(() => ({ source: new Set(), target: new Set() }));
  const [pendingFocus, setPendingFocus] = useState<{
    id: string;
    side: TransferSide;
    origin: HTMLElement | null;
    previousTargetKeys: string[];
    expectedTargetKeys: string[];
  } | null>(null);
  const itemRefs = useRef(new Map<string, HTMLInputElement>());
  const panelRefs = useRef<Record<TransferSide, HTMLElement | null>>({ source: null, target: null });

  const visibleSource = useMemo(
    () => filterPanelItems(panels.source, queries.source, 'source', filterItem),
    [panels.source, queries.source, filterItem],
  );
  const visibleTarget = useMemo(
    () => filterPanelItems(panels.target, queries.target, 'target', filterItem),
    [panels.target, queries.target, filterItem],
  );
  const pageIndex = (side: TransferSide, count: number) => pageLength === undefined ? 0 : Math.min(pages[side], Math.max(0, Math.ceil(count / pageLength) - 1));
  const sourcePage = pageIndex('source', visibleSource.length);
  const targetPage = pageIndex('target', visibleTarget.length);
  const shownSource = useMemo(() => pageLength === undefined ? visibleSource : visibleSource.slice(sourcePage * pageLength, (sourcePage + 1) * pageLength), [visibleSource, sourcePage, pageLength]);
  const shownTarget = useMemo(() => pageLength === undefined ? visibleTarget : visibleTarget.slice(targetPage * pageLength, (targetPage + 1) * pageLength), [visibleTarget, targetPage, pageLength]);
  const visibleItems = { source: shownSource, target: shownTarget };

  useEffect(() => {
    setSelected(current => {
      const source = new Set([...current.source].filter(key => itemsById.has(key) && !currentTargetSet.has(key)));
      const target = new Set([...current.target].filter(key => itemsById.has(key) && currentTargetSet.has(key)));
      if (source.size === current.source.size && target.size === current.target.size) return current;
      return { source, target };
    });
  }, [itemsById, currentTargetSet]);

  useEffect(() => {
    if (!pendingFocus) return;
    if (disabled || !itemsById.has(pendingFocus.id)) {
      setPendingFocus(null);
      return;
    }
    const valueResolution = transferKeysEqual(currentTargetKeys, pendingFocus.expectedTargetKeys)
      ? 'accepted'
      : transferKeysEqual(currentTargetKeys, pendingFocus.previousTargetKeys) ? 'unchanged' : 'mismatch';
    const ownerDocument = pendingFocus.origin?.ownerDocument ?? document;
    const activeElement = ownerDocument.activeElement;
    const originStillOwnsFocus = activeElement === pendingFocus.origin;
    const focusFellBackToDocument = activeElement === ownerDocument.body || activeElement === ownerDocument.documentElement;
    const originUnavailable = pendingFocus.origin != null
      && (!pendingFocus.origin.isConnected || pendingFocus.origin.matches(':disabled'))
      && focusFellBackToDocument;
    if (valueResolution !== 'accepted') {
      if (resolveTransferFocusIntent(valueResolution, originStillOwnsFocus, originUnavailable) !== 'wait') {
        setPendingFocus(null);
        return;
      }
      const cancel = (event: FocusEvent) => {
        const target = event.target;
        const documentFallback = target === ownerDocument.body || target === ownerDocument.documentElement;
        const unavailable = pendingFocus.origin != null
          && (!pendingFocus.origin.isConnected || pendingFocus.origin.matches(':disabled'));
        if (target !== pendingFocus.origin && !(documentFallback && unavailable)) setPendingFocus(null);
      };
      ownerDocument.addEventListener('focusin', cancel);
      return () => ownerDocument.removeEventListener('focusin', cancel);
    }
    if (resolveTransferFocusIntent('accepted', originStillOwnsFocus, originUnavailable) !== 'focus') {
      setPendingFocus(null);
      return;
    }
    if (pageLength !== undefined) {
      const matching = pendingFocus.side === 'source' ? visibleSource : visibleTarget;
      const index = matching.findIndex(item => item.id === pendingFocus.id);
      const nextPage = index < 0 ? undefined : Math.floor(index / pageLength);
      if (nextPage !== undefined && nextPage !== pages[pendingFocus.side]) {
        setPages(current => ({ ...current, [pendingFocus.side]: nextPage }));
        return;
      }
    }
    const control = itemRefs.current.get(`${pendingFocus.side}:${pendingFocus.id}`);
    (control ?? panelRefs.current[pendingFocus.side])?.focus({ preventScroll: true });
    setPendingFocus(null);
  }, [disabled, pendingFocus, currentTargetKeys, itemsById, pageLength, pages, visibleSource, visibleTarget]);

  const setItemSelected = (side: TransferSide, id: string, checked: boolean) => {
    setSelected(current => {
      if (current[side].has(id) === checked) return current;
      const next = new Set(current[side]);
      if (checked) next.add(id);
      else next.delete(id);
      return { ...current, [side]: next };
    });
  };

  const selectableVisible = (side: TransferSide) => visibleItems[side].filter(item => !item.disabled && !disabled);

  const toggleAll = (side: TransferSide, checked: boolean) => {
    const ids = selectableVisible(side).map(item => item.id);
    setSelected(current => {
      const next = new Set(current[side]);
      ids.forEach(id => checked ? next.add(id) : next.delete(id));
      return { ...current, [side]: next };
    });
  };

  const move = (
    keys: readonly string[],
    direction: TransferDirection,
    action: 'single' | 'batch',
    origin: HTMLElement | null,
  ) => {
    const sourceSide: TransferSide = direction === 'to-target' ? 'source' : 'target';
    const destinationSide: TransferSide = direction === 'to-target' ? 'target' : 'source';
    const allowed = new Set(panels[sourceSide].filter(item => !item.disabled && !disabled).map(item => item.id));
    const movedKeys = [...new Set(keys)].filter(key => allowed.has(key));
    if (movedKeys.length === 0) return;
    const next = moveTransferKeys(uniqueItems, currentTargetKeys, movedKeys, direction);
    if (!controlled) setUncontrolledTargetKeys(next);
    setSelected(current => {
      const source = new Set(current[sourceSide]);
      movedKeys.forEach(key => source.delete(key));
      return { ...current, [sourceSide]: source };
    });
    setPendingFocus({
      id: movedKeys[0],
      side: destinationSide,
      origin,
      previousTargetKeys: [...currentTargetKeys],
      expectedTargetKeys: next,
    });
    onTargetKeysChange?.(next, {
      action,
      direction,
      movedKeys,
      movedItems: movedKeys.map(key => itemsById.get(key)).filter((item): item is TransferItem => item !== undefined),
    });
  };

  const renderPanel = (side: TransferSide) => {
    const source = side === 'source';
    const panelItems = panels[side];
    const shown = visibleItems[side];
    const selectable = selectableVisible(side);
    const selectedVisible = selectable.filter(item => selected[side].has(item.id));
    const allVisibleSelected = selectable.length > 0 && selectedVisible.length === selectable.length;
    const someVisibleSelected = selectedVisible.length > 0 && !allVisibleSelected;
    const titleId = `${generatedId}-${side}-title`;
    const panelTitle = source ? labels.sourceTitle : labels.targetTitle;
    const count = formatCount({ side, visible: shown.length, total: panelItems.length, selected: selectedVisible.length });
    const empty = panelItems.length === 0
      ? source ? labels.sourceEmpty : labels.targetEmpty
      : source ? labels.sourceNoResults : labels.targetNoResults;
    const searchLabel = source ? labels.sourceSearchLabel : labels.targetSearchLabel;
    const clearSearchLabel = source ? labels.sourceClearSearch : labels.targetClearSearch;
    const searchPlaceholder = source ? labels.sourceSearchPlaceholder : labels.targetSearchPlaceholder;
    const selectAllLabel = source ? labels.selectAllSource : labels.selectAllTarget;
    const direction: TransferDirection = source ? 'to-target' : 'to-source';
    const moveLabel = source ? labels.moveToTarget : labels.moveToSource;

    return <PencilSurface<'section'>
      aria-labelledby={titleId}
      as="section"
      className="inkra-transfer__panel"
      data-searchable={searchable || undefined}
      data-side={side}
      ref={element => { panelRefs.current[side] = element; }}
      seed={`inkra-transfer-${generatedId}-${side}`}
      tabIndex={-1}
      variant="paper"
    >
      <PencilSurface<'span'> aria-hidden="true" as="span"
        className="inkra-transfer__panel-focus" variant="outline"
        seed={`inkra-transfer-${generatedId}-${side}-focus`} />
      <header className="inkra-transfer__header">
        <span className="inkra-transfer__title" id={titleId}>
          {typeof panelTitle === 'string' ? <PencilText>{panelTitle}</PencilText> : panelTitle}
        </span>
        <span aria-live="polite" className="inkra-transfer__count">{count}</span>
      </header>
      <PencilLine aria-hidden="true" className="inkra-transfer__divider" seed={`inkra-transfer-${generatedId}-${side}-header`} />
      {searchable && <Input
        aria-label={searchLabel}
        clearable
        clearButtonLabel={clearSearchLabel}
        disabled={disabled}
        onValueChange={value => {
          setQueries(current => ({ ...current, [side]: value }));
          setPages(current => ({ ...current, [side]: 0 }));
        }}
        placeholder={searchPlaceholder}
        startIcon={<PencilIcon decorative paths={searchPaths} size={18} sourceSize={24} />}
        type="search"
        value={queries[side]}
        variant="outline"
      />}
      <div className="inkra-transfer__selection-bar">
        <Checkbox
          checked={allVisibleSelected}
          disabled={disabled || selectable.length === 0}
          indeterminate={someVisibleSelected}
          label={selectAllLabel}
          onCheckedChange={checked => toggleAll(side, checked)}
          seed={`inkra-transfer-${generatedId}-${side}-all`}
        />
      </div>
      <ul className="inkra-transfer__list" aria-labelledby={titleId}>
        {shown.length === 0 ? <li className="inkra-transfer__empty">{empty}</li> : shown.map(item => {
          const itemDisabled = disabled || item.disabled === true;
          const itemSelected = selected[side].has(item.id);
          const copy = renderItem?.(item, { side, selected: itemSelected, disabled: itemDisabled, query: queries[side] }) ?? itemCopy(item);
          return <li className="inkra-transfer__item" data-disabled={itemDisabled || undefined} data-transfer-item-id={item.id} key={item.id}>
            <Checkbox
              checked={itemSelected}
              disabled={itemDisabled}
              label={copy}
              onCheckedChange={checked => setItemSelected(side, item.id, checked)}
              ref={element => {
                const key = `${side}:${item.id}`;
                if (element) itemRefs.current.set(key, element);
                else itemRefs.current.delete(key);
              }}
              seed={`inkra-transfer-${generatedId}-${side}-${item.id}`}
            />
            <Button
              aria-label={`${moveLabel}: ${typeof item.label === 'string' || typeof item.label === 'number' ? String(item.label) : item.searchText ?? item.id}`}
              disabled={itemDisabled}
              onClick={event => move([item.id], direction, 'single', event.currentTarget)}
              seed={`inkra-transfer-${generatedId}-${side}-${item.id}-move`}
              size="icon-sm"
              title={moveLabel}
              variant="ghost"
            >
              <PencilIcon className="inkra-transfer__direction-icon" data-direction={direction}
                decorative paths={rightPaths} size={18} sourceSize={24} />
            </Button>
          </li>;
        })}
      </ul>
      {pageLength !== undefined && <nav aria-label={typeof panelTitle === 'string' ? panelTitle : undefined}>
        <Button size="sm" variant="ghost" aria-label={labels.previousPage} disabled={disabled || pageIndex(side, (source ? visibleSource : visibleTarget).length) === 0}
          onClick={() => setPages(current => ({ ...current, [side]: pageIndex(side, (source ? visibleSource : visibleTarget).length) - 1 }))}>{labels.previousPage}</Button>
        <span aria-live="polite">{pageLabel((source ? visibleSource : visibleTarget).length === 0 ? 0 : pageIndex(side, (source ? visibleSource : visibleTarget).length) + 1,
          Math.ceil((source ? visibleSource : visibleTarget).length / pageLength))}</span>
        <Button size="sm" variant="ghost" aria-label={labels.nextPage} disabled={disabled || (pageIndex(side, (source ? visibleSource : visibleTarget).length) + 1) * pageLength >= (source ? visibleSource : visibleTarget).length}
          onClick={() => setPages(current => ({ ...current, [side]: pageIndex(side, (source ? visibleSource : visibleTarget).length) + 1 }))}>{labels.nextPage}</Button>
      </nav>}
    </PencilSurface>;
  };

  const sourceBatchKeys = selectableVisible('source').filter(item => selected.source.has(item.id)).map(item => item.id);
  const targetBatchKeys = selectableVisible('target').filter(item => selected.target.has(item.id)).map(item => item.id);

  return <div
    {...props}
    aria-disabled={disabled || undefined}
    className={['inkra-transfer', className].filter(Boolean).join(' ')}
    data-disabled={disabled || undefined}
    ref={ref}
  >
    <div className="inkra-transfer__layout">
      {renderPanel('source')}
      <div className="inkra-transfer__actions" role="group" aria-label={labels.batchActions}>
        <Button
          aria-label={labels.moveSelectedToTarget}
          disabled={disabled || sourceBatchKeys.length === 0}
          onClick={event => move(sourceBatchKeys, 'to-target', 'batch', event.currentTarget)}
          seed={`inkra-transfer-${generatedId}-batch-target`}
          size="icon"
          title={labels.moveSelectedToTarget}
          variant="outline"
        ><PencilIcon className="inkra-transfer__direction-icon" data-direction="to-target"
          decorative paths={rightPaths} size={20} sourceSize={24} /></Button>
        <Button
          aria-label={labels.moveSelectedToSource}
          disabled={disabled || targetBatchKeys.length === 0}
          onClick={event => move(targetBatchKeys, 'to-source', 'batch', event.currentTarget)}
          seed={`inkra-transfer-${generatedId}-batch-source`}
          size="icon"
          title={labels.moveSelectedToSource}
          variant="outline"
        ><PencilIcon className="inkra-transfer__direction-icon" data-direction="to-source"
          decorative paths={rightPaths} size={20} sourceSize={24} /></Button>
      </div>
      {renderPanel('target')}
    </div>
  </div>;
});

export { moveTransferKeys, normalizeTargetKeys, splitTransferItems, uniqueTransferItems } from './model.js';
export type { TransferDirection, TransferSide, TransferIdentity } from './model.js';

