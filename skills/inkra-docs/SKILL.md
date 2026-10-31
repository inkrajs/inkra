---
name: inkra-docs
license: MIT
description: Find and use Inkra components in an application with version-aware package discovery, component selection, public APIs, examples, setup and usage troubleshooting.
---

# Inkra documentation

Help a consuming developer answer: what can I use, which component fits, and how do I use it in this project? Respond in the user's language. Read [discovery and integration](references/discovery.md) for the data protocol, version resolution, setup and troubleshooting.

## Discover product facts

Start from the consumer's existing `@inkra/react` installation and the official documentation at https://inkrajs.github.io. If the user explicitly supplies a local mirror or versioned source, use that origin and identify it as such.

Read `/llms.txt` and the lightweight `/ai/components.json` index to discover capabilities, categories, canonical component pages and generated Markdown/type links. Select a small set matching the user's task, compare meaningful alternatives, then read their `markdownUrl` and relevant public declarations. Resolve relative links against the fetched document's URL. The index is a versioned documentation snapshot, not a hard-coded inventory in this skill or proof of the newest npm release.

Check the project's actually resolved package/lockfile and exported types before writing imports or props. Use `/version.json` when available and catalog package metadata otherwise to identify the deployed docs snapshot. Consult registry metadata only when the newest published version matters and network access is available. State a mismatch and use compatible APIs; an update requires the user's intended scope. Do not alias to private source or invent exports from component names.

When machine-readable endpoints are unavailable, use official rendered documentation, its examples and the installed package's public types. Identify what could not be verified, keep a bounded fallback and avoid repeatedly fetching a missing endpoint. Do not claim stale or unavailable data is current.

## Help with use

Prefer an existing component's documented behavior before rebuilding it from primitives. Explain a choice through the user's need, including any uncovered requirement. Provide the smallest useful setup or example with imports, styles, real state and relevant controlled/uncontrolled callbacks; preserve the application's architecture. Link the exact component/API/example consulted and distinguish application-owned data from component behavior.

For setup or bugs, inspect the smallest relevant consumer code and symptom. Focus on package version/imports, one entry stylesheet, theme scope/portal inheritance, native form behavior, controlled values and relevant layout boundaries. A syntax/build pass is not evidence that a visible interaction works.

For organizing a business screen, theme or custom appearance, fill that specific gap with **inkra-design** through the current available-skill catalog or the public [skill registry](https://inkrajs.github.io/skills/registry.json). If not installed, read its entry and relevant references as public guidance. Do not require it for an API-only answer, assume it is installed, forward the whole task back to inkra, or recurse over already-read guidance. This skill is independently usable.

Run only meaningful affected checks for code that changes, reuse valid results for unchanged inputs and report actual limits. Maintainer CI, library internals and publishing workflows are outside the default consumer context.
