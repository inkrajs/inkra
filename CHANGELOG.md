# Changelog

## 0.5.0 - 2026-10-25

- Add InkraProvider with English, Simplified Chinese, Japanese, Korean and
  French component dictionaries, typed partial overrides and nested inheritance.
  Explicit component copy stays authoritative; locale changes preserve user input.
- Add scoped ThemeProvider with light, dark, system and inherited themes,
  CSS token overrides, portal inheritance and forced-color support.
- Add five-language documentation navigation and provider playgrounds with
  shared text, line and fill controls. Reference translations remain partial.
- Remove the empty searchable-select clear-action space and retain pencil text
  on long Retina lines using bounded adaptive raster resolution.

Published as `@inkra/react@0.5.0` with the `latest` npm dist-tag and the
`react-v0.5.0` GitHub Release. The public archive matches the approved candidate;
clean registry installations passed with React 18 and 19.
Existing React 18 Calendar SSR and Next.js/RSC limitations remain documented.

## 0.4.3 - 2026-10-25

- Add theme-aligned Markdown with pencil typography, task checkboxes, tables,
  content-seeded inline code, and language-labeled code cards with copy actions.
- Add reusable ColorSwatch and ColorPicker presentations, including opt-in
  structured linear, radial, conic and repeating gradients.
- Extend Editable with built-in Input, Textarea and Select editors and integrated
  confirm/cancel actions; preserve keyboard, composition and async-save behavior.
- Make ImageViewer a full-viewport resource viewer with bottom thumbnails and
  tools, video support and a MediaViewer alias; soften PanZoom wheel zoom.
- Add Tabs overflow menus/buttons, independently queued Toast positions and
  compact/card appearances, Empty illustrations and borderless Skeleton fills.
- Add icon weight, intensity, pressure and break controls. Gap count is an upper
  bound based on displayed stroke length; the default icon weight is now 1.5.
- Improve bounded geometry/collection rendering, visibility-aware pencil work,
  frame scheduling and package-level JavaScript/CSS entry points.
- Simplify primary documentation previews, extend the icon catalog and expose
  a 16-128px size slider with a responsive nine-icon preview.
- Keep Drawer actions inside short viewports with classic scrollbars; allow
  header/footer shrinkage and avoid reserving an unused footer scrollbar gutter.

- Center viewer thumbnails and tools without unused classic-scrollbar gutters.

The 0.4.0 and 0.4.1 tagged candidates were not published after Linux browser
checks found Drawer overflow and viewer gutter offsets. Their immutable tags
are retained. The 0.4.2 release also remained unpublished: its final run reached
the 25-minute validation limit. Version 0.4.3 retains all checks with a 45-minute
validation budget and supersedes those candidates.

Published as `@inkra/react@0.4.3` with the `latest` npm dist-tag and the
`react-v0.4.3` GitHub Release. The public archive matches the approved candidate;
clean registry installations passed with React 18 and 19.
Existing React 18 Calendar SSR and Next.js/RSC limits
remain; automated browser checks do not certify the full catalog on real devices.

## 0.3.0 - 2026-10-23

- Extend NumberTicker to exact bigint and decimal-string values, configurable
  compact units and promotion thresholds, scientific/engineering notation,
  rounding and decimal precision, and icon-capable affixes.
- Add InputNumber modifier-key steps and configurable press-and-hold repetition;
  preserve readable incomplete native numeric drafts and pencil-rendered values.
- Restore portal exit animations without losing scoped themes or nested focus;
  add menu, accordion and tree feedback with reduced-motion support.
- Allow Command to reuse its containing dialog surface without a duplicate frame.
- Improve Sortable drag handles, VirtualList pencil framing and empty text,
  and Radar table localization.
- Document native password input and an accessible reveal action; clear detached
  editable canvases when returning to masked input.
- Expand localized examples, collapsible playground settings and bounded layout
  transitions without per-frame pencil texture redraws.

Published as `@inkra/react@0.3.0` with the `latest` npm dist-tag and
the `react-v0.3.0` GitHub Release. The public archive matches the approved
candidate; clean registry installations passed with React 18 and 19.
Tree collapse remains immediate; real-device and full-catalog visual acceptance
are not claimed. Existing rendering limits below continue to apply.

## 0.2.0 - 2026-10-23

- Add AudioPlayer, Carousel, ImageCropper and ImageViewer for media interfaces.
- Add NodeGraph, Sortable, PanZoom, Resizable, DockablePanel, ScrollArea and
  VirtualList using established interaction engines where appropriate.
- Add ChoiceGrid, ColorPicker, Editable, Keypad, RangeSlider, Rating,
  TagInput, Transfer and TreeSelect for richer input workflows.
- Add ContextMenu, HoverCard, OverflowList, Flip, Hotkey, Log, NumberTicker,
  Slot, Typewriter, Heatmap, Radar, Sparkline and SegmentedProgress.
- Extend Progress with a pencil-rendered ring and customizable content placement.
- Preserve PencilText layout under canvas zoom and CSS transforms; align new
  component controls, separators, surfaces and scrolling with Inkra primitives.
- Expand bilingual documentation, interactive examples, navigation icons and
  focused desktop/mobile regression checks.

### Known Validation Limits

- The full expanded component matrix is not certified visually on real devices.
  Typewriter pause/show-all and Sortable desktop cross-container browser
  scenarios still need follow-up; passing unit tests does not certify them.
- Calendar's React 18 development SSR warning and the uncertified Next.js/RSC
  boundary described below continue to apply.

Publication is confirmed only by the matching npm version and GitHub Release.

## Earlier Source Additions

- Add Toast, AlertDialog, Drawer, DatePicker, TimePicker, Pagination, Empty,
  ToggleGroup, Command, Upload, DataTable, Tree, Steps and Timeline.
- Reuse Base UI for notification/toggle interactions, Radix Dialog for modal
  focus management, DayPicker for dates, cmdk for commands, TanStack Table v8
  for tabular state and React Aria for tree interaction.
- Add bilingual examples, categorized property controls, API/accessibility
  documentation and component/installed-package/browser regression coverage.
- Upload accepts an application-supplied transport; it does not upload to an
  Inkra service. Drawer swipe gestures, Tree drag/drop and DataTable
  virtualization/server transport are outside this increment.

These additions are included in the 0.2.0 release alongside the new components.

## 0.1.0 - 2026-10-22

Published as `@inkra/react@0.1.0` with the `latest` npm dist-tag and
the `react-v0.1.0` GitHub Release. The public archive matches the approved
Actions candidate; clean registry installations passed with React 18 and 19.

- The approved npm package name is `@inkra/react`; npm rejected the earlier
  unscoped `inkra` name as too similar to existing packages. Public imports,
  installed-package checks and the documentation consumer use the scoped name.
- Release tags now use `react-vX.Y.Z`, preserving the unsuccessful `v0.1.0` tag.

### Components

- Pencil drawing primitives, semantic action/form controls, overlays,
  navigation, content and feedback components.
- Single/multiple Select, a separate searchable Select, decorative trigger
  slots, hidden value/indicator options and icon-only triggers.
- Calendar, DayAgenda and JourneyMap using caller-provided data.
- Localized documentation with grouped interactive property controls.

### Release Preparation

- Bilingual introduction, maintenance templates and root MIT license.
- Public-registry lockfile and portable browser-test imports.
- Repository and tarball checks, candidate digest, installed-package SSR/types/
  assets, read-only CI and manual candidate artifacts.
- A manually triggered, approval-gated npm pipeline: candidate validation,
  OIDC publishing, first-package staging and registry installation verification.

### Rendering And Compatibility

- Server-safe layout effects for Inkra drawing and input components, and
  React 18-compatible ref forwarding through portal theme containers.
- Installed-package StrictMode hydration checks for React 18/19, including
  controls, portals, lazy maps, canvas recovery and unavailable-canvas fallback.

### Known Limits

- Calendar's upstream DayPicker animation hook emits a React 18 development
  SSR layout-effect warning. Browser hydration is tested separately.
- Next.js/RSC integration is not certified; components require a client boundary.
