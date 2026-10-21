# First React Release

## State and Boundaries

Repository: `inkrajs/inkra`. Package: `inkra`. Intended first release: `0.1.0`.
The package remains `0.0.1-alpha.0` until release gates are satisfied.
Source pushes, public visibility, npm publication and docs deployment are
separate actions requiring approval.

This repository belongs to the `inkrajs` organization. CordisX is a reference
for bilingual documentation and checked candidates, not the repository owner.
Inkra retains MIT and existing third-party notices without copying CordisX's
host-specific release machinery or AGPL license.

## Candidate Checks

1. Install clean dependencies with `npm ci` from the public registry.
2. Run `npm run check`, producing `.release/manifest.json` and an npm tarball.
3. Run `REACT_VERSION=18.3.1 npm run check:installed` against the same tarball.
4. In `inkrajs/docs`, prepare the same candidate from this checkout, build and
   run relevant browser checks; inspect light/dark and narrow layouts.
5. Review package entries, licenses, exports, dependencies and README.

The manifest records name/version, npm integrity, SHA-256 and, on GitHub, the
candidate commit. Installation checks validate the checksum and install that
archive in a temporary project without source aliases or workspace links.

`Prepare release candidate` is a manual read-only GitHub workflow. It uploads
the checked tarball and manifest. The independent docs workflow takes an exact
library commit, builds its candidate and verifies the installed consumer before
uploading the docs artifact. Neither workflow publishes npm packages,
create Releases, deploy Pages or change repository visibility.

## Remaining First-Release Gates

- Confirm npm ownership and the final `inkra` name. Registry absence is not a
  reservation or a guarantee that publication is permitted.
- Verify installed-package browser hydration, fonts, canvas recovery, portals
  and the map lazy-loading boundary.
- Verify Next.js/RSC boundaries or document unsupported usage. SSR-only checks
  are not automatic RSC compatibility.
- The current React 18 installed-package SSR smoke renders markup but emits
  `useLayoutEffect` warnings from drawing components. Resolve these warnings
  and validate hydration before claiming clean React 18 SSR support.
- Review package README and API tables against the final exported types.
- Confirm and perform the initial commits/pushes for the six approved owner
  repositories, then record exact compatible revisions in `inkrajs/inkramono`.
  Visibility is already public except for the private `inkrajs/roadmap`.
- Enable and verify private vulnerability reporting before public release.
- Configure branch/ruleset checks after their actual CI names exist. YAML alone
  does not mean branch protection has been activated.
- Choose documentation hosting and test base paths, direct links and refresh.
  The current history router needs a host fallback; a docs artifact is not a
  functioning Pages deployment.
- Confirm npm account authorization and publishing authentication. Prefer
  trusted publishing for subsequent releases; bootstrap and package settings
  need an owner check. Never commit a publishing token.

## Approved Publication

After explicit approval, update package and lockfile to `0.1.0`, change the
current `alpha` dist-tag setting to `latest`, update the changelog and rerun all
gates. Review the exact digest before creating `v0.1.0`.

Publish the verified tarball, not a newly rebuilt directory. Install
`inkra@0.1.0` from npm in a clean consumer, compare registry integrity, verify
types/styles/fonts and create the GitHub Release for the same source tag.
Published docs must identify the version they describe.

No current workflow has publication permissions. Add the publishing job only
after ownership, authentication and the protected release environment are
configured and reviewed. Do not bypass missing authorization.

## Recovery

Stop before publishing when a gate fails. If npm succeeded but a later docs or
GitHub step failed, read registry state first and resume only the missing step.
Never replace an existing version with different bytes. Preserve the candidate
manifest and evidence; fixes normally require a reviewed patch version.
