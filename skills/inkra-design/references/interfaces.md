# Interfaces and composition

Build the user's actual task flow with Inkra components. Use a clear content hierarchy, useful controls and a restrained number of boundaries. Pencil texture should support the information rather than becoming a reason for nested cards, giant empty spaces or ornamental controls.

## Type, spacing and color

- Inherit `--inkra-font-body`, `--inkra-font-hand` and `--inkra-font-display`. Default Xiaolai is regular weight 400; create hierarchy through size and spacing rather than synthetic bold or negative tracking. Use `--inkra-font-mono` for code.
- The standard text scale is 12/13/15/17/20/24/28px (`text-xs` through `text-3xl`); body line height is 1.6. Body content generally starts at 15px, metadata at 13–14px. Keep long prose native when texture would reduce readability or increase cost.
- Use the 4px spacing grid. Typical gaps are 8px within a related control group, 16px between independent fields, 24px between content groups and 32px between sections. Ordinary containers commonly use 16px padding; independent task panels/dialogs commonly use 24px and can reduce to 16px on narrow screens. Keep one owner for each gap instead of adding parent gap and child margins together.
- The documentation site's shared 20px page/preview spacing is a context-specific convention. Match it when extending that site; do not impose 20px on every consumer layout or override a component's own sizing.
- Use radius tokens: 0/3/6/8px for none/sm/md/lg. Independent cards/dialogs have restrained corners up to 8px; retain existing component rendering. Avoid replacing pencil surfaces with pill buttons or glossy gradients.
- Use `--inkra-paper`, `--inkra-surface`, `--inkra-ink`, `--inkra-ink-muted` and the paired status tokens. Action is `on-accent` on paper plus an `accent` wash; selection uses `selection-foreground` with `selection-pigment`. Pigment is not an opaque background color. Preserve an application's selected palette; do not force the documentation site's graphite colors or hard-code Ocean hex values.
- Import `@inkra/react/styles.css` once at the app entry. A `ThemeProvider` from `@inkra/react/theme` makes a local scope: omit `theme` to inherit; use `light`, `dark` or `auto` deliberately. Its `tokens` accepts `--inkra-*` keys; dimensional values need units. Scope changes to the intended preview rather than mutating global theme/storage.

## Optional text-material tuning

Prefer the inherited preset. In the 2026-10-28 design revision used by 0.12.0, Xiaolai variation/breaks/outline/fill/grain are `0.10/0.31/0.44/0.85/0.40`; other fonts retain independent presets. Use the consumer's saved choices. These values explain that version's defaults, not a reason to override every application or imitate the documentation palette.

## Layout and interaction

Prefer native semantics and existing components. `Field` associates labels/descriptions/errors with `Input`; `Button` is an action and `ButtonLink` is navigation with a real href. Put meaningful status text near the action, including failure or empty states. An icon-only action has a real name; unfamiliar actions also need a discoverable explanation.

Let content reflow to a single column before shrinking type. Constrain overflow to the actual table/code/graph region; avoid multiple full-page scrollers. Use logical CSS properties for RTL, and keep the current language/font selection independent. Check long translated labels and text zoom for the changed layout.

Use semantic variants instead of making important buttons arbitrarily larger. Button visual surfaces xs/sm/md/lg are 32/36/44/48px; their interaction targets remain at least 44px. Hover artwork and focus indication belong to the same actionable box; texture overshoot cannot enlarge the real target or obscure a neighbor. Loading and value changes retain stable control/icon slots.

Use stable, optional motion with transform/opacity; do not redraw texture every frame. Custom transitions respect reduced motion. Forced colors, print and failed decoration preserve visible DOM and system focus. Do not disable a user's existing text-effect setting; `--inkra-letter-effect: 0` keeps the selected native font and semantics while disabling its decorative text canvas.

## Complete interactive example

This form uses public components, local state, native submission and a persistent result. The surrounding section stays unboxed; the primary button gets the component's pencil surface. It inherits the consumer's current theme. The form text is sample copy to localize, not a required product scenario.

```tsx
import { useState, type FormEvent } from 'react';
import { Button, Field, Input, PencilText } from '@inkra/react';
import { ThemeProvider } from '@inkra/react/theme';
import '@inkra/react/styles.css';

export function IdeaForm() {
  const [idea, setIdea] = useState('');
  const [saved, setSaved] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = idea.trim();
    if (value) setSaved(value);
  }
  return (
    <ThemeProvider>
      <section style={{ maxWidth: 'var(--inkra-reading-width)', padding: 'var(--inkra-space-4)' }}>
        <PencilText as="h2" style={{ fontSize: 'var(--inkra-text-xl)', fontWeight: 400 }}>
          Keep an idea
        </PencilText>
        <form onSubmit={submit} style={{ display: 'grid', gap: 'var(--inkra-space-4)' }}>
          <Field label="Idea" description="Saved in this preview only." required>
            <Input
              required
              pattern=".*\S.*"
              value={idea}
              onValueChange={value => { setIdea(value); setSaved(''); }}
              placeholder="A small beginning"
            />
          </Field>
          <Button type="submit" disabled={!idea.trim()}>Save idea</Button>
          <output aria-live="polite" style={{ minBlockSize: '1.6em', color: 'var(--inkra-ink-muted)' }}>
            {saved ? `Saved: ${saved}` : ''}
          </output>
        </form>
      </section>
    </ThemeProvider>
  );
}
```

The pattern is a JSX string attribute: keep a single `\S` in the resulting HTML pattern (write `pattern=".*\S.*"` in TSX). Do not serialize it as a JavaScript expression containing an unescaped backslash. Native validation and the trimmed submission guard reject whitespace-only content without altering the user's editable input.

## Conditional compositions

Apply these only when that component or scenario is requested:

- **Flip cards:** rotate the entire face, including paper, border and selection outline. Do not leave a fixed outer card while only its text flips. Keep actions separate and keyboard reachable, with focus and reduced-motion behavior checked.
- **DependencyGraph / skill trees:** separate dependency data and application unlock/level logic from node appearance. A custom node can be a card, icon or borderless image; use `renderNode` for the whole node and `renderSurface` when supplying a card-like surface. Arrows reach the visible node boundary without port dots or floating ends. Explicit `sourceAnchor`/`targetAnchor` coordinates are normalized local 0–1 positions; edge values override node defaults, and `position` selects the physical entering/leaving direction. Account for transparent image padding when choosing a connection point. Check the installed API before composing it.
- **Long galleries/graphs:** mount nearby examples on demand, retain useful state, and budget canvas resolution/cache memory. Do not pre-render all hidden content or assume eager module warming helps mobile. Measure affected loading and scrolling behavior before claiming improvement.

## Review the interface

Check the changed flow at desktop and a narrow viewport with its real content:

- Actual save/toggle/navigation behavior, readable empty/error/loading states, complete labels and stable control slots.
- Native input, selection/copy, IME when editing is affected, keyboard order/focus and Escape/focus-return where overlays are involved.
- Light and dark themes on real paper/wash composites, plus relevant forced-color and reduced-motion fallbacks. Target at least 4.5:1 for normal text and 3:1 for necessary control/icon boundaries; a flat-color ratio alone cannot certify textured output.
- Long translations, text zoom and RTL when relevant; local scrolling and non-overlapping 44px targets.
- First render and repeat interaction: decoration has stable geometry, content is usable while it prepares, and idle content does not keep repainting.

Inspect an actual rendering for visual work, but keep verification proportional. A small layout correction needs a focused check; it does not automatically require a full component-library regression suite.
