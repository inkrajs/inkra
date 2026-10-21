# React Package Releases

Repository: inkrajs/inkra. Package: inkra. Intended first release: 0.1.0.
The package and lockfile declare the 0.1.0 candidate, with latest as its
publication tag. Website deployment does not publish an npm package.

## Pipeline

Use the **Release npm package** GitHub Actions workflow (publish.yml). It is
manually dispatched; neither pushing main nor creating a tag publishes a package.
Local npm login is not a prerequisite. Never put credentials in chat or source.

The action input has four explicit modes:

| Action | Ref | Effect |
| --- | --- | --- |
| validate | main or a candidate tag | Build and test an archive; never publish |
| bootstrap-stage | exact stable version tag | Submit the first package for npm approval using the environment secret |
| publish | exact stable version tag | Publish with npm Trusted Publishing (OIDC), without a stored npm token |
| verify | same stable version tag | Verify an approved staged version or resume after an interrupted publish |

Select the exact inkrajs/docs commit in docs_ref. It defaults to the tested
documentation checkpoint, not a moving branch.

Every mode starts with a clean source checkout and npm 11.21.0. The workflow
checks repository portability, release-policy tests, components, package
contents, exports, styles/fonts and installed-package SSR/types with React
18 and 19. It also hydrates server-rendered fixtures in Chromium with both
React versions, checking controls, portals, lazy maps and canvas recovery.
The independent docs checkout installs that exact archive, then
builds and runs its browser smoke and homepage suites.

Only the resulting tarball and manifest are passed to the publishing job.
They are retained as an Actions artifact for 90 days. The publishing job has
no product build or dependency install and rechecks commit, version and both
archive digests before npm receives anything.

For a real release, all of the following must match: the selected vX.Y.Z tag,
package.json version, lockfile version, latest dist-tag and candidate commit.
The tag commit must be reachable from origin/main. Alpha candidates can be
validated but cannot pass the stable publication gate.

## GitHub Authorization

The publishing job uses the npm-release environment. Configure it with:

- Maintainer approval by NWYLZW.
- Only version tags matching v* may deploy.
- No administrator bypass of the environment gate.

The OIDC job has contents:read and id-token:write. Only the separate final
GitHub Release job gets contents:write, after public-registry checks pass.
Keep v* tags immutable with repository update/deletion rules.
The npm-release reviewer/tag policies and immutable-tag rules have been
configured and read back on GitHub. Private vulnerability reporting is enabled.

## First Package Bootstrap

The inkra package was not found in the public registry at the last check.
Absence is not a reservation or proof of publishing permissions.

npm configures Trusted Publishers through an existing package's settings.
For the first package, an authorized npm owner can create a short-lived,
minimally scoped granular access token and store it directly as the
NPM_BOOTSTRAP_TOKEN secret in GitHub's npm-release environment.
The token needs package creation/write permission; no bypass-2FA option is
needed for staging. The npm account must have 2FA enabled.

The CLI can store the secret using `gh secret set NPM_BOOTSTRAP_TOKEN
--repo inkrajs/inkra --env npm-release`. Supply the credential through its
interactive prompt or standard input, never a command argument or log.
GitHub authentication cannot create an npm credential. An optional npm web
login can establish an authorized npm session; it never publishes locally.

Run bootstrap-stage for the reviewed stable tag and approve the GitHub
environment deployment. This uses npm stage publish, not a local publish.
For a new package, npm creates a public 0.0.0-stage placeholder; the candidate
contents do not become public until the npm maintainer approves them.

Review the candidate under npm's Staged Packages tab and approve with 2FA.
This human npm authorization cannot be replaced by GitHub credentials or an
OIDC token. Then run verify for the exact same tag.

Once the package exists, configure its Trusted Publisher:

| Field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization | inkrajs |
| Repository | inkra |
| Workflow filename | publish.yml |
| Environment | npm-release |
| Allowed action | npm publish |

New npm configurations may default to staging-only; explicitly allow direct
publishing for the publish mode. Complete the first trusted publish within
the validity period shown by npm. Revoke the bootstrap token and remove the
GitHub secret after successful migration; prefer disallowing token publishing.

## Registry Verification And Recovery

### Initial Staging Service Failure

On 2026-10-22, staging run 39656403601 and its retry failed with npm HTTP 400
"Version uniqueness check failed unexpectedly". The authenticated staged list
was empty and the public package returned 404. This is not a completed release.

The temporary Bootstrap first npm publication workflow recovers only the exact
v0.1.0 source and validated artifact 12372033672 from that run. It never rebuilds
the package or moves the tag. A separate npm-bootstrap environment retains
maintainer review, disallows administrator bypass and permits main only.
The official npm CLI runs inside Actions with a terminal for browser 2FA; its
approval URL is exposed in a one-day npm-approval artifact. No OTP or credential
is put into that artifact. The original pipeline remains the verification and
GitHub Release path. Provenance records the recovery workflow's real identity;
the checked manifest records the original tagged product source.
Remove bootstrap secrets from both environments after configuring OIDC.

After publish, or when running verify, the workflow reads the public registry,
downloads its archive and compares SHA-256 and SHA-512 with the approved
candidate. It installs inkra@X.Y.Z from npm in clean React 18/19 consumers,
checks the installed lockfile integrity, imports, types, styles and fonts,
then creates the GitHub Release with that same archive and manifest.

A retry skips npm publication only if the existing public version has the
same integrity. Different bytes stop the workflow. HTTP authorization,
rate-limit and server errors are not interpreted as an available version.
Never overwrite a tag, package version or release asset. A staged version
that is waiting for approval must be approved or rejected on npm before a
retry; do not submit another version merely to bypass the approval.

## 0.1.0 Release Checklist

- Package and lockfile versions agree on 0.1.0 and latest; the changelog
  describes candidate scope without claiming a public release.
- Run all candidate checks on the exact commit, including the independent
  docs_ref consumer. Existing alpha artifacts are not release evidence.
- Rendering coverage and explicit Calendar/Next.js limits are documented in
  [rendering.md](rendering.md). Do not claim warning-free Calendar SSR or RSC
  certification from the browser tests.
- Record compatible source revisions in the organization integration inventory.
- Configure and verify npm package ownership and publishing authorization;
  only then dispatch bootstrap-stage or publish for the immutable v0.1.0 tag.
- After approval/publication, run registry verification and create the GitHub
  Release. Update the docs to the released registry version and verify the
  deployed consumer; do not relabel the existing alpha site as 0.1.0.

Do not claim a completed release while registry verification or authorization
is unresolved. Required maintainer approvals must not be bypassed.

## References

- https://docs.npmjs.com/trusted-publishers/
- https://docs.npmjs.com/staged-publishing/
- https://docs.npmjs.com/cli/v11/commands/npm-stage/

Discovery: gh does not expose --llms-txt. npm publication behavior was checked
against the reachable official npm/documentation and npm/cli sources, including
trusted-publishers.mdx, staged-publishing.mdx and npm-stage.md on 2026-10-22.
