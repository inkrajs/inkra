# Media, visualization and motion performance audit

Baseline: `7bd08e47b05c9d61a226bbbfd3d5d620ce93962a`.

All 22 exported component identities in this group were inspected, not just the
changed files. `performance-audit-media.json` records aliases, source, findings,
verification, disposition and remaining browser-only gaps for each identity.
Fourteen identities have targeted fixes; eight have no independently justified
change. Internal renderers/helpers are included under their owning export.

## Measured regressions and changes

These are deterministic operation counts in Node/React test-renderer fixtures,
not production frame-rate, memory, GPU or end-user latency benchmarks.

| Fixture | Baseline | Updated |
| --- | --- | --- |
| Audio callback-only replacement, same source | 2 source loads | 1 source load |
| PanZoom, 10 engine transform notifications | 10 additional wrapper commits | 0, all callbacks retained |
| Carousel, 3 controlled selection changes | 3 engine reinitializations | 0 |
| Carousel, align/loop/autoplay/plugin-delay changes | Engine configuration still needs reinitialization | All 4 reinitializations retain current index 2 |
| Radar, selection plus unrelated render | 48 additional point-value reads | 0 |
| DayAgenda, 20 timed events in h12 mode | 66 Intl formatters per initial render | 2 initially, 0 added on selection |
| DayAgenda scale, 1,000 intervals | 1,501,500 start-property reads | 5,996 |
| Tilt, 101 pointer samples before one frame | 101 layout reads | 1; caller still receives 101 events |
| ImageCropper, 5 equal-size measurements | 5 additional commits | 0; a real size change adds 1 |
| ImageViewer, 10 rotations before a frame | 10 pending fit callbacks | 1 |
| NumberTicker, 10 decimal formats after capability warmup | 10 Intl capability-probe formatters | 0 |
| Sparkline domain, Radar long series and JourneyMap terrain bounds, each at 200,000 input records/vertices | Argument-count RangeError | Completes without that error |

Additional deterministic assertions cover unchanged NodeGraph wrapper identities
when one node/edge is replaced, renderer/read-only configuration invalidation,
cache-hit SVG sampling avoidance, and Typewriter rerendering only the changed
PencilText grapheme leaf. Tests also cover stale audio play rejection after source
replacement/unmount, frame/timer/listener cancellation, rapid ticker retargeting,
reduced motion, and controlled PanZoom external updates/refused gestures.

DayAgenda's heap allocation keeps the lowest available lane and original id tie
order. The sweep and binary search are compared against the original algorithm
for 150 seeded cases, including ties, point events and dense overlaps, in both
densities. A separate 20,000-overlap case verifies lane ordering. This changes
algorithmic work without claiming that rendering 20,000 cards is inexpensive.

## Input identity and invalidation

Collection props are immutable snapshots. Public prop comments now make these
requirements explicit:

- NodeGraph: replace the nodes/edges array and each changed node/edge object.
  Replace changed nested data/position objects too. Unchanged records should keep
  their identities. WeakMap adapters are invalidated by rendering configuration,
  do not strongly retain removed input records, and are not mutation detectors.
  A new array containing the same mutated object does **not** invalidate its
  per-record adapter. This is a stricter invalidation boundary than the previous
  whole-array adapter and must be observed by consumers.
- Radar: replace the axes or series array when its data changes, including changed
  series/point records and nested data arrays. Selection and unrelated attributes
  intentionally do not invalidate domain/geometry computation.
- DayAgenda: replace the events array and changed event records; changes to date,
  locale, hour cycle, density and other derivation inputs invalidate their caches.

Callbacks are not frozen. Audio's native handlers read the latest callback refs;
NodeGraph renderer changes invalidate the appropriate adapters. Controlled
selection/transforms remain caller-owned. Carousel snapshots genuine engine
options/plugins separately from ordinary selection, using the latest selection
when a configuration reinitialization is necessary.

The NumberTicker feature probe assumes the runtime's Intl implementation remains
stable after first use. Replacing/polyfilling Intl after mounting requires a fresh
module/runtime, rather than being treated as a per-frame supported operation.

## Reproduce

Use the repository's installed workspace dependencies and build first:

```sh
npm run build
node --test packages/inkra/test/media-performance.test.mjs \
  packages/inkra/test/agenda-layout-performance.test.mjs \
  packages/inkra/test/carousel-performance.test.mjs
npm run check
```

The focused suite contains 22 tests: 18 media/lifecycle cases, three agenda
algorithm cases and one Carousel subprocess. Carousel runs the actual Embla
React hook with deterministic engine/plugin adapters. Its child process uses
Node's experimental module mocking; it was also verified on Node 22.23.4.
React test renderer's deprecation warning is expected, and these tests are not
substitutes for browser tests. Profiler-count cases assert that mount callbacks
actually fired and additionally verify retained host/engine prop identities.

For baseline comparisons, build the baseline in a separate checkout, then run:

```sh
node scripts/verify-media-equivalence.mjs /path/to/baseline/packages/inkra/dist
```

Fifty exact SSR comparisons cover agenda locale/density/point/cross-day cases,
Radar axes/domains/typed and duplicate keys/hidden series/selection, Sparkline
line/bar/missing data, Unicode Typewriter content, numeric/decimal/bigint ticker
values, controlled RTL Carousel, PanZoom, Flip/Tilt, AudioPlayer, ImageCropper and
JourneyMap. To replay operation-count regressions, copy the uniquely named new
test files and Carousel fixture into an isolated baseline checkout and run them
against its built dist. Optimized-work assertions should fail there; lifecycle
and equivalence assertions may already pass.

## Remaining boundaries

- The original intermittent page crash was not reproduced or attributed. The
  argument-count failures above are independently reproducible robustness bugs,
  not evidence that they caused that report.
- Browser execution was unavailable under the sandbox. No browser restriction was
  bypassed. SSR equality is not pixel equality or gesture/focus acceptance.
  Native audio playback, pointer/wheel/pinch, portals/focus, image decode/export,
  Leaflet/React Flow integration, canvas recovery and GPU/device-memory behavior
  remain explicitly unverified in a real browser.
- Existing canvas/raster/sample/export budgets are preserved, not newly unlimited.
  Full accessible tables, graphemes, cards and thumbnails remain mounted.
  Heatmap still scales with rows times columns; Radar's domain scan still scales
  with axes times input points; Typewriter's parent still maps all graphemes.
  Virtualization, new size limits and broad context/API changes were deliberately
  not introduced without evidence and an accessibility-compatible design.
- A separate read-only review found no remaining blocking issue after checking
  callback freshness, cleanup/cancellation, immutable invalidation, controlled
  props, Carousel reinitialization and agenda equivalence; its focused rerun was
  22/22. Real-device validation remains a separate acceptance step.
