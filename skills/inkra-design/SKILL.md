---
name: inkra-design
license: MIT
description: Turn product needs into usable Inkra interfaces by choosing and composing components, organizing business states, layout, themes and responsive interaction. Use also for custom Inkra icons or focused design reviews.
---

# Inkra design

Help a consuming developer build their product with Inkra. Preserve the user's content, language, architecture, selected theme and requested delivery format. Start with the user flow and existing components; create custom appearances only where the task needs them.

## Choose the relevant guidance

- For a screen or product flow, read [component composition](references/composition.md) to organize choices, business state and interaction.
- For implementation, layout, typography, theme and native interaction, read [interfaces](references/interfaces.md). It includes a public-API form example.
- For a requested custom icon, filled counterpart or icon family, read [icons](references/icons.md). It includes original geometry and the version-specific canvas sizing contract.
- For a review, read only the references relevant to the observed problem. A composition task does not require the icon-authoring guide.

## Use product facts without guessing

Find components and confirm APIs through **inkra-docs** when the task needs a capability or contract that is not already established. Discover it in the available-skill catalog or the [public skill registry](https://inkrajs.github.io/skills/registry.json); resolve relative links against the fetched registry URL. An explicit user-provided documentation mirror can supply that origin instead. If not installed, read its official entry and relevant references as product guidance rather than pretending to invoke an installed skill. Reuse known facts and return to the current design task instead of routing the entire request back to inkra or repeating a skill-reference loop.

This skill also works independently: use the consumer's installed public types and official component pages when inkra-docs is unavailable. These examples target `@inkra/react` 0.12.0; confirm the actual installed version before coding, preserve dependencies and verify differences in that version's exports/types. The installed version, newest npm release and deployed docs snapshot are separate facts. For a proposal without code, identify any capability that still needs confirmation.

## Preserve the design invariants

- Compose useful information and real actions. Keep application data, permissions, validation and business transitions under explicit application ownership; a component's selected appearance does not grant an entitlement or complete a purchase.
- Use semantic tokens and the application's existing palette. The package's Ocean default and documentation site's graphite theme are both valid contexts. Keep foreground/pigment pairs readable on actual paper and wash.
- Keep native DOM content and editing behavior: selectable/copyable text, form semantics, keyboard focus and meaningful control names. Decoration must not intercept input, determine layout or hide content while fonts or texture prepare.
- Use predictable grouping and restrained boundaries; adapt the flow to narrow screens before shrinking text. Keep targets at least 44px and match hover/focus artwork to the actionable area.
- Let exported components provide stable pencil material. Do not introduce random per-render strokes or always-running drawing loops. Respect reduced motion, forced colors and user text-effect preferences.

## Deliver and verify proportionally

For implementation, confirm the changed interaction with real content and the relevant narrow/keyboard/theme conditions. Reuse valid checks for unchanged inputs; a small reversible layout change does not require a full library suite. Build/type success does not establish visual acceptance: inspect a render or state the remaining visual verification limit.

Deliver the requested design or code with concise component choices, state behavior and material limits. A design request does not authorize unrelated application changes, dependency upgrades, publication or deployment.

## Public sources

[Design standard](https://inkrajs.github.io/docs/design-standard) · [Components](https://inkrajs.github.io/docs/components/button) · [Theming](https://inkrajs.github.io/docs/theming)

Maintain these recipes against the current package types/tokens and latest dated design-standard revisions. Keep maintainer contribution, renderer internals, CI and release procedures outside the default consumer guidance.
