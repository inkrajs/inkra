import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

import { sealPlan } from '../component-test-plan.mjs';

const repositoryRoot = resolve(new URL('../../', import.meta.url).pathname);
const planner = join(repositoryRoot, 'scripts/plan-component-tests.mjs');
const runner = join(repositoryRoot, 'scripts/run-component-tests.mjs');

async function write(root, path, source) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, source);
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

test('runner executes exactly the declared suite and rejects plan tampering', async () => {
  const root = await mkdtemp(join(tmpdir(), 'inkra-runner-'));
  try {
    git(root, 'init', '-q');
    await write(root, 'packages/inkra/src/widget.ts', 'export const widget = true;\n');
    await write(root, 'packages/inkra/test/widget.test.mjs', "import test from 'node:test'; import assert from 'node:assert/strict'; test('widget', () => assert.equal(1, 1));\n");
    await write(root, 'packages/inkra/test/other.test.mjs', "import test from 'node:test'; test('other', () => { throw new Error('must stay skipped'); });\n");
    git(root, 'add', '.');
    git(root, '-c', 'user.name=CI', '-c', 'user.email=ci@example.test', 'commit', '-qm', 'base');
    const base = git(root, 'rev-parse', 'HEAD');
    await write(root, 'packages/inkra/test/widget.test.mjs', "import test from 'node:test'; import assert from 'node:assert/strict'; test('widget changed', () => assert.equal(2, 2));\n");
    git(root, 'add', '.');
    git(root, '-c', 'user.name=CI', '-c', 'user.email=ci@example.test', 'commit', '-qm', 'head');
    const head = git(root, 'rev-parse', 'HEAD');
    const planPath = join(root, 'component-plan.json');
    execFileSync(process.execPath, [planner, '--root', root, '--base', base, '--tested-revision', 'HEAD', '--requested-head', base, '--output', planPath], { encoding: 'utf8' });
    const plan = JSON.parse(await readFile(planPath, 'utf8'));
    assert.equal(plan.testedRevision, head);
    assert.equal(plan.requestedHead, base);
    assert.equal(plan.mergePreview, true);
    assert.deepEqual(plan.selectedTests, ['packages/inkra/test/widget.test.mjs']);
    assert.deepEqual(plan.skippedTests, ['packages/inkra/test/other.test.mjs']);

    const success = spawnSync(process.execPath, [runner, '--root', root, '--plan', planPath], { encoding: 'utf8' });
    assert.equal(success.status, 0, success.stderr || success.stdout);
    assert.match(success.stdout, /1 selected, 1 skipped/);

    plan.selectedTests = [];
    await writeFile(planPath, JSON.stringify(plan, null, 2));
    const tampered = spawnSync(process.execPath, [runner, '--root', root, '--plan', planPath], { encoding: 'utf8' });
    assert.notEqual(tampered.status, 0);
    assert.match(tampered.stderr, /digest does not match/);

    const overlap = JSON.parse(await readFile(join(root, 'component-plan.json'), 'utf8'));
    overlap.selectedTests = ['packages/inkra/test/widget.test.mjs'];
    overlap.skippedTests = ['packages/inkra/test/other.test.mjs', 'packages/inkra/test/widget.test.mjs'];
    overlap.counts = { total: 2, selected: 1, skipped: 2 };
    sealPlan(overlap);
    await writeFile(planPath, JSON.stringify(overlap, null, 2));
    const overlapping = spawnSync(process.execPath, [runner, '--root', root, '--plan', planPath], { encoding: 'utf8' });
    assert.notEqual(overlapping.status, 0);
    assert.match(overlapping.stderr, /must be disjoint/);

    const unknownMode = JSON.parse(await readFile(planPath, 'utf8'));
    unknownMode.selectedTests = ['packages/inkra/test/widget.test.mjs'];
    unknownMode.skippedTests = ['packages/inkra/test/other.test.mjs'];
    unknownMode.counts = { total: 2, selected: 1, skipped: 1 };
    unknownMode.mode = 'partial';
    sealPlan(unknownMode);
    await writeFile(planPath, JSON.stringify(unknownMode, null, 2));
    const invalidMode = spawnSync(process.execPath, [runner, '--root', root, '--plan', planPath], { encoding: 'utf8' });
    assert.notEqual(invalidMode.status, 0);
    assert.match(invalidMode.stderr, /Unsupported component test plan mode/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
