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
import { useEffect, useMemo, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

import { Button } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import { Input } from '../form/Input.js';
import { Table } from '../content/index.js';
import { Checkbox } from '../selection/Checkbox.js';

const sortIcon = [{ d: 'M 8 10 L 12 6 L 16 10 M 8 14 L 12 18 L 16 14' }] as const;
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

// Keep malformed numeric input out of the row-model arithmetic and correction
// effect: 0 / 0 produces NaN, which never satisfies the page-index stop guard.
function normalizePagination(state: PaginationState): PaginationState {
  const pageIndex = Number.isFinite(state.pageIndex) ? Math.max(0, Math.floor(state.pageIndex)) : 0;
  const pageSize = Number.isFinite(state.pageSize) && state.pageSize > 0 ? Math.max(1, Math.floor(state.pageSize)) : 10;
  return pageIndex === state.pageIndex && pageSize === state.pageSize ? state : { pageIndex, pageSize };
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
  const resolvedFilter = globalFilter ?? internalFilter;
  const resolvedSorting = sorting ?? internalSorting;
  const requestedPagination = paginationState ?? internalPagination;
  const resolvedPagination = useMemo(() => normalizePagination(requestedPagination), [requestedPagination]);
  const resolvedSelection = rowSelection ?? internalSelection;

  const handleSorting: OnChangeFn<SortingState> = updater => {
    if (sorting === undefined) setInternalSorting(current => resolve(updater, current));
    onSortingChange?.(updater);
  };
  const handlePagination: OnChangeFn<PaginationState> = updater => {
    if (paginationState === undefined) setInternalPagination(current => normalizePagination(resolve(updater, normalizePagination(current))));
    onPaginationChange?.(updater);
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
      pagination: resolvedPagination,
      rowSelection: resolvedSelection,
    },
    onGlobalFilterChange: updater => handleFilter(resolve(updater, resolvedFilter)),
    onSortingChange: handleSorting,
    onPaginationChange: handlePagination,
    onRowSelectionChange: handleSelection,
    enableRowSelection: selectable ? getRowCanSelect ?? true : false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
  });
  const rows = table.getRowModel().rows;
  const filteredRowCount = table.getPrePaginationRowModel().rows.length;
  const pageCount = Math.max(1, table.getPageCount());
  const visibleColumnCount = Math.max(1, table.getVisibleLeafColumns().length + (selectable ? 1 : 0));
  const hasSelectableRows = rows.some(row => row.getCanSelect());

  useEffect(() => {
    if (!pagination) return;
    const lastPageIndex = Math.max(0, Math.ceil(filteredRowCount / resolvedPagination.pageSize) - 1);
    if (resolvedPagination.pageIndex <= lastPageIndex) return;
    const next = { ...resolvedPagination, pageIndex: lastPageIndex };
    if (paginationState === undefined) setInternalPagination(next);
    onPaginationChange?.(next);
  }, [filteredRowCount, onPaginationChange, pagination, paginationState, resolvedPagination]);

  return <div {...props} className={classes('inkra-data-table', className)} data-loading={loading || undefined}>
    {filterable && <div className="inkra-data-table__toolbar">
      <label className="inkra-data-table__filter">
        <span>{filterLabel}</span>
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
              {header.isPlaceholder ? null : header.column.getCanSort() ? <button
                type="button"
                className="inkra-data-table__sort"
                data-sorted={header.column.getIsSorted() || undefined}
                onClick={header.column.getToggleSortingHandler()}
              >
                <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                <PencilIcon aria-hidden="true" paths={sortIcon} size={18} sourceSize={24} active={Boolean(header.column.getIsSorted())} />
                <span className="inkra-visually-hidden">{sortStatusLabel(header.column.id, header.column.getIsSorted())}</span>
              </button> : flexRender(header.column.columnDef.header, header.getContext())}
            </Table.Head>)}
          </Table.Row>)}
        </Table.Header>
        <Table.Body>
          {loading ? <Table.Row><Table.Cell colSpan={visibleColumnCount}><div className="inkra-data-table__state" role="status">{loadingMessage}</div></Table.Cell></Table.Row>
            : rows.length === 0 ? <Table.Row><Table.Cell colSpan={visibleColumnCount}><div className="inkra-data-table__state">{emptyMessage}</div></Table.Cell></Table.Row>
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
      <Button size="icon-xs" variant="ghost" aria-label={previousPageLabel} disabled={loading || !table.getCanPreviousPage()} onClick={() => table.previousPage()}>
        <PencilIcon paths={previousIcon} size={18} sourceSize={24} />
      </Button>
      <span aria-live="polite">{pageLabel(table.getState().pagination.pageIndex + 1, pageCount)}</span>
      <Button size="icon-xs" variant="ghost" aria-label={nextPageLabel} disabled={loading || !table.getCanNextPage()} onClick={() => table.nextPage()}>
        <PencilIcon paths={nextIcon} size={18} sourceSize={24} />
      </Button>
    </nav>}
  </div>;
}
