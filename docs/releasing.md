# React Package Releases

Repository: inkrajs/inkra. Package: @inkra/react. First release: 0.1.0.
Version 0.1.0 is published and registry-verified. Future source versions remain
candidates until their own registry verification passes.
Website deployment does not publish an npm package.

## First Release Record

- Source/tag: 25e2e29bf3c001096440ebcff9c51c372c5a587f / react-v0.1.0.
- Staging run: 39671918917, followed by the maintainer's npm approval.
- Registry verification and GitHub Release run: 39677233690, successful.
- Public archive SHA-256:
  f86161cf33223628c64451ec87e39488f4b0f1ebc28db31e8ab7a8a595291a67.
- Temporary GitHub bootstrap secrets removed from npm-release and npm-bootstrap.

The first version used staging, not OIDC publishing. The maintainer has saved
the trusted publisher in npm package settings; it still shows Pending validation.
Do not describe OIDC as verified until a new version is successfully published
through that trusted workflow. Re-running 0.1.0 only verifies its existing bytes
and skips publishing, so it cannot validate the new trust relationship.

## Pipeline

Use the manually dispatched **Release npm package** workflow, publish.yml.
Select an exact inkrajs/docs commit in docs_ref; the docs consumer must import
the scoped package. Pushing main or a tag does not publish automatically.

| Action | Ref | Effect |
| --- | --- | --- |
| validate | main or candidate tag | Build and test; never publish |
| bootstrap-stage | react-vX.Y.Z | Submit the first package for npm approval |
| publish | react-vX.Y.Z | Publish using Trusted Publishing (OIDC) |
| verify | same release tag | Verify an approved stage and create GitHub Release |

Every mode checks clean source, package/lockfile version agreement, the exact
release tag, source ancestry on origin/main, repository and public registry.
Stable releases require latest; alpha candidates can only be validated.
Node 24 and npm 11.21.0 build and test the candidate, including package contents,
exports, license/font assets, React 18/19 installed SSR/types/hydration checks,
and the exact docs consumer's build, browser smoke and homepage tests.

Only that validated archive and manifest reach the publishing job; no product
rebuild occurs there. The scoped tarball is inkra-react-X.Y.Z.tgz. Actions
retains the candidate artifact for 90 days. Calendar's React 18 SSR warning and
the unverified Next.js/RSC boundary remain documented in rendering.md.

## Package Identity And Tags

On 2026-10-22 npm rejected the old unscoped name inkra as too similar to ink and
inert (recovery run 39659366235). Its staging endpoint had hidden that reason
behind a generic HTTP 400. No unscoped version was published.

The user approved @inkra/react. Product source remains in packages/inkra and
the GitHub repository remains inkrajs/inkra. New tags are react-vX.Y.Z; retain
the unsuccessful v0.1.0 tag without moving or deleting it. The one-off unscoped
recovery workflow has been retired and its temporary GitHub secrets removed.

## Approval Gates

The npm-release environment requires review by NWYLZW, disallows administrator
bypass, and must permit the version-tag pattern react-v*. Immutable-tag protection
must cover both historical v* and current react-v* tags.
Only the final GitHub Release job gets contents:write; the publishing job has
contents:read and id-token:write. Do not disable or bypass approval gates.

## Bootstrap Procedure

The existing npm organization is inkra, separate from the inkrajs GitHub
organization. On 2026-10-22 the official npm registry confirmed yijie4188 as
its owner. Recheck ownership before first publication; do not create another
organization or infer npm permissions from GitHub membership.

Store a short-lived authorized credential as NPM_BOOTSTRAP_TOKEN in the
npm-release environment using gh secret set with standard input. Never put
credentials in chat, command arguments or repository files. A session token
supports staging; staging defers rather than bypasses npm's required 2FA.

Dispatch bootstrap-stage for the reviewed react-v0.1.0 tag. Approve the protected
GitHub deployment, then approve the staged package on npm with 2FA. A staged
placeholder is not the usable release. Never submit a duplicate while a stage
is awaiting approval. Afterwards dispatch verify for the same tag and docs_ref.

Once the package exists, configure npm trust github for @inkra/react with:

| Setting | Value |
| --- | --- |
| GitHub repository | inkrajs/inkra |
| Workflow file | publish.yml |
| Environment | npm-release |
| Allowed command | npm publish |

Do not claim OIDC is configured until npm reads back that relationship. Complete
the first trusted publish within npm's displayed validity window. Revoke the
bootstrap credential and remove its GitHub secret after successful migration.
Future publish runs use short-lived OIDC, not a manually renewed access token.

If a CLI web-auth link expires, use the fixed npm package page: Settings,
Trusted publishing, GitHub Actions. A saved configuration is not an end-to-end
publish test. Newly created configurations must complete their first successful
publish within two days; use the deadline shown by npm. Never create an unapproved
version or overwrite a published version just to test authentication.

## Verification And Consumer Deployment

The verify job downloads the public archive and checks both SHA-256 and SHA-512
against the approved manifest. It installs @inkra/react@X.Y.Z in clean React
18/19 projects, verifies lockfile integrity, exports, types, styles and assets,
then creates the GitHub Release with the matching archive and manifest.

Retries skip publication only if the existing version has identical integrity.
Auth, rate-limit, network and server errors fail closed; only HTTP 404 means
absent. Do not overwrite a tag, package version or release asset.

After registry verification, update inkrajs/docs to the released package,
pin that docs revision in inkrajs/inkrajs.github.io, run its deployment checks,
and verify the live version.json and actual routes. Record compatible revisions
in the organization inventory. Validation, staging, npm publication and website
deployment are separate outcomes and must be reported separately.

## References

- https://docs.npmjs.com/creating-an-organization/
- https://docs.npmjs.com/trusted-publishers/
- https://docs.npmjs.com/staged-publishing/
- https://docs.npmjs.com/cli/v11/commands/npm-stage/

Discovery: gh has no --llms-txt surface. Official npm/documentation and npm/cli
sources were used on 2026-10-22. npm org supports membership operations, not
organization creation. Current browser runtime bootstrap fails because its
configured browser-service.mjs is unavailable; no browser workaround was used.
