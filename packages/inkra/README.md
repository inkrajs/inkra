# Inkra

Inkra is a pencil-styled React component library. It includes action, form, overlay, navigation, content and feedback components, plus Calendar, DayAgenda, JourneyMap and deterministic drawing primitives. This document describes the APIs shipped with this package; see the repository changelog and npm registry for release status.

Source and maintenance: [inkrajs/inkra](https://github.com/inkrajs/inkra).

Package name: `@inkra/react`. Import the scoped package and its stylesheet;
the unscoped `inkra` name is not this library's published package.

## Installation

The package is prepared for npm-compatible installation, but this repository does not assume that a release has been published. In a workspace, depend on the local package according to the workspace package manager's conventions.

The manifest declares React 18 or newer as a peer dependency; release checks target React 18 and 19. ESM, TypeScript declarations, CSS and font assets are included. The release pipeline verifies SSR-to-browser hydration from the installed package, including form controls, portals, canvas recovery and the lazy-loaded map. Do not interpret the peer range as testing every future React version.

Inkra components require a React client boundary. Next.js and React Server Components are not a certified integration in 0.1.0; do not import interactive components directly into a Server Component. React 18 development SSR of Calendar still reports a layout-effect warning from react-day-picker 9; its browser hydration is checked separately. Applications requiring warning-free React 18 SSR should mount Calendar after hydration. Server and client must use matching locale, dates, values and theme inputs.

## Usage

### Guided And Asynchronous Experiences

`Guide.Root`, `Guide.Trigger` and `Guide.Step` compose a targeted walkthrough.
`showSkip` exposes skipping; `onSkip` is separate from `onFinish`, so leaving
early never reports completion. Controlled `open` and `step`, target resolution,
focus restoration and localized labels are available.

`Loading` supports `inline`, `region` and `fullscreen` carriers with six layout
presets: `brand-center`, `scene-bottom`, `intel`, `staged`, `edge` and `skeleton`.
Supply real progress or `null` for indeterminate progress. The application owns
`status` and the cancel/retry/continue actions. Fullscreen blocking and scroll
locking can be configured independently; the edge preset is non-blocking by
default. Backgrounds, logos, stages, six logical content slots and rotating
ReactNode tips share the same component. Tips support manual navigation, pause,
controlled indices and sequential or non-repeating random rotation.

`InfiniteScroll` loads at `top`, `bottom`, `left` or `right` boundaries. Configure
automatic boundary loading and touch pull-and-release separately per direction;
buttons remain available for keyboard use. `onLoad` receives an abort signal,
direction and source. Stable item identities support anchored prepends, while
errors, retry, exhausted directions and in-flight requests remain explicit.

`Masonry` arranges measured items in shortest-column or sequential order while
retaining DOM order. It supports adaptive or fixed columns, independent gaps,
RTL and dynamic item sizes. Supply unique stable keys, image alternatives and
your own data fetching, optionally through `InfiniteScroll`:

```tsx
<InfiniteScroll
  directions="bottom"
  hasMore={hasMore}
  onLoad={({ signal }) => fetchNextPage(signal)}
  style={{ maxHeight: 640, overflow: 'auto' }}
>
  <Masonry
    items={items}
    getItemKey={item => item.id}
    minColumnWidth={220}
    renderItem={({ item }) => <article>{item.content}</article>}
  />
</InfiniteScroll>
```

These APIs are included in this source candidate. Local browser checks are not
real-device certification or a claim that this candidate has been published.

Import the component styles once near the application entry point:

```tsx
import '@inkra/react/styles.css';

import { Button, ButtonGroup, ButtonLink, PencilLine, PencilSurface, PencilText } from '@inkra/react';

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

To use only the design tokens, import `@inkra/react/tokens.css` instead.

## Theme Provider

```tsx
import '@inkra/react/styles.css';
import { ThemeProvider } from '@inkra/react/theme';
import type { InkraThemeTokens } from '@inkra/react/theme';

const tokens = {
  '--inkra-accent': '#4b96aa',
  '--inkra-icon-stroke-width': '1.5px',
} satisfies InkraThemeTokens;

<ThemeProvider theme="auto" tokens={tokens}>
  <App />
</ThemeProvider>
```

`ThemeProvider` is also exported from the package root. It renders a local `div`
scope, accepts its normal HTML attributes and forwards its ref. It never changes
the document theme or stores a preference. `theme` supports `light`, `dark`, and
`auto`; omit it to inherit the surrounding CSS theme. Auto uses native CSS media
queries and works with SSR without resolving the system preference in JavaScript.

`tokens` accepts partial `--inkra-*` variables for color, fonts, geometry and
pencil rendering. Supply units for lengths (`"1.5px"`); unitless numbers work for
intensity and similar values. An inner scope without `theme` inherits outer
tokens; an explicit mode establishes that mode's built-in variables before local
overrides. `style` takes precedence over `tokens`. User token overrides are
suspended while forced colors are active so the system palette can take over.

Custom colors do not automatically adapt to light/dark modes. Supply appropriate
variables for each mode, or use CSS media queries. Existing component portals
inherit the trigger scope and track its live changes. The scope has no default
background or spacing; use a surface or your own layout when needed. It composes
with `InkraProvider` for language configuration without changing input state.

## Internationalization

Wrap your application in `InkraProvider` to localize component-owned copy and
accessible labels. Built-in dictionaries are `en`, `zh-CN`, `ja`, `ko`, and `fr`.
All five share the same typed keys. Regional tags such as `en-GB`, `ja-JP`,
`ko-KR`, `fr-CA` and `zh-Hans-CN` select the matching language while keeping
regional date/number formatting. No provider preserves the English defaults.

```tsx
import { InkraProvider, Input, Pagination } from '@inkra/react';
import type { InkraDictionary } from '@inkra/react/i18n';

const messages = {
  'input.clear': 'Clear note',
  'pagination.page': 'Open page {page}',
} satisfies InkraDictionary;

<InkraProvider locale="fr-CA" messages={messages}>
  <Input clearable defaultValue="My note" aria-label="Note" />
  <Pagination totalPages={5} />
</InkraProvider>;
```

`messages` is a partial dictionary; developers can import JSON or adapt their
existing i18n resource into these flat keys. Inspect `inkraLocales.en` for the
complete key list and source templates, or copy another built-in dictionary.
The provider, dictionaries, types, `useInkraLocale` and
`createInkraTranslator` are also exported from `@inkra/react/i18n`.

- Precedence: explicit component labels/props, inner provider overrides, inherited
  overrides, then the built-in dictionary. Unknown languages use English copy
  while valid `Intl` locale formatting is preserved. Invalid locale strings use `en-US`.
- Nested providers merge by key, even when the inner locale changes. Pass the
  desired override dictionary on language changes; inherited overrides are intentional.
- `undefined` entries do not override; empty strings do. Avoid empty accessible
  labels on interactive controls. Use `satisfies InkraDictionary` to catch key typos.
- Preserve template placeholders such as `{page}`, `{count}` and `{label}`.
  Interpolation is a single literal-text pass, not HTML, ICU, or executable code.
  Missing placeholder values are left visible rather than silently removed.
- Explicit component `locale` props take priority over the provider. Calendar
  also retains its DayPicker locale/labels/formatters API. NumberTicker's
  explicit compact-unit policies remain independent of regional number formatting.
- Language and dictionary updates do not remount children or clear form drafts.
  The provider adds no HTML wrapper and does not mutate the document language.
  Set `lang` on your page or locale-scoped container; set `dir` separately if needed.
- Application labels, option content, errors supplied by your application, and
  stored/submitted values are not automatically translated. InkraProvider also
  passes its locale to React Aria's internal announcements; third-party/native
  messages are not keys in the Inkra dictionary.
- Use identical locale/dictionary data for SSR and hydration. Messages may change
  after hydration; the provider does not read browser language or local storage.

```tsx
import { InkraProvider, inkraLocales } from '@inkra/react/i18n';

const customLanguage = { ...inkraLocales.en, 'input.clear': 'Effacer la note' };

<InkraProvider locale="fr" messages={customLanguage}>
  {children}
</InkraProvider>;
```

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

`Textarea` respects an explicit native `rows`, including `rows={1}`. Omit both
`rows` and `autoSize` to retain the existing sm/md/lg minimum heights. Enable
`autoSize` to grow and shrink with content, including lines wrapped by the actual
container width:

```tsx
import { Textarea } from '@inkra/react/form';
import type { TextareaAutoSizeOptions } from '@inkra/react/form';

<Textarea rows={1} aria-label="Single-line initial height" />
<Textarea autoSize={{ minRows: 1, maxRows: 6 }} aria-label="Note" />
<Textarea autoSize rows={2} aria-label="At least two rows, unlimited growth" />
```

`autoSize` accepts `boolean | TextareaAutoSizeOptions` and defaults to `false`.
Its `minRows` falls back to `rows`, then 1; omit `maxRows` for unlimited growth.
Both limits accept positive safe integers; invalid values use these defaults and
`maxRows` below `minRows` is raised to `minRows`. The limit counts visible text
rows, including soft wraps, rather than newline characters or input length.
Above the maximum, the native editor scrolls internally; deleting text shrinks it.
Controlled value updates, native form reset, width and font changes remeasure
without emitting change events or replacing the native control. Empty editors
size from their minimum rows rather than their placeholder text.

Automatic sizing owns `height`, `minHeight`, `maxHeight` and vertical overflow;
it takes precedence over inline height and `resize="vertical"`, hiding the manual
handle. With automatic sizing disabled, manual resizing keeps its existing
behavior (an explicit `rows` supplies its minimum). Row limits apply only to the
editor: the character counter retains its separate footer, even while its
automatic indicator is hidden. On the server, native `rows` provides the initial
height; existing multi-line content is measured after hydration. Avoid CSS
`!important` height constraints when enabling automatic sizing.

`InputNumber` places decrease and increase buttons on either side of a centered numeric input, with no clear button. Keyboard deletion produces `null`; decimal stepping and out-of-range validation remain native. `Slider` supports single/range values, horizontal/vertical layout and `standard` or `inset` appearance.

`InputNumber` supports Shift-click and Shift-arrow increments of 10 by default.
Use `stepModifiers={[{ shiftKey: true, step: 10 }, { altKey: true, step: 0.1 }]}`
to configure exact modifier chords with absolute increments, or `[]` to disable
overrides. The first valid matching rule wins; unspecified modifiers must be
released. Values remain bounded by `min`/`max`; `step="any"` disables stepping.
`pressAndHold` defaults to true, with `repeatDelay={400}` and
`repeatInterval={80}` in milliseconds. Release, cancellation, blur, backgrounding,
disabling and value boundaries stop repetition. Delay/interval are bounded to
150-60000/32-60000 ms. Numeric values use pencil lettering at rest and during
button stepping. Direct text entry deliberately stays native until blur, keeping
browser-owned incomplete drafts such as `-`, `1.` and `1e` readable.

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
<Progress shape="circular" value={72} diameter={128} thickness={6} aria-label="Download">
  {({ percent }) => `${Math.round(percent ?? 0)}%`}
</Progress>
<Progress shape="circular" value={3} max={5} contentPosition="end" label="Files">
  <span>3 / 5 files</span>
</Progress>
```

`Badge` variants are `neutral`, `accent`, `success`, `warning`, `danger` and `info`. `Separator` has horizontal/vertical orientation and a decorative opt-out. `Skeleton` is a static, aria-hidden placeholder; mark its loading container `aria-busy`. `Progress` clamps numeric values to `0..max` (default 100); `null` is indeterminate without a fabricated percentage. Always provide a progress label.

`Badge.size` accepts `sm | md | lg` with optional `startIcon` and `endIcon`. `Separator.weight` clamps to 0.3–2 (default 0.9). `Skeleton.radius` uses the existing 0–8px pencil corner contract. `Progress.size` selects a 12/16/24px track (`sm/md/lg`); `dir`, `aria-valuetext`, refs and native DOM attributes remain available. Tooltip exposes the underlying delay, alignment, collision and hoverable-content controls alongside `Content.surfaceRadius`.

Circular Progress uses a grainy pencil arc with naturally tapered ends and an
empty gap for the remaining progress.
`size` selects a 64/96/128px diameter; `diameter` overrides it (32-512px), and
`thickness` sets the base stroke width (1-diameter/8px, affected by global stroke
settings). `children` accepts non-interactive icons/text or a render function
receiving normalized `{ value, max, percent }`; unknown value/percent are null.
`contentPosition` supports `center`, `top`, `bottom`, `start`, and `end`; logical
sides follow RTL. Circular defaults to center, linear to end (including explicit
center). Keep center content short; longer descriptions belong outside the ring.
Always supply a label or ARIA name, even for icon content. Progress updates reveal
the existing texture; only unknown progress rotates, respecting reduced motion.
Canvas failures, forced colors and printing retain an SVG progress fallback.

## Menus And Content

`Breadcrumb` exposes `Root`, `List`, `Item`, `Link`, `MenuTrigger`,
`ContextLink`, `Page` and `Separator`. `Link` renders a real anchor and defaults
to the pencil-underlined `link` appearance; `startIcon` and `endIcon` occupy the
logical sides and follow RTL. `Page` accepts the same icon slots. Page, link and
menu-trigger content share a 44px default hit height, 15px text, 20px icon slot,
8px gap and 12px logical padding so a header can change item semantics without
moving its baseline. Disabled links remove `href` and leave the tab order. Use
`MenuTrigger` inside `DropdownMenu.Root` for an item that selects another path,
and `ContextLink` inside `ContextMenu.Root` for pointer, keyboard and optional
long-press actions without adding a second focus target.

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

## Additional Components

These exports extend the original core component set. The documentation playground includes
working examples, live property tabs and per-component API/accessibility notes.

| Component | Contract |
| --- | --- |
| Toast | `Provider`, `useToastManager`, `createToastManager`; add/update/close/promise notifications, named actions and timer pause managed by Base UI |
| AlertDialog | Always-modal confirmation; `Root`, `Trigger`, `Portal`, `Backdrop`, `Content`, `Header`, `Body`, `Footer`, `Title`, `Description`, `Cancel`, `Action`; pending blocks user dismissal, async actions use `closeOnAction={false}` |
| Drawer | Dialog parts plus section layout, four `Content.direction` values and token/custom `size`; focus trap, Escape and return focus, no swipe gesture API |
| DatePicker | Calendar/Popover composition; single/range local dates, controlled/default values, clear, form fields and localized labels; no UTC conversion |
| TimePicker | Native time input with clear, disabled/readOnly, min/max/step and optional seconds; browser/OS controls the native presentation |
| Pagination | Page count/current page, boundary actions and ellipses; optional page-size selection, button variants, logical alignment and wrapping |
| Empty | Optional `Root`, `Icon`, `Title`, `Description`, `Actions`; no mandatory card or live-region role |
| ToggleGroup | `Root` and `Item`; array values for single/multiple toggles, roving focus and `aria-pressed`, not tabs |
| Command | cmdk-backed search, grouped commands, empty/disabled states and optional modal composition |
| Upload | File selection/drop, type/size/count rejection, removal, progress, cancel and retry; application transport receives `AbortSignal` and `reportProgress` |
| DataTable | Typed columns, required stable `getRowId`, sorting, filtering, pagination, selection, empty/loading state; native table semantics |
| Tree | `Root`, `Item`, `ItemContent`, `ItemTitle`, `ItemDescription`; stable keys, expansion and selection via React Aria; no drag/drop |
| Steps | Ordered `items`, `current`, orientation and optional `onStepChange`; status and disabled steps |
| Timeline | Ordered `items` with date/title/description/content, semantic `dateTime` and horizontal/vertical orientation |

### Pagination page sizes

```tsx
const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(20);
<Pagination totalPages={Math.ceil(itemCount / pageSize)}
  page={page} onPageChange={setPage}
  pageSize={pageSize} onPageSizeChange={setPageSize}
  pageSizeOptions={[10, 20, 50]} hideOnSinglePage
  variant="outline" align="end" wrap />
```

The caller computes `totalPages` and slices or fetches its data. `pageSize` is
controlled; `defaultPageSize` initializes an uncontrolled size (default `10`).
Only positive safe integers are accepted. Invalid sizes fall back to `10`;
invalid options are ignored, duplicates removed and options sorted numerically.
The current size is retained in a nonempty option list. Omit `pageSizeOptions`
or provide no valid options to hide the selector.

Selecting a different size first calls `onPageSizeChange(size)`, then requests
`onPageChange(1)` when the current page exceeds one. Each uncontrolled state
updates independently; controlled state changes only when the parent accepts
the request. Rendering, changing totals or options, and clamping do not emit
user callbacks. `hideOnSinglePage` hides page controls for zero or one page while
retaining the size selector.

`variant` uses the Button variants (default `ghost`). `align` accepts logical
`start | center | end` (default `start`); `wrap` defaults to `false` and retains
local horizontal scrolling. The size selector reuses Select, inherits disabled
state and direction, and uses InkraProvider labels. Override
`labels.pageSize` (accessible name) and `labels.pageSizeOption(size)` (visible
option text) for application-specific copy. `simple`, `renderPage` and
`renderSummary` compose with these options.

分页容量由调用方计算总页数并切分或请求数据。`pageSize` 为受控值，
`defaultPageSize` 为非受控初值，默认 10；只接收正安全整数。非法容量回退为
10，非法选项忽略，选项去重并排序，有效列表保留当前容量。省略或提供空的有效
选项列表时不显示选择器。切换容量先通知 `onPageSizeChange`，当前页大于 1 时
再请求 `onPageChange(1)`；受控值由父组件决定是否接受。渲染、总页数及选项变化
不触发交互回调。`hideOnSinglePage` 隐藏翻页按钮但保留容量选择器；`align`
按逻辑方向对齐，`wrap` 允许换行，默认仍为局部横滚。容量选择复用 Select，
继承禁用、方向和语言设置，可用 `labels.pageSize/pageSizeOption` 覆盖文案。

## Utility Components (Unreleased)

`Slot` is a fixed square visual container for arbitrary icons or content. Static
slots render a `div`; `interactive` slots render one native button with
`aria-pressed` selection and native Enter/Space behavior. `empty` preserves
geometry, `count` reuses Badge, and `renderCount` keeps custom rendering at the
logical corner. Keep nested controls out of interactive slots. Slot does not
implement equipment rules, rarity, sorting or drag and drop.

`Hotkey` formats shortcut values for Mac or Windows. `HotkeyInput` records only
while its native input is focused, supports controlled/uncontrolled values,
clear, Escape cancellation, read-only/disabled states, IME safeguards and
caller-owned conflict validation. It does not register global shortcut listeners
or suppress browser shortcuts.

`NumberTicker` formats values with `Intl.NumberFormat`, optionally animates from
the currently displayed frame, and can show a temporary signed delta. Reduced
motion and SSR show deterministic final values. Intermediate frames are visual;
the polite announcement updates only at the final value. Use `getValueLabel`
when units or custom rendering need a complete accessible phrase.

Use `animation="roll"` for vertical, place-aligned digit reels. Integers align
from the right and fractions from the decimal point; carry, multiplication,
shrinking values and sign changes expand or collapse the affected columns.
Grouping, signs, currency and compact units remain formatted text, not digit
reels. `rollDirection="auto"` rolls up for increasing values and down for
decreasing values; `up` or `down` fixes the direction. `duration` and `easing`
apply to both modes. The default `animation="count"` retains value interpolation.
`renderValue` takes precedence over the built-in reels. Changing the formatting
or animation mode settles immediately, as do disabled/reduced motion, invalid
durations, and transitions with more than 128 formatted tokens. Exact strings
and bigint values retain their original precision in either mode.

```tsx
<NumberTicker value={amount} animation="roll" rollDirection="auto" duration={650} />
```

Set `compact` to follow `locale` (Chinese units for `zh`, English units otherwise),
or use `compact="en"` / `compact="zh"` to select a unit table explicitly.
English uses this library's short-scale suffix convention: K, M, B, T, Qa, Qi,
Sx, Sp, Oc, No, Dc (10^3 through 10^33, increasing by 10^3).
Chinese uses 千 (10^3), then 万, 亿, 兆, 京, 垓, 秭, 穰, 沟, 涧, 正, 载, 极,
恒河沙, 阿僧祇, 那由他, 不可思议, 无量大数 (10^4 through 10^68, increasing by 10^4).
`numberTickerUnits` exports both tables. A space separates numbers and units by default.
The default is `false`, preserving existing `formatOptions` behavior. Compact mode
uses at most one fractional digit by default; customize precision with
`formatOptions`. Explicit scientific/engineering notation takes priority over compact.
Currency/percent affixes are preserved. By default rounding can promote the unit
(999,950 becomes 1 M). Deltas use the same unit
system with their own precision; announcements and `getValueLabel` receive the
unabbreviated formatted value. `renderValue` receives the abbreviated value in
`details.formattedValue`. NumberTicker never changes the supplied numeric value.

`compactOptions` supports:

- `minUnit` / `maxUnit`: allowed unit labels; equal bounds fix the unit. An empty
  label denotes the unitless base. For example `maxUnit: '万'` keeps 10^8 as `10,000 万`.
- `separator`: defaults to one space; `''` removes it.
- `promotionThreshold`: positive multiplier on each unit's factor (default 1).
  Set 10 to wait until 10,000 before entering K. `promoteAfterRounding: false`
  compares raw magnitudes instead of rounded current-unit values.
- `units`: replace the table with `{ factor, label, threshold? }` entries.
  `threshold` overrides the multiplier with an absolute display-magnitude trigger;
  e.g. `{ factor: 10000, label: '万', threshold: 100000 }`. Binary factors work too.
  Entries are sorted without mutation; labels/factors must be unique, factors > 1,
  and thresholds positive, finite and strictly increasing. Invalid configurations
  and unknown/reversed bounds throw RangeError. The unitless base is implicit.
- `overflow`: `unit` keeps the largest permitted unit; `scientific` switches at
  the next unit's threshold (or extrapolates the last step at the table end).
  Explicit `maxUnit` defaults to `unit`; otherwise the default is `scientific`.

Use `formatOptions.notation: 'scientific' | 'engineering'` for exponent notation.
`maximumFractionDigits` controls decimals, `minimumFractionDigits` pads zeros,
and `roundingMode: 'trunc'` truncates instead of rounding (`halfExpand` is default).
Other Intl rounding modes are supported when provided by the runtime; unsupported
nondefault rounding modes throw rather than silently round differently.
`value`, unit `factor` / `threshold`, and `promotionThreshold` accept
`number | bigint | string`. Use bigint for exact integers and decimal strings for
exact fractions or exponents beyond JavaScript's numeric range. Already-rounded
`number` inputs cannot regain lost digits. Decimal arithmetic uses an isolated
`decimal.js` context without modifying the application's Decimal settings.

```tsx
<NumberTicker value={9007199254740993n} showDelta />
<NumberTicker value="12345678901234567890.123456" formatOptions={{ maximumFractionDigits: 6 }} />
<NumberTicker value="1.23456789e1000" formatOptions={{ notation: 'scientific' }} />
```

Strings accept signs, decimal points, e/E exponents and outer whitespace, but
not grouping separators, hex, empty strings or non-finite spellings. Inputs are
bounded to 10,000 coefficient digits and written/normalized exponents within
-10,000..10,000; invalid or oversized exact inputs throw `RangeError`. Decimal
fractions require exact Intl decimal-string support in the runtime; unsupported
engines throw rather than silently lose precision. Native number NaN/Infinity
formatting is unchanged.

`renderValue` and `getValueLabel` retain the input type; prefer the supplied
formatted text when custom rendering. Deltas between bigints are bigint, between
numbers are number, and mixed/string deltas are exact decimal strings. Bigint
animation frames stay integral. Input-type changes or exact arithmetic spanning
more than 512 digits settle immediately, as do reduced-motion updates.
`createNumberFormatter` remains a native Intl formatter; use
`formatTickerValue(formatter, value)` for precise numeric-string formatting.

`prefix` and `suffix` accept icons, text or fragments. Pass `PencilIcon` to keep
the library material, and `getValueLabel` to describe icon meanings to assistive
technology; decorative affixes are not announced twice.

`Log` renders caller-ordered records with stable ids, optional level filters and
pause/follow controls. It follows only append updates while the viewport remains
near the bottom. The named scroll region supports Home/End and intentionally is
not a live region, so a long stream is not repeatedly announced. Log does not
provide persistence, virtualization or transport.

Upload does not send files anywhere unless the application supplies `onUpload`.
Without a transport, files remain selected, not successfully uploaded. Client
validation is a convenience; the receiving server must validate files itself.
DataTable does not replace `Table` and does not promise virtualization, cell
editing or server-side transport. Tree is not a file-system permission boundary.
All examples use public sample data.

## Travel Components

`Calendar` wraps React DayPicker with default `appearance="itinerary"` day cards and optional `appearance="picker"`. It retains single/multiple/range selection, month control, disabled matchers, locale and keyboard navigation. Supply `selected` and `onSelect` for controlled selection. Events have independent `onEventSelect` handling; `displayRange` and `renderDayAccessory` customize the itinerary. Narrow itinerary grids retain seven columns and hide event text while preserving accessible names; picker targets remain at least 44px.

`DayAgenda` takes a local `date` (`YYYY-MM-DD`) and `AgendaEvent[]` with `id`, `title`, optional `description`, `startMinute` and `endMinute`. Minutes are relative to that day's midnight. Cross-day intervals show continuation; missing times remain pending and missing ends remain points. Its vertical timeline uses a piecewise scale for readable short events and separate lanes for overlaps. `selectedEvent`, `onEventSelect`, `onPreviousDay` and `onNextDay` provide interaction. Supply localized labels, `locale` and optional `timeZoneLabel`; no time zones or flight durations are inferred.

`JourneyMap` accepts `places`, optional GeoJSON `geography`, `routes`, `selectedPlace`, `onPlaceSelect` and required `attribution`. Place/route coordinates use latitude then longitude; GeoJSON retains longitude then latitude. Leaflet is loaded only in the browser. The map supports pan, zoom and reset, with an equivalent place-button list. It does not request location permissions, fetch map tiles, calculate routes or infer travel times. Demo geography is illustrative, not navigation data. Use `labels` to localize controls and failure feedback, and import `@inkra/react/styles.css` for all required map styles.

## Pencil Primitives

`PencilSurface` renders pencil material behind semantic DOM content. Available variants are `paper`, `action`, `quiet`, `badge`, `outline`, `danger`, `ghost`, `selection`, `wash`, and `full`. Use `selection` for the transparent selected-tab wash; it intentionally has no paper fill, outline, or bleed.

`PencilText` keeps its string in the DOM for selection, copy, search, and assistive technology. Browser enhancement paints the same glyph geometry with the traced C lettering preset; unavailable canvas or font loading leaves the readable DOM fallback visible.

`PencilIcon` accepts familiar SVG path data and deposits pigment along sampled geometry.
Use `size` for the displayed canvas size (default 40px), `strokeWidth` (0.3-3,
default 1.5), `intensity` (0-1, default 1), `breaks` (0-1, default 0.18),
`pressureVariation` (0-1, default 0.82), and `breakCount` (integer 0-12, default 1).
The gap count is a maximum: short displayed paths use fewer or no gaps, while
larger icons can use more up to that limit. Device pixel ratio does not change
the count. Zero breaks or zero breakCount removes intentional gaps; zero pressure
variation keeps constant pressure without removing the grain or endpoint taper.
The matching inherited tokens are `--inkra-icon-stroke-width`,
`--inkra-icon-intensity`, `--inkra-icon-breaks`, `--inkra-icon-pressure-variation`
and `--inkra-icon-break-count`. Finite explicit props override those tokens.
See `docs/pencil-contract.md` in the workspace for the material contract.

Icons support `variant="outline"` (default) and `variant="filled"`. Filled icons
keep holes and internal marks transparent, join overlapping silhouettes and do
not close open arrows or checks into polygons. Set `fillColor` independently of
the contour's CSS `color`; it defaults to `currentColor` and accepts CSS variables.
The silhouette stays continuous while stroke controls affect its exterior.

```tsx
<PencilIcon paths={folderPaths} variant="filled" fillColor="var(--folder-color)"
  sourceSize={24} size={32} style={{ color: 'var(--inkra-ink)' }} />
```

Supply `filledPaths` when a shape needs a dedicated filled silhouette. Each path
can use `mode: 'fill'` with an optional `color` for independently colored regions,
or `mode: 'cutout'` for transparent details. Closed cutouts remove an area; open
cutouts remove a stroke without implicitly closing it. Explicit fills accept
`fillRule: 'nonzero' | 'evenodd'` (default `nonzero`). These authored regions do
not add their own contour stroke. For lighter colored-pencil regions, use
`mode: 'wash'` with the same optional `color` and `fillRule`: paper remains visible
between pigment strokes, with a light pencil edge in the icon's CSS `color`.
Dense `fill` regions are unchanged.
Explicit `mode: 'stroke'` keeps a line symbol
even when its path closes; omitted mode detects filled silhouettes automatically.
An empty `filledPaths` intentionally hides the
base shape in filled mode. `badge` accepts the same three props and inherits the
base variant and fill color unless overridden. Intensity applies once to the
completed image, including its fills, exterior strokes and badge.

`PencilLine` is an aria-hidden canvas decoration using the same pressure, grain, breaks, and repeated-pass renderer as surfaces and icons. It defaults to horizontal and supports a native vertical stroke without rotating a horizontal bitmap:

```tsx
<PencilLine seed="notes-divider" className="notes-divider" />
<PencilLine orientation="vertical" seed="sidebar-divider" className="sidebar-divider" />
```

### Rendering tokens

`ThemeProvider` accepts typography through `tokens`. Set
`--inkra-font-hand`, `--inkra-font-body` and `--inkra-font-display` to CSS font
stacks (load your chosen font separately). Set `--inkra-letter-effect: 0` to
display plain selectable text in that font, without the pencil canvas.
The default is 1 (enabled). This inherited toggle preserves all lettering
parameters and does not affect icons, surface fills or borders.

```tsx
<ThemeProvider tokens={{
  '--inkra-font-hand': '"Inkra Xiaolai", cursive',
  '--inkra-font-body': '"Inkra Xiaolai", cursive',
  '--inkra-font-display': '"Inkra Xiaolai", cursive',
  '--inkra-letter-effect': 0,
}}>
  <Button>普通字体效果</Button>
</ThemeProvider>
```

`PencilText` reads `--inkra-letter-variation`, `--inkra-letter-breaks`,
`--inkra-letter-outline`, `--inkra-letter-fill`, and `--inkra-letter-grain` from
its computed style. Values are clamped to 0-1; missing or invalid values use the
default Xiaolai lettering preset (0.10, 0.31, 0.44, 0.85, 0.40 respectively, revised 2026-10-28). Apply these tokens to an ancestor to customize all
text within that scope without changing layout, selectable text, or labels.

`PencilLine` reads `--inkra-stroke-width` (0.3-3) and
`--inkra-stroke-amplitude` (0-4) when `weight` or `roughness` is omitted.
Explicit props take precedence. These tokens also scale surface outlines,
including button/card/input borders. Icon weight uses its independent token;
the general amplitude token still controls icon roughness.
The default values are 2 and 1.5. They do not change layout or text lettering.

Surface fills read `--inkra-wash-strength` (0-1, default 0.8),
`--inkra-wash-spacing` (1-6, default 2), `--inkra-wash-roughness` (0-6,
default 3), and `--inkra-wash-angle` (-85 to 85 degrees, default -45).
Strength scales each variant's original light/dark pigment intensity relative to
the original 0.48 reference. These settings affect button fills, selections
and swatches, not paper or lettering. Selection reveals follow the chosen angle.

Only self/ancestor appearance changes invalidate decoration, not unrelated theme
subtrees. Unchanged computed paint settings are reused, including when a dialog
changes body pointer events or scroll locks. Rendering settings are part of the
bounded texture cache keys. No page remount is needed. Forced-color, print, and
unavailable-canvas fallbacks remain intact.

## Font license

The default font is Xiaolai SC Regular v3.120, registered as `Inkra Xiaolai`.
Common and extended characters are separate WOFF2 resources loaded through
`unicode-range`. Override `--inkra-font-hand` to choose another font; the source
text and canvas use the same computed family. The package also retains
`Trip Map Hand`, a web subset of Yozai Light v0.868, for compatibility.
Both fonts use SIL OFL 1.1, separately from Inkra's MIT software license.
See `THIRD_PARTY_NOTICES.md`, `Xiaolai-OFL.txt` and `Yozai-OFL.txt`.

## Development

```sh
npm run typecheck
npm test
npm run pack:check
```

`npm test` builds the package before running the SSR and determinism tests. `pack:check` prints the files that would be included without publishing anything.

## Slider endpoints and circular dragging

Slider and RangeSlider use `thumbAlignment="edge"` by default: the thumb center
reaches either end of the track. Set `thumbAlignment="contain"` to keep the
previous inset positioning. This setting is independent of the visual variant.

`CircularSlider` is an optional single-value control exported from
`@inkra/react` and `@inkra/react/slider`. It supports controlled and uncontrolled
values, min/max/step, pointer and touch dragging, keyboard controls, disabled
and read-only states, form submission/reset, and a configurable arc. Angles are
measured clockwise from the top; `startAngle={0} sweepAngle={360}` draws a full
ring. `clockwise` controls the value direction. Arrow Right/Up increase,
Arrow Left/Down decrease, Home/End reach bounds and Page keys take larger steps.
Give the control an accessible name and use `getValueLabel` for units.

Use `centerIcon` for a decorative icon. The default center displays the value;
set `showValue={false}` for an icon alone. `centerContent` accepts a React node
or `(value: number) => ReactNode`, overriding the default value display when
provided; `null` hides the text. Strings and numbers retain the pencil text
appearance. Center content is inert and hidden from accessibility APIs;
keep the slider's `aria-label` and `getValueLabel` meaningful independently.
