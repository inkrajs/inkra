# Component discovery and integration

## Locate the project and package

Use the user's existing project files and package manager. The product is `@inkra/react`; package information is at https://www.npmjs.com/package/@inkra/react, source at https://github.com/inkrajs/inkra and consumer documentation at https://inkrajs.github.io/docs/getting-started. Preserve the current framework and dependency strategy. Installing the skill does not install the React library.

Read the actually resolved installed package version, export map and declarations; a broad range in `package.json` alone is not the installed version. A lockfile may identify a version without the dependency being installed. If a fresh application needs the package, use its existing package manager within the requested integration task, then import `@inkra/react/styles.css` once at the entry. This stylesheet includes the default fonts and tokens. A basic action uses `import { Button } from '@inkra/react'`; verify version-specific exports before using others.

## Read the generated documentation

Paths below are relative to the chosen documentation origin. They are produced with the documentation build; a checkout or deployment that predates them may not serve them.

| Resource | Purpose |
| --- | --- |
| `/llms.txt` | Package, documentation and discovery entry points |
| `/ai/components.json` | Component capability/category index and link metadata |
| `/ai/components/<slug>.md` | Targeted generated component information, API/type links and available examples |
| `/ai/types/<declaration-relative-path>` | Public declaration material from the documented installed package |
| `/version.json` | Deployed website/docs/library identity and consumed package version; a local ordinary build may omit this deployment-only file |
| `/skills/registry.json` | Related independent skills and their entry/readme/download locations |

Catalog protocol: `schemaVersion`, `package` (`name`, `version`, `source`, `revision`) and `docsRevision` identify the snapshot. Each component entry provides `name`, `slug`, `category`, localized `summary`, `importPath`, `exports`, `docsUrl`, `apiUrl`, `markdownUrl`, `typesUrl` and `exampleCount`. Validate that the response is the expected JSON/Markdown rather than a generic HTML fallback. Resolve each relative URL against its actual source URL, retaining a user-provided mirror origin. Fields can be unavailable; do not infer a valid import, example or declaration when a link/export is missing.

Use categories and summaries to shortlist by capability. Explain differences relevant to the task: a compact static table versus a data-heavy interactive table, a contextual popover versus an interrupting overlay, or manual layout versus dependency-driven graph layout. Confirm these distinctions in the chosen version's documentation instead of assuming a feature from the component name. Do not load all component pages into context.

Follow only the selected component's Markdown, public declaration and example links. `exampleCount` describes material indexed by the generator, not comprehensive API coverage or a promise that every feature has an example. A route in the index can be a documentation entry with multiple exports; use the declared import/export metadata rather than converting its slug to an assumed JavaScript identifier.

## Resolve versions and freshness

Keep three values separate:

1. **Installed package:** the version/types that code in this application will execute.
2. **Published registry release:** the latest release or a requested tag, queried when that distinction matters.
3. **Documentation snapshot:** the package version and docs revision used to generate the fetched index.

A same-version docs snapshot is a useful reference; the installed public declarations settle the actual export/prop contract. If docs are newer, look for compatible versioned references or use the installed declarations and tested existing usage. Explain unavailable newer features without upgrading the application automatically. A source branch or unpublished documentation example is not evidence that npm contains it.

Within one task, reuse the fetched catalog and selected pages while their origin/version/revision inputs remain unchanged. Refresh when the task asks for newer availability, the version identity changes, or the existing evidence is insufficient. If offline, report which local version and files were actually inspected; do not label an offline inventory as the latest published catalog.

## Usage troubleshooting

- **Missing export or prop:** compare the resolved installed version, entry/subpath export and public declaration. Check the exact component API before changing dependencies.
- **Plain appearance or wrong font:** check that `styles.css` loads once from the installed package, fonts resolve and the consumer's CSS is not overriding semantic tokens or font properties. Native text must remain readable while fonts load.
- **Unexpected colors or an overlay with another theme:** inspect the intended `ThemeProvider` scope, inherited tokens and documented portal behavior. Preserve the user's palette.
- **Value does not change, reset fails or form submission differs:** check the documented controlled/uncontrolled contract, callback payload, `name`, reset semantics, disabled and readonly behavior in the smallest relevant example.
- **Clipping, overflow or a graph without usable space:** inspect actual container constraints and documented dimensions, local scrolling and transformed ancestors. Keep the change local rather than redesigning unrelated screens.

Verify the changed flow and relevant narrow/keyboard behavior proportionally. Design or composition questions can consult inkra-design; a diagnosed API/setup issue need not load its entire visual guide.
