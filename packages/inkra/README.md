# Inkra

Inkra is a pencil-styled React component library. It includes action, form, overlay, navigation, content and feedback components, plus Calendar, DayAgenda, JourneyMap and deterministic drawing primitives. The first `0.1.0` release is being prepared; this package is still an unpublished candidate unless a corresponding registry release has been announced.

Source and maintenance: [inkrajs/inkra](https://github.com/inkrajs/inkra).

## Installation

The package is prepared for npm-compatible installation, but this repository does not assume that a release has been published. In a workspace, depend on the local package according to the workspace package manager's conventions.

The manifest declares React 18 or newer as a peer dependency; release checks target React 18 and 19. ESM, TypeScript declarations, CSS and font assets are included. The release pipeline verifies SSR-to-browser hydration from the installed package, including form controls, portals, canvas recovery and the lazy-loaded map. Do not interpret the peer range as testing every future React version.

Inkra components require a React client boundary. Next.js and React Server Components are not a certified integration in 0.1.0; do not import interactive components directly into a Server Component. React 18 development SSR of Calendar still reports a layout-effect warning from react-day-picker 9; its browser hydration is checked separately. Applications requiring warning-free React 18 SSR should mount Calendar after hydration. Server and client must use matching locale, dates, values and theme inputs.

## Usage

Import the component styles once near the application entry point:

```tsx
import 'inkra/styles.css';

import { Button, ButtonGroup, ButtonLink, PencilLine, PencilSurface, PencilText } from 'inkra';

export function Actions() {
  return (
    <>
      <ButtonGroup aria-label="Document actions">
        <Button variant="primary" size="md" seed="save-action">
          Save changes
        </Button>
        <ButtonLink href="/preview" variant="outline">
          Preview
        </ButtonLink>
      </ButtonGroup>
      <div>
        <PencilLine seed="section-divider" />
        <PencilSurface variant="paper" seed="note-paper">
          <PencilText seed="note-title">Project notes</PencilText>
        </PencilSurface>
      </div>
    </>
  );
}
```

To use only the design tokens, import `inkra/tokens.css` instead.

## Button

`Button` forwards its ref and native button attributes. Its default `type` is `button`, so placing it inside a form will not submit unexpectedly.

```tsx
<Button variant="secondary" size="sm" onClick={handleCancel}>
  Cancel
</Button>

<Button loading seed="save-request">
  Save
</Button>
```

Supported Inkra props:

- `variant`: `primary`, `secondary`, `outline`, `ghost`, `destructive`, or `link`
- `size`: `xs`, `sm`, `md`, `lg`, `icon-xs`, `icon-sm`, `icon`, or `icon-lg`
- `loading`: marks the button busy and disables interaction
- `seed`: controls the deterministic hand-drawn decoration
- `startIcon` / `endIcon`: preserve logical icon placement in LTR and RTL layouts

All standard `button` props, including `disabled`, `name`, `value`, `form`, `aria-*`, and `data-*`, are passed to the native element.

`ButtonLink` renders a native anchor with the same visual props. Disabled or loading links remove their `href`, leave the tab order, expose `aria-disabled`, and block primary, modified, auxiliary and keyboard navigation. `ButtonGroup` renders `role="group"` with horizontal or vertical layout; provide `aria-label` or `aria-labelledby`. Icon-only controls use a square visual size and require an accessible name.

## Form Controls and Select

`Input` defaults to an underline appearance, with explicit `outline`, `soft` and `ghost` variants. It supports `startIcon`, `endIcon`, `prefix`, `suffix`, `clearable`, `loading`, `startAction`, `endAction`, `fullWidth` and logical `textAlign`. Use `onValueChange` for edits and clearing; native `onChange` does not receive fabricated clear events. `Field` connects labels, descriptions and errors.

`InputNumber` places decrease and increase buttons on either side of a centered numeric input, with no clear button. Keyboard deletion produces `null`; decimal stepping and out-of-range validation remain native. `Slider` supports single/range values, horizontal/vertical layout and `standard` or `inset` appearance.

`Select.Root` uses string values for single selection and string arrays with `multiple`. Multi-select remains open while toggling items and submits repeated values under the same field name. `Select.Clear` is a separate button; never nest it inside the trigger.

`Select.Trigger` supports `startIcon`, `endIcon`, `hideValue`, `hideIndicator`, `iconOnly`, `fullWidth` and `textAlign`. The existing `icon` prop replaces the dropdown indicator. Icon-only mode keeps a square hit target of at least 44px and retains selected text as an accessible description. Provide a Field/ARIA name and Tooltip for icon-only triggers. Decorative slots must not contain interactive controls.

`Select.Searchable` is a separate combobox API accepting `items` with `value`, `label`, optional `disabled` and `keywords`. `searchPlacement="trigger"` uses an editable input; `"popup"` places search inside the popup. It supports single/multiple values, filtering and clear controls. The compound Trigger appearance props do not implicitly apply to this separate API.

## Overlay Sections

`Overlay.Content layout="sections"` composes a fixed `Header`, a scrolling `Body`
and a fixed `Footer`. The default `layout="plain"` preserves the original padded
content layout. Keep the sections as direct children of Content.

```tsx
<Overlay.Root>
  <Overlay.Trigger asChild><Button>Edit note</Button></Overlay.Trigger>
  <Overlay.Portal>
    <Overlay.Backdrop />
    <Overlay.Content layout="sections">
      <Overlay.Header closeLabel="Close">
        <Overlay.Title>Edit note</Overlay.Title>
        <Overlay.Description>Update the note title.</Overlay.Description>
      </Overlay.Header>
      <Overlay.Body>{/* Fields or other dialog content */}</Overlay.Body>
      <Overlay.Footer>
        <Overlay.Close asChild><Button variant="outline">Cancel</Button></Overlay.Close>
      </Overlay.Footer>
    </Overlay.Content>
  </Overlay.Portal>
</Overlay.Root>
```

Header includes a pencil close button by default (`showClose={false}` hides it).
Localize its accessible name and tooltip with `closeLabel`; `action` adds extra
header controls. Header/Footer use pencil separators by default; disable each
with `divided={false}`. Footer `align` is `start | center | end` (default end) and
wraps actions when needed. `Overlay.CloseButton label="Close"` is also available
for custom layouts. Native attributes, handlers and refs are forwarded.

Keep a form inside Body and link Footer submit buttons with matching `form`/`id`
attributes. This preserves validation and submission without wrapping the
sections in another scroll container. Radix continues to manage Escape,
outside interaction, modal focus trapping and focus return.

## Navigation And Feedback

`Tabs` exposes `Root`, `List`, `Trigger` and `Content`. It supports controlled or default values, horizontal/vertical orientation, RTL, automatic/manual activation and disabled triggers. `Content forceMount` preserves child state while hiding inactive panels. The selected pigment draws in and erases out, with reduced-motion fallbacks.

`Root.size` accepts `sm | md | lg` (default `md`), and `Root.animated={false}` disables pigment animation. `List.align` accepts `start | center | end`, `List.fullWidth` distributes triggers equally, and `List.loop={false}` stops keyboard wrapping. `Trigger.startIcon` and `Trigger.endIcon` accept decorative React nodes; provide an accessible name for icon-only triggers. Small tabs keep a minimum 44px hit target.

`List.divided` adds pencil separators between adjacent triggers (default false), following horizontal or vertical orientation without changing keyboard navigation.

`Tooltip` exposes `Provider`, `Root`, `Trigger`, `Portal` and `Content`. Use it for supplementary non-interactive text, never as the only accessible name or essential instructions. Portal content inherits the trigger's theme.

`Accordion` exposes `Root`, `Item`, `Header`, `Trigger` and `Content`. Use `type="single"` with a string value or `type="multiple"` with a string array. Single mode accepts `collapsible`; both support disabled items and keyboard navigation.

```tsx
<Tabs.Root defaultValue="notes">
  <Tabs.List aria-label="Workspace">
    <Tabs.Trigger value="notes">Notes</Tabs.Trigger>
    <Tabs.Trigger value="drafts">Drafts</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="notes">Saved notes</Tabs.Content>
  <Tabs.Content value="drafts">Unpublished drafts</Tabs.Content>
</Tabs.Root>

<Badge variant="success">Saved</Badge>
<Separator decorative />
<Skeleton style={{ width: 200, height: 20 }} />
<Progress label="Uploading" value={60} />
<Progress aria-label="Loading" value={null} />
```

`Badge` variants are `neutral`, `accent`, `success`, `warning`, `danger` and `info`. `Separator` has horizontal/vertical orientation and a decorative opt-out. `Skeleton` is a static, aria-hidden placeholder; mark its loading container `aria-busy`. `Progress` clamps numeric values to `0..max` (default 100); `null` is indeterminate without a fabricated percentage. Always provide a progress label.

`Badge.size` accepts `sm | md | lg` with optional `startIcon` and `endIcon`. `Separator.weight` clamps to 0.3–2 (default 0.9). `Skeleton.radius` uses the existing 0–8px pencil corner contract. `Progress.size` selects a 12/16/24px track (`sm/md/lg`); `dir`, `aria-valuetext`, refs and native DOM attributes remain available. Tooltip exposes the underlying delay, alignment, collision and hoverable-content controls alongside `Content.surfaceRadius`.

## Menus And Content

`DropdownMenu` exposes `Root`, `Trigger`, `Portal`, `Content`, `Item`, `CheckboxItem`, `RadioGroup`, `RadioItem`, `Group`, `Label` and `Separator`. It supports controlled open state, placement/collision props, disabled items, keyboard navigation and focus return. Use `Trigger asChild` with a Button; use `Item.destructive` for dangerous actions. Portal content inherits the trigger theme. Submenus are not included yet.

`Alert.Root` accepts `variant="info | success | warning | danger"`, an optional decorative `icon`, and native attributes. Compose with `Alert.Title` and `Alert.Description`. The default `role="status"` is polite; explicitly use `role="alert"` only for urgent feedback.

`Avatar.Root` provides fixed `sm/md/lg` sizes (32/44/64px), with `Avatar.Image` and `Avatar.Fallback`. Images require `alt`; name meaningful fallback content with `role="img"` and `aria-label`. Fallback supports `delayMs` and appears when the image cannot load.

`Card` exposes `Root`, `Header`, `Title`, `Description`, `Content` and `Footer`. Root accepts `variant="paper | quiet | outline"`, `radius` (0-8px) and `seed`; Title accepts `as="h2 | h3 | h4 | h5 | h6"` (default h3). Native props and refs remain available.

`Table` exposes `Container`, `Root`, `Header`, `Body`, `Footer`, `Row`, `Head`, `Cell` and `Caption`, preserving native table semantics. Root accepts `density="compact | comfortable"`; `Row.selected` is visual emphasis only. Give the scrollable Container an accessible name and use a Caption and appropriate Head scope. Sorting, filtering, pagination and grid selection are not built in.

Content layout options preserve existing defaults:

- `Card.Root.size` and `Alert.Root.size` accept `sm | md | lg` for 12/16/24px padding (default md), without reducing text size.
- `Card.Root.divided` defaults to true; `Header.divided` and `Footer.divided` override it locally. `Header.action` accepts an independent action node. `Content.padding="none"` removes content padding for edge-to-edge content. `Footer.justify` accepts `start | center | end | between`, respecting text direction.
- `Alert.Root.appearance` accepts `soft | outline` (default soft). `actions` places actual controls after the message; it does not add automatic dismissal or focus changes.
- `Avatar.Root.radius` clamps to 0-8px, including pencil and image corners; `bordered={false}` removes the outline. `Avatar.Image.fit` accepts `cover | contain` (default cover).
- `Table.Root.striped`, `hoverable` and `stickyHeader` default to false. Constrain `Table.Container` with `style={{ maxHeight: 240 }}` for sticky scrolling. `captionSide` accepts `top | bottom`. `Head.align` and `Cell.align` accept logical `start | center | end`, retaining native alignment values for compatibility. Hover feedback does not imply row actions.

## Travel Components

`Calendar` wraps React DayPicker with default `appearance="itinerary"` day cards and optional `appearance="picker"`. It retains single/multiple/range selection, month control, disabled matchers, locale and keyboard navigation. Supply `selected` and `onSelect` for controlled selection. Events have independent `onEventSelect` handling; `displayRange` and `renderDayAccessory` customize the itinerary. Narrow itinerary grids retain seven columns and hide event text while preserving accessible names; picker targets remain at least 44px.

`DayAgenda` takes a local `date` (`YYYY-MM-DD`) and `AgendaEvent[]` with `id`, `title`, optional `description`, `startMinute` and `endMinute`. Minutes are relative to that day's midnight. Cross-day intervals show continuation; missing times remain pending and missing ends remain points. Its vertical timeline uses a piecewise scale for readable short events and separate lanes for overlaps. `selectedEvent`, `onEventSelect`, `onPreviousDay` and `onNextDay` provide interaction. Supply localized labels, `locale` and optional `timeZoneLabel`; no time zones or flight durations are inferred.

`JourneyMap` accepts `places`, optional GeoJSON `geography`, `routes`, `selectedPlace`, `onPlaceSelect` and required `attribution`. Place/route coordinates use latitude then longitude; GeoJSON retains longitude then latitude. Leaflet is loaded only in the browser. The map supports pan, zoom and reset, with an equivalent place-button list. It does not request location permissions, fetch map tiles, calculate routes or infer travel times. Demo geography is illustrative, not navigation data. Use `labels` to localize controls and failure feedback, and import `inkra/styles.css` for all required map styles.

## Pencil Primitives

`PencilSurface` renders pencil material behind semantic DOM content. Available variants are `paper`, `action`, `quiet`, `badge`, `outline`, `danger`, `ghost`, `selection`, `wash`, and `full`. Use `selection` for the transparent selected-tab wash; it intentionally has no paper fill, outline, or bleed.

`PencilText` keeps its string in the DOM for selection, copy, search, and assistive technology. Browser enhancement paints the same glyph geometry with the traced C lettering preset; unavailable canvas or font loading leaves the readable DOM fallback visible.

`PencilIcon` accepts familiar SVG path data and deposits pigment along sampled geometry. See `docs/pencil-contract.md` in the workspace for the current alpha contract.

`PencilLine` is an aria-hidden canvas decoration using the same pressure, grain, breaks, and repeated-pass renderer as surfaces and icons. It defaults to horizontal and supports a native vertical stroke without rotating a horizontal bitmap:

```tsx
<PencilLine seed="notes-divider" className="notes-divider" />
<PencilLine orientation="vertical" seed="sidebar-divider" className="sidebar-divider" />
```

## Font license

The package includes `Trip Map Hand`, a modified web subset of Yozai Light v0.868, under the SIL Open Font License 1.1. The font is not covered by Inkra's MIT software license. See `THIRD_PARTY_NOTICES.md` and `Yozai-OFL.txt` in the package.

## Development

```sh
npm run typecheck
npm test
npm run pack:check
```

`npm test` builds the package before running the SSR and determinism tests. `pack:check` prints the files that would be included without publishing anything.
