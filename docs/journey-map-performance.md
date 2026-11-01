# JourneyMap rendering performance

`rendering="auto"` enables four independent strategies: `boundaryViewport`,
`terrainViewport`, `reuseCanvas` and `cacheBase`. Both Chrome and WebKit benefit
from the measured workloads below, so the defaults do not inspect the browser.
An options object overrides individual flags; omitted flags follow `auto`.
`rendering="legacy"` disables the four strategies for comparison. Canvas memory
limits and restoration handling still apply in legacy mode.

## Measurements recorded on 2026-10-31

Headless installed Google Chrome 156.0.8078.79 and Playwright WebKit 27.2 ran
serially on the same machine, at DPR 2 without CPU/network throttling. The
installed-package fixture used the documentation's New Zealand geography and
land-cover data, at 662×600 CSS pixels for docs and 368×420 for home. Each warm
zoom sample reset to the initial land view before zooming once; each action was
sampled three times. These are synchronous map-paint requestAnimationFrame
callback medians, not full GPU presentation time, FPS or input latency.

| Browser / map | Action | Previous package | Optimized |
| --- | --- | ---: | ---: |
| Chrome / docs | Zoom | 73.0 ms | 50.3 ms |
| Chrome / docs | Select place | 47.5 ms | 1.8 ms |
| Chrome / home | Zoom | 44.9 ms | 44.2 ms |
| Chrome / home | Select place | 37.0 ms | 1.3 ms |
| WebKit / docs | Zoom | 1633 ms | 993 ms |
| WebKit / docs | Select place | 543 ms | 2 ms |
| WebKit / home | Zoom | 672 ms | 493 ms |
| WebKit / home | Select place | 236 ms | 2 ms |

No complete map repaints occurred during stable idle. Theme changes, resize,
pan settling, selection, unmount/remount and independent switch behavior were
also exercised. Earlier screenshot differences included a hovered control; raw
map pixels need to be distinguished from overlaid controls when comparing ink.
The recorded fixture predates the street-background option; these measurements
are workload evidence, not a benchmark of the final street demo or every device.

## Boundaries and recovery

A single per-instance snapshot retains at most 3 Mi pixels (about 12 MiB RGBA).
The main canvas is limited to 4 Mi pixels and 8192 per side, reducing DPR as
needed, down to 1. A snapshot is discarded before resizing the main canvas;
combined retained main/snapshot pixels stay within 6 Mi pixels. If the main
canvas cannot fit even at DPR 1, its ink is released; DOM controls and place
labels remain, and shrinking restores drawing. Context/cache-copy failure
falls back to direct drawing. Unmount releases both backing stores.

Data-reference, view, size/DPR, theme-color and renderer-version changes
invalidate the base. Selection reuses it. Rendering switches redraw without
recreating the Leaflet instance or resetting the view. Replace changed data
references rather than mutating them in place.

WebKit is not branded Safari. Real Safari automation could not establish a
session: remote automation was disabled on the initial attempt; a later isolated
session request timed out. No system setting was changed. Actual Safari/iPhone
acceptance therefore remains unverified. WebKit's roughly one-second docs zoom
paint is still visibly expensive; the optimization does not eliminate all lag.
No Safari CI gate is added. Future browser-specific presets should follow
measured regressions; callers can already choose any combination of the flags.
