import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../../.github/workflows/check.yml', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));

test('PR checks preserve contracts and use an auditable exact-tree component plan', () => {
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /if: github\.event_name != 'pull_request'[\s\S]*run: npm run check/);
  assert.match(workflow, /if: github\.event_name == 'pull_request'[\s\S]*run: npm run check:contracts/);
  assert.match(workflow, /--base "\$\{\{ github\.event\.pull_request\.base\.sha \}\}"/);
  assert.match(workflow, /--requested-head "\$\{\{ github\.event\.pull_request\.head\.sha \}\}"/);
  assert.match(workflow, /--tested-revision HEAD/);
  assert.match(workflow, /run-component-tests\.mjs --plan/);
});

test('package scripts retain full check while exposing contract and incremental commands', () => {
  assert.match(manifest.scripts.check, /npm test/);
  assert.match(manifest.scripts['check:contracts'], /check:repository.*test:release.*build.*check:package.*check:installed/);
  assert.equal(manifest.scripts['test:components:plan'], 'node scripts/plan-component-tests.mjs');
  assert.equal(manifest.scripts['test:components:run'], 'node scripts/run-component-tests.mjs');
});
