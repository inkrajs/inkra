# Inkra delivery checkpoint

Historical delivery log. Since the 2026-10-21 organization split, interactive
docs and consumer browser scripts belong to `inkrajs/docs`, not this workspace.
Old commands and task references below describe their original checkpoints;
use `CONTRIBUTING.md` and `docs/organization-structure.md` for current ownership.

Date: 2026-10-20 (Asia/Shanghai).

## Phase 2 Component Refinement

Docs controls follow-up: all visible native selects in documentation sources
are replaced with the shared DocsSelect composition of Inkra Select. Language
and icon-only segmented theme controls now live in the stationary sidebar footer
and mobile drawer footer. Navigation scrolls independently; both navigation and
documentation use 20px padding on all sides. Active navigation wash fits its
label while the link keeps its full-row hit area. `verify-docs-controls.mjs`
passed language changes, theme radios, all property selects, desktop footer
position, spacing and mobile 390/320 drawer menu/Escape/focus behavior. Desktop
and mobile screenshots reviewed locally, not user acceptance.
Final docs build passed. `verify-playgrounds.mjs` passed all nine playgrounds
at 1302/390/320px for stable preview/code height, live source, keyboard and
absence of page overflow. Existing dependency directive warnings remain.

ButtonGroup follow-up: zero-gap joined buttons share one pencil outline and one
PencilLine at each adjacent boundary, for both orientations. Individual borders
are separated from wash rendering and hidden inside the group; button semantics,
variants and native Tab order remain. Removed the docs mobile override that
turned horizontal groups into columns. `verify-button-group.mjs` passed painted
dividers, adjacency, click/keyboard, RTL and 1302/390/320 layouts; 45 tests passed.

Latest connected-group override: segmented choices now share one radius-8
pencil outline with 4px group inset, zero option gap and no per-item outline.
The selection wash still fades over 180ms. Ordinary radios are unchanged.
45/45 package tests and docs build passed after this change. Selection browser
checks passed desktop/390/320 single-row adjacency, vertical adjacency, painted
outer frame, dark/RTL keyboard behavior, forms/reset and reduced motion. Local
screenshots inspected; this is not user visual acceptance.

Final local checkpoint: 2026-10-20 23:26 +0800. All three independent routes
completed and handoffs were read; coordination is recorded in
`docs/component-refinement-coordination.md`.

Latest RadioGroup correction keeps horizontal segmented choices on one row,
with local horizontal scrolling only when needed. Stable pencil outline and
selection layers crossfade over 180ms; reduced motion disables transitions.
Desktop and 390/320px checks cover layout, actual animation midframes, native
keyboard selection, disabled state, form data and reset.

Select is implemented and documented, including pencil surfaces/text, native
form/reset behavior, keyboard navigation, focus restoration, scoped theme/RTL
and nested layers. Switch now has a 52x32 track, 24px thumb, 4px insets and
correct LTR/RTL endpoints. Input/Textarea render editable pencil lettering with
native caret/editing and bounded fallbacks. All ten component pages share page
tabs; supplemental titles sit inside card headers. Sidebar dividers remain
stationary, and page scrolling follows actual content.

Final package tests: 45/45. Docs build and local browser suites passed:
verify-selection, verify-docs-refinement, verify-playgrounds, verify-phase1,
verify-select, verify-editable and verify-editable-integration. Screenshots
inspected. These are bounded local checks, not user visual acceptance, real OS
IME/device acceptance or full accessibility certification. Existing dependency
directive build warnings remain. No publish, push or deployment. Select is no
longer backlog; Tooltip/DropdownMenu remain outside this delivery.

## Phase 1 Foundations

Follow-up: all eight new component pages now share ComponentPlayground, matching the Button preview/code toolbar and persistent property sidebar. Switching tabs changes only the fixed-height left display; controls update source live. Supplementary examples retain footer disclosure. verify-playgrounds.mjs passed all eight at 1302/390/320px for height stability, live code, sidebar position, keyboard tabs and overflow. verify-phase1.mjs passed again; docs build passed. Screenshots inspected locally, not user acceptance.

Three existing independent chats completed isolated overlay, form and selection implementations. Integrated Portal-backed Overlay/Popover, Field/Input/Textarea and Checkbox/RadioGroup/Switch with eight separate documentation pages. Root exports and built stylesheet aggregation include all new components. Radix dialog/popover dependencies provide floating interaction primitives; react-dom is declared as a peer. Docs retain Xuanmo and existing pencil primitives.

Final package tests 34/34 and documentation build passed. scripts/verify-phase1.mjs passed native editing/validation/reset/keyboard, nested layer Escape/focus/scroll restoration, scoped theme inheritance, forced-colors tokens, English content and 390/320px layout with zero page errors. Desktop and mobile screenshots inspected. These are bounded local checks, not user visual acceptance or full accessibility certification. Tooltip/Select/DropdownMenu and remaining phase-one components are still backlog. No publish or deployment.

## Shared Layout and Usage Guide

Latest requested changes: /usage-guide is independently routed and searchable under Foundations, covering typography, spacing ownership, radii, icon/control pairing, feedback and adaptation. The color usage table and framed paired demo now live there. Color selection occupies the full palette area's right side, vertically centered; selected controls use pencil outlines. Light ocean low steps are bluer, dark preview palettes have separate ascending brightness values. Paper samples contain their foreground text.

All pages now share 20px horizontal padding and no category kicker. Getting started uses one 32px section inset plus 16px internal gaps with direct child margins reset. These ownership rules are recorded in the design standard and visible usage guide.

Button example groups now have pencil cards and independent footer disclosure rows; expanding code retains the example. The playground keeps property controls mounted beside its fixed-height preview/code area and updates code from live controls. Button and ButtonLink link variants share pencil underlines, with native underline fallback for forced colors/print.

Local Chromium checks passed all four routes at desktop and 768/390/320px, header alignment, no kickers, section spacing, live code and stable tab-switch heights, footer disclosure, painted underline pixels, right-side palette placement, theme-specific swatches, guide navigation and English guide translation. Screenshots reviewed: /tmp/inkra-start-aligned.png, /tmp/inkra-playground-code.png, /tmp/inkra-size-footer.png, /tmp/inkra-palette-side.png and /tmp/inkra-palette-dark.png. This is local verification, not user acceptance or full accessibility certification. No publish, push, deployment or travel changes.

## Design Standard Reference Refinement

Latest feedback override: one default ocean palette with four right-aligned swatch controls replaces the four-family grid and nested color-category tabs. Text/background applications live inside the selected palette. Fixed -35-degree pencil swatches preserve native copy targets. The large pairing board is removed; the live task demo provides left-light/right-dark columns and switches to only the header-resolved theme below 760px content width, including system-theme changes. Completion and open-task filtering are synchronized across columns. Foreground tiers now have stronger luminance separation without lettering changes.

Fresh local Chromium checks passed palette switches, mocked clipboard Enter activation, synchronized completion/filtering, explicit/system theme changes, English translation and 1302/1000/768/390/320px layout. Desktop/demo/mobile screenshots inspected. Static text-to-muted-paper contrast ranges from 4.52 to 12.48 in light and 5.69 to 13.56 in dark; these are not glyph-pixel certification. Package tests include updated theme expectations plus luminance/three-paper contrast assertions. No deployment or publication.

Latest local revision references the rendered TDesign color and font guidelines for organization, not their visual identity. The color page retains three user-requested categories, four named pencil palettes, framed light/dark applications and an interactive task-card demo. Swatches copy their hex values by click or keyboard, without numeric captions or a values disclosure. Redundant introductory prose has been removed.

Typography now covers family, seven size roles, three line-height roles, regular weight, light/dark text hierarchy and four icon sizes, with use cases and local section navigation. Original handwriting, full-opacity pencil lettering, default ocean colors and crisp dark tokens remain unchanged. Radius specimens use the actual pencil renderer with an optional bounded radius parameter rather than CSS solid borders.

Verification: production build passed with existing Lucide directive warnings. Package tests passed 15/15. Local Chromium checked palette pigment pixels, clipboard success by click/Enter, actual typography and icon sizes, and English/Chinese views at 1302/768/390/320px without document overflow or page errors. Fresh palette, radius and typography screenshots were inspected. Clipboard success was mocked for deterministic testing, not an OS clipboard acceptance test. These checks are bounded local evidence, not user acceptance, exhaustive contrast certification or real-device coverage. No publication, push, deployment or travel-site changes.

## Scope

- Standalone React package `inkra` and local documentation shell.
- GitHub organization preference: `inkrajs`.
- npm organization created by user: `inkra`; unscoped public package: `inkra`.
- No documentation website deployment requested.

## Independent chats

- Documentation: `01a15812-ee83-76f2-bdbd-ff250eaa9683`.
- Alpha package: `01a15812-f430-7d00-a031-2ea9792e7391`.
- Design standard: `01a15812-fad7-7183-8060-3b9199dbc230`.

The original subagent implementation was stopped at the user's request. Its package task failed with rate limiting; the independent package chat resumed from the saved manifest rather than assuming implementation had finished.

## External setup

- GitHub CLI is authenticated as NWYLZW; membership in `inkrajs` is verified active with the admin role.
- npm web login completed successfully on 2026-10-20. `npm whoami` confirms `yijie4188`; `npm org ls inkra --json` confirms the owner role. Publication is not yet complete.
- The available browser backend exposes only MCP Apps and no open tabs, not a navigable GitHub/npm browser.
- GitHub and npm organization pages were requested through the app UI, which returned queued, not confirmed visible.
- Both organizations were created by the user. No repository, package, or paid plan has been created by this task.

## Local setup

- Root npm workspace, scripts, ignore rules and README are present.
- Initial dependency installation completed successfully with lifecycle scripts disabled.
- First alpha package tests and documentation build passed, but the user rejected its visual style as unlike the original travel site.
- Independent chats are replacing the approximate SVG/CSS treatment with the original site's pencil stroke, wash, paper, lettering and font foundation. The prior visual design is not accepted.
- Local development service is available at port 4180; browser visual verification is not yet available through the connected tools.

## Visual correction coordination

Requirement: reuse the reference site's actual pencil lettering, pressure strokes, paper and wash, not a generic hand-drawn approximation. Preserve semantic DOM, stable bounded caches and readable rendering-failure fallbacks. The travel checkout is read-only.

All routes use the same Inkra root and native independent Codex chats on host `local`. Existing chats are reused, not replaced with subagents.

| Route / task reference | Exclusive write scope | Dependency | Status / handoff |
| --- | --- | --- | --- |
| Docs / `01a15812-ee83-76f2-bdbd-ff250eaa9683` | `apps/docs/**` | Pencil contract and package implementation | Completed; coordinator read `apps/docs/HANDOFF.md`, inspected final desktop/mobile screenshots and checked route transitions |
| Package / `01a15812-f430-7d00-a031-2ea9792e7391` | `packages/inkra/**` except tokens; `docs/pencil-contract.md` | Reference generic rendering sources | Completed including exact `selection` tab wash; coordinator read `packages/inkra/HANDOFF.md` and independently ran 8/8 tests; visual acceptance pending |
| Design / `01a15812-fad7-7183-8060-3b9199dbc230` | `docs/design-standard.md`, `docs/design-review.md`, `packages/inkra/src/tokens.css` | Reference style evidence | Completed including selection foreground/background light/dark/auto tokens; coordinator read updated review handoff; final pixel contrast remains pending |

Coordinator owns integration, this checkpoint, workspace manifest/lock, service checks and publication. No concurrent route may publish or edit another route's files.

Acceptance evidence: inspect completed artifacts, run package tests and production compilation, inspect the exact npm tarball and verify published metadata. Local browser visual acceptance remains pending because the connected browser exposes no controllable tabs. A successful build or HTTP 200 does not establish visual acceptance.

The generic first pass remains rejected. No website deployment, repository push or travel-project changes are included. Do not publish an empty placeholder to reserve the npm name.

Latest feedback requires separate pages instead of one anchored document, removal of duplicate CSS/canvas boundaries, pencil-rendered icons, and the original calendar tab wash for navigation/selection. The reference is `AdventureCalendar.jsx:paintSelectedTab`: strength .32 light / .48 dark, spacing 1.8, roughness 3.5, inset 2, radius 8, no edge reach, no paper fill or outline. Matching foreground/background tokens must be consumed together.

## Final local integration checkpoint

All three independent routes have completed and their artifacts have been read by the coordinator. Subsequent integration checks passed: package 8/8 tests, root production build, and a fresh isolated local Chromium check. No authenticated Chrome session, cookies, or official connected browser tabs were used by that check.

- `/getting-started`, `/components/button`, `/design-standard` render separate views. `/#api` resolved to `/components/button#api` with no playground mounted; switching to the example tab and browser Back restored the expected route.
- At 1302x954, seven visible pencil icon canvases contained nontransparent pixels. No page errors were captured.
- At 390x844, document width did not overflow. The mobile drawer allowed dark-theme selection and navigation to the design standard; Back returned to Button preview.
- Coordinator inspected `/tmp/inkra-final-desktop.png` and `/tmp/inkra-final-mobile-dark.png`: title/description block flow and complete playground outline were corrected; duplicate CSS lines and solid polygon selections were removed. These are local diagnostic images, not user acceptance or exhaustive contrast certification.
- Latest selection tokens pair the light green wash with dark ink and the dark gold wash with light ink. Actual pixel-level contrast certification remains uncompleted.
- Source aliases and service on port 4180 remain active. npm publication is held while the user reviews the corrected material. No package published, source pushed, or website deployed in this correction.

Progressive discovery: `https://docs.npmjs.com/llms.txt` returned HTTP 404 (`unavailable`); no hidden discovery paths were scanned. This did not trigger any account or publication action.

## Button layout correction

Current requirements: FR1 restore one vertical pencil divider at desktop navigation; FR2 put playground controls to the right on desktop, responsive on narrow screens; FR3 replace mixed variant/size rows with organized comparisons and usable code views. Preserve reference material, selection wash and accessible controls.

- Docs route `01a15812-ee83-76f2-bdbd-ff250eaa9683`: completed; handoff read by coordinator; owns `apps/docs/**`; FR1 integration, FR2, FR3; handoff `apps/docs/HANDOFF.md`.
- Package route `01a15812-f430-7d00-a031-2ea9792e7391`: completed, handoff read by coordinator; owns package files except tokens and `docs/pencil-contract.md`; FR1 vertical PencilLine primitive; handoff `packages/inkra/HANDOFF.md`. Direct axis geometry and direction-aware cache/CSS/fallback are implemented, owner 10/10 tests passed; docs integration verification pending.
- Shared contract: `PencilLine orientation="vertical"`, horizontal default. Docs controls layout depends on primitive, not new visual tokens. Coordinator owns integration verification and this checkpoint. No publication or deployment.
- Research: shadcn official Button documentation separates size and individual appearance examples with code views (`https://ui.shadcn.com/docs/components/base/button`). Borrow organization only, not visual material.
- Acceptance: fresh desktop 1302x954 and narrow mobile screenshots, canvas pixels for divider, working playground controls/code/tab routing, package tests and root build. User visual acceptance remains separate.

FR1-FR3 integration: coordinator verified two nonblank vertical canvas dividers on desktop, right-hand controls, loading/disabled/variant/size/code switching, grouped source toggle and API/back routing. At 768/390/320 widths there is no page overflow and the single playground divider changes orientation; sidebar divider is hidden. No page errors. Package tests 10/10 passed. Fresh screenshots `/tmp/inkra-layout-final-desktop.png`, `/tmp/inkra-layout-final-dark.png`, `/tmp/inkra-layout-final-mobile.png`.

Latest FR4: user reports sm/md/lg look the same. Root cause confirmed: sm height 36px is overridden by min-height 44px, and sm/md share 13px text. Package route resumed to separate visual surface height from native minimum hit area, preserving 36/44/48 visual tokens and using 13/15/17 text. Docs route will align comparison and record actual size labels without faking component size in demo CSS. FR4 is pending implementation and fresh measurements.

## Button refinement against shadcn

User explicitly supplied `https://ui.shadcn.com/docs/components/base/button` and requested Button refinement. Official page read 2026-10-20. FR5: primary/secondary/outline/ghost/destructive/link styles; xs/sm/md/lg plus icon-xs/icon-sm/icon/icon-lg sizes; start/end icon composition and accessible icon-only controls; loading/disabled/focus, stable geometry; native anchor ButtonLink and group composition. Retain primary/md compatibility, native DOM semantics, genuine colored-pencil surfaces, logical inline spacing/RTL and radius at most 8px. No requirement to clone shadcn's rounded-full/Tailwind appearance or its entire dependency stack.

- Package route (same task): FR4/FR5 completed, handoff read; 13/13 owner tests; public exports and focused semantic/size/disabled tests; no tokens edits. Coordinator measured 32/36/44/48px surfaces, 12/13/15/17px text, square icon surfaces and hit areas >=44px; full integration still pending.
- Docs route (same task): FR4/FR5/FR6 integration/FR7 completed; coordinator read current `apps/docs/HANDOFF.md`; grouped examples, working controls/source/API, native links, async loading, icon labels, RTL, stable tabs and 56px toolbar implemented; no package edits. Final runtime verification pending.
- Design route `01a15812-fad7-7183-8060-3b9199dbc230`: FR5 tokens/design standard only, add xs visual height32 and text12 as needed, define distinct wash/outline/ghost/danger/link contract and update review handoff. Pending dispatch.
- Fixed API coordination: Button variants primary|secondary|outline|ghost|destructive|link; sizes xs|sm|md|lg|icon-xs|icon-sm|icon|icon-lg; startIcon/endIcon ReactNode; ButtonLink native anchor with same variants/sizes/icon slots and disabled/loading; ButtonGroup semantic role group with accessible label, orientation horizontal|vertical. No polymorphic render/asChild API in this correction.
- Validation remains coordinator-owned: fresh actual visual heights, icon squares, hit areas, native anchor behavior, disabled prevention, form semantics, loading geometry, responsive and RTL checks, tests/build. No publishing.

FR6 latest color-system feedback: replace four-pair placeholder with a real theme color scale, surface/text/border hierarchy, status pairs and side-by-side light/dark specimens. Preserve reference selection wash. Design route additionally owns new isolated `apps/docs/src/components/ColorSystem.tsx` and `ColorSystem.css`; docs route must not edit these and integrates its export in DesignStandardPage only. Design route owns raw/semantic token pairs and documented contrast audit. Coordinator verifies actual composed wash background, both theme scopes and responsive layout; no unsupported accessibility-certification claim.

FR7 latest user correction: active/inactive tab padding and geometry must match, toolbar content must be vertically centered, ghost hover must transition instead of pop, and primary text must be readable over the actual pencil wash. Docs owns tab/toolbar layout; package owns motion and renderer contrast; design owns paired foreground tokens. Initial canvas background sampling failed (light action minimum 2.53, dark action 1.92, dark selection 1.88). These are failures to fix, not accepted contrast. Latest readability requirements override historical exact wash parameters if those cannot meet contrast; preserve material technique, not unreadable pigment density.

Design route encountered terminal 429 exhausted retries; resumed the same task with previously verified `gpt-5.6-sol-codex-oauth`. Recovery not yet assumed until active progress and final output are verified. Package FR7 correction remains in progress.

## Latest Integrated Verification

- Package FR4/FR5/FR7 is completed; current `packages/inkra/HANDOFF.md` read after terminal status. Ghost uses 200ms fade, renderer v2 limits wash density, Button keeps opaque hand-font glyphs under pigment. Old exact selection-density requirements are superseded by user readability feedback.
- Docs FR1-FR7 is completed; current `apps/docs/HANDOFF.md` read. Real Chromium test `/tmp/inkra-verify.mjs` passed after integration: stable 80x44px tabs with zero toolbar center offset; 32/36/44/48px visuals with >=44px hit boxes; square icon sizes; async width stable; alignment group updates; disabled modified/aux link events cannot navigate; enabled native link works; icon-only controls named; 768/390/320px no page overflow.
- Design recovery confirmed: same task became active, edited owned files, completed successfully, and root build passed. Latest design evidence-only handoff synchronization is being completed; source/token implementation has passed integration.
- Root production build and 13/13 package tests passed. Only known Lucide module-level use-client warnings remain. No runtime page errors in the local browser test.
- Final color sampling `/tmp/inkra-contrast.mjs` examined 30 paired specimens in light/dark, composing canvas with paper and comparing opaque foreground. All sampled minima >=4.5; action light/dark 6.012/6.621, selection 5.960/6.292, lowest static text pair 4.525. Border/focus rows measured their text, not decorative stroke contrast. This is bounded local Chromium evidence, not all glyph antialias pixels, all seeds/sizes or a global accessibility certificate.
- Inspected fresh `/tmp/inkra-appearance-final.png`, `/tmp/inkra-themes-final.png`, and desktop/mobile full-page images. The local service remains on 4180. No travel edits, publication, push or deployment occurred.

Final barrier: all three routes are completed and idle. Design evidence-only continuation completed; coordinator read the appended `docs/design-review.md` evidence override after terminal status. Recovery from 429 is verified, not merely dispatched. Independent coordinator ghost-motion test measured entry midpoint .550 and exit .438, endpoints 1/0, reduced-motion duration .00001s. Current code passed final root build, 13/13 tests and local browser workflow checks. Port 4180 returned HTTP 200 at closeout. Remaining limitations are user visual acceptance, broader browser/device coverage and exhaustive glyph/seed contrast coverage; no pending implementation tasks in this correction. No long-term memory proposal or rollback was needed.

## Button Lettering Correction

The user's latest feedback rejects changing lettering while correcting colors. Removed only the two Button-specific rules that exposed solid DOM glyphs and faded the pencil canvas to `.55`. Ready labels again use the original full-opacity pencil rendering with a transparent selectable DOM source; initial/failure, forced-colors and print fallbacks remain intact. Font family, font assets, sizes, paired foreground tokens, wash strengths, tab layout and hover motion were not changed.

Root build and all 13 package tests passed after this correction. A focused local Chromium check on port 4180 confirmed painted label canvases at opacity `1`, transparent ready sources, unchanged `Trip Map Hand` family, light foreground `rgb(23, 59, 69)`, dark foreground `rgb(255, 251, 232)`, readable fallback/forced-colors states and no page errors. Light/dark appearance screenshots were inspected at `/tmp/inkra-lettering-light.png` and `/tmp/inkra-lettering-dark.png`. These supersede the previous solid-underlay behavior and screenshots, not user visual acceptance. No push, publication, deployment or travel-site changes occurred.

## Design Standard Specimens

Latest override (2026-10-20): the user selected crisp, now the shared explicit/automatic dark token default. Dark status specimens use tinted paper tokens beneath the existing pencil wash. Removed the temporary palette picker/module and parameter disclosure, all visible technical identifiers in color specimens/matrix, and the design-page kicker. Added the pencil divider below category tabs; horizontal page padding remains 20px. Color display names are 沧浪 / 宣墨. Header language selection persists, updates document lang and translated search, and the design page's three views translate before PencilText rendering. Search now uses outline without wash. No font or renderer changes in this UI cleanup.

Verification: root build passed (existing Lucide directive warnings only), 14/14 package tests passed. Local Chromium checked both locales, persistence, translated search navigation, absent debug controls/identifiers, below-tab divider, outline search, and all three design views at 1302/768/390/320px without page overflow or runtime errors. Desktop light/dark and mobile screenshots were inspected. Browser checks are local evidence, not user visual acceptance or real-device coverage. No push, publish, deployment or travel edits.

Palette direction correction: the user's latest clarification permits dark-mode color adjustment but requires preserving the light palette's semantic hue families. Removed the graphite/pine/berry identity experiments. Preview candidates are now balanced/soft/crisp, all ocean primary, fern selection/success, amber warning and coral danger with bounded brightness/saturation differences. Current package dark remains as an explicit historical comparison. No font, material algorithm, package defaults or light tokens changed.

Dark palette comparison: added three preview-only candidate palettes (graphite/cyan, pine, berry/gray) plus the current package palette. Native radio controls update only the dark specimen; a disclosure exposes the 23 candidate color inputs. Remounting the keyed dark specimen ensures text and material canvases repaint while keeping identical seeds and lettering parameters. Default preview is graphite, not a change to the package or full-site theme. No renderer strengths, fonts, or light palette changes. Root build passed; local Chromium confirmed four distinct painted action canvases, unchanged light paper, operable radios and parameter disclosure, and no page overflow at 768/390/320px. All three candidate screenshots were visually inspected. These are candidate treatments for user comparison, not approved defaults or accessibility certification.

Dark readability follow-up: raised dark primary/muted/subtle and semantic status foregrounds in both explicit and automatic theme scopes. No font, glyph-mask, grain, alpha, wash, background, light token, or solid-text-underlay changes. Focused Chromium sampling now includes actual text alpha over composed surface pixels (only alpha >= .5 for a bounded body-pixel diagnostic): muted median 4.18 -> 6.11, subtle 3.29 -> 4.97, muted on muted paper 3.56 -> 5.08. This is not a full WCAG certification; low-opacity grain and antialiasing remain outside that diagnostic. Fresh dark panel screenshot inspected at `/tmp/inkra-dark-after.png`.

Latest continuation: added scenario/default/exception rules for radius, padding, gap and control size, and synchronized the design specification. Raw spacing enumeration is now secondary in a disclosure. Existing canvas radius and ButtonGroup spacing exceptions are explicitly documented rather than presented as migrated implementations. Per the user's clarified padding request, the design page uses full available width with 20px horizontal padding matching side-navigation, not zero padding; specimen padding stays unchanged. Fixed narrow-screen table minimum-width inheritance and bounded raw palette scrolling.

Unified ColorSystem headings and descriptive/sample labels with the existing PencilText enhancement; code identifiers and numeric swatches remain native technical text. Removed the duplicated heading top margin and reduced the design section padding. Removed the extra solid CSS rectangle from the static focus-color specimen; its existing focus-colored pencil outline remains, and actual interactive keyboard focus styles are unchanged.

Split the design page into color, geometry/spacing, and typography/material views. Added token-backed radius (0/3/6/8px), spacing scale, padding, gap, and native Button size specimens. Radius specimens intentionally demonstrate actual CSS radius geometry; they do not claim to change PencilSurface's renderer-owned radii. No package tokens or Button rendering were changed.

Root production build passed. Local Chromium checked all three views at widths 768/390/320 without document overflow, confirmed pencil-ready color heading and zero heading top margin, no extra focus-sample CSS outline, radius values 0/3/6/8px and actual padding/gap values 8/12/16/24px. No page errors were captured. Desktop and mobile screenshots were inspected. Preview remains on port 4180; no publish or deployment.
