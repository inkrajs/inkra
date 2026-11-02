# Inkra

This is the inkrajs/inkra React component library. Documentation is owned by the independent inkrajs/docs repository. Do not copy travel data, account credentials, private media, or unrelated source changes here.

## Workflow

- Preserve existing changes and respect concurrent file ownership.
- Use npm workspaces. Root scripts: `npm run dev`, `npm run build`, `npm test`.
- The npm package is `@inkra/react`, in `packages/inkra`. Local `apps/docs` is a separate ignored Git checkout, not an npm workspace. Other checkouts use INKRA_DOCS_DIR.
- After library changes, build and pack, then run the docs checkout's `npm run prepare:library -- <library-checkout>`. Never restore source aliases to hide packaging failures.
- Read `docs/design-standard.md` before changing visual behavior.
- New or changed icon geometry must support both PencilIcon outline and filled variants. Preserve holes and open-symbol semantics; provide filledPaths for shapes that need a dedicated silhouette, and validate both variants at small sizes.
- Keep semantic HTML and selectable text. Decorative drawing must not determine layout or intercept input.
- Never equate a successful build with visual or real-device acceptance.
- Keep the root READMEs concise and appealing: lead with the project, visual preview, a few core strengths, minimal installation and documentation links. Put version-by-version updates in CHANGELOG.md and delivery/CI records in their own guides; do not append them to the README.
- Do not register accounts, publish packages, push, or deploy without explicit user authorization.
- The user requests parallel work for separable implementation, documentation and verification tasks. Delegate bounded subtasks with explicit file ownership; the main chat must monitor progress, resolve blockers and verify the integrated result. Keep dependent edits sequential and avoid concurrent writes to the same files. Create user-owned Codex chats only when explicitly requested.

## Choosing configuration controls

- Choose a control from the meaning of the data and the user's task, not from its JavaScript type or whichever component is easiest to add. Consider binary vs mutually exclusive vs multiple selection, discrete vs continuous values, option count, search needs, range, units, precision, frequency and screen space. Inspect existing equivalent interactions before implementing.
- Use judgment: Switch for immediate on/off; Checkbox for independent selections or explicit form confirmation; segmented/radio controls for a few comparable alternatives; Select or searchable Select for longer option sets; Slider/CircularSlider for exploring a meaningful range; InputNumber for precise or wide-range entry; suitable date/time, text or specialized editors for structured data. Combine exploration with precise entry when useful. These are examples, not a mandate to force every setting into one widget.
- Preserve Inkra's established patterns when the task matches them. In theme and appearance panels, color parameters normally use ColorSwatch with a “+” ColorPicker popover and a theme-following default; visual scalar parameters normally use CircularSlider. Reuse the docs repository's `src/components/DocsAppearanceControls.tsx` and consult `ThemeSettingsPanel.tsx`. A named palette is a semantic choice and may need a different control than an arbitrary color value. Do not use a dropdown of arbitrary numeric/color presets merely to avoid implementing the right editor.
- Make ranges, steps, units, defaults and disabled/dependent states match the public API and real task. Preserve custom values, provide precise entry where needed, and avoid hiding valid values behind arbitrary demo limits. Keep interactive editors outside a CircularSlider's inert center. Minimum hit sizes, keyboard access, labels and narrow layouts remain necessary regardless of appearance.
- Before finishing, review whether each control makes its actual values and consequences easy to understand and change; reuse shared components where applicable and keep displayed source synchronized. In a group of related controls, align visual centers, caption baselines and spacing using shared layout slots; verify the actual rendered result, including mixed control types and editing/disabled states, rather than assuming wrapper CSS aligns their contents. If a different control better serves the task, choose it and briefly explain the material tradeoff rather than mechanically copying the last panel. Follow `docs/design-standard.md` in the library repository; keep these implementation rules out of the root README.

## CI decisions for AI agents

- Before creating or updating a PR, follow [the AI CI guide](docs/ai-ci-guide.md) and inspect the local-validation policy at the actual PR base. Proactively use eligible local-test confirmations when the authorized account, exact committed head/base, test groups, actual tested environments and evidence all match; do not wait for the user to request each declaration again.
- Run the smallest meaningful affected local checks. Reuse already valid results for unchanged inputs; do not run a full suite merely to obtain an exemption. Record only tests that actually passed and environments actually exercised. Preserve mandatory build/package/installed-consumer gates and normal CI for everything else.
- Within an already authorized PR workflow, include truthful reports and the matching declaration without a redundant confirmation. Do not add yourself to the allowlist or expand eligible groups to approve your own PR. A changed head, base, candidate or relevant test environment requires fresh validation and an updated declaration.
- Read CI's decision and the exact locally confirmed / online test lists. A declaration in the description alone does not establish an accepted exemption. Diagnose rejected declarations or failing checks; never use an exemption to relabel a failed test.
- For an authorized website deployment, use the resumable `npm run ship` entry and [delivery guide](docs/shipping.md). Review committed source refs, preview the plan, then execute it once; leave unchanged CI polling and deterministic publishing steps to the script. Never include unrelated dirty drafts or infer npm publication from website deployment.
- On interruption, inspect the saved ship status and resume the same plan/id. Do not create duplicate PRs, force-push, bypass a failed gate, or trigger another deployment merely to check status.
- Wait for the PR's required checks and requested merge. After a successful merge, sync the local checkout and finish. Do not also wait for post-merge full checks, run another full suite, or start publication/deployment unless the user requested that work.

## Initial Delivery

The first deliverable is an honest alpha package and a local documentation shell. Navigation and preview controls must work, but unfinished documentation must be marked as such. Avoid invented API coverage, usage metrics, or publication claims.
