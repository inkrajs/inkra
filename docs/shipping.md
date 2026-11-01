# One entry for website delivery

The user can continue to ask the agent to deploy in the current chat. The agent
prepares a reviewed plan and invokes `npm run ship` once, then intervenes only
when a gate fails or a source decision needs review. The command does not call a
model, create another chat, publish npm, bypass CI, or modify model settings.

## Prepare the inputs

Finish the intended source changes and identify their committed refs. Do not
automatically stage everything: unrelated drafts remain in the original working
trees and are excluded from delivery. The preview prints the exact chosen SHAs
and warns which source trees are dirty. It does not decide which uncommitted
edits belong to a release.

Copy `scripts/ship.example.json` to a private plan such as `.release/ship-plan.json`.
Choose a unique stable `id`, a useful PR title, and the reviewed library/docs
refs. Directory paths are relative to the Inkra repository root, regardless of
where the plan file is stored. They can also be absolute in a local plan.

Omit `library.ref` to preserve the library revision already pinned by the chosen
docs commit. Registry-backed docs retain their registry source unless a library
ref is explicitly supplied. The source repositories must be the three Inkra
GitHub repositories; the website always publishes through its approved `main`.

```sh
# Read-only preview: no fetch, install, commit, PR, push or deployment.
npm run ship -- --plan .release/ship-plan.json

# Only after the user has authorized deployment of these reviewed sources:
npm run ship -- --plan .release/ship-plan.json --execute
```

`--execute` authorizes the plan's pushes, PR creation, normal merge and website
deployment. Developing or testing this command does not itself authorize a new
publication. A later plan change requires a new id; resuming an unchanged plan
continues its frozen commits even if a symbolic source ref has since moved.

## What proceeds automatically

1. Check repository identities and ancestry, then create detached worktrees.
2. Build and verify the exact library archive; reuse an intact same-run archive.
3. Pin and build the installed docs candidate with the existing preparation script.
4. Push source branches, discover or create PRs, and wait for their current gates.
5. Merge library and docs in dependency order. Create the website's exact docs pin,
   merge its PR and wait for that exact commit's existing deployment workflow.
6. Verify the live website/docs/library identities, package integrity and HTTP
   routes. The website CI still runs its production browser/route checks.

Already-merged source commits need no new PR. Completed local steps are not
repeated on resume. A candidate checksum mismatch, changed PR head/base, failed
check, closed unmerged PR or foreign edit stops the run. There is no force-push,
admin merge, automatic failing-job rerun or invented test exemption.

The command does not re-run a full local component/browser suite. Existing PR
affected-component selection and historical release-browser reuse remain in their
own CI workflows. Mandatory package/build/installed-consumer checks remain active.

## Existing local test results

If an actual complete local test group already passed, the agent may supply its
existing declaration JSON through `library.localValidation` or
`docs.localValidation`. Follow [the AI CI guide](ai-ci-guide.md). The entry checks
the exact tested head/base, candidate hash when supplied, authenticated numeric
user ID and policy from the PR base. It copies the declared environments and
evidence without claiming to have run them. CI's resolver must explicitly accept
the same head/base, groups and environments before merging.

No declaration means normal CI selection, not an implicit waiver. Do not run
extra tests merely to obtain an exemption. The command never expands an allowlist.
If the generated docs pin changes the tested head, the old receipt is invalid.

For an optional review/testing checkpoint before any push:

```sh
npm run ship -- --plan .release/ship-plan.json --execute --until prepared
# Inspect the exact prepared docs commit, or run relevant checks there.
# Then resume the same plan and id:
npm run ship -- --plan .release/ship-plan.json --execute
```

## Recovery and timing

```sh
npm run ship -- --status my-reviewed-change
npm run ship -- --plan .release/ship-plan.json --execute
```

Each run stores phase timings, frozen source SHAs, PRs, the deployment run,
accepted local-test declarations, logs and an atomic checkpoint under
`.release/ship/<id>/`. A repository-wide lock prevents concurrent local runs.
Only a lock whose local PID no longer exists is recovered automatically.
Keep this private directory intact until delivery finishes.

GitHub reads have bounded retries. Mutations are not blindly retried: a resumed
run first inspects the source branch, PR and merge state. Thus a lost merge reply
does not create another PR or deploy another commit. A failed cloud job remains
failed until an authorized operator fixes or reruns it; then the same plan can
continue. A CDN identity mismatch waits before stopping, without redeploying.

Unchanged polling stays quiet. The final report distinguishes live identity/HTTP
verification from CI browser checks. `--status` reports saved progress rather
than launching another poll or certifying that an old release is still live.
Completed ids are historical records and return without another publication.

This reduces model round trips; it does not change the model provider's own
first-output latency. End-to-end savings still need measurement on a real future
authorized publication. This implementation is verified with isolated fixtures,
including an uncertain merge response; it is not evidence of a new live release.
