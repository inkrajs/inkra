# Travel Component Port

Repository migration note: `apps/docs` references below are historical local
paths. Those public datasets and examples now belong to `inkrajs/docs`, at the
same `src/data` paths relative to that independent repository.

The previous Calendar/DayAgenda/JourneyMap implementation was a generic approximation, not a port of the travel site's experience. The user's October 21 correction replaces that baseline.

## Source Mapping

Source checkout: `new-zealand-slow-trip-2026/src/adventure/` (read-only).

| Component | Source | Adaptation |
| --- | --- | --- |
| Calendar | AdventureCalendar.jsx / .css | Seven spaced rounded day cards, whole-day button with sibling event buttons, container-width density at 1000/700px, bounded date range. Existing DayPicker selection and keyboard behavior retained. |
| DayAgenda | AdventureScheduleTimeline.jsx, scheduleCardScale.js | Vertical clock axis, overlapping interval lanes, common piecewise mapping for short cards and ticks, isolated point slots, cross-midnight indicators, previous/next actions. The copied geometry algorithm accepts minutes instead of absolute milliseconds. |
| JourneyMap | pencil/brush.js, stopMarker.js, drawPencilMap.js, palette.js | Geographic clipped land-cover pigment, anchored pencil hatching and sea tile, irregular filled station rings, pencil labels, lower-left icon controls. Leaflet remains the projection/gesture engine; existing raster is transformed while moving and regenerated on rest. |

Default Calendar appearance is now `itinerary`; `picker` explicitly retains the former compact date-picker display. `displayRange` limits visible days without changing the underlying selection semantics. Accessory rendering is caller-supplied; weather is not fabricated.

DayAgenda has one scrollable timeline, with undated events outside the scale. Short events expand the time mapping and the ticks together, following the source's newer readable-card implementation, not a falsely linear 24-hour scale. `showOverview` now controls timeline grid visibility. `divided` controls grid strokes. Navigation callbacks are optional and missing endpoints are disabled.

JourneyMap defaults to 480px and hides the duplicate place list after readiness; loading/failure retains the list. Optional focus follows the source's absolute 10x overview zoom and 850ms motion, respecting reduced motion. Geography, land cover, water, places and routes remain injected; no private itinerary, reservation, media, credentials or live location were copied.

## Public Demo Data

- `apps/docs/src/data/pencil-geography.json`: exact original public Natural Earth dataset, including source metadata; public domain.
- `apps/docs/src/data/pencil-land-cover.json`: exact original generalized ESA WorldCover 2021 dataset and source metadata; CC BY 4.0. Contains modified Copernicus Sentinel data (2021), processed by ESA WorldCover consortium.
- Sample calendar events are fictional and unrelated to private trip bookings. Map markers identify public locations only; no straight line is presented as a road route.

## Remaining Boundaries

This is not the entire original travel application. Town-detail tiles, bathymetry, route resolution, viewport-aware business drawers, weather data fetching, cross-time-zone flight conversion, and the private vault remain outside these primitives. Those require explicit data/adapters and further extraction. The original site's full terrain cache is not yet ported. Scale and compass reuse AdventureMapScale's pencil geometry with Leaflet distance projection. Visual acceptance remains with the user.

## Verification Checkpoint

October 21, 2026: package and docs builds pass. All 86 package tests pass, including independent calendar event targets, shared time/card mapping, and point events inside overlapping durations. Final local preview checks at 1302px and 390px found no page overflow or page errors; map marker selection, zoom/reset and agenda selection worked. Screenshots were inspected locally. These checks do not constitute user visual acceptance or real-device verification. Existing broad travel verification scripts target the previous demo and have not been presented as passing for this port.

Build retains the existing Radix module-directive and main-chunk-size warnings. Geographic demo data is lazy-loaded separately from the main documentation bundle. No commit, deployment, private trip data, or source-site modification was made.
