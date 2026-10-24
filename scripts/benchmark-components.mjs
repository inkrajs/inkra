// Pure-model benchmark, not a browser responsiveness or visual-acceptance test.
// Run: node scripts/benchmark-components.mjs [baseline-git-ref]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as tree from '../packages/inkra/src/tree-select/model.ts';
import * as transfer from '../packages/inkra/src/transfer/model.ts';

const baseline = process.argv[2] ?? '35e26d81e985ed9011f3387a3aac27bfb423c07f';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'inkra-component-baseline-'));
const options = { multiple: true, branchSelection: 'all', selectionPropagation: 'both' };

function nestedNodes(count) {
  let children = [];
  for (let position = count - 1; position >= 0; position--) {
    children = [{ id: `node-${position}`, label: `Node ${position}`, children }];
  }
  return children;
}

function medianMs(run, count = 7) {
  run();
  const durations = [];
  for (let sample = 0; sample < count; sample++) {
    const start = performance.now();
    run();
    durations.push(performance.now() - start);
  }
  durations.sort((a, b) => a - b);
  return Number(durations[Math.floor(durations.length / 2)].toFixed(3));
}

function verifyTreeEquivalence(previous) {
  let seed = 17;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let example = 0; example < 250; example++) {
    const forest = [];
    const records = [];
    for (let position = 0; position < 55; position++) {
      const node = {
        id: random() < .05 ? '' : `node-${Math.floor(random() * 50)}`,
        label: `Label ${position % 7}`,
        disabled: random() < .2,
        children: [],
      };
      const parent = records.length && random() < .7 ? records[Math.floor(random() * records.length)] : null;
      (parent ? parent.children : forest).push(node);
      records.push(node);
    }
    assert.deepEqual(tree.normalizeTreeSelectNodes(forest), previous.normalizeTreeSelectNodes(forest));
    for (const query of ['', 'label', 'Label 2', 'unmatched']) {
      const before = previous.filterTreeSelectNodes(forest, query);
      const after = tree.filterTreeSelectNodes(forest, query);
      assert.deepEqual(after.nodes, before.nodes);
      assert.deepEqual([...after.visibleIds], [...before.visibleIds]);
      assert.deepEqual([...after.expandedIds], [...before.expandedIds]);
    }
    for (const multiple of [false, true]) for (const branchSelection of ['leaf', 'all']) for (const selectionPropagation of ['none', 'down', 'both']) {
      const current = records.filter(() => random() < .5).map(node => node.id).concat('external', 'external');
      const toggledId = records[Math.floor(random() * records.length)].id;
      const selected = random() < .5;
      const mode = { multiple, branchSelection, selectionPropagation };
      assert.deepEqual(tree.updateTreeSelectSelection(forest, current, toggledId, selected, mode),
        previous.updateTreeSelectSelection(forest, current, toggledId, selected, mode));
    }
  }
}

try {
  const loadBaseline = async component => {
    const source = execFileSync('git', ['show', `${baseline}:packages/inkra/src/${component}/model.ts`], { cwd: root });
    const path = join(directory, `${component}.ts`);
    await writeFile(path, source);
    return import(pathToFileURL(path).href);
  };
  const previousTree = await loadBaseline('tree-select');
  const previousTransfer = await loadBaseline('transfer');
  verifyTreeEquivalence(previousTree);
  console.log('Tree output equivalence passed: 250 deterministic forests, 12 selection modes, normalization and 4 search queries.');
  console.log(`Runtime: ${process.version}; baseline: ${baseline}; timing: 7-sample median after warmup.`);

  const keys = Array.from({ length: 20000 }, (_, index) => `external-${index}`);
  assert.deepEqual(transfer.normalizeTargetKeys([], keys), previousTransfer.normalizeTargetKeys([], keys));
  console.log(JSON.stringify({
    scenario: 'Transfer: normalize 20,000 unknown controlled target keys',
    baselineMs: medianMs(() => previousTransfer.normalizeTargetKeys([], keys)),
    optimizedMs: medianMs(() => transfer.normalizeTargetKeys([], keys)),
  }));

  const nodes = nestedNodes(1500);
  assert.deepEqual(tree.updateTreeSelectSelection(nodes, [], 'node-0', true, options),
    previousTree.updateTreeSelectSelection(nodes, [], 'node-0', true, options));
  console.log(JSON.stringify({
    scenario: 'TreeSelect: select root of 1,500-deep tree, both-direction propagation including index construction',
    baselineMs: medianMs(() => previousTree.updateTreeSelectSelection(nodes, [], 'node-0', true, options)),
    optimizedMs: medianMs(() => tree.updateTreeSelectSelection(nodes, [], 'node-0', true, options)),
  }));
  const index = tree.indexTreeSelectNodes(nodes);
  console.log(JSON.stringify({
    scenario: 'TreeSelect: same selection reusing component index',
    optimizedMs: medianMs(() => tree.updateTreeSelectSelectionFromIndex(index, [], 'node-0', true, options)),
  }));

  const deep = nestedNodes(20000);
  for (const [name, implementation] of [['baseline', previousTree], ['optimized', tree]]) {
    try {
      console.log(`${name} 20,000-deep model indexing: ${implementation.indexTreeSelectNodes(deep).orderedIds.length} nodes`);
    } catch (error) {
      if (name !== 'baseline' || !(error instanceof RangeError)) throw error;
      console.log(`${name} 20,000-deep model indexing: ${error.name}: ${error.message}`);
    }
  }
  console.log('These measurements do not establish the cause of the reported intermittent page crash.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
