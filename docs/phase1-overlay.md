# Phase 1 Overlay Handoff

Date: 2026-10-20
Completed: 2026-10-20 22:06:08 CST (+0800)
Status: implementation complete in the owned route; coordinator integration pending.

## Scope

This route owns the first overlay foundations only: modal `Overlay` and non-modal `Popover`, backed by `@radix-ui/react-dialog` and `@radix-ui/react-popover`. Tooltip, Select, package manifests, root exports, root style aggregation, builds, publication and docs routes remain outside this route.

## Public API Draft

```tsx
import {
  Overlay,
  OverlayBackdrop,
  OverlayClose,
  OverlayContent,
  OverlayDescription,
  OverlayPortal,
  OverlayRoot,
  OverlayTitle,
  OverlayTrigger,
  Popover,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverPortal,
  PopoverRoot,
  PopoverTitle,
  PopoverTrigger,
} from 'inkra';
```

`Overlay` is a compound alias containing `Root`, `Trigger`, `Portal`, `Backdrop`, `Content`, `Title`, `Description`, and `Close`. The named exports remain available for direct imports and better tree shaking.

```tsx
<Overlay.Root open={open} onOpenChange={setOpen}>
  <Overlay.Trigger asChild>
    <Button>Open settings</Button>
  </Overlay.Trigger>
  <Overlay.Portal>
    <Overlay.Backdrop />
    <Overlay.Content seed="settings-dialog" aria-describedby="settings-description">
      <Overlay.Title>Settings</Overlay.Title>
      <Overlay.Description id="settings-description">
        Update the current workspace.
      </Overlay.Description>
      <Overlay.Close asChild>
        <Button variant="secondary">Close</Button>
      </Overlay.Close>
    </Overlay.Content>
  </Overlay.Portal>
</Overlay.Root>
```

`Popover` is a compound alias containing `Root`, `Anchor`, `Trigger`, `Portal`, `Content`, `Title`, `Description`, and `Close`. `PopoverContent` forwards Radix positioning and collision props, including `side`, `align`, `sideOffset`, `alignOffset`, `avoidCollisions`, `collisionBoundary`, `collisionPadding`, `sticky`, and `hideWhenDetached`.

```tsx
<Popover.Root>
  <Popover.Trigger asChild>
    <Button variant="outline">Filters</Button>
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content
      side="bottom"
      align="end"
      sideOffset={8}
      collisionPadding={12}
      seed="filter-popover"
      showArrow
    >
      ...semantic DOM content...
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
```

Both roots preserve Radix controlled and uncontrolled APIs. Dialog remains modal by default, so Escape, pointer-outside dismissal, focus trapping/restoration, scroll lock and nested layers are delegated to the mature primitive. Popover preserves Radix outside dismissal, Escape handling, focus restoration and collision positioning without inventing new keyboard behavior.

## Pencil Surface Contract

`OverlayContent` and `PopoverContent` keep Radix ownership of role, focus, dismissal events, positioning and refs on the outer content element. A pointer-neutral inner `PencilSurface variant="paper" radius={8}` owns paper texture and the colored-pencil boundary. Content remains semantic DOM and is never replaced by a screenshot or canvas.

Content props add:

- `seed?: string | number`
- `surfaceVariant?: PencilSurfaceVariant`, default `paper`
- `surfaceRadius?: number`, default `8`
- `surfaceClassName?: string`

`PopoverContent` additionally accepts `showArrow?: boolean`, default `false`, and `arrowProps?: PopoverArrowProps`. When enabled, the Radix arrow is rendered after `PencilSurface` as a direct child of Radix Content, so it participates in Popper positioning and cannot be clipped by the scrollable content body. A standalone arrow component is intentionally not exported.

`OverlayTitle`, `OverlayDescription`, `PopoverTitle`, and `PopoverDescription` require string children and accept an optional deterministic `seed`. The Radix title/description remains the semantic outer element and the original `PencilText` renders its visible lettering. Consumers own vertical rhythm, including the standard 4px title-to-description relationship, through their wrapper or `gap`; descriptions add no margin of their own.

## Portal Theme Bridge

The custom `Trigger` records its mounted DOM node. Each custom `Portal` wraps Radix portal children in a `display: contents` theme bridge that snapshots every computed `--inkra-*` custom property from the trigger, plus `data-theme`, `data-inkra-theme`, direction, language, color scheme and font family. Every trigger ancestor is observed for `class`, `style`, theme, direction and language attribute changes, preserving scoped themes after content moves under `document.body`.

When `forced-colors: active` changes on or off, the bridge refreshes dynamically. While it is active, semantic `--inkra-*` values are not copied inline, allowing the package forced-color selectors to win; theme attributes, font, color scheme and the layer offset remain bridged.

Each root receives a nesting depth. The portal bridge exposes `--inkra-floating-layer-offset: depth * 20`, which combines with `--inkra-z-popover` and `--inkra-z-modal`. A top-level modal uses backdrop/content layers 30/31, a popover nested in it uses 40, and a nested modal uses 50/51. Same-depth siblings retain portal DOM order.

No global account, browser, package publication or deployment action is required.

## Implementation

- `OverlayRoot` and `PopoverRoot` preserve the complete Radix controlled/uncontrolled API. Dialog remains modal by default; Popover preserves Radix's default non-modal behavior and accepts `modal` when the caller needs it.
- Trigger, close, title, description, backdrop and anchor refs/props are forwarded to their Radix primitives. The optional Popover arrow is emitted directly by `PopoverContent` after the surface. No local Escape, outside-click, focus-trap, focus-return, scroll-lock or collision engine was added.
- `OverlayContent` and `PopoverContent` leave Radix's semantic/focus element outside and render a real `PencilSurface` inside it. Default paper radius is `8px`; semantic children remain searchable/selectable DOM.
- Portal theme bridging copies every computed `--inkra-*` property from the trigger plus scoped theme attributes, direction, language, color scheme and the Inkra font. It observes every trigger ancestor and both OS color-scheme and forced-color changes while mounted. Forced colors bypass inline semantic tokens, and nested roots receive deterministic layer offsets.
- The trigger ref callback depends only on the stable capture function, not the changing theme snapshot, preventing ref detach/reattach churn during theme updates.
- Radix title/description nodes wrap the original `PencilText`; their string-only API keeps semantic text and deterministic canvas lettering aligned.
- `styles.css` provides modal backdrop, centered responsive dialog geometry, collision-sized popover geometry, nesting-aware z-indexes, token-based focus, motion/reduced-motion, forced-colors and print fallbacks. Normal mode has no CSS solid border; the visible content boundary comes from `PencilSurface`. Description margins are zero so consumer layout owns spacing.

## Files For Main Integration

- Add exports from `packages/inkra/src/overlay/index.ts` to the package root `src/index.ts`. This was not yet present at handoff time.
- Add `packages/inkra/src/overlay/styles.css` to the coordinator-owned style copy/aggregation path. This was not yet present at handoff time.
- Keep the already declared Radix dependencies in the coordinator-owned package manifest and lockfile.
- Run the coordinator-owned build/test only after all parallel component routes finish; this route will run package `typecheck` once dependencies are installed but will not run scripts that clean `dist`.

## Verification Evidence

- Isolated strict TypeScript check passed for `Overlay.tsx`, `Popover.tsx`, `themeBridge.tsx` and their imported package dependencies.
- `node --test test/overlay.test.mjs`: 7/7 passed. Coverage checks named/compound APIs, Radix ownership, PencilSurface and PencilText composition, safe direct-child arrows, Popover prop forwarding, all-ancestor observation, forced-color bypass, nesting-aware layers, stable trigger refs, reduced motion, focus treatment, zero description margins, and normal-mode absence of solid CSS borders.
- `npm run typecheck`: passed for the full package after the concurrent selection route completed its fixes.
- Per coordination rules, this route did not run the package build or package test script because those scripts clean/rewrite shared `dist`. Integrated runtime verification remains coordinator-owned after root exports and CSS aggregation land.

## Remaining Integration Checks

- Verify controlled and uncontrolled Overlay/Popover in the integrated docs or test harness: Escape, outside pointer dismissal, focus trap/return, modal scroll lock, nested dialog/popover layers, arrow positioning and collision flipping.
- Open from explicit scoped light and dark containers and confirm the portalled content's computed `--inkra-paper`, `--inkra-ink`, status tokens, `color-scheme`, direction and font match the trigger scope.
- Verify narrow viewport content scrolling, forced colors, reduced motion and a custom `container` portal.
- A controlled overlay rendered without any Trigger cannot infer a trigger-scoped theme; it will retain the package/global theme unless the caller portals into a scoped `container`. The standard compound usage includes a Trigger and receives the full bridge.

coordinatorContinuationRequired=true

coordinatorMayComplete=false
