# Phase 1 Component Delivery

Date: 2026-10-20. Local implementation only; no publication or deployment.

## Dependency Order

1. Portal, modal overlay and anchored popover primitives.
2. Field/Input/Textarea and Checkbox/RadioGroup/Switch can proceed independently.
3. Tooltip, Select, DropdownMenu and Dialog compose the verified floating primitives in a later integration pass, not independent positioning or focus stacks.
4. Tabs, Card, Badge and Alert remain in the first-phase backlog; this first delivery establishes the primitives above.

## Ownership

| Existing chat | Exclusive implementation scope | Status |
| --- | --- | --- |
| Inkra · 基础组件与 Alpha 包 | src/overlay, overlay tests, phase1-overlay.md | Implemented and integrated |
| Inkra · 文档站骨架 | src/form, form tests, phase1-form.md | Implemented and integrated |
| Inkra · 设计风格标准 | src/selection, selection tests, phase1-selection.md | Implemented and integrated |
| Coordinator | exports, style aggregation, dependencies, documentation routes, integration tests | First delivery verified locally |

All src paths are under packages/inkra. Contributors do not build/clean shared dist concurrently. Coordinator owns builds and package manifests. Preserve existing source and the pencil renderer.

## Delivery Gates

- Separate docs pages and working examples with source disclosure and API/keyboard notes.
- Native form values, disabled/required/readOnly/invalid states; controlled and uncontrolled inputs.
- Overlay: focus trap, restoration, outside dismissal, nested Escape behavior, scroll lock.
- Popover: anchor positioning, collision handling, responsive content sizing, scoped theme inheritance through portals.
- No font substitution, duplicate CSS/canvas borders, duplicated spacing or layout shifts.
- Light/dark/auto and Chinese/English, desktop/mobile, package tests and docs build.
- Local checks do not imply user visual acceptance or full accessibility certification.

## First Delivery Evidence

- Eight independent component routes: Popover, Overlay, Field, Input, Textarea, Checkbox, RadioGroup, Switch. Each has working examples, source disclosure, API and keyboard notes.
- Package build and 34 tests passed. Docs TypeScript and Vite build passed, with non-blocking dependency use-client directive warnings.
- scripts/verify-phase1.mjs passed against the local preview: editing, required validation, live example code, native form values/reset, radio arrow keys, checkbox mixed state, popover focus restoration, nested popover over modal, top-layer Escape and scroll-lock restoration.
- Scoped dark tokens survive portals; forced-colors returns system tokens. English main content checked on all eight pages. 390px and 320px routes have no document overflow; modal fits viewport. No browser page errors in the final run.
- Existing local preview on port 4180 reused. No publication, deployment, travel edits or Git changes requested/performed.
- Remaining phase-one backlog: upper floating controls and Tabs/Card/Badge/Alert. No claim that these are implemented yet.
