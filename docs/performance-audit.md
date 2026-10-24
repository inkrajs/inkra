# Component-by-component performance audit

This is a point-in-time source and regression-test audit, not a statement that
all components have passed browser acceptance or that the reported intermittent
application crash has been reproduced. The original comparison baseline is
`35e26d81e985ed9011f3387a3aac27bfb423c07f`. The expanded component audit starts at
`7bd08e47b05c9d61a226bbbfd3d5d620ce93962a`, after the first rendering/model fixes.

## Coverage and evidence

The public entry point has 254 runtime exports. Resolving direct and compound
aliases by identity gives 230 distinct React components. Every identity has an
implementation, aliases, disposition, findings, verification evidence and
remaining limitations in these review ledgers:

- `performance-audit-lead.json`: 123 rendering, overlay, navigation, display and
  layout identities. Thin wrappers retain their existing primitives; shared
  drawing budgets, portal theme equality, fallback attempts, ring cache recovery
  and dockable stacking have focused regressions.
- `performance-audit-controls.json`: 25 controls, including field/group context,
  Calendar indexing, picker formatters, InputNumber hold listeners and Upload
  rows. Details: `performance/form-controls-audit.md`.
- `performance-audit-collections.json`: 60 collection identities, including
  VirtualList key/measurement invalidation, DataTable pagination normalization,
  TagInput bulk insertion, selection membership and stable derived collections.
  Details: `performance-collections.md` and
  `performance-collection-wrappers.md`.
- `performance-audit-media.json`: 22 media, visualization and motion identities.
  The ledger distinguishes fixed/runtime-tested implementations from unchanged,
  source-reviewed wrappers and records remaining browser-only checks. Details:
  `performance-media.md`.

An unchanged component is not claimed to be bottleneck-free. It means no
additional concrete, safely actionable library-owned bottleneck was established
by this pass. Source contracts, SSR, React test-renderer, mocked external engines
and native-canvas checks are identified as such; none substitutes for browser
layout, focus, painting, real-device latency or sustained heap profiling.

Build, then check coverage and the unchanged public runtime names:

```sh
npm run build
node scripts/check-component-audit.mjs
node scripts/check-component-audit.mjs --json > component-audit.json
```

This optional command intentionally describes the audited snapshot. A future
intentional API addition must update its inventory rather than silently inherit
a claim of review. Public helper functions are not counted as React components;
rendering/model helpers have their own tests and benchmarks.

## Reproduction and interpretation

```sh
npm run check
node scripts/benchmark-components.mjs 35e26d81e985ed9011f3387a3aac27bfb423c07f
node scripts/compare-rendering-updates.mjs 7bd08e47b05c9d61a226bbbfd3d5d620ce93962a
node scripts/compare-collection-updates.mjs 7bd08e47b05c9d61a226bbbfd3d5d620ce93962a
node scripts/verify-media-equivalence.mjs /path/to/baseline/packages/inkra/dist
```

See `performance.md` for the optional native-canvas benchmark, pixel comparison,
cache admission policy and per-canvas limits. New runtime regression files also
assert workload counts, retained output identity, listener/observer teardown,
configuration invalidation and semantic behavior. Counts are evidence for the
specific fixture, not whole-page speedup factors. Cold unique rendering and
cache-thrashing workloads must be considered alongside warm repeated rendering.

Collection memoization follows React's immutable-input model: replace a changed
collection and its changed records. This matters for Calendar events, Upload
items, collection options, graph records, chart data and agenda events. Replace
changed callback/configuration values as well. Retaining and mutating the same
object may reuse derived results; these changes do not introduce a deep mutation
observer. Value-snapshotted icon inputs and Upload label overrides explicitly
retain their tested same-object update behavior.

## Remaining acceptance and limits

- No original application crash reproduction, browser crash recovery proof, or
  real-browser performance/visual acceptance is available from this audit.
- Complete installed-package browser checks described in `rendering.md` and
  `CONTRIBUTING.md`, including keyboard/focus, controlled interactions, RTL,
  reduced motion, native form behavior, portal positioning and mobile devices.
- Nonvirtualized components still render their requested content. Cache byte
  limits are not a global live-canvas, DOM, process or GPU memory budget.
- Iterative TreeSelect models and wrapper construction do not make arbitrarily
  deep open React/ARIA trees safe. The external rendering stack remains a limit.
- Very large visual collections should still be paginated or virtualized. No
  arbitrary item-count truncation was added to public semantic content.
- Release, publication and deployment require their own successful checks and
  authority. A local checked archive is not evidence of a published release.
