# Collection wrapper performance audit

Audited 35 exports in `content`, `tree`, `command`, and `overflow-list`. Machine-readable rows are in [performance-collection-wrappers.json](performance-collection-wrappers.json). This is an implementation/reconciliation audit, not a browser-performance acceptance report.

## Changes supported by failing tests

1. **OverflowList observer membership.** The previous resize observer effect watched only its initial visible items when the number of visible items changed but the overflow trigger remained present. The executable reproduction moved 4 → 7 visible items and found item 4 unobserved. Depending on memoized `visibleEntries` now refreshes targets on membership changes, releases hidden targets, and keeps the observer stable on unrelated parent updates. The regression also checks 7 → 2 and unmount cleanup.
2. **OverflowList notification collision.** With priority items `a|string:b`, `a`, and `b`, the typed visible keys for `[a, b]` and `[a|string:b]` have identical `join("|")` strings. Changing width 50 → 60 really switches partitions but previously emitted only one notification. JSON tuple encoding now distinguishes the partitions. Both regressions failed against pre-fix built code, then passed after rebuilding.

No other assigned production source was changed. The remaining wrappers delegate to native elements, Radix, React Aria or cmdk and do not duplicate collection engines. Blanket memoization would add comparators and risk hiding live callback/context changes without measured benefit.

## Per-export disposition

| Export | Source evidence | Result |
| --- | --- | --- |
| `Command.Empty` | `packages/inkra/src/command/index.tsx:59–62` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Command.Group` | `packages/inkra/src/command/index.tsx:54–57` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Command.Input` | `packages/inkra/src/command/index.tsx:31–34` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Command.Item` | `packages/inkra/src/command/index.tsx:41–52` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Command.List` | `packages/inkra/src/command/index.tsx:36–39` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Command.Root` | `packages/inkra/src/command/index.tsx:15–29` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Command.Separator` | `packages/inkra/src/command/index.tsx:64–67` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Command.Shortcut` | `packages/inkra/src/command/index.tsx:69–72` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Alert.Description` | `packages/inkra/src/content/index.tsx:88–90` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Alert.Root` | `packages/inkra/src/content/index.tsx:63–84` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Alert.Title` | `packages/inkra/src/content/index.tsx:85–87` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Avatar.Fallback` | `packages/inkra/src/content/index.tsx:108–111` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Avatar.Image` | `packages/inkra/src/content/index.tsx:104–107` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Avatar.Root` | `packages/inkra/src/content/index.tsx:98–103` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Card.Content` | `packages/inkra/src/content/index.tsx:38–41` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Card.Description` | `packages/inkra/src/content/index.tsx:35–37` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Card.Footer` | `packages/inkra/src/content/index.tsx:42–46` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Card.Header` | `packages/inkra/src/content/index.tsx:26–30` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Card.Root` | `packages/inkra/src/content/index.tsx:22–25` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Card.Title` | `packages/inkra/src/content/index.tsx:31–34` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Table.Body` | `packages/inkra/src/content/index.tsx:129` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Table.Caption` | `packages/inkra/src/content/index.tsx:142` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Table.Cell` | `packages/inkra/src/content/index.tsx:139–141` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Table.Container` | `packages/inkra/src/content/index.tsx:125–127` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Table.Footer` | `packages/inkra/src/content/index.tsx:130` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Table.Head` | `packages/inkra/src/content/index.tsx:133–138` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Table.Header` | `packages/inkra/src/content/index.tsx:128` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Table.Root` | `packages/inkra/src/content/index.tsx:122–124` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `Table.Row` | `packages/inkra/src/content/index.tsx:131–132` | Source and repeated-update React checks pass; DOM acceptance pending. |
| `OverflowList` | `packages/inkra/src/overflow-list/index.tsx:138–175, 187–277, 296–305` | Two defects fixed; synthetic lifecycle tests pass. |
| `Tree.Item` | `packages/inkra/src/tree/index.tsx:58–62` | Pure wrapper boundary verified; React Aria DOM engine pending. |
| `Tree.ItemContent` | `packages/inkra/src/tree/index.tsx:81–123` | Pure wrapper boundary verified; React Aria DOM engine pending. |
| `Tree.ItemDescription` | `packages/inkra/src/tree/index.tsx:130–133` | Pure wrapper boundary verified; React Aria DOM engine pending. |
| `Tree.ItemTitle` | `packages/inkra/src/tree/index.tsx:125–128` | Pure wrapper boundary verified; React Aria DOM engine pending. |
| `Tree.Root` | `packages/inkra/src/tree/index.tsx:34–56` | Pure wrapper boundary verified; React Aria DOM engine pending. |

## Targeted evidence

- Card: 128 fully composed cards × 12 updates, context divider changes, stable generated seeds, zero keyed-child remounts.
- Alert: 128 composed alerts, eight repeated updates plus controlled close/reopen and uncontrolled close; latest handler retained.
- Avatar: 128 image/fallback pairs × 12 updates; fallback identity and border/radius checks. Twenty delay changes retain one pending timer; unmount cancels it. Image loading was not simulated.
- Table: 512 rows × four body cells, eight selection/text updates; all nine exports exercised, native semantics and child identity retained.
- Command: actual cmdk React state, 512 explicit-valued items, 12 unrelated updates: filter calls stay at 512. Each distinct search adds exactly 512 calls. Empty state, disabled item click guard, latest selection callback, shortcut and separator are covered. Twenty IME composition cycles preserve current handlers.
- Tree: pure Inkra forwarding contract and 10,000 state-callback evaluations, including selection decoration, disclosure labels and icon state. This is not a mounted React Aria collection.
- OverflowList: 2,000 items settle to four visible items; 12 unrelated parent updates add zero geometry reads and zero observers. One hundred observer callbacks coalesce to one frame and six geometry reads. Unchanged layout does not repeat notifications. Membership changes, delimiter-containing IDs and teardown are covered.
- Overflow helper: 20,000 entries over `start`, `end` and `priority`, five widths each; ordered disjoint partitions, stable input order and provisional trigger measurement. Source review confirms linear scans for contiguous strategies and O(n log n) sorting for priority. No timing threshold or production-frame claim is inferred from these tests.

## Commands and outcomes

1. `node --test --test-name-pattern="OverflowList (observes|reports)" packages/inkra/test/collection-wrappers-runtime.test.mjs` against pre-fix dist: **2 failed**, proving both reported defects.
2. `npm run build`: **passed**.
3. `node --test packages/inkra/test/collection-wrappers-runtime.test.mjs packages/inkra/test/overflow-list.test.mjs packages/inkra/test/content.test.mjs packages/inkra/test/tree-timeline-regression.test.mjs packages/inkra/test/expansion-data.test.mjs`: **35 passed, 0 failed, 0 skipped, 0 TODO**. The new runtime file contributes 12 tests. React emits its expected react-test-renderer deprecation warning.

## Explicit acceptance limits

- Browser launch is blocked by this environment's socket/sandbox restriction. No alternative was used to bypass it. No real-DOM browser run, screenshot, visual acceptance, focus audit, forced-colors/RTL acceptance or real-device profile was completed.
- React test renderer gives decoration elements null host refs. These tests do not measure PencilText/PencilLine/PencilSurface canvas painting, layout, MutationObserver work, browser long tasks, memory retention, FPS or CPU savings. Thousands of table/cmdk decorations are still a valid real-browser profiling target; this audit neither proves nor dismisses that cost.
- Command uses a minimal `document.activeElement.hasAttribute` stub so cmdk's state engine runs. It does not emulate querySelector-backed sorting, keyboard focus, real list ResizeObserver geometry, native event dispatch or IME behavior in a browser. Explicit item values avoid pretending null host text extraction works.
- A real Tree mount was attempted and failed because React Aria creates a ReactDOM collection portal unsupported by react-test-renderer (invalid container / appendChild failure), with additional missing DOM effects. Its source review and direct pure wrapper calls are reported separately, not counted as engine interaction acceptance.
- OverflowList uses a controlled fake ResizeObserver, animation-frame queue and width values. The two lifecycle regressions are deterministic but browser validation must still cover late item resize, shrink/expand loops, font loading, focus transfer into the overflow trigger, menu keyboard use, RTL, and open-menu changes.
- Avatar source/fallback behavior is covered; real image loading/error/replacement behavior and visual border alignment remain unverified.
- Full repository aggregate checks, package/pack/docs consumer checks and integration with concurrently edited collections belong to the integration owner. This report does not claim those passed.
