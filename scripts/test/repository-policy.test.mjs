import assert from 'node:assert/strict';
import test from 'node:test';
import { checkComponentTestPortability } from '../repository-policy.mjs';

const path = 'packages/inkra/test/loading-source.test.mjs';

test('component tests reject ignored handoff inputs before build or remote CI', () => {
  for (const target of ['../../../.release/loading-handoff.md', '../../../.local/state.json', '.release/manifest.json']) {
    assert.throws(() => checkComponentTestPortability(path,
      `readFile(new URL('${target}', import.meta.url), 'utf8')`), /ignored local/);
  }
});

test('component tests keep tracked source, fixtures and built package checks', () => {
  for (const target of ['../src/loading/index.tsx', './fixtures/loading.mjs', '../dist/loading/index.js', '../package.json']) {
    assert.doesNotThrow(() => checkComponentTestPortability(path, `new URL('${target}', import.meta.url)`));
  }
  assert.throws(() => checkComponentTestPortability(path, "readFile('apps/docs/src/App.tsx')"), /separate docs/);
});

test('release tooling may still validate ignored package artifacts', () => {
  assert.doesNotThrow(() => checkComponentTestPortability('scripts/check-package.mjs', "readFile('.release/manifest.json')"));
});
