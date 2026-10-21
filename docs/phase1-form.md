# Phase 1 Form Controls

- taskRef: `01a15812-ee83-76f2-bdbd-ff250eaa9683`
- completedAt: `2026-10-20T22:08:37+08:00`
- status: source implementation and focused tests complete
- coordinatorContinuationRequired: true
- coordinatorMayComplete: false

## API draft

```tsx
<Field
  id="email"
  label="Email"
  description="Used for delivery updates."
  error={emailError}
  required
>
  <Input
    autoComplete="email"
    startIcon={<MailIcon />}
    size="md"
    type="email"
  />
</Field>
```

### `Field`

`Field` owns the visible label and optional description/error DOM. It provides IDs and state to direct Inkra controls through context; it does not clone or rewrite arbitrary children.

```ts
interface FieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'id'> {
  id?: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  children: React.ReactNode;
}
```

- `id` is the native control ID. When omitted, Field creates a stable React ID.
- `error` implies invalid state; `invalid` also supports invalid state without visible error copy.
- `required`, `invalid`, `disabled`, and `readOnly` are inherited by Inkra Input/Textarea children.
- Label uses native `label[for]`. Description and error IDs are included in `aria-describedby`; invalid controls also receive `aria-errormessage` and `aria-invalid`.
- String label/description/error content is enhanced by PencilText pigment while remaining semantic selectable DOM. ReactNode content is rendered unchanged.

### `Input`

```ts
type FieldControlSize = 'sm' | 'md' | 'lg';

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: FieldControlSize;
  seed?: string | number;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}
```

- Forwards `HTMLInputElement` ref and every non-conflicting native input prop.
- `startIcon` and `endIcon` are decorative slots; accessible naming still comes from Field label or native ARIA.
- Existing consumer `aria-describedby` and `aria-errormessage` IDs are merged, not replaced.
- `invalid` also works when Input is used without Field, setting `aria-invalid` and selecting the danger PencilSurface.

### `Textarea`

```ts
interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  size?: FieldControlSize;
  seed?: string | number;
}
```

- Forwards `HTMLTextAreaElement` ref and native textarea props.
- Uses the same Field association/state contract as Input.
- Superseded by Phase 2: native input semantics remain, with optional pencil canvas lettering for supported editable text. See `phase2-form.md` for fallback and composition boundaries.
- `invalid` also works standalone, matching Input's danger surface and ARIA behavior.

## Rendering contract

- Input/Textarea remain the interactive and editable layer.
- A sibling `PencilSurface` is decorative and `aria-hidden`; invalid uses the danger surface, otherwise outline.
- `sm/md/lg` use token-backed visual geometry. No CSS solid border substitutes for the pencil outline.
- Focus is a visible CSS focus ring on the control shell; pencil texture does not replace focus semantics.

## Integration contract

- Owned implementation files: `packages/inkra/src/form/**`.
- Owned future test: `packages/inkra/test/form.test.mjs`.
- Root `index.ts`, aggregate `styles.css`, copy scripts and package metadata remain coordinator-owned.
- Coordinator should export Field/Input/Textarea and their prop/size types, and aggregate/copy `src/form/styles.css`.

## Implemented files

- `packages/inkra/src/form/context.ts`: Field context and stable ARIA ID merging.
- `packages/inkra/src/form/controlProps.ts`: inherited/native state resolution without replacing consumer ARIA IDs.
- `packages/inkra/src/form/Field.tsx`: label/description/error DOM and inherited state provider.
- `packages/inkra/src/form/Input.tsx`: native input, ref/attribute forwarding, start/end icon slots and PencilSurface shell.
- `packages/inkra/src/form/Textarea.tsx`: native textarea, ref/attribute forwarding and PencilSurface shell.
- `packages/inkra/src/form/types.ts`, `index.ts`, `styles.css`.
- `packages/inkra/test/form.test.mjs`: six SSR/source contract tests.

## Final behavior

- String label, description and error content uses PencilText pigment; ReactNode content stays unchanged.
- Phase 2 adds decorative pencil lettering over native editable controls; this historical Phase 1 implementation did not include that enhancement.
- Field error implies invalid state. Standalone Input/Textarea `invalid` also sets `aria-invalid` and the danger surface.
- Consumer `aria-describedby` and `aria-errormessage` are de-duplicated and merged with Field IDs.
- Native `required`, `disabled`, `readOnly`, form, name, autocomplete, data attributes and refs remain available.
- Decorative icon slots are `aria-hidden`; label/ARIA remains the accessible name source.

## Verification evidence

- `npm run typecheck --workspace inkra`: passed after final source edits.
- `node --check packages/inkra/test/form.test.mjs`: passed.
- `node --test packages/inkra/test/form.test.mjs`: passed 6/6 against the latest integrated dist.
- Form CSS token audit: every external `--inkra-*` token referenced by `form/styles.css` exists in `tokens.css`; local `--inkra-field-control-*` variables are defined in the same file.
- `git diff --check` for owned paths: no whitespace errors.
- The focused tests validate native association/state contracts rather than relying on brittle whole-markup adjacency. React SSR casing for `autoComplete` and `readOnly` is handled explicitly.

## Coordinator integration checklist

- Public export aggregation and CSS copy are already present in the shared workspace (`export * from './form/index.js'` and `form/styles.css` in copy-styles).
- Keep `export * from './form/index.js'` and `form/styles.css` in the coordinator-owned package aggregation/copy flow.
- Include `packages/inkra/test/form.test.mjs` in the coordinator-owned full suite; focused result is 6/6.
- Include the form docs route/examples and complete browser checks separately. Build/typecheck evidence is not visual acceptance.
