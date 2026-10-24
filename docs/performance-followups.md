# Performance report follow-ups

The complete execution ledger is `performance-followups.json`; it retains the
source report hashes and all 35 follow-up work items. Existing component identity
mapping remains in `component-performance-inventory.json` (231 identities).
Measurements distinguish optional data/rendering contracts from unchanged
component defaults. No operation silently drops records or enables pagination.

## Server-owned DataTable work

For large immutable collections, callers may supply one already filtered/sorted
server page instead of rebuilding the complete client model on every update:

```tsx
<DataTable data={page.rows} columns={columns} getRowId={row => row.id}
  pagination manualPagination rowCount={page.total}
  paginationState={pagination} onPaginationChange={setPagination}
  manualSorting sorting={sorting} onSortingChange={setSorting}
  manualFiltering globalFilter={query} onGlobalFilterChange={setQuery} />
```

`rowCount` is the known total *after server filtering*, not this page's length.
Supply the corresponding `data`, sorting, filter and pagination state together;
coordinate async requests in the consumer and discard stale responses. Omitted
manual flags retain the existing client model, sort/filter and full-data update
semantics. This API avoids processing records the caller does not supply; it is
not an incremental cache for arbitrary mutations to TanStack row objects.

## Transfer panel pagination

`<Transfer items={items} pageSize={25} />` keeps all items in the model and search,
but mounts only the current page of each panel. `pageSize` is opt-in; omission
retains the complete list. Search returns to the first page. Select-all and batch
movement apply to the current visible page, and page changes retain selections.
After an accepted movement, the destination page reveals the moved item before
focus is restored. Controlled rejected/delayed requests retain focus ownership.
Customize `labels.previousPage`, `labels.nextPage`, and `pageLabel` for locale.
Invalid/nonfinite sizes fall back to the full list; finite sizes normalize to at
least one item. Pagination controls preserve native buttons and list semantics.

## Reproduction

Build the current checkout and an independent `de40239` baseline. Run
`node scripts/benchmark-paged-collections.mjs <baseline>/packages/inkra/dist`.
The harness runs serial child processes, each limited to 768 MiB old-space and
45 seconds for the entire warmup + seven samples. It records default-baseline,
default-current and explicitly paged-current separately, host nodes, row-ID calls,
raw wall-time samples and process peak RSS. Failed resource-limited cases remain
failed records, never a fabricated per-operation duration or browser crash.
