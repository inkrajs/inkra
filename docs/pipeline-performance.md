# Pipeline Performance

## Version 0.9.0 Follow-Up (2026-10-27)

The three release runs were 40388605809 (24m08s), 40392534434 (32m08s), and
40398411054 (47m41s including the failed-install retry). From the first dispatch
to the GitHub Release, elapsed time was 1h53m50s, including repair/redispatch gaps.
These are not three npm uploads: only the last run published. Earlier failures
were a missing tracked pixel baseline/animation measurement and a report CLI
contract mismatch. Those fixes are already merged in docs PRs 16 and 17.

Successful-run job/step timestamps, excluding duplicate carried-forward jobs
in the GitHub retry response:

| Work | Observed duration | Finding |
| --- | ---: | --- |
| Package validation | 16m16s | Browser OS dependency installation alone 12m51s |
| Package check / React 18 SSR and types | 1m33s / 15s | Not the primary bottleneck |
| React 18/19 hydration | 1m11s | Previously blocked docs preparation |
| Docs prepare/build job | 37s | Actual build 9s |
| Browser checks on shards 1/2/3/4 | 14m38s / 8m57s / 13m36s / 9m15s | Count-based distribution is unbalanced |
| Browser installation on shard 1 | 10m31s | Other shards installed in 22-23s |
| Publish job / npm upload | 20s / 9s | Not the bottleneck |
| Initial registry validation | 79-80s, failed | Version endpoint ready; npm index still returned ETARGET |
| Retried clean registry installs | 31-39s jobs, passed | No second upload |
| Website 40405863046 build / deploy | 12m29s / 10s | Browser install 10m44s, route test 53s, build 7s |

The package validation log reports 20.8 MB downloaded from the Ubuntu Azure
mirror in 12m25s (27.9 kB/s). Chromium downloads took seconds. Adding only a
browser archive cache would not fix that OS-package bottleneck.

Changes prepared from these observations:

- Reuse the docs CI's immutable Playwright 1.64.1 Noble image in release browser,
  hydration and website jobs. Verify the installed npm version and launch the
  preinstalled Chromium; do not run apt or download browsers in each job. Image
  index and amd64 manifest were checked against MCR. Cold image pulls still cost
  time, so eliminating apt does not mean zero setup time.
- Upload the validated archive before hydration. Hydration and docs build/tests
  can proceed independently; the final gate still requires both React versions.
- Run report-contract and historical-baseline tests in docs preparation before
  launching the expensive browser matrix. This exposes the two tooling failures
  from this release early, without fabricating browser acceptance.
- Schedule longest checks first and balance four shards using the 109 recorded
  durations. Keep two workers per shard, exactly-once coverage, and new-test
  fallback. Simulation of the recorded durations lowers the longest shard from
  875.775s to 677.046s (22.7%). This is a scheduling replay, not a new CI benchmark.
- Retry only npm ETARGET identifying the exact release package/version for at
  most five minutes, with online metadata revalidation. Auth/network/integrity,
  dependency-version and process-timeout errors still fail immediately. SSR,
  type, archive-integrity and export checks never retry or get skipped.

Local validation: 41 library tooling tests and 153 docs contract tests pass;
actionlint accepts the release and deployment workflows. Chromium launches from
the installed package locally. Cloud image startup and new end-to-end elapsed
time remain unmeasured until a non-publishing validation runs. Do not publish a
new version or move react-v0.9.0 just to benchmark pipeline changes.

## Measured Baseline

Inspection date: 2026-10-26. The release sequence was observed around
04:10-05:35 Asia/Shanghai (2026-10-25 20:10-21:35 UTC).
Durations below come from GitHub Actions job/step timestamps, not local estimates.

| Repository / run | Job | Dominant step |
| --- | --- | --- |
| inkrajs/docs 40229529512 | 2148s | Browser smoke 2049s |
| inkrajs/inkra 40229546497 | validate 2401s | Browser smoke + homepage 2091s |
| inkrajs/inkra 40229546497 | publish 23s | Package upload, not browser validation |
| inkrajs/docs 40233093555 | 2165s | Browser smoke 2099s |
| inkrajs/inkrajs.github.io 40236044417 | build 120s; deploy 9s | Production browser check 59s |

Reproduce the job/step measurements with:

```sh
gh run view 40229529512 --repo inkrajs/docs --json jobs,createdAt,updatedAt
gh run view 40229546497 --repo inkrajs/inkra --json jobs,createdAt,updatedAt
gh run view 40233093555 --repo inkrajs/docs --json jobs,createdAt,updatedAt
gh run view 40236044417 --repo inkrajs/inkrajs.github.io --json jobs,createdAt,updatedAt
```

Docs builds took 24-26s and Chromium installation about 22s. Browser validation
is the critical path; publication and Pages deployment are not. The previous
runner lacked completion timestamps, so interleaved PASS output cannot reliably
attribute individual script durations. The old one-minute registry polling
window also caused manual verification retries while npm processed the upload.

## Local Changes

- Preserve the original 98-check list, split deterministically across four
  GitHub runners. Each runner still has at most two browser workers. Release
  validation includes the homepage as check 99.
- Prepare/build once, retain candidate inputs before browser validation, and
  require a final complete-coverage gate. Publishing still checks exact source,
  archive hashes, React 18/19 compatibility, browser results and registry bytes.
- Keep successful shards and build inputs on a failed-job rerun. Only diagnostic
  shard reports are replaceable; the npm candidate remains immutable.
- Record per-check duration, error and output; stop stuck checks after ten
  minutes, including their browser children. Retain failure diagnostics.
- Cancel superseded PR runs, never in-progress npm publication or Pages deploys.
- Cache npm downloads; prepare candidate lockfiles without a redundant install.
  Website keeps its current pinned-consumer build and production-route checks.
- Wait for mobile search focus before asserting it, retaining selection, close,
  Escape and desktop-transition checks. Do not use blind retries to mask failure.
- Retry registry 404 visibility for at most five minutes with 5/10/20/30s backoff,
  capped at 30s between requests. All other errors still fail closed.

## Verification And Rollout

Local unit/contract checks cover bounded workers, real process timeout cleanup,
timing/log output, exact 98/99-check partitioning, duplicate/missing/failed/stale
reports, candidate preparation arguments/checksums and registry retry boundaries.
The workflow files are validated with actionlint 1.7.12 and their publication
dependencies are inspected structurally. Docs production build remains required.

Local results on 2026-10-26: 18/18 library release tests, 115/115 docs contract
tests, repository portability checks, and docs TypeScript/Vite build passed.
The real fourth shard completed 24/24 browser checks in 207.75s using two local
workers against the existing 4180 server. This is not a cloud before/after
comparison. The CLI gate correctly rejected that single report as incomplete
four-shard evidence. The other three browser shards were not rerun locally.
Mobile search separately passed at 430/390/320px; no user browser settings,
release tags, registry versions or live deployments were changed.
An isolated temporary consumer also prepared the real 0.8.0 archive with
--lockfile-only, confirmed node_modules was absent, then passed npm ci and
check:candidate without altering the active docs checkout's package pins.

These changes are local until explicitly approved for merge. First merge the
docs tooling, then the library release workflow; select that compatible exact
docs commit on the next validation. Existing release tags must not be moved.
The website cache/diagnostic changes work with its currently pinned docs commit.
Do not dispatch another publication merely to benchmark the changes.

Use a non-publishing validation to measure all four shard durations, queue time,
setup cost, slowest scripts and total runner-minutes. A browser critical path of
roughly 10-15 minutes is a planning estimate, not a measured result; it depends
on runner availability and script balance. Four runners can increase aggregate
setup cost even while reducing elapsed time. Rebalance only from real timings.

Cross-run reuse is deliberately deferred: a green workflow or matching version
does not prove the same package, docs, lockfile, suite and runtime were checked.
A later optimization needs an exact-input verification record and a fail-closed
fallback to full validation. Changed-file selection also needs a dependency map.

The 2026-10-28 local-test confirmation mechanism is a separate, explicit path:
an allowed maintainer attests named local groups for an exact PR head/base,
environment and candidate archive. Release CI resolves that authorization from
GitHub and records confirmed groups alongside fresh online results. It does not
infer a cross-run cache hit or relabel local confirmations as cloud execution.
Unconfirmed coverage retains full online selection; source, build, archive,
hydration and registry gates remain required. Dynamic browser shard counts follow
the remaining online checks and the final gate verifies their exact plan.

Rollback by reverting these pipeline commits through normal review. Keep source
and archive identity gates, publication serialization and existing immutable tags.
Do not disable tests or change release pins just to shorten a failing run.
