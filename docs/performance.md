# Rendering and collection performance

These changes retain the public API and deterministic normal-size decoration.
They are not evidence that an application-specific page crash has been reproduced.

## Rendering budgets

- Finished surface snapshots use an LRU cache with at most 64 entries and 16 MiB
  of RGBA backing pixels, including separate border canvases. Individual entries
  larger than 2 MiB are painted but not retained. A snapshot is admitted only
  after a repeat within a 64-key recent window, avoiding cold/long-scan copying.
  Keys include dimensions, DPR,
  seed, variant, border mode, radius, colors, dark mode and material settings.
- Live canvases are never stored in that cache. Snapshots and clipping points are
  copied; a lost snapshot context invalidates the entry even after restoration.
  Failure to allocate an optional snapshot does not discard a successful paint.
- Surface/wash/line/icon backing stores are checked before allocation: at most
  8192 pixels on either axis and 4,194,304 pixels total per canvas. Oversized
  surfaces use the existing readable CSS fallback; oversized icons/lines skip
  decoration without changing the semantic DOM. Ghost surfaces need no bitmap.
- SVG icon path sampling is capped at 16,384 intervals per path and 65,536 sampled
  points per icon. Oversized geometry uses the existing vector path fallback.
  Inputs over 65,536 characters per path or 1024 paths are not decorated.
- Stroke sampling rejects invalid steps, excessive samples, pass/filament counts
  and unsafe distance offsets. This prevents malformed internal inputs from
  entering nonterminating loops; ordinary stroke output is unchanged. Coordinates
  are validated and copied in one bounded indexed pass, avoiding a separate scan
  and spread-based cloning on cold paints.
- Oversized/invalid cache entries are not retained and no longer evict all useful
  small entries. Cache accounting also handles the empty-string key correctly.
- Equal-value icon path/badge props retain the same drawing effect and observers.
  Actual geometry changes, including in-place edits followed by a React render,
  still create a new snapshot and repaint.

The RGBA cache budgets are accounting limits, not a claim about total browser or
GPU memory. Per-instance live canvases, graphics-driver overhead, other caches
and application DOM still consume memory. Cold mounts and workloads larger than
the cache are not expected to gain the same benefit as repeated stable surfaces.

## Collection processing

Transfer uses sets/maps for key normalization, membership and batched move
lookups. TreeSelect reuses its index across interactions, traverses its model
iteratively and aggregates propagated selection bottom-up. Duplicate handling,
ordering, disabled nodes and controlled-key behavior remain covered by tests.
Deep-tree model safety does not imply that arbitrarily deep React/ARIA trees are
supported: the open React/ARIA rendering stack may still recurse. See
`performance-audit.md` for the subsequent component-by-component audit.

## Reproduce

Run `npm ci --ignore-scripts`, then `npm run check`. The icon lifecycle regression
uses react-test-renderer with simulated canvas/observer APIs; it checks React
subscription lifetimes, not browser layout or pixels. Its upstream deprecation
notice is expected. Existing opt-in tests remain opt-in.

For collection model timings and baseline-output equivalence:

```sh
node scripts/benchmark-components.mjs 35e26d81e985ed9011f3387a3aac27bfb423c07f
```

For an optional native Skia canvas microbenchmark, install
`@napi-rs/canvas@1.0.13` separately, or locally with
`npm install --no-save --package-lock=false --ignore-scripts @napi-rs/canvas@1.0.13`.
Build the baseline in a separate checkout and retain its `packages/inkra/dist`.
Then run:

```sh
node --expose-gc scripts/benchmark-rendering.mjs /path/to/baseline/packages/inkra/dist
```

`INKRA_CANVAS_MODULE` may point to the native canvas module in an isolated
installation. The script reports five samples and medians for warm identical
keys, cold unique keys and a working set exceeding the surface-cache entry limit.
It also compares 72 light/dark, DPR and separate-border combinations against the
baseline, including cache hits. This native-canvas test does not measure browser
layout, frame rate, interaction latency or real-device memory. Complete the
installed-package browser checks in `docs/rendering.md` and desktop/mobile visual
acceptance before release.
