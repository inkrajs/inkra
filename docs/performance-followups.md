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

## Explicit collection and itinerary display bounds

- `TagInput.maxVisibleTags` bounds the initially mounted tag rows; all native
  hidden form values are retained. The localized `showAllTagsLabel(count)` /
  `showFewerTagsLabel` disclosure reveals every tag. Arrow navigation to a hidden
  tag first expands it; ordinary draft editing does not mount hidden tags.
- `ChoiceGrid.pageSize` pages **controlled direct ChoiceGridOption children**.
  Off-page selected values retain hidden native inputs in original option order,
  including option-specific form association/disabled state. Selection callbacks
  retain the full collection. Native keyboard selection operates within the
  current page; localized previous/next controls expose every page. Uncontrolled,
  required, fragment/custom/composed children retain the complete original output
  instead of silently changing native validation or unknown descendant behavior.
- `Calendar.maxEventsPerDay` optionally summarizes itinerary event cards per day.
  The per-day disclosure (`showDayEventsLabel(date,total,expanded)`) reveals every
  event and keeps the date target separate. Default date labels still include all
  event labels; summarized dates have a count rather than a potentially enormous
  accessible name. Custom Day overrides remain caller-owned.
- `DayAgenda.maxVisibleEvents` limits initial card output only. Layout, timeline
  scale and lanes still use the complete input; an externally selected event is
  always retained even beyond the limit. The localized all/fewer disclosure
  reveals every timed and untimed event. This does not accelerate full layout
  indexing or claim that 10k simultaneous overlapping cards become usable.

All bounds are opt-in and finite values normalize to nonnegative counts (paging
normalizes to at least one). Nonfinite/omitted bounds retain full output. Expanding
an enormous collection still incurs its full rendering cost; use paging or an
appropriate data view when all-at-once expansion is unsuitable. Form hidden values
and caller-created React option elements still grow with input size.

## Package boundaries and optional CSS

Public family subpaths (for example `@inkra/react/tag-input`,
`@inkra/react/select`, `@inkra/react/select/stepper`, and `@inkra/react/Button`)
retain the exact root-exported component identities. Static frozen compound API
objects are explicitly pure, so retaining a flat named component does not require
an unused compound object and every sibling. The compound API itself remains
unchanged, including its single/multiple/selectable engines. AudioPlayer imports
only the select parts it actually renders; its controls and native semantics stay
the same.

The established `@inkra/react/styles.css` remains the complete stylesheet. Expert
consumers can instead choose `@inkra/react/styles/base.css` plus the required
family CSS. Button needs the base; a Select consumer typically adds `form.css`,
`selection.css`, `overlay.css`, then `select.css` in that order. AudioPlayer also
needs `slider.css` and `audio-player.css`. Add CSS for any custom slotted content.
JourneyMap maps need `journey-map.css` and `leaflet.css`; Leaflet remains lazy.
Tokens, font and Leaflet image paths are rebased for nested CSS entry points.
CSS remains side-effectful; these are explicit files, not automatic unused-rule
purging. The existing handwritten web font is already a 706-character subset
(documented in design-standard and third-party notices). Its current glyph
coverage is preserved; further universal subsetting would remove supported text. Byte savings are measured separately from real
network downloads and page experience.

## Viewport-aware decorative surface scheduling

A production Chromium trace exposed substantial cold mount work in complete lists:
`PencilSurface` synchronously painted every mounted surface, including rows well
outside the viewport. The follow-up keeps visible surfaces and a 240px prewarm
band synchronous, defers more distant decorative paint with one shared viewport
observer per document, and retains every DOM node, input and interaction. New
unpainted canvases release their implicit blank bitmap. Previously painted
surfaces retain valid pixels when scrolling out; latest geometry/theme/seed is
rechecked when returning. Missing/unavailable IntersectionObserver falls back to
the existing eager behavior. Observer targets and pending frames detach on
unmount. Invisible focus/selection layers inside the prewarm band remain painted
so CSS-only hover, checked and keyboard focus changes never reveal an empty ring.


## Final local measurement snapshot

The final snapshot is `performance-final-metrics.json`. It maps every one of the
231 identities to a production consumer closure and verified shared runtime/SSR
fixture evidence. Full raw files are separately archived by SHA-256; fixture
totals are never divided into fictitious isolated component costs. Source code
was unchanged between main 3a646fa and the measured tool commit 10f3f1d.

The complete docs browser queue passed 75/77 scripts. The narrow Tooltip and
Sortable configuration failures reproduce at the same assertions on the #10
package baseline. They are retained as existing failures, not silently skipped.

Cold reveal is a measured tradeoff of viewport surface scheduling: in a serial
three-sample desktop TagInput 1k test, mount+jump+focus falls from 5842.13 to
3046.46 ms, but jump plus awaited paint rises from 128.78 to 1166.80 ms.
Small renderer mounts also retain regressions. These observations do not justify
a universal speedup claim or a threshold that remounts component subtrees.

Production RUM has no authorized sample source and deployment is prohibited.
Original intermittent crash was not reproduced under bounded pressure. Phone
real-device work was explicitly excluded by the user, so no device settings or
permissions are pending.
