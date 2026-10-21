# Inkra Organization Structure

Status: approved boundaries; six remote repositories created and local trees
prepared. Initial commits/pushes, remote CI and publication are still pending.
Reviewed on 2026-10-21. GitHub organization: `inkrajs`.

## Current State

All six repositories below exist, with no source commits yet. The library npm
workspace contains only `packages/*`. The original `apps/docs` directory is now
an independent `inkrajs/docs` Git checkout, ignored by the library and consuming
a verified installed tarball with no source aliases. Its existing preview is
preserved. Supporting local repositories contain community defaults, a homepage
publishing scaffold, an integration inventory and private release planning.
The homepage is not implemented or deployed by this structural migration.

## What To Learn From CordisX

The reference organization separates product implementation, portable contracts,
documentation navigation, the public homepage, organization community files,
cross-repository integration, private planning and independently maintained
plugins. Repository count is a consequence of ownership, not a target.

Sources inspected through the GitHub API:

- `cordisx/cordisxmono`: README and `.agents/docs/organization-context.md`.
- `cordisx/docs`: README, including its explicit portal/aggregation distinction.
- `cordisx/cordisx.github.io`: README and homepage ownership.
- `cordisx/cordisx-protocol`: README and implementation-independent contracts.
- `cordisx/.github`: organization profile.
- The current organization repository inventory, including visibility.

The private roadmap's contents were not needed or read. CordisX licensing and
product-specific plugin infrastructure do not transfer to Inkra.

## Approved Repositories

| Repository | Visibility | Owns | Does not own |
| --- | --- | --- | --- |
| `inkrajs/.github` | Public | Organization profile, bilingual onboarding, default community and issue/PR templates | Product code, automatic inheritance of CI workflows or secrets |
| `inkrajs/inkra` | Public | React components, drawing implementation, tokens, exported API, package tests, MIT notices, changelog, npm releases | Organization homepage, private planning |
| `inkrajs/docs` | Public | Interactive documentation, examples, search, translations, versioned presentation and installed-package integration tests | A second implementation of components or duplicated API authority |
| `inkrajs/inkrajs.github.io` | Public | Brand homepage, project navigation, real showcases and public-site publishing | Component APIs, a duplicate component playground |
| `inkrajs/inkramono` | Public | Development entrypoint, repository inventory, task routing, exact compatible revisions and cross-repository checks | Component source or a second npm distribution |
| `inkrajs/roadmap` | Private | Provisional decisions, research and release coordination | Public API facts or information required to build the public project |

The main product stays named `inkra`; GitHub repository names do not require
changing the current npm package name. Registry ownership remains a release
gate. The React 0.1.0 scope is not expanded to other frameworks by this plan.

## Dependency And Documentation Boundaries

1. `inkra` is buildable, testable and releasable without the other repositories.
2. `docs` consumes an exact package version or verified candidate tarball.
   Production validation must not depend on an alias into `inkra/src`.
3. Exported types, API semantics, tokens and design contracts remain authoritative
   in `inkra`. The docs site renders or links a revision-matched source snapshot;
   hand-editing a second conflicting API table is not the target architecture.
4. The homepage links to a verified docs deployment and displays actual product
   captures. Creating a Pages-named repository does not deploy a site.
5. `inkramono` records compatible source revisions after each owning repository
   has real commits. It coordinates development without bundling product code.
   Private planning is opt-in and never required by public CI or installation.
6. Public contribution defaults belong in `.github`. Product-specific checks,
   package permissions and release workflows remain in the owning repository.

## Migration Progress

1. Done: approved names and visibility applied to the six remote repositories.
2. Prepared locally: organization profile, bilingual community entrypoints and
   templates. They are not visible on GitHub until initial source pushes.
3. Prepared locally: independent docs checkout, lockfile, installed-candidate
   validation, browser fixtures and build. There is only one live docs copy.
4. Prepared locally: `inkramono` inventory, doctor and candidate-sync commands.
   The authoritative inventory is `inkrajs/inkramono:repositories.json`; revisions
   are intentionally null until real owner commits exist. Do not create empty
   submodule links or describe this as a pinned remote bootstrap yet.
5. Pending: prepare and verify homepage/docs publication, including base
   paths, direct links, browser refresh, fonts and version labels. Keep the
   existing local preview available during this work.
6. Pending: complete the React 0.1.0 gates in `releasing.md`, then separately authorize
   package publication and site deployment. Repository creation alone is not a
   release or an acceptance result.

## Later, When There Is A Real Consumer

- `inkra-core`: extract framework-neutral strokes, washes, caches and tokens
  only when there is a second independent consumer and a tested standalone API.
- `icons`: independent icon data and generators only if there is an actual
  independently versioned distribution. Current PencilIcon is a React renderer;
  the documentation's Lucide catalog is not a separate published icon package.
- Framework adapters and starter templates: separate repositories once there
  is maintained implementation and compatibility testing, not placeholder claims.

There is no current Inkra plugin protocol or marketplace requirement. Do not
clone the CordisX protocol, marketplace or plugin repository hierarchy merely
to match its size.

## Acceptance

- Inventory, Git remotes, README links and package repository metadata agree.
- Every repository has one owner boundary, real entrypoints and honest status.
- Public checkouts and CI do not require private credentials or local paths.
- Docs validate the same installed package candidate intended for release.
- Source migration, public visibility, commits/pushes, CI, npm publication,
  site deployment and user acceptance are reported separately.
