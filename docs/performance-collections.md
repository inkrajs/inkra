# Collection performance audit

This second pass covers all **60 distinct exported React component identities** in the collection family, deduplicating aliases. The full per-export record is [performance-audit-collections.json](performance-audit-collections.json). The [wrapper report](performance-collection-wrappers.md) details Card, Alert, Avatar, Table, Command, Tree and OverflowList.

There is no standalone `List`, `Cascader` or `AutoComplete` export in this revision. Relevant functionality is provided by VirtualList, OverflowList, Log, Command.List, SearchableSelect and the tree/select families.

## Proven fixes

| Family | Observed defect/work | Change |
| --- | --- | --- |
| VirtualList | Same-length reorder retained the old engine keys and item-specific offsets; `c` rendered with key `a` | Data/estimate-aware measurement-key invalidation; no unused SSR index allocation after virtualization |
| DataTable | Empty data and zero/invalid page size repeatedly scheduled a `NaN` page correction | Finite integer pagination normalization before arithmetic, preserving valid input behavior |
| TreeSelect | Rebuilt all tree elements on unrelated updates; deeply nested closed input overflowed wrapper recursion | Memoized derived selection/elements; iterative enter/finish construction with the same preorder label callbacks |
| TagInput | Per-candidate duplicate/value/ID scans made bulk paste quadratic | Per-commit ID and normalized-value indexes, preserving ordered partial commits and validation |
| ChoiceGrid / ChoiceGridOption | Each option scanned selected/default arrays | Memoized membership sets and context; native control semantics unchanged |
| Multiple Select | Fresh context and change function invalidated all consumers | Dependency-complete context/callback memoization |
| SearchableSelect | Fresh filter/string-label functions invalidated the underlying engine's memoized filtering | Stable callbacks until option/filter inputs change |
| Log | Scroll/pause updates repeated filtering and identity-array work | Memoized derived data and level lookup; collision-safe array effect dependencies |
| Sortable | Repeated equal drag projections rerendered items/overlay and cloned data | Equality bailout, stable idle data, memoized engine ID arrays |
| OverflowList | Newly revealed items were not observed; delimiter-containing IDs could suppress partition notifications | Membership-aware observer targets and unambiguous notification keys |

Transfer retains the earlier linear normalization and memoized filtering fix; the second pass adds larger runtime validation. Other wrappers remain unchanged where source analysis and targeted checks did not justify a new optimization. In particular, custom DataTable cells can read broad table state, so indiscriminate cell memoization is not safe.

## Reproducible comparison

Build and run:

```sh
npm run build
node scripts/compare-collection-updates.mjs
```

The default baseline is `7bd08e47b05c9d61a226bbbfd3d5d620ce93962a`, which already includes the first renderer/Transfer/tree-model batch. The script creates a temporary ignored copy of the current dist, substitutes only the audited baseline component implementations, runs the same tests, then deletes that temporary copy. It leaves current source and dist intact. An explicit baseline git ref may be supplied.

On Node v24.19.0, the comparison ran 29 deterministic scenarios:

- Baseline: **17 passed, 12 failed** at the regression assertions.
- Current: **29 passed, 0 failed**.
- Baseline failure is expected and reported rather than hidden. The script fails if the current implementation fails.

| Deterministic work counter | Baseline | Current |
| --- | ---: | ---: |
| Normalized-key calls for 2,000 pasted tags | 4,002,000 | 6,000 |
| Selected-array reads for 128 options / 64 selected | 6,176 | 64 |
| Extra multiple-select consumer renders over 8 unrelated updates | 8 | 0 |
| Extra Log filter / ID-map passes over 8 scroll changes plus pause | 9 / 9 | 0 / 0 |
| TreeSelect label calls, 3 nodes and 8 unrelated updates | 27 | 3 |
| Extra sortable item/overlay renders, 10 no-target drag updates | 40 | 0 |

These are algorithm/reconciliation counts, not browser frame-time, CPU, memory or whole-page speed measurements. Test-runner durations are not presented as performance speedups.

Additional stress checks include a 10,000-row DataTable with bounded 20-row pagination and cached core row model; a 10,000-item VirtualList with at most eight rows in a synthetic viewport through repeated scrolling; a 5,000-record sortable model; 5,000 searchable options; 512 Transfer records; and the wrapper report's large table/cmdk/overflow cases. Closed TreeSelect construction with 12,000 nested nodes passes where the baseline throws `RangeError`.

## Verification commands

```sh
npm test
INKRA_TRANSFER_MODULE=../dist/transfer/index.js INKRA_TREE_SELECT_MODULE=../dist/tree-select/index.js INKRA_VIRTUAL_LIST_MODULE=../dist/virtual-list/index.js node --test packages/inkra/test/transfer.test.mjs packages/inkra/test/tree-select.test.mjs packages/inkra/test/virtual-list.test.mjs
npm run check:repository
npm run test:release
npm run check:package
```

Local full library result: **450 tests, 444 passed, six existing opt-in skips, zero failures**. The explicit Transfer/TreeSelect/VirtualList opt-in invocation passes **32/32**, including SSR. Build, repository portability, release tests and package checks are separate verification steps; final integration owns the installed-consumer and docs build checks.

## Limits and residual risks

- The original intermittent page crash has not been reproduced. The malformed pagination update loop and deep wrapper stack overflow are concrete failure modes, not proof of that incident's cause.
- Browser launch is blocked by the environment's socket/sandbox restriction. No bypass was attempted. Real DOM, screenshots, visual acceptance, keyboard/focus/portal behavior, canvas painting, forced colors, RTL and real-device profiling remain pending.
- Synthetic viewport/ResizeObserver and null-host React renderer tests establish specific state/identity/lifecycle invariants, not browser rendering performance. React test renderer emits its upstream deprecation notice.
- React Aria Tree itself could not mount in the DOM-less renderer because it creates a ReactDOM collection portal. Tree's pure forwarding/state boundary was checked separately. Although TreeSelect wrapper/model recursion is removed, open React/React Aria rendering of an extremely deep nested tree may still recurse; no unlimited-depth guarantee is made.
- Single Radix Select's mounted effects require browser globals. Its repeated closed SSR boundary is covered; the multiple Base UI path and closed selection controls are exercised in React. Popup-specific exported wrappers are source-reviewed with existing forwarding tests, not claimed as real-DOM interaction coverage.
- Most collection components intentionally render all supplied visible records. Large unpaginated DataTable, Log, Transfer, Command, Sortable, ChoiceGrid and open selects may still create substantial DOM/decorative work. No silent truncation or automatic virtualization was introduced because that would change public behavior. VirtualList or DataTable pagination can bound work when suitable for the application.
- Memoization follows immutable React prop semantics. Replacing readonly data/value arrays invalidates derived data; mutating an existing array in place is not a supported invalidation mechanism.
