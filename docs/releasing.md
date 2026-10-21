# React Package Releases

Repository: inkrajs/inkra. Package: inkra. Intended first release: 0.1.0.
The current package is still 0.0.1-alpha.0. Website deployment is complete;
it does not publish an npm package.

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
18 and 19. The independent docs checkout installs that exact archive, then
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

## Remaining 0.1.0 Product Gates

- Review final API/docs parity and approve the exact stable candidate.
- Verify browser hydration, canvas recovery, portals and lazy-loaded maps;
  client-rendered docs checks alone are not hydration acceptance.
- Resolve React 18 server-rendering layout-effect warnings, or explicitly
  narrow the supported SSR contract. Validate or document Next.js/RSC support.
- Update package and lockfile to 0.1.0, use latest, and finalize the changelog.
- Record compatible source revisions in the organization integration inventory.
- Configure and verify npm package ownership and the authorization above.
- After publication, update the docs to the released registry version and
  verify the deployed consumer. Do not relabel the existing alpha site as 0.1.0.

Do not publish while one of these product gates is unresolved.

## References

- https://docs.npmjs.com/trusted-publishers/
- https://docs.npmjs.com/staged-publishing/
- https://docs.npmjs.com/cli/v11/commands/npm-stage/

Discovery: gh does not expose --llms-txt. npm publication behavior was checked
against the reachable official npm/documentation and npm/cli sources, including
trusted-publishers.mdx, staged-publishing.mdx and npm-stage.md on 2026-10-22.
