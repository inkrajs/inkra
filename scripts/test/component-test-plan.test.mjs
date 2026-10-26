import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { createPlanFromEntries, planComponentTests } from '../component-test-plan.mjs';

const files = {
  'packages/inkra/src/Button.tsx': "export function Button() { return null; }\n",
  'packages/inkra/src/index.ts': [
    "export { Button } from './Button.js';",
    "export { Loading } from './loading/index.js';",
    "export { NumberTicker } from './number-ticker/index.js';",
  ].join('\n'),
  'packages/inkra/src/internal/shared.ts': 'export const shared = 1;\n',
  'packages/inkra/src/foo/Foo.ts': 'export const Foo = true;\n',
  'packages/inkra/src/foo/index.ts': "export { Foo } from './Foo.js';\n",
  'packages/inkra/src/bar/index.ts': "import { Foo } from '../foo/index.js'; export const Bar = Foo;\n",
  'packages/inkra/src/loading/index.tsx': "import { Button } from '../Button.js'; import { model } from './model.js'; export const Loading = Button && model;\n",
  'packages/inkra/src/loading/model.ts': "import { shared } from '../internal/shared.js'; export const model = shared;\n",
  'packages/inkra/src/loading/styles.css': '.loading {}\n',
  'packages/inkra/src/number-ticker/index.tsx': "import { rolling } from './rolling.js'; export const NumberTicker = rolling;\n",
  'packages/inkra/src/number-ticker/rolling.ts': "import { shared } from '../internal/shared.js'; export const rolling = shared;\n",
  'packages/inkra/test/button.test.mjs': "import { Button } from '../dist/Button.js'; void Button;\n",
  'packages/inkra/test/bar.test.mjs': "import { Bar } from '../dist/bar/index.js'; void Bar;\n",
  'packages/inkra/test/dynamic-runtime.test.mjs': "const target = process.env.TARGET; await import(target);\n",
  'packages/inkra/test/fixtures/loading-fixture.mjs': "export const fixture = true;\n",
  'packages/inkra/test/fixtures/carousel-helper.mjs': "import { NumberTicker } from '../../dist/number-ticker/index.js'; void NumberTicker;\n",
  'packages/inkra/test/loading-source.test.mjs': "import '../test/fixtures/loading-fixture.mjs'; const source = new URL('../src/loading/index.tsx', import.meta.url); const css = new URL('../src/loading/styles.css', import.meta.url); void source; void css;\n",
  'packages/inkra/test/loading.test.mjs': "import { Loading } from '../dist/loading/index.js'; void Loading;\n",
  'packages/inkra/test/carousel-parent.test.mjs': "const helper = new URL('./fixtures/carousel-helper.mjs', import.meta.url); void helper;\n",
  'packages/inkra/test/number-ticker.test.mjs': "import { NumberTicker } from '../dist/number-ticker/index.js'; void NumberTicker;\n",
  'packages/inkra/test/root-loading.test.mjs': "import { Loading } from '../dist/index.js'; void Loading;\n",
  'packages/inkra/test/arbitrary-string.test.mjs': "const values = ['./a\\0b', './']; void values;\n",
};

function makePlan(changedEntries, overrides = {}) {
  const snapshot = { ...files, ...overrides };
  const paths = new Set(Object.keys(snapshot));
  const read = path => snapshot[path];
  return createPlanFromEntries({
    base: 'a'.repeat(40),
    basePaths: paths,
    baseRead: read,
    changedEntries,
    headPaths: paths,
    headRead: read,
    requestedHead: 'b'.repeat(40),
    testedRevision: 'b'.repeat(40),
  });
}

function selected(plan) {
  return new Set(plan.selectedTests);
}

test('isolated component styles select source assertions, runtime coverage and named root consumers', () => {
  const plan = makePlan([{ status: 'M', path: 'packages/inkra/src/loading/styles.css' }]);
  assert.equal(plan.mode, 'incremental');
  assert.deepEqual(plan.affectedComponents, ['index', 'loading']);
  assert(selected(plan).has('packages/inkra/test/loading-source.test.mjs'));
  assert(selected(plan).has('packages/inkra/test/loading.test.mjs'));
  assert(selected(plan).has('packages/inkra/test/root-loading.test.mjs'));
  assert(selected(plan).has('packages/inkra/test/dynamic-runtime.test.mjs'));
  assert(!selected(plan).has('packages/inkra/test/button.test.mjs'));
  assert(!selected(plan).has('packages/inkra/test/number-ticker.test.mjs'));
});

test('reverse transitive dependencies include consumers of shared components and modules', () => {
  const button = makePlan([{ status: 'M', path: 'packages/inkra/src/Button.tsx' }]);
  assert(selected(button).has('packages/inkra/test/button.test.mjs'));
  assert(selected(button).has('packages/inkra/test/loading.test.mjs'));
  assert(selected(button).has('packages/inkra/test/loading-source.test.mjs'));
  assert(!selected(button).has('packages/inkra/test/number-ticker.test.mjs'));

  const shared = makePlan([{ status: 'M', path: 'packages/inkra/src/internal/shared.ts' }]);
  assert(selected(shared).has('packages/inkra/test/loading.test.mjs'));
  assert(selected(shared).has('packages/inkra/test/number-ticker.test.mjs'));
});

test('named barrel re-exports propagate through source consumers to their tests', () => {
  const plan = makePlan([{ status: 'M', path: 'packages/inkra/src/foo/Foo.ts' }]);
  assert(selected(plan).has('packages/inkra/test/bar.test.mjs'));
  assert(plan.affectedSourceFiles.includes('packages/inkra/src/foo/index.ts'));
  assert(plan.affectedSourceFiles.includes('packages/inkra/src/bar/index.ts'));
});

test('fixture and helper source coverage propagates recursively to the parent test', () => {
  const plan = makePlan([{ status: 'M', path: 'packages/inkra/src/number-ticker/rolling.ts' }]);
  assert(selected(plan).has('packages/inkra/test/carousel-parent.test.mjs'));
  const fixture = makePlan([{ status: 'M', path: 'packages/inkra/test/fixtures/carousel-helper.mjs' }]);
  assert(selected(fixture).has('packages/inkra/test/carousel-parent.test.mjs'));
});

test('changed tests and their mapped fixtures are selected directly', () => {
  const direct = makePlan([{ status: 'M', path: 'packages/inkra/test/number-ticker.test.mjs' }]);
  assert.deepEqual(direct.selectedTests, ['packages/inkra/test/number-ticker.test.mjs']);

  const fixture = makePlan([{ status: 'M', path: 'packages/inkra/test/fixtures/loading-fixture.mjs' }]);
  assert.deepEqual(fixture.selectedTests, ['packages/inkra/test/loading-source.test.mjs']);
});

test('empty changes select zero tests while preserving the auditable inventory', () => {
  const plan = makePlan([]);
  assert.equal(plan.mode, 'incremental');
  assert.equal(plan.counts.selected, 0);
  assert.equal(plan.counts.skipped, plan.counts.total);
  assert.deepEqual(plan.selectedTests, []);
});

test('non-literal dynamic product imports fail closed without arbitrary test strings crashing analysis', () => {
  const dynamic = { 'packages/inkra/src/internal/dynamic.ts': "const target = './shared.js'; export async function load() { return import(target); }\n" };
  const plan = makePlan([{ status: 'M', path: 'packages/inkra/src/internal/shared.ts' }], dynamic);
  assert.equal(plan.mode, 'full');
  assert(plan.reasons.some(item => item.code === 'unresolved-source-edge' && item.files.some(file => file.includes('non-literal dynamic import'))));
  assert.equal(plan.counts.selected, plan.counts.total);
});

test('unknown, configuration, deletion and rename changes conservatively select all tests with reasons', () => {
  for (const entry of [
    { status: 'M', path: 'notes/unknown.txt' },
    { status: 'M', path: 'package-lock.json' },
    { status: 'D', path: 'packages/inkra/src/loading/model.ts' },
    { status: 'R', oldPath: 'packages/inkra/src/loading/model.ts', path: 'packages/inkra/src/loading/state.ts', score: 90 },
  ]) {
    const plan = makePlan([entry]);
    assert.equal(plan.mode, 'full');
    assert.equal(plan.counts.selected, plan.counts.total);
    assert(plan.reasons.length > 0);
  }
});

async function write(root, path, source) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, source);
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

test('missing base history produces an explicit non-empty full plan for the tested tree', async () => {
  const root = await mkdtemp(join(tmpdir(), 'inkra-plan-missing-'));
  try {
    git(root, 'init', '-q');
    await write(root, 'packages/inkra/src/widget.ts', 'export const widget = true;\n');
    await write(root, 'packages/inkra/test/widget.test.mjs', "import test from 'node:test'; test('widget', () => {});\n");
    git(root, 'add', '.');
    git(root, '-c', 'user.name=CI', '-c', 'user.email=ci@example.test', 'commit', '-qm', 'fixture');
    const head = git(root, 'rev-parse', 'HEAD');
    const plan = planComponentTests({ root, base: '0'.repeat(40), requestedHead: head, testedRevision: 'HEAD' });
    assert.equal(plan.mode, 'full');
    assert.equal(plan.testedRevision, head);
    assert.deepEqual(plan.selectedTests, ['packages/inkra/test/widget.test.mjs']);
    assert.equal(plan.reasons[0].code, 'missing-history');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('missing or unrelated requested PR heads cannot produce an incremental plan', async () => {
  const root = await mkdtemp(join(tmpdir(), 'inkra-plan-head-'));
  try {
    git(root, 'init', '-q');
    await write(root, 'packages/inkra/src/widget.ts', 'export const widget = true;\n');
    await write(root, 'packages/inkra/test/widget.test.mjs', "import test from 'node:test'; test('widget', () => {});\n");
    git(root, 'add', '.');
    git(root, '-c', 'user.name=CI', '-c', 'user.email=ci@example.test', 'commit', '-qm', 'base');
    const base = git(root, 'rev-parse', 'HEAD');
    await write(root, 'packages/inkra/src/widget.ts', 'export const widget = false;\n');
    git(root, 'add', '.');
    git(root, '-c', 'user.name=CI', '-c', 'user.email=ci@example.test', 'commit', '-qm', 'tested');
    const missing = planComponentTests({ root, base, requestedHead: '0'.repeat(40), testedRevision: 'HEAD' });
    assert.equal(missing.mode, 'full');
    assert.equal(missing.reasons[0].code, 'missing-requested-head');

    git(root, 'checkout', '-q', '-b', 'unrelated', base);
    await write(root, 'unrelated.txt', 'other\n');
    git(root, 'add', '.');
    git(root, '-c', 'user.name=CI', '-c', 'user.email=ci@example.test', 'commit', '-qm', 'unrelated');
    const unrelated = git(root, 'rev-parse', 'HEAD');
    git(root, 'checkout', '-q', '-');
    const notTested = planComponentTests({ root, base, requestedHead: unrelated, testedRevision: 'HEAD' });
    assert.equal(notTested.mode, 'full');
    assert.equal(notTested.reasons[0].code, 'requested-head-not-tested');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
