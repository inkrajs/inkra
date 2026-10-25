# React Package Releases

Repository: inkrajs/inkra. Package: @inkra/react. First release: 0.1.0.
Version 0.6.0 is published and registry-verified. Future source versions remain
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

## Version 0.4.3 Record

- Source/tag: 0f9cdc5ace22dc62bcc65875f3c925216572e826 / react-v0.4.3.
- Release run: 40136234346, successful on 2026-10-25 (Asia/Shanghai).
- Validation docs: 04ee219dfee981320b220753ed7941d7b59f57e1.
- OIDC publication, public archive comparison and clean React 18/19 installations passed.
- GitHub Release was created only after registry verification succeeded.
- Public archive SHA-256:
  2232f51a5aa9b91013fcd949c4585b541290b70df7d7fc5494a9eac244adb664.
- Registry docs consumer: 90251371184904cbad96fbc68bc5ac8f8255c5e2.
- npm initially reported that the package was still processing. The one-minute
  verification window expired before public availability; only failed verification
  jobs were rerun. No duplicate publication occurred.
- Versions 0.4.0 and 0.4.1 were not published after Linux browser checks found
  Drawer overflow and viewer scrollbar offsets. Version 0.4.2 remained unpublished
  after validation reached its 25-minute limit. All three tags are retained unchanged.
  Version 0.4.3 preserves the checks with a 45-minute validation limit.

## Version 0.5.0 Record

- Source/tag: a8dce668c0f614d557917274a39f62e4b490c6e2 / react-v0.5.0.
- Release run: 40179941672, successful on 2026-10-25 (Asia/Shanghai).
- Validation docs: f4a5226e50dcf3611d65b4e5f996b40f97da3fbf.
- OIDC publication, public archive comparison and clean React 18/19 installations passed.
- GitHub Release was created only after registry verification succeeded.
- Public archive SHA-256:
  5f0eced91fe98bba204b6f0af9f87cdf049c0d621999c956b3b29004e8efae0a.
- Registry docs consumer: a317377640eb63d8643cc6d3cfa57dfadc09f8a6.
- npm initially reported that the package was still processing. The one-minute
  verification window expired before public availability; only failed verification
  jobs were rerun after the archive became available. No duplicate publication occurred.
- The separately developed Select.Stepper alignment fix is not part of this version.

## Version 0.6.0 Record

- Source/tag: 1897b5c2f4b5520ad658821959643f2393b8a288 / react-v0.6.0.
- Release run: 40194921258, successful on 2026-10-25 (Asia/Shanghai).
- Validation docs: 5d97514e44015a4f04b025427084d8f007a0352d.
- OIDC publication, public archive comparison and clean React 18/19 installations passed.
- GitHub Release was created only after registry verification succeeded.
- Public archive SHA-256:
  06fbedf3ca9c6dcffd39c51cb5a06b8855dc518befbee182ebc172cef90b2c4f.
- Registry docs consumer: a2d99223275e3d280d473add5042ab6da757f258.
  Consumer check run 40198443308 passed, including installed-package browser smoke.
- Website source: 3fbc62b698544d04c3952c3a7336da2ad7a005d8.
  Deployment run 40200541355 passed; live version.json reports the matching
  docs/library revisions and registry package integrity. The homepage,
  getting-started, Layout and Breadcrumb routes returned HTTP 200.
- npm initially reported that the package was still processing. Only failed
  verification jobs were rerun after registry availability; no duplicate
  publication occurred and the source tag remained unchanged.
- Later Pagination, Grid and mobile Layout work is outside this archive.

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
