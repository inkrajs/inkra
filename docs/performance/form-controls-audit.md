# Form and control performance audit

Audit baseline: `7bd08e47b05c9d61a226bbbfd3d5d620ce93962a`.

This pass inspected every component exported by the assigned control modules: 25 public components, plus the two file-exported internal form helpers. It also inspected their state/model helpers, event effects, drawing integration, native form behavior, controlled/uncontrolled transitions, and related existing tests. No public props, DOM structure, CSS, keyboard behavior, or visual design were intentionally changed.

## Reproducible evidence

Run `npm run build && node --test packages/inkra/test/form-control-performance.test.mjs`.

The same test file was copied to an isolated clean checkout of the baseline and run after building it. Nine performance assertions fail on the baseline; the calendar behavior-preservation test passes there. All ten tests pass after these changes. Counts below are deterministic work counts, not browser timing or FPS claims.

| Exercise | Baseline work | Updated work |
| --- | ---: | ---: |
| Calendar, 2,000 events, two visible months, initial render | 280,000 event year reads | 2,000 |
| Same Calendar, unrelated rerender | Repeated per-cell event scans | 0 additional event year reads |
| DatePicker, format 42 day labels | 42 `Intl.NumberFormat` constructions | 1 |
| TimePicker, initial value plus 10 value updates | 11 `Intl.DateTimeFormat` constructions | 1 |
| TimePicker with seconds, change a minute | 144 radio-option renders | 60 |
| Same TimePicker, unrelated class change | All option columns rendered | 0 option renders |
| InputNumber, one idle mounted control | 6 hold-related global listeners | 0 |
| Upload, 100 files, upload start plus four progress updates | Each unchanged row renders 6 times including mount | Each unchanged row renders 1 time |
| Field, stable control child, change label/description text | Consumer renders 2 times including mount | 1 |
| ButtonGroup, stable child, change class | Button renders 2 times including mount | 1 |
| RadioGroup, two stable children, change class | Items render 4 times including mount | 2 |

The Calendar index is linear in event count and retains event identity, original within-day order, and local-date grouping. Replacing the event collection invalidates the index. Upload retains individual progress callbacks and immutable item updates rather than dropping/coalescing updates; only unchanged row rendering is skipped. As with existing collection memoization in this library, data updates should replace changed arrays/objects instead of mutating props in place.

## Component-by-component findings

“Inspected, no justified change” means that this pass did not establish a safe, material additional optimization. It is not a claim that the component is optimal in every browser or workload.

| Component | Disposition | Specific inspection and reasoning |
| --- | --- | --- |
| Button | Inspected; benefits from fixed group context | Fixed-size native-button visual tree. Rendering depends on disabled/loading, group settings, action context, labels, and icons; those semantic updates remain live. No local timers, collection traversal, or drawing cache was added. Stable group children now avoid unrelated context broadcasts. |
| ButtonLink | Inspected; benefits from fixed group context | Same visual tree and group dependency as Button. Disabled/loading guards still cover click, auxiliary click, keyboard activation, href, and tab order. No separate broad component memoization was introduced, which could obscure fresh handlers/children. |
| ButtonGroup | Fixed | Provider previously allocated a new value for every class/style/children update and forced consumers to render even when group settings were identical. Memoized the four semantic context fields; changes to size/orientation/variant/disabled still propagate. |
| Field | Fixed | Provider recreated its context for label/description text changes although the control IDs and state stayed identical. Memoized exact ID/state fields. Tests verify disabled/required/error/description-presence changes still reach consumers and update ARIA relationships. |
| Input | Inspected, no additional justified change | Uncontrolled value synchronization, clear eligibility, focus/composition state, form reset timer, and native listener cleanup inspected. Its updates drive clear affordance and editable drawing; blindly suppressing them risks stale uncontrolled/autofill/change-event behavior. Controlled native values and native callbacks retained. Existing input/form tests pass. |
| Textarea | Inspected, no additional justified change | UTF-16 counter, threshold modes, native value, resize observer, pointer capture, keyboard resizing, form-reset frame cancellation inspected. Pointer work is local; resize observer is only installed for vertical resize. Retained counter/drawing synchronization rather than speculatively removing keystroke updates without browser IME/resize measurement. |
| Checkbox | Inspected, no additional justified change | Uses native checked/defaultChecked state and a constant-size visual tree. Controlled updates avoid redundant internal checked writes; uncontrolled changes synchronize the visual. Indeterminate behavior and native reset cleanup were inspected. No global per-checkbox input listeners or collection computations found. |
| Switch | Inspected, no additional justified change | Same native checked helper; fixed glyph geometry and state-dependent track. Existing cached primitives own drawing. No repeated global listener or growing work queue in this wrapper. |
| RadioGroup | Fixed | Provider recreated a handler and context on every parent rerender. Memoized all relevant context values, including the callback, current selection, disabled/required/form/name/variant. Runtime tests check fresh callback and selection/state propagation. |
| RadioGroupItem | Inspected; benefits from fixed provider | Every selection change must at least resolve checked state. Group-level unrelated updates no longer force stable children to render. Kept native radio grouping, item-specific callbacks, selected drawing, and descriptions intact; no custom selector-store or rewritten radio interaction model. |
| InputNumber | Fixed | Six global hold listeners were installed for every mounted control, even when no gesture was active. Install synchronously when a hold starts, remove on stop, and preserve repeat timers, live modifiers, pointer-ID guards, capture fallback, latest step callback, and form reset. StrictMode/runtime tests cover pointer up/cancel, unrelated pointer, blur, hidden document, disable, and unmount cleanup. |
| Slider | Inspected, no additional justified change | Delegates gesture/form mechanics to Radix; uses stable full-size painted surfaces with CSS clipping for range changes. The ancestor-direction observer has cleanup and is omitted for explicit direction. Per-value work scales with the requested thumbs, not the numeric range. No second gesture engine or visual throttling added. |
| RangeSlider | Inspected, no additional justified change | Thin two-value wrapper. Endpoint normalization and minimum-step calculation are constant-time and preserve already-ordered array identity. Existing crossed-value, RTL, disabled, and callback-shape tests pass; memoizing these trivial calculations would add complexity without demonstrated benefit. |
| Rating | Inspected, no additional justified change | Preview callback already rejects duplicate preview values; symbol indices are memoized; native reset timer is cancelled. Rendering scales with caller-requested symbol count and custom renderSymbol state. Did not cap count or virtualize interactive symbols, because either changes the public visual/accessibility contract. |
| ToggleGroup.Root | Inspected, no additional justified change | Interaction/state delegation remains with Base UI. Inkra's orientation context is already a primitive, so it does not create object-identity broadcasts. Frame and selection visuals use shared renderer caches. |
| ToggleGroup.Item | Inspected, no additional justified change | Fixed-size surfaces and label/icons; primitive orientation dependency. Preserved Base UI state-derived class functions and value behavior rather than adding a custom comparator around arbitrary render/interaction props. |
| Hotkey | Inspected, no additional justified change | Modifier/key formatting is bounded by one shortcut, not a growing collection. Auto-platform detection is effect-based to preserve SSR hydration, with no global key listener. Retained detection semantics rather than reading browser platform in the initial server-compatible render. |
| HotkeyInput | Inspected, no additional justified change | Capture stays on the native focused input. IME, modifier-only, Tab, Escape, clear, validation, and conflict paths inspected. No document/window recording listener or polling loop. Constant-size normalization is not the dominant drawing cost. |
| Keypad | Inspected, no additional justified change | State is local and a value ref preserves consecutive presses. Only actual value changes publish onValueChange. Layout traversal is proportional to caller-defined keys; labels and disabled-at-limit behavior must stay current. No listeners/timers outside native buttons. Arbitrarily large custom layouts still intentionally render all supplied keys. |
| Editable | Inspected, no additional justified change | One editor is mounted only while editing. Focus-on-edit animation frame has cleanup; validation/save work is interaction-triggered rather than per-render. Retained async error/value behavior and IME guards. The finish-focus callback already dereferences the live ref; native focus/async race acceptance still needs a browser, not an SSR assertion. |
| ColorPicker | Inspected, no additional justified change | Preset normalization is already memoized by preset collection; palette uses a native color input and alpha uses the shared Slider. Text draft remains separate from committed value so incomplete input is preserved. No custom 2D drag listener or conversion loop. Large preset collections remain explicit render output rather than silently truncated. |
| Calendar | Fixed | Removed repeated full-event filtering from both day-cell and day-button rendering. A single local-date index is shared through stable context. Runtime test verifies event order, accessible names, event identity, and stopPropagation; index invalidates on replacement events. |
| DatePicker | Fixed | Day labels constructed a fresh `Intl.NumberFormat` per cell, unlike its already memoized date formatters. Added the corresponding locale-keyed number formatter. Tests verify locale changes and cell formatting while existing single/range/form tests pass. |
| TimePicker | Fixed | Memoized localized display formatter, fixed option arrays, and memoized option columns with stable callbacks. Minute/second edits now leave other columns untouched. Callbacks read the latest draft, preserve AM/PM, and invalidate for constraints/cycle/localization changes. Runtime test commits 21:30:15 after separate minute/second/period/hour edits. Native validation remains authoritative. |
| Upload | Fixed | Progress updated one item but reconstructed every row's expensive control/surface subtree. Extracted a memoized row and stabilized labels/actions while retaining latest callbacks via existing refs. Tests cover unrelated rows, same item identity, every progress notification, cancellation/late callbacks, and disabled/label changes. The parent still traverses the file list for ordered immutable updates. |
| InputAction (internal file export) | Inspected, no additional justified change | Hover/focus state is local to the action; disabled clears both. Primitive boolean action context and selection-drawing cleanup inspected. The focus-containment guard prevents needless blur changes within the action. |
| EditablePencilText (internal file export) | Inspected; browser measurement blocked | Existing per-editor bounded 128-entry/4 MiB glyph cache, 4,096-character total bound, 256-character line bound, appearance-key deduplication, native numeric-draft fallback, IME handling, and observer/font/reset cleanup inspected. Textarea line measurement still performs native range geometry reads. Further measurement-cache or paint-scheduling changes require actual wrapping/scroll/font/IME evidence; no unverified layout shortcut was added. |

## Verification and remaining boundary

- Build/type generation passed.
- Full library suite: 431 tests, 425 passed, 6 existing skips, 0 failed.
- New runtime regression file: 10/10 passed; unchanged baseline: 1 passed, 9 expected performance failures.
- Release policy tests: 5/5 passed.
- Repository portability and `git diff --check` passed.
- Package validation/pack passed: 273 entries, required exports/assets present. Used a writable local npm cache because the default home cache was unavailable.
- Installed tarball SSR/import/type checks passed with React 19.3.1; 126 dependencies were installed in an isolated temporary consumer.
- No browser was launched, no denied browser path was retried, and no user desktop was accessed. Browser visual, real native validity/IME/pointer-capture acceptance, sustained scrolling/heap profiles, and the original intermittent crash remain unverified.
- The final integrating checkout should rerun installed-package checks and run the independent docs checkout's `prepare:library` against the integrated package. This isolated pass did not mutate shared documentation or publish a package.

These improvements establish reduced redundant work; they do not establish a root cause or resolution of the unobserved crash.
