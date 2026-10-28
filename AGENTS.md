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

## CI decisions for AI agents

- Before creating or updating a PR, follow [the AI CI guide](docs/ai-ci-guide.md) and inspect the local-validation policy at the actual PR base. Proactively use eligible local-test confirmations when the authorized account, exact committed head/base, test groups, actual tested environments and evidence all match; do not wait for the user to request each declaration again.
- Run the smallest meaningful affected local checks. Reuse already valid results for unchanged inputs; do not run a full suite merely to obtain an exemption. Record only tests that actually passed and environments actually exercised. Preserve mandatory build/package/installed-consumer gates and normal CI for everything else.
- Within an already authorized PR workflow, include truthful reports and the matching declaration without a redundant confirmation. Do not add yourself to the allowlist or expand eligible groups to approve your own PR. A changed head, base, candidate or relevant test environment requires fresh validation and an updated declaration.
- Read CI's decision and the exact locally confirmed / online test lists. A declaration in the description alone does not establish an accepted exemption. Diagnose rejected declarations or failing checks; never use an exemption to relabel a failed test.
- Wait for the PR's required checks and requested merge. After a successful merge, sync the local checkout and finish. Do not also wait for post-merge full checks, run another full suite, or start publication/deployment unless the user requested that work.

## Initial Delivery

The first deliverable is an honest alpha package and a local documentation shell. Navigation and preview controls must work, but unfinished documentation must be marked as such. Avoid invented API coverage, usage metrics, or publication claims.
