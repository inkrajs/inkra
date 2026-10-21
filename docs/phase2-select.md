# Phase 2 Select Handoff

Date: 2026-10-20
Completed: 2026-10-20 23:10:34 CST (+0800)
Status: implementation complete; coordinator has wired package exports and style aggregation, with docs/browser/build acceptance pending.

## Scope

This route owns the single-value `Select` foundation only. It uses `@radix-ui/react-select@2.4.1` and intentionally does not implement an editable combobox, multiple selection, async search, or option creation.

## Public API

```tsx
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectLabel,
  SelectPortal,
  SelectRoot,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'inkra';
```

The `Select` compound alias contains `Root`, `Trigger`, `Value`, `Portal`, `Content`, `Viewport`, `Group`, `Label`, `Item`, `ItemText`, `ItemIndicator`, `ScrollUpButton`, `ScrollDownButton`, and `Separator`. Named exports and matching prop types remain available.

```tsx
<Field label="Region" description="Used for local defaults." required>
  <Select.Root defaultValue="north" name="region">
    <Select.Trigger>
      <Select.Value placeholder="Choose a region" />
    </Select.Trigger>
    <Select.Portal>
      <Select.Content
        position="popper"
        sideOffset={8}
        collisionPadding={12}
      >
        <Select.ScrollUpButton />
        <Select.Viewport>
          <Select.Group>
            <Select.Label>Available regions</Select.Label>
            <Select.Item value="north">
              <Select.ItemText>North</Select.ItemText>
              <Select.ItemIndicator />
            </Select.Item>
            <Select.Item value="south">
              <Select.ItemText>South</Select.ItemText>
              <Select.ItemIndicator />
            </Select.Item>
          </Select.Group>
        </Select.Viewport>
        <Select.ScrollDownButton />
      </Select.Content>
    </Select.Portal>
  </Select.Root>
</Field>
```

`SelectContent` preserves Radix's default `position="item-aligned"`. Use `position="popper"` when consuming `side`, `align`, offsets, collision boundaries, sticky positioning, or detached-anchor behavior.

## Behavior Contract

- `SelectRoot` directly preserves the Radix controlled and uncontrolled APIs: `value`, `defaultValue`, `onValueChange`, `open`, `defaultOpen`, and `onOpenChange`.
- Radix owns arrow-key navigation, Home/End, typeahead, Enter/Space selection, Escape and outside dismissal, modal focus management, selected-item focus, and focus return to the trigger. No local keyboard or dismissal state machine was added.
- Native form integration remains on Radix's hidden select. `name`, `form`, `autoComplete`, `required`, `disabled`, submitted value, bubbled user changes, autofill support, and reset-to-initial-value behavior are forwarded unchanged.
- `Field` state is merged at the root. Its label targets the real Radix trigger button; description and error IDs are merged into `aria-describedby`, invalid errors into `aria-errormessage`, and required/disabled/invalid state is reflected on the correct primitive.
- `SelectValue` supports placeholder content. String placeholders, custom string values, labels, and item text use the original `PencilText`; item text remains real DOM so Radix typeahead and native option collection read the same text.
- When an item changes Radix `data-highlighted` or `data-state`, `SelectItemText` remounts only its PencilText enhancement. The DOM fallback immediately inherits the new foreground and the canvas then repaints with that computed color instead of retaining stale ink.
- The trigger, selected/highlighted items, indicator, scroll controls, separator, and menu surface use `PencilSurface`, `PencilText`, `PencilIcon`, and `PencilLine` without replacing semantic DOM or intercepting input.

## Portal And Layering

`SelectRoot` participates in the shared `PortalThemeProvider`, the trigger uses the stable portal capture ref, and `SelectPortal` renders a `PortalThemeBridge` inside the Radix portal. Scoped theme tokens, attributes, direction, language, forced-colors behavior, and nesting depth therefore match Overlay and Popover.

When `dir` is not explicitly supplied, Select observes the Trigger's DOM ancestors and forwards their computed `ltr`/`rtl` direction into Radix. This avoids Radix's default `ltr` attribute overriding a scoped RTL container; an explicit Root `dir` remains authoritative.

The content z-index is `--inkra-z-popover + --inkra-floating-layer-offset`. A Select nested inside a top-level modal receives depth 1 and renders at layer 40, above the modal content layer 31. Same-depth siblings retain portal DOM order.

## Visual Contract

- Trigger sizes are `sm/md/lg`, with 36/44/48px visual surfaces and a minimum 44px interactive box. The trigger is full-width by default for Field composition.
- Trigger visuals use an outline PencilSurface, switching to danger for invalid state. Keyboard focus reveals a second focus-token PencilSurface rather than a CSS solid rectangle. Forced colors hides that canvas ring and restores a system solid outline. The default chevron is a PencilIcon and may be replaced or hidden through `icon`.
- Content uses a paper PencilSurface with configurable `seed`, `surfaceVariant`, `surfaceRadius`, and `surfaceClassName` while Radix Content retains semantics, focus and positioning refs.
- Items retain a 44px minimum row. Highlighted and selected rows reveal the selection wash and repaint their PencilText foreground; normal-mode item focus suppresses later global CSS outlines with a higher-specificity rule, while forced colors restores a system outline. The indicator uses logical positioning and works in RTL independently of child order.
- Reduced motion removes content animation and icon/wash transitions. Forced colors replace canvas-dependent boundaries and selection with system colors.

## Files

- `packages/inkra/src/select/Select.tsx`
- `packages/inkra/src/select/index.ts`
- `packages/inkra/src/select/styles.css`
- `packages/inkra/test/select.test.mjs`
- `packages/inkra/scripts/verify-select.mjs`
- `docs/phase2-select.md`

## Verification

- `node --test test/select.test.mjs`: 7/7 passed. Coverage checks the complete single-value API, Radix ownership, native form prop forwarding, Field association, portal theme capture, focus PencilSurface, item repaint observation, nested layer offset, stable geometry, reduced motion, and forced-colors fallbacks.
- Isolated strict TypeScript check passed for `src/select/Select.tsx` and `src/select/index.ts` with NodeNext, React JSX, strict mode and `verbatimModuleSyntax`.
- `npm run typecheck`: passed for the full package.
- `node scripts/verify-select.mjs`: passed against the live `http://127.0.0.1:4180` docs app without running a build. Normal trigger/item focus had no CSS solid outline; forced colors restored solid system outlines. Item canvas ink changed from average RGB `[17, 51, 85]` to `[220, 39, 150]`, matching the highlighted computed foreground `[220, 40, 150]`. Select nested in both Overlay and Popover inherited RTL and a scoped custom token, received layer offset `20`, and computed z-index `40` above parent layers `31` and `20` respectively.
- Progressive Skill Discovery at `http://127.0.0.1:4180/llms.txt` was unavailable because Vite history fallback returned the application HTML rather than a bootstrap document; the browser script uses only the user-supplied local origin and repository fixture.
- Radix 2.4.1 source was inspected to confirm its hidden native select, native option collection, form reset listener, user-change bubbling, detached closed-content collection, item-aligned/popper positioning, typeahead, scroll controls, Escape handling and focus restoration.
- Per coordination rules, this route did not run package build or package test because those scripts clear/rewrite shared `dist`.

## Limits And Coordinator Work

- This is a single-value select, not an editable combobox or multi-select.
- Field `readOnly` is not mapped because native select and Radix Select do not expose a read-only state. Use controlled value handling when an immutable submitted value is required; do not substitute disabled if the value must submit.
- Package root exports and style aggregation are already wired by the coordinator; this route did not edit those integration files.
- Integrated docs are present. Remaining coordinator acceptance includes controlled/uncontrolled form reset, required validation, name/form submission, disabled options, keyboard/typeahead, Escape/focus return, item-aligned and popper collision, long lists/scroll buttons, mobile touch and 200% text zoom. This route verified focus rendering, item canvas repaint, forced colors, nesting, scoped token propagation and RTL in a live browser.
- Build success remains separate from visual and browser acceptance.

coordinatorContinuationRequired=true

coordinatorMayComplete=false
