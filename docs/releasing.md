# React Package Releases

Repository: inkrajs/inkra. Package: @inkra/react. First release: 0.1.0.
Version 0.3.0 is published and registry-verified. Future source versions remain
candidates until their own registry verification passes.
Website deployment does not publish an npm package.

## First Release Record

- Source/tag: 25e2e29bf3c001096440ebcff9c51c372c5a587f / react-v0.1.0.
- Staging run: 39671918917, followed by the maintainer's npm approval.
- Registry verification and GitHub Release run: 39677233690, successful.
- Public archive SHA-256:
  f86161cf33223628c64451ec87e39488f4b0f1ebc28db31e8ab7a8a595291a67.
- Temporary GitHub bootstrap secrets removed from npm-release and npm-bootstrap.

The first version used staging, not OIDC publishing. Version 0.2.0 subsequently
validated the trusted publisher through a successful OIDC publication.

## Version 0.2.0 Record

- Source/tag: 035d3380cc2e1bd1c524d69ca74dd62f4ed10230 / react-v0.2.0.
- Release run: 39873927781, approved by the maintainer on 2026-10-23.
- OIDC publication succeeded; public archive and React 18/19 installation checks passed.
- GitHub Release was created after registry verification succeeded.
- Public archive SHA-256:
  f3f9448495c3fd6fe6a013a7c91801e52fc787b39f3852575551d890c82e935a.
- npm initially reported that the package was still processing. The first registry
  verification exhausted its one-minute availability window; only the failed verification
  jobs were rerun after the public package became available. No duplicate publication occurred.

## Version 0.3.0 Record

- Source/tag: ae2a38f146e657773b00765128c2a1e478582a02 / react-v0.3.0.
- Release run: 39945191730, successful on 2026-10-23 without manual environment approval.
- Validation docs: b950d0eb6ee06d135857ae2b55189692948c1102.
- OIDC publication, public archive comparison and clean React 18/19 installations passed.
- GitHub Release was created only after registry verification succeeded.
- Public archive SHA-256:
  d244164ba3d5317ebbdc43112cd8cf2288a96a421da3417f6b9914ea08fca732.
- Registry docs consumer: cebdf3ad6581209add9ce1d965e266cf329f84b4.
- Earlier run 39944246310 stopped at a Tree browser measurement during entrance
  motion, before publication. The docs test was corrected to measure after the
  animation; no component assertion was removed and the source tag was unchanged.

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

## Release Authorization

On 2026-10-23, the maintainer explicitly requested removal of the redundant
GitHub environment approval. The npm-release environment has no required
reviewers and no wait timer. Once an explicitly requested publish run passes
validation, publication proceeds without a second manual approval.

Keep the npm-release environment and the workflow's environment binding: npm
Trusted Publishing uses this identity. Preserve its version-tag policies
(react-v* and historical v*) and disabled administrator bypass. Immutable-tag
protection must continue to cover both tag patterns.

Pushing main or a tag still does not publish. Dispatch publish.yml only when
the user explicitly requests publication, and retain all source, version,
archive, browser and registry checks. Only the final GitHub Release job gets
contents:write; the publishing job has contents:read and id-token:write.
Do not reinstate required reviewers without the maintainer's authorization.

## Bootstrap Procedure

The existing npm organization is inkra, separate from the inkrajs GitHub
organization. On 2026-10-22 the official npm registry confirmed yijie4188 as
its owner. Recheck ownership before first publication; do not create another
organization or infer npm permissions from GitHub membership.

Store a short-lived authorized credential as NPM_BOOTSTRAP_TOKEN in the
npm-release environment using gh secret set with standard input. Never put
credentials in chat, command arguments or repository files. A session token
supports staging; staging defers rather than bypasses npm's required 2FA.

The first release used bootstrap-stage for the reviewed react-v0.1.0 tag,
with GitHub environment approval followed by npm approval with 2FA. A staged
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
