# Phase 2 Editable Pencil Form Handoff

- taskRef: `01a15812-ee83-76f2-bdbd-ff250eaa9683`
- completedAt: `2026-10-20T23:18:12+08:00`
- coordinatorContinuationRequired: true
- coordinatorMayComplete: false

## Implemented

- Input and Textarea keep native values, caret, selection, clipboard, IME, form ownership, controlled/default values, reset, scroll and wrap behavior.
- A sibling `inkra-editable-text` canvas renders the current visible placeholder/value with the shared pencil lettering renderer.
- Native glyphs become transparent only after a successful canvas paint. Input/scroll/value/theme/font/resize invalidation removes ready state first, so stale pigment never represents a new native value.
- Composition start immediately restores native text and hides the canvas. Composition state is stored independently from controlled `value` effects, so repeated composition input/rerenders do not reset it. Composition end schedules fresh pigment.
- Focus no longer adds a second CSS solid ring. Focus increases contrast/saturation of the existing PencilSurface canvas. Forced-colors retains the required system outline.
- Canvas geometry follows the actual input/textarea `offsetLeft`, `offsetTop`, `clientWidth` and `clientHeight`, including start/end icon slots.
- Textarea uses an offscreen DOM mirror and Range rectangles to consume browser wrapping, padding, direction, alignment, word-break and white-space measurements. It does not estimate word wrapping by character width.
- Single-line horizontal scroll and Textarea vertical scroll draw only visible text/lines.
- Dynamic editable text always calls `renderPencilText(..., cache: false)`. `textRenderer.ts` skips both cache lookup/storage and dynamic-text cache-key construction when cache is disabled.

## Safe native fallback

- Password never mounts editable pencil enhancement and never sends plaintext or a mask to the lettering renderer/cache.
- Only `undefined/text/search/email/url/tel` Input types are enhanced. Date, number, file, color, range, checkbox and other specialized native inputs stay native.
- `direction: rtl` and complex shaping scripts stay native because the current glyph renderer is not a bidi/shaping engine.
- Input lines over 256 characters, total editable text over 4096 characters, Textarea browser lines over 256 characters, canvas/context failure and renderer exceptions stay native.
- During forced-colors and print the editable canvas is hidden; text, placeholder and selection foreground are explicitly restored.
- Canvas remains decorative, `aria-hidden` and pointer-events none.

## Owned files

- `packages/inkra/src/form/EditablePencilText.tsx`
- `packages/inkra/src/form/Input.tsx`
- `packages/inkra/src/form/Textarea.tsx`
- `packages/inkra/src/form/styles.css`
- `packages/inkra/src/internal/textRenderer.ts`
- `packages/inkra/test/form.test.mjs`
- `packages/inkra/scripts/verify-editable.mjs`
- `docs/phase2-form.md`

## Verification

- `npm run typecheck --workspace inkra`: passed.
- `node --test packages/inkra/test/form.test.mjs`: passed 9/9 against current integrated dist.
- Script syntax checks for form tests and `verify-editable.mjs`: passed.
- Owned-path `git diff --check`: passed.
- Local Playwright base flow passed before the final review hardening: placeholder/value canvases contained pixels, native value/caret remained, native focus outline was none, composition restored native text, horizontal Input scroll and vertical Textarea scroll preserved values, no page errors.
- Coordinator integration script independently passed controlled composition with repeated input, selected-text replacement, readonly no-double-text, 4100-character fallback and forced-colors fallback.
- Coordinator identified print placeholder transparency; form CSS now explicitly restores print/forced-colors placeholder and selection colors. Coordinator should rerun its integration script after this final CSS change.

## Coordinator next steps

- Run full package tests/build through the coordinator-owned flow. Latest focused form result is 9/9; coordinator previously reported the suite was 44/45 only because of the now-corrected composition CSS regex.
- Run `node packages/inkra/scripts/verify-editable.mjs` once after the dev server is stable. The script waits explicitly for Input/Textarea, logs progress, captures page errors and emits DOM diagnostics on missing controls.
- Rerun the coordinator-owned `verify-editable-integration.mjs` to confirm print placeholder/selection restoration after the final CSS patch.
- Complete browser screenshots/visual acceptance separately. Build and pixel presence are not visual approval.

No package build/test command that cleans dist, publish, deploy, commit or push was performed by this task.
