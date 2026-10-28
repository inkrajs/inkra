import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const workflow = await readFile(new URL('../../.github/workflows/publish.yml', import.meta.url), 'utf8');
const lock = JSON.parse(await readFile(new URL('../../package-lock.json', import.meta.url), 'utf8'));
const section = name => workflow.split(`\n  ${name}:\n`)[1]?.split(/\n  [a-z-]+:\n/)[0] ?? '';

test('release browser jobs use the locked prebuilt runtime without apt downloads', () => {
  assert.equal(lock.packages['node_modules/playwright'].version, '1.64.1');
  for (const name of ['hydration', 'browser']) {
    assert.match(section(name), /image: mcr\.microsoft\.com\/playwright:v1\.64\.1-noble@sha256:47b510dd9230bf0b9bfc9b20102241e577ea7a99334ab4c3ca19f19770e9b8ea/);
    assert.match(section(name), /options: --ipc=host/);
    assert.match(section(name), /name: Verify preinstalled browser runtime/);
  }
  assert.doesNotMatch(workflow, /playwright install|continue-on-error/);
});

test('hydration runs alongside docs on the same artifact and remains a release prerequisite', () => {
  assert.match(section('hydration'), /needs: validate/);
  assert.match(section('docs-build'), /needs: validate/);
  assert.doesNotMatch(section('validate'), /check-installed\.mjs --browser/);
  assert.match(section('hydration'), /name: npm-candidate/);
  for (const version of ['18.3.1', '19.3.1']) assert(section('hydration').includes(`REACT_VERSION=${version} node scripts/check-installed.mjs --browser`));
  assert.match(section('docs-verified'), /needs: \[validate, hydration, docs-build, browser\]/);
  assert.match(section('docs-verified'), /HYDRATION_RESULT: \$\{\{ needs.hydration.result \}\}/);
  assert.match(section('docs-verified'), /test "\$HYDRATION_RESULT" = success/);
  assert.match(section('publish'), /needs: \[validate, docs-verified\]/);
  assert.match(section('verify'), /needs.docs-verified.result == 'success'/);
});

test('docs report CLI and portable fixtures are tested before expensive browser jobs', () => {
  assert.match(section('docs-build'), /node --test scripts\/test\/browser-report.test.mjs scripts\/test\/browser-incremental-workflow.test.mjs scripts\/test\/icon-edge-baseline.test.mjs/);
  assert.match(section('browser'), /needs: docs-build/);
  assert.match(section('docs-verified'), /check-browser-reports.mjs \.ci-results \.ci-plan\/browser-selection.json/);
});

test('release coverage starts full and only trusted candidate-bound local results can reduce it', () => {
  assert.match(workflow, /local_validation_pr:[\s\S]*required: false[\s\S]*default: ''/);
  assert.match(section('validate'), /run: npm run check/);
  assert.match(section('docs-build'), /test -f scripts\/browser-local-validation.mjs/);
  assert.match(section('docs-build'), /REPOSITORY: inkrajs\/docs/);
  assert.match(section('docs-build'), /TARGET_SHA: \$\{\{ env.DOCS_REF \}\}/);
  assert.match(section('docs-build'), /PR_NUMBER: \$\{\{ inputs.local_validation_pr \}\}/);
  assert.match(section('docs-build'), /GH_TOKEN: \$\{\{ github.token \}\}/);
  assert.match(section('docs-build'), /run: node scripts\/resolve-pr-local-validation.mjs/);
  assert.match(section('docs-build'), /node scripts\/select-browser-checks.mjs --event release/);
  assert.match(section('docs-build'), /--attestation \.ci-plan\/local-validation.json/);
  assert.match(section('docs-build'), /--candidate library-candidate.json/);
  for (const name of ['docs-build', 'docs-verified']) {
    assert.match(section(name), /readFileSync\("\.release\/manifest.json"\)\)\.sha256/);
    assert.match(section(name), /EXPECTED_CANDIDATE_SHA256=/);
  }
  assert.doesNotMatch(section('publish'), /local_validation_pr|LOCAL_VALIDATION|local-validation/);
  assert.match(section('publish'), /run: node scripts\/release.mjs publish/);
  assert.match(section('verify'), /run: node scripts\/release.mjs verify/);
});

test('local component confirmations preserve build, package and installed-consumer release checks', () => {
  assert.match(workflow, /component_validation_pr:[\s\S]*required: false[\s\S]*default: ''/);
  assert.match(section('validate'), /id: component-local/);
  assert.match(section('validate'), /TARGET_SHA: \$\{\{ github.sha \}\}/);
  assert.match(section('validate'), /PR_NUMBER: \$\{\{ inputs.component_validation_pr \}\}/);
  assert.match(section('validate'), /run: npm run check\n\s+if: steps.component-local.outputs.accepted != 'true'/);
  assert.match(section('validate'), /if: steps.component-local.outputs.accepted == 'true'[\s\S]*npm run check:contracts\n\s+LOCAL_VALIDATION_REPORT=\.release\/component-local-validation.json node scripts\/component-local-validation.mjs/);
  assert.doesNotMatch(section('validate'), /LOCAL_VALIDATION_REPORT: /, 'exemption context must not leak into contract test fixtures');
  assert.match(section('validate'), /REACT_VERSION: 19.3.1/);
  const installed = section('validate').slice(section('validate').indexOf('- name: Verify the same archive with React 18'));
  assert.match(installed, /run: npm run check:installed/);
  assert.doesNotMatch(installed.slice(0, installed.indexOf('- name: Verify candidate identity')), /if:/);
  assert.match(installed, /run: node scripts\/release.mjs candidate/);
  assert.match(section('validate'), /name: release-component-local-validation/);
});

test('selected release shards and final gate share one exact coverage plan', () => {
  assert.match(section('docs-build'), /browser_plan_digest: \$\{\{ steps.browser-plan.outputs.plan_digest \}\}/);
  assert.match(section('browser'), /if: needs.docs-build.outputs.browser_selected_count != '0'/);
  assert.match(section('browser'), /shard: \$\{\{ fromJSON\(needs.docs-build.outputs.browser_matrix\) \}\}/);
  assert.match(section('browser'), /BROWSER_SHARD: \$\{\{ matrix.shard \}\}\/\$\{\{ needs.docs-build.outputs.browser_shard_count \}\}/);
  assert.match(section('browser'), /BROWSER_SELECTION_PLAN: \.ci-plan\/browser-selection.json/);
  for (const name of ['browser', 'docs-verified']) {
    assert.match(section(name), /name: release-browser-plan[\s\S]*path: \.ci-plan/);
    assert.match(section(name), /EXPECTED_BROWSER_PLAN_DIGEST: \$\{\{ needs.docs-build.outputs.browser_plan_digest \}\}/);
    assert.match(section(name), /EXPECTED_TESTED_REVISION: \$\{\{ env.DOCS_REF \}\}/);
  }
  assert.match(section('docs-verified'), /BROWSER_JOB_RESULT: \$\{\{ needs.browser.result \}\}/);
  assert.match(section('docs-verified'), /if: needs.docs-build.outputs.browser_selected_count != '0'[\s\S]*pattern: release-browser-report-/);
});

test('release prerequisites accept skipped browsers only for a trusted zero-selection output', () => {
  const shell = section('docs-verified').match(/run: \|\n((?:          .*(?:\n|$))+)/)?.[1]
    .split('\n').map(line => line.replace(/^          /, '')).join('\n');
  assert(shell?.includes('SELECTED_COUNT'), 'Exercise the actual workflow prerequisite shell');
  const run = patch => spawnSync('bash', ['-euc', shell], { env: {
    ...process.env, PACKAGE_RESULT: 'success', HYDRATION_RESULT: 'success', BUILD_RESULT: 'success',
    BROWSER_RESULT: 'success', SELECTED_COUNT: '2', ...patch,
  } }).status;
  assert.equal(run({}), 0);
  assert.equal(run({ BROWSER_RESULT: 'skipped', SELECTED_COUNT: '0' }), 0);
  for (const patch of [
    { BROWSER_RESULT: 'skipped', SELECTED_COUNT: '1' },
    { BROWSER_RESULT: 'skipped', SELECTED_COUNT: '' },
    { BROWSER_RESULT: 'failure', SELECTED_COUNT: '0' },
    { BROWSER_RESULT: 'cancelled', SELECTED_COUNT: '0' },
    { PACKAGE_RESULT: 'failure' }, { HYDRATION_RESULT: 'skipped' }, { BUILD_RESULT: 'cancelled' },
  ]) assert.notEqual(run(patch), 0, JSON.stringify(patch));
});
