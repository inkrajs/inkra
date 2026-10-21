# Inkra Pencil Rendering Contract

Status: alpha implementation contract. Date: 2026-10-20.

This document defines the first reusable pencil-rendering API. The implementation is derived from the proven pressure, wash, paper, lettering, and icon rendering approach used by the New Zealand reference site, with travel-specific names and behavior removed.

## Shared Rules

- Canvas is decorative and always `aria-hidden` with `pointer-events: none`.
- Meaning, focus, events, layout, text selection, search, and copy remain in native DOM elements.
- `seed` accepts `string | number`. Equal inputs produce equal pigment sampling. Runtime time and `Math.random()` are never renderer inputs.
- Browser enhancement starts after semantic SSR markup exists. A missing font, unavailable canvas, oversized input, context loss, or async paint failure leaves the readable DOM fallback in place.
- Bitmap caches are bounded. Keys include the renderer version, normalized geometry or text, seed, actual CSS size, resolved color, effective DPR, and every material parameter that changes pixels.
- Resize, theme, DPR, or renderer-version changes invalidate only the affected key. Visibility restoration must not call a global cache clear.

## `PencilSurface`

```tsx
<PencilSurface
  as="section"
  variant="paper"
  seed="settings-panel"
  clipContent
>
  ...semantic content...
</PencilSurface>
```

Public props:

- `as?: React.ElementType`, default `div`
- `variant?: 'paper' | 'action' | 'quiet' | 'badge' | 'outline' | 'danger' | 'ghost' | 'selection' | 'wash' | 'full'`, default `paper`
- `seed?: string | number`
- `clipContent?: boolean`, clips content to the same sampled outline and draws the border above it
- Native props and refs for the selected element are forwarded

`paper`, `action`, `quiet`, `badge`, and `danger` combine the paper fibre texture, optional pressure-pencil wash, and sampled outline. FR7 keeps the original stroke spacing, roughness, inset, radius, taper, grain and exposed-paper technique while lowering theme-specific pigment density after composed-canvas sampling found unreadable dark regions. `action` now uses light/dark strengths `.20/.12`, and `quiet` uses `.12/.08`. `selection` remains a transparent canvas with no paper fill, outline, bleed or edge reach and retains `spacing=1.8`, `roughness=3.5`, `inset=2`, and `radius=8`, but its light/dark strengths are readability-adjusted to `.22/.14` instead of the historical `.32/.48`. Its pigment still comes from `--inkra-selection-pigment`, while content inherits `--inkra-selection-foreground`. These constants are conservative rendering inputs, not a contrast certification; integrated specimens must still sample final canvas pixels. `wash` remains a separate loose wash with transparent bleed, while `full` paints a full paper texture without an outline.

## `PencilText`

```tsx
<PencilText as="span" seed="save-label">Save changes</PencilText>
```

Public props:

- `children: string` (pure string only)
- `as?: React.ElementType`, default `span`
- `seed?: string | number`
- `ellipsis?: boolean`, applies native single-line ellipsis before pigment enhancement
- Native non-child props and refs for the selected element are forwarded

The DOM text is rendered immediately using the bundled `Trip Map Hand` subset with platform Kai and handwritten fallbacks. A high-resolution native glyph mask is then processed with the reference C lettering preset: `variation=.52`, `breaks=.18`, `outline=.96`, `fill=.34`, `grain=.45`. When the pigment canvas is ready, it visually overlays the same DOM text. Selection, copy, search, accessible names, wrapping, and layout remain owned by the DOM text.

## `PencilIcon`

```tsx
<PencilIcon
  aria-label="Close"
  paths={[{ d: 'M 8 8 L 24 24 M 24 8 L 8 24' }]}
  seed="close-icon"
/>
```

Public props:

- `paths: readonly PencilIconPath[]`
- `PencilIconPath = { d: string; mode?: 'stroke' | 'wash' | 'scuff' }`
- `seed?: string | number`
- `size?: number`, CSS pixel canvas size, default `40`
- `sourceSize?: number`, source path coordinate size, default `32`
- `active?: boolean`, adds the reference hand-drawn active underline
- `decorative?: boolean`, default `true`; set `false` with an accessible name when the icon itself conveys meaning
- Standard canvas props and ref are forwarded

Geometry is sampled from familiar SVG paths and deposited with the same pressure-pencil stroke renderer. `wash` clips pressure strokes inside a closed path; `scuff` uses a lighter dry stroke. Geometry and bitmap caches use normalized path content, not React child identity.

## `PencilLine`

```tsx
<PencilLine seed="section-divider" />
<PencilLine orientation="vertical" seed="sidebar-divider" />
```

Public props:

- `seed?: string | number`
- `orientation?: 'horizontal' | 'vertical'`, default `horizontal`
- `weight?: number`, default `1.2`
- `roughness?: number`, default `0.6`
- Standard canvas props and ref are forwarded

The line is an aria-hidden canvas drawn with the same distance-stable pressure, grain, breaks, and repeated-pass algorithm as surfaces and icons. Horizontal lines sample directly along the x axis; vertical lines sample directly along the y axis using their measured height. Vertical rendering does not rotate or scale a horizontal bitmap. Default CSS dimensions are `width:100%; height:8px` for horizontal and `width:8px; height:100%` for vertical. Forced-colors and print modes reduce the corresponding cross-axis to a one-pixel system-color divider.

## `Button`

The native button contract keeps `primary` and `md` as its defaults:

- `variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'`
- `size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon-xs' | 'icon-sm' | 'icon' | 'icon-lg'`
- `loading?: boolean`
- `disabled?: boolean`
- `seed?: string | number`
- `startIcon?: ReactNode`
- `endIcon?: ReactNode`
- Native button props and `HTMLButtonElement` ref
- Default `type="button"`

The outer native button owns the ref, ARIA, form attributes, events, focus, loading and disabled state. A pointer-inert inner `PencilSurface` owns only the visual geometry. Text sizes `xs/sm/md/lg` use visual heights `32/36/44/48px`, font sizes `12/13/15/17px`, and inline padding `12/16/20/24px`. The four icon sizes use the same height sequence as square visual surfaces. Every outer control occupies at least a `44px` hit area in normal layout, so the smaller visual surfaces do not rely on an overlapping pseudo-element.

`primary` uses the action wash and the paired `--inkra-on-accent` foreground, `secondary` uses the quieter wash, `outline` deposits only a colored-pencil outline, and `destructive` uses the danger pigment pair. Button labels use the normal `PencilText` rendering: after successful painting, the full-opacity pigment canvas supplies the visible lettering and the selectable DOM source becomes transparent. No solid glyph underlay or Button-specific canvas fading is applied. Initial, failed, forced-colors and print states retain readable native text. `ghost` has no permanent boundary but reveals a real quiet pencil surface on hover or keyboard focus with a `200ms` eased opacity transition; its CSS fallback animates background and border color over the same duration. Reduced-motion removes these transition durations. `link` has no button boundary and uses underlined pencil text. Loading keeps the label and icons in layout, adds an absolute spinner, sets `aria-busy`, and prevents repeat activation without changing width. String labels use `PencilText`; non-string children remain real DOM content.

## `ButtonLink`

`ButtonLink` accepts the same variants, sizes, icon slots, loading state and seed as `Button`, plus native anchor props and an `HTMLAnchorElement` ref. It always renders an `<a>` and never assigns `role="button"`. When disabled or loading, it sets `aria-disabled`, removes `href`, leaves no tab stop, and prevents primary, modified, auxiliary and keyboard activation. Enabled links preserve native anchor navigation and caller event handling.

## `ButtonGroup`

`ButtonGroup` renders a `div` with `role="group"`, forwards its `HTMLDivElement` ref and native attributes, and accepts `orientation?: 'horizontal' | 'vertical'`. Callers provide an accessible label with `aria-label` or `aria-labelledby`. It is not a toolbar, does not invent arrow-key behavior, and separates member pencil boundaries so adjacent controls do not produce a doubled outline. Buttons and links remain sibling native controls; the group never nests one interactive element inside another.
