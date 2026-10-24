import {
  flexRender,
  functionalUpdate,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  Row,
  RowSelectionState,
  SortingState,
  TableOptions,
  Updater,
} from '@tanstack/react-table';
import { useEffect, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

import { Button } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { Input } from '../form/Input.js';
import { Table } from '../content/index.js';
import { Checkbox } from '../selection/Checkbox.js';
import { normalizeDataTablePagination } from './model.js';

const sortIcon = [{ d: 'M 8 10 L 12 6 L 16 10 M 8 14 L 12 18 L 16 14' }] as const;
const sortAscendingIcon = [{ d: 'M 7 15 L 12 10 L 17 15' }] as const;
const sortDescendingIcon = [{ d: 'M 7 9 L 12 14 L 17 9' }] as const;
const previousIcon = [{ d: 'M 14 7 L 9 12 L 14 17' }] as const;
const nextIcon = [{ d: 'M 10 7 L 15 12 L 10 17' }] as const;

export type DataTableColumnDef<TData, TValue = unknown> = ColumnDef<TData, TValue>;
export type DataTableSortingState = SortingState;
export type DataTablePaginationState = PaginationState;
export type DataTableRowSelectionState = RowSelectionState;

export interface DataTableProps<TData> extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  data: TData[];
  columns: DataTableColumnDef<TData>[];
  getRowId: NonNullable<TableOptions<TData>['getRowId']>;
  caption?: ReactNode;
  density?: 'compact' | 'comfortable';
  layout?: 'auto' | 'fixed';
  striped?: boolean;
  hoverable?: boolean;
  stickyHeader?: boolean;
  captionSide?: 'top' | 'bottom';
  filterable?: boolean;
  filterLabel?: string;
  filterPlaceholder?: string;
  globalFilter?: string;
  defaultGlobalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  sorting?: SortingState;
  defaultSorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  pagination?: boolean;
  paginationState?: PaginationState;
  defaultPagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  selectable?: boolean;
  rowSelection?: RowSelectionState;
  defaultRowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  getRowCanSelect?: (row: Row<TData>) => boolean;
  loading?: boolean;
  loadingMessage?: ReactNode;
  emptyMessage?: ReactNode;
  selectAllLabel?: string;
  selectRowLabel?: (row: Row<TData>) => string;
  previousPageLabel?: string;
  nextPageLabel?: string;
  paginationLabel?: string;
  pageLabel?: (page: number, pageCount: number) => ReactNode;
  sortStatusLabel?: (columnId: string, direction: false | 'asc' | 'desc') => string;
}

function classes(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(' ');
}

function resolve<T>(updater: Updater<T>, current: T): T {
  return functionalUpdate(updater, current);
}

function pencilCopy(value: ReactNode, seed: string): ReactNode {
  return typeof value === 'string' || typeof value === 'number'
    ? <PencilText seed={seed}>{String(value)}</PencilText>
    : value;
}

function SelectionCheckbox(props: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return <Checkbox
    className="inkra-data-table__selection"
    checked={props.checked}
    indeterminate={props.indeterminate}
    disabled={props.disabled}
    label={<span className="inkra-visually-hidden">{props.label}</span>}
    onCheckedChange={props.onChange}
  />;
}

export function DataTable<TData>({
  data,
  columns,
  getRowId,
  caption,
  density = 'comfortable',
  layout = 'auto',
  striped = false,
  hoverable = true,
  stickyHeader = false,
  captionSide = 'top',
  filterable = false,
  filterLabel = 'Filter rows',
  filterPlaceholder = 'Filter rows',
  globalFilter,
  defaultGlobalFilter = '',
  onGlobalFilterChange,
  sorting,
  defaultSorting = [],
  onSortingChange,
  pagination = false,
  paginationState,
  defaultPagination = { pageIndex: 0, pageSize: 10 },
  onPaginationChange,
  selectable = false,
  rowSelection,
  defaultRowSelection = {},
  onRowSelectionChange,
  getRowCanSelect,
  loading = false,
  loadingMessage = 'Loading rows',
  emptyMessage = 'No rows',
  selectAllLabel = 'Select all rows on this page',
  selectRowLabel = row => `Select row ${row.id}`,
  previousPageLabel = 'Previous page',
  nextPageLabel = 'Next page',
  paginationLabel = 'Table pagination',
  pageLabel = (page, pageCount) => `Page ${page} of ${pageCount}`,
  sortStatusLabel = (columnId, direction) => direction === 'asc' ? `${columnId}: sorted ascending` : direction === 'desc' ? `${columnId}: sorted descending` : `${columnId}: not sorted`,
  className,
  ...props
}: DataTableProps<TData>) {
  const [internalFilter, setInternalFilter] = useState(defaultGlobalFilter);
  const [internalSorting, setInternalSorting] = useState(defaultSorting);
  const [internalPagination, setInternalPagination] = useState(defaultPagination);
  const [internalSelection, setInternalSelection] = useState(defaultRowSelection);
  const paginationCorrection = useRef('');
  const resolvedFilter = globalFilter ?? internalFilter;
  const resolvedSorting = sorting ?? internalSorting;
  const resolvedPagination = paginationState ?? internalPagination;
  const resolvedSelection = rowSelection ?? internalSelection;
  const initialPagination = normalizeDataTablePagination(resolvedPagination, data.length);

  const handleSorting: OnChangeFn<SortingState> = updater => {
    if (sorting === undefined) setInternalSorting(current => resolve(updater, current));
    onSortingChange?.(updater);
  };
  const handlePagination: OnChangeFn<PaginationState> = updater => {
    const normalizedUpdater: Updater<PaginationState> = current => {
      const rowCount = table.getPrePaginationRowModel().rows.length;
      return normalizeDataTablePagination(resolve(updater, normalizeDataTablePagination(current, rowCount)), rowCount);
    };
    if (paginationState === undefined) setInternalPagination(normalizedUpdater);
    onPaginationChange?.(normalizedUpdater);
  };
  const handleSelection: OnChangeFn<RowSelectionState> = updater => {
    if (rowSelection === undefined) setInternalSelection(current => resolve(updater, current));
    onRowSelectionChange?.(updater);
  };
  const handleFilter = (value: string) => {
    if (globalFilter === undefined) setInternalFilter(value);
    onGlobalFilterChange?.(value);
    if (pagination && resolvedPagination.pageIndex !== 0) handlePagination(current => ({ ...current, pageIndex: 0 }));
  };

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: {
      globalFilter: resolvedFilter,
      sorting: resolvedSorting,
      pagination: initialPagination,
      rowSelection: resolvedSelection,
    },
    onGlobalFilterChange: updater => handleFilter(resolve(updater, resolvedFilter)),
    onSortingChange: handleSorting,
    onPaginationChange: handlePagination,
    onRowSelectionChange: handleSelection,
    defaultColumn: {
      header: context => pencilCopy(context.column.id, `data-table-header-${context.header.id}`),
      cell: context => pencilCopy(context.renderValue<unknown>()?.toString?.() ?? null, `data-table-cell-${context.cell.id}`),
    },
    enableRowSelection: selectable ? getRowCanSelect ?? true : false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
  });
  const filteredRowCount = table.getPrePaginationRowModel().rows.length;
  const effectivePagination = normalizeDataTablePagination(initialPagination, filteredRowCount);
  if (table.getState().pagination.pageIndex !== effectivePagination.pageIndex
    || table.getState().pagination.pageSize !== effectivePagination.pageSize) {
    table.setOptions(previous => ({
      ...previous,
      state: { ...previous.state, pagination: effectivePagination },
    }));
  }
  const rows = table.getRowModel().rows;
  const pageCount = filteredRowCount === 0 ? 0 : Math.ceil(filteredRowCount / effectivePagination.pageSize);
  const visibleColumnCount = Math.max(1, table.getVisibleLeafColumns().length + (selectable ? 1 : 0));
  const hasSelectableRows = rows.some(row => row.getCanSelect());

  useEffect(() => {
    if (!pagination) return;
    const matches = resolvedPagination.pageIndex === effectivePagination.pageIndex
      && resolvedPagination.pageSize === effectivePagination.pageSize;
    if (matches) {
      paginationCorrection.current = '';
      return;
    }
    const signature = `${filteredRowCount}:${resolvedPagination.pageIndex}:${resolvedPagination.pageSize}->${effectivePagination.pageIndex}:${effectivePagination.pageSize}`;
    if (paginationCorrection.current === signature) return;
    paginationCorrection.current = signature;
    if (paginationState === undefined) setInternalPagination(effectivePagination);
    onPaginationChange?.(effectivePagination);
  }, [effectivePagination.pageIndex, effectivePagination.pageSize, filteredRowCount, onPaginationChange, pagination,
    paginationState, resolvedPagination.pageIndex, resolvedPagination.pageSize]);

  return <div {...props} className={classes('inkra-data-table', className)} data-loading={loading || undefined}>
    {filterable && <div className="inkra-data-table__toolbar">
      <label className="inkra-data-table__filter">
        <span>{pencilCopy(filterLabel, 'data-table-filter-label')}</span>
        <Input type="search" value={resolvedFilter} placeholder={filterPlaceholder} onChange={event => handleFilter(event.currentTarget.value)} />
      </label>
    </div>}
    <Table.Container className="inkra-data-table__container">
      <Table.Root density={density} layout={layout} striped={striped} hoverable={hoverable} stickyHeader={stickyHeader} captionSide={captionSide}>
        {caption != null && <Table.Caption>{caption}</Table.Caption>}
        <Table.Header>
          {table.getHeaderGroups().map(headerGroup => <Table.Row key={headerGroup.id}>
            {selectable && <Table.Head className="inkra-data-table__select-cell">
              <SelectionCheckbox
                checked={pagination ? table.getIsAllPageRowsSelected() : table.getIsAllRowsSelected()}
                indeterminate={pagination ? table.getIsSomePageRowsSelected() : table.getIsSomeRowsSelected()}
                label={selectAllLabel}
                disabled={loading || !hasSelectableRows}
                onChange={checked => pagination ? table.toggleAllPageRowsSelected(checked) : table.toggleAllRowsSelected(checked)}
              />
            </Table.Head>}
            {headerGroup.headers.map(header => <Table.Head
              key={header.id}
              colSpan={header.colSpan}
              aria-sort={header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : header.column.getCanSort() ? 'none' : undefined}
            >
              {header.isPlaceholder ? null : (() => {
                const rendered = flexRender(header.column.columnDef.header, header.getContext());
                const direction = header.column.getIsSorted();
                if (!header.column.getCanSort()) return pencilCopy(rendered, `data-table-header-${header.id}`);
                return <button
                  type="button"
                  className="inkra-data-table__sort"
                  data-sorted={direction || undefined}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <PencilSurface as="span" aria-hidden="true" className="inkra-data-table__sort-focus" variant="outline" radius={6} seed={`data-table-sort-${header.id}-focus`} />
                  <span className="inkra-data-table__sort-label">{pencilCopy(rendered, `data-table-sort-${header.id}`)}</span>
                  <PencilIcon aria-hidden="true" className="inkra-data-table__sort-icon" data-direction={direction || 'none'}
                    paths={direction === 'asc' ? sortAscendingIcon : direction === 'desc' ? sortDescendingIcon : sortIcon}
                    size={18} sourceSize={24} active={Boolean(direction)} />
                  <span className="inkra-visually-hidden">{sortStatusLabel(header.column.id, direction)}</span>
                </button>;
              })()}
            </Table.Head>)}
          </Table.Row>)}
        </Table.Header>
        <Table.Body>
          {loading ? <Table.Row><Table.Cell colSpan={visibleColumnCount}><div className="inkra-data-table__state" role="status">{pencilCopy(loadingMessage, 'data-table-loading')}</div></Table.Cell></Table.Row>
            : rows.length === 0 ? <Table.Row><Table.Cell colSpan={visibleColumnCount}><div className="inkra-data-table__state">{pencilCopy(emptyMessage, 'data-table-empty')}</div></Table.Cell></Table.Row>
              : rows.map(row => <Table.Row key={row.id} selected={row.getIsSelected()}>
                {selectable && <Table.Cell className="inkra-data-table__select-cell">
                  <SelectionCheckbox
                    checked={row.getIsSelected()}
                    label={selectRowLabel(row)}
                    disabled={!row.getCanSelect()}
                    onChange={checked => row.toggleSelected(checked)}
                  />
                </Table.Cell>}
                {row.getVisibleCells().map(cell => <Table.Cell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Cell>)}
              </Table.Row>)}
        </Table.Body>
      </Table.Root>
    </Table.Container>
    {pagination && <nav className="inkra-data-table__pagination" aria-label={paginationLabel}>
      <Button size="icon-xs" variant="ghost" aria-label={previousPageLabel} disabled={loading || pageCount === 0 || effectivePagination.pageIndex <= 0} onClick={() => table.previousPage()}>
        <PencilIcon className="inkra-data-table__page-arrow" paths={previousIcon} size={18} sourceSize={24} />
      </Button>
      <span aria-live="polite" aria-atomic="true">{pencilCopy(pageLabel(pageCount === 0 ? 0 : effectivePagination.pageIndex + 1, pageCount), 'data-table-page-label')}</span>
      <Button size="icon-xs" variant="ghost" aria-label={nextPageLabel} disabled={loading || pageCount === 0 || effectivePagination.pageIndex >= pageCount - 1} onClick={() => table.nextPage()}>
        <PencilIcon className="inkra-data-table__page-arrow" paths={nextIcon} size={18} sourceSize={24} />
      </Button>
    </nav>}
  </div>;
}
