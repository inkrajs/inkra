import type { PaginationState } from '@tanstack/react-table';

export function normalizeDataTablePagination(state: PaginationState, rowCount: number): PaginationState {
  const pageSize = Number.isFinite(state.pageSize) ? Math.max(1, Math.floor(state.pageSize)) : 10;
  const count = Number.isFinite(rowCount) ? Math.max(0, Math.floor(rowCount)) : 0;
  const pageCount = count === 0 ? 0 : Math.ceil(count / pageSize);
  const requestedIndex = Number.isFinite(state.pageIndex) ? Math.max(0, Math.floor(state.pageIndex)) : 0;
  return { pageIndex: pageCount === 0 ? 0 : Math.min(requestedIndex, pageCount - 1), pageSize };
}
