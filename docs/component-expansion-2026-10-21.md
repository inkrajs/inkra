# Component Expansion

Historical batch record: following the organization split, examples and consumer
browser scripts live in `inkrajs/docs`. Run its build from that independent
checkout, not with the former `@inkra-internal/docs` workspace command.

## Scope

User requested more components referencing https://ui.shadcn.com/docs/components,
retaining Inkra design and parallel delivery. This batch adds Tabs, Tooltip,
Accordion, Badge, Separator, Skeleton and Progress. It is not full shadcn parity.
No publication, deployment or commits are authorized.

Root: existing work/inkra checkout. Read AGENTS.md and docs/design-standard.md.
Shared runtime: React 19, local Vite 4180, npm workspaces.

## ThreadWork / RouteSpecExecution

| Route | Existing Thread | Write Scope | State | Output |
| --- | --- | --- | --- | --- |
| Interaction | 01a15812-f430-7d00-a031-2ea9792e7391 | src/tooltip, src/accordion, matching tests | completed, handoff reviewed | docs/expansion-interaction-handoff.md |
| Display | 01a15812-fad7-7183-8060-3b9199dbc230 | src/display, test/display.test.mjs | completed, handoff reviewed | docs/expansion-display-handoff.md |
| Examples | 01a15812-ee83-76f2-bdbd-ff250eaa9683 | MoreExamples.tsx/css | completed, handoff reviewed | docs/expansion-examples-handoff.md |
| Integration | current chat | Tabs, exports, styles bundle, navigation, API, translations, integration tests | completed | this document |

Package source paths are relative to packages/inkra; examples to apps/docs/src/components.
Integration owns package.json, lockfile, source exports, vite aliases and CSS bundle.
Examples depend on interaction and display public APIs. No overlapping file writers.
Do not spawn subagents, create new chats or revive unrelated work.

## ValidationDecision

- Package build and native node tests for semantics and API boundaries.
- Browser checks at 1302, 390 and 320px, scoped light/dark, keyboard navigation,
  disabled states, stable preview/code layout, panels, tooltips and progress.
- Tabs reuses Radix focus/activation and existing deterministic drawing animation.
- Reviewer: integration owner inspects delivered source and actual screenshots.
- No real-device or user visual acceptance claimed from automated checks.

## Readiness

Yes, for this seven-component local alpha batch. All three terminal task states were
observed and their persistent handoffs read. No publication or full shadcn parity is claimed.

## Integration Evidence

- `npm test`: 62/62 package tests pass, including the public built export surface.
- `npm run build --workspace=@inkra-internal/docs`: passes. Existing module-directive
  and >500 kB bundle warnings remain; these are not runtime errors.
- `scripts/verify-expansion.mjs`: seven routes at 1302/390/320px; stable preview/code
  heights, persistent controls, API/accessibility tabs and one-step history navigation.
- Same browser suite: Tabs automatic/manual activation, disabled skipping,
  Home/End, vertical, RTL, forceMount state preservation, 480/320ms draw/erase;
  Accordion multiple mode and keyboard; Tooltip focus/Escape and dark portal tokens;
  Progress indeterminate ARIA/reduced motion; editable JSX escaping and English labels.
- Dark 1302/390px screenshots and nonblank canvas-pixel checks cover all seven routes.
  Visual review sampled `/tmp/inkra-tabs-1302.png`, `/tmp/inkra-accordion-390.png`,
  `/tmp/inkra-badge-dark-1302.png`, `/tmp/inkra-progress-refined.png`.
- `scripts/verify-playgrounds.mjs`: all nine existing playgrounds pass at all three widths.
- `scripts/verify-selection-drawing.mjs`: progressive frames, interruptions,
  reduced motion, cleanup and light/dark pigment alignment pass.

## Review And Closeout

Coordinator corrected duplicate tab-change notifications/history entries found in
browser verification, completed translation/API/accessibility integration, and changed
Progress's final fill from action to diagonal selection pigment after screenshot review.
The latter supersedes the display handoff's action-fill description; fixed geometry,
RTL and clipping remain unchanged. Source and tests were updated together.

All shared write scopes are released. Local Vite remains on port 4180 for inspection.
No real-device or user visual acceptance is inferred from these checks. No commit,
push, publish or deployment was performed. Rollback is scoped to the seven component
directories, their tests and recorded integration edits; preserve unrelated work.
