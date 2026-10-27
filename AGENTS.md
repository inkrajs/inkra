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
- Do not register accounts, publish packages, push, or deploy without explicit user authorization.
- The user requests parallel work for separable implementation, documentation and verification tasks. Delegate bounded subtasks with explicit file ownership; the main chat must monitor progress, resolve blockers and verify the integrated result. Keep dependent edits sequential and avoid concurrent writes to the same files. Create user-owned Codex chats only when explicitly requested.

## Initial Delivery

The first deliverable is an honest alpha package and a local documentation shell. Navigation and preview controls must work, but unfinished documentation must be marked as such. Avoid invented API coverage, usage metrics, or publication claims.
