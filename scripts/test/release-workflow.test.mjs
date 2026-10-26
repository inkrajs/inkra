import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  assert.match(section('docs-verified'), /check-browser-reports.mjs \.ci-results 4/);
});
