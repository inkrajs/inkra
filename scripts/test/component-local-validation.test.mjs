import assert from 'node:assert/strict';
import test from 'node:test';
import { componentLocalValidation } from '../component-local-validation.mjs';

const tests = ['packages/inkra/test/log.test.mjs', 'packages/inkra/test/log-refinement.test.mjs', 'packages/inkra/test/number-ticker.test.mjs'];
const context = { targetRevision: 'a'.repeat(40), targetTree: 'b'.repeat(40), environment: 'node24-react19.3.1' };
const receipt = { accepted: true, repository: 'inkrajs/inkra', targetRevision: context.targetRevision,
  targetTree: context.targetTree, headTree: context.targetTree,
  componentGroups: { 'component:log': tests.slice(0, 2), 'component:log-refinement': [tests[1]], 'component:lo': [] },
  actor: { id: 51358815, login: 'NWYLZW' }, prUrl: 'https://github.com/inkrajs/inkra/pull/1',
  declarations: [{ group: 'component:log', environments: [context.environment], evidence: 'https://example.com/report', reason: 'Local tests passed' }] };

test('local confirmation removes only declared module files in the declared environment', () => {
  const result = componentLocalValidation(tests, receipt, context);
  assert.deepEqual(result.selected, [tests[2]]);
  assert.deepEqual(result.waived.map(entry => entry.path), tests.slice(0, 2));
  assert.equal(result.waived[0].actor.id, 51358815);
  assert.deepEqual(componentLocalValidation(tests, receipt, { ...context, environment: 'node22-react18.3.1' }).selected, tests);
  assert.deepEqual(componentLocalValidation(tests, { accepted: false }, context).selected, tests);
});

test('changed commit, merge tree, repository and unconfirmed merge content reject exemptions', () => {
  for (const changed of [{ targetRevision: 'c'.repeat(40) }, { targetTree: 'c'.repeat(40) },
    { headTree: 'c'.repeat(40) }, { repository: 'another/repo' }]) {
    assert.throws(() => componentLocalValidation(tests, { ...receipt, ...changed }, context));
  }
});

test('declarations do not leak into similarly named modules or other test kinds', () => {
  const declaration = receipt.declarations[0];
  for (const group of ['component:lo', 'component:log-refinement', 'browser:log']) {
    const result = componentLocalValidation(tests, { ...receipt, declarations: [{ ...declaration, group }] }, context);
    assert.deepEqual(result.waived.map(entry => entry.path), group === 'component:log-refinement' ? [tests[1]] : []);
  }
});

test('explicit module membership never treats InputNumber or TreeSelect as parent-module tests', () => {
  const paths = ['packages/inkra/test/input-props.test.mjs', 'packages/inkra/test/input-number.test.mjs',
    'packages/inkra/test/tree.test.mjs', 'packages/inkra/test/tree-select.test.mjs'];
  const declaration = receipt.declarations[0];
  const result = componentLocalValidation(paths, { ...receipt,
    componentGroups: { 'component:input': [paths[0]], 'component:tree': [paths[2]] },
    declarations: ['component:input', 'component:tree'].map(group => ({ ...declaration, group })),
  }, context);
  assert.deepEqual(result.selected, [paths[1], paths[3]]);
});
