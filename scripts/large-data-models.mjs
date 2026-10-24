// MODEL ONLY: no React render, DOM, browser interaction, layout, or paint.
// Fixture construction is outside run(). Repeated calls use identical inputs,
// not the result of the preceding call. Build the library before importing.
import * as transfer from '../packages/inkra/dist/transfer/model.js';
import * as tree from '../packages/inkra/dist/tree-select/model.js';
import * as tags from '../packages/inkra/dist/tag-input/model.js';

/**
 * Pure-model scenarios for the final built implementation, not a baseline.
 * run() returns the observed output count; outputCount is its expected value.
 * TagInput's public model has no bulk-commit/remove operation. Splitting pasted
 * text and duplicate lookup below are helpers, NOT timings of those UI actions.
 * Transfer's search is component-local, so no invented model search is included.
 */
export function scenarios(size) {
  if (!Number.isSafeInteger(size) || size < 4) {
    throw new RangeError('Model scenario size must be a safe integer >= 4.');
  }
  const items = Array.from({ length: size }, (_, i) => ({
    id: `item-${i}`, label: `Employee ${i}`, searchText: `Department ${i % 20}`,
  }));
  const half = Math.floor(size / 2);
  const target = items.slice(0, half).map(item => item.id);
  const source = items.slice(half).map(item => item.id);
  // Unknown controlled keys are an intentionally separate nonempty-data case.
  const unknown = Array.from({ length: half }, (_, i) => `external-${i}`);
  const controlled = [...target, ...unknown];

  // Exact total size; breadth 8, bounded depth rather than an artificial chain.
  const nodes = Array.from({ length: size }, (_, i) => ({
    id: `node-${i}`, label: `Department node ${i}`, children: [],
  }));
  for (let i = 1; i < size; i++) nodes[Math.floor((i - 1) / 8)].children.push(nodes[i]);
  const forest = [nodes[0]];
  const last = nodes[size - 1];
  last.keywords = 'exact-search-marker';
  const index = tree.indexTreeSelectNodes(forest);
  const leaves = nodes.filter(node => node.children.length === 0);
  const selected = leaves.filter((node, i) => i % 2 === 0 && node.id !== last.id).map(node => node.id);
  const allOptions = { multiple: true, branchSelection: 'all', selectionPropagation: 'both' };
  const leafOptions = { multiple: true, branchSelection: 'leaf', selectionPropagation: 'none' };
  let pathCount = 1;
  for (let p = size - 1; p > 0; p = Math.floor((p - 1) / 8)) pathCount++;

  const existingTags = Array.from({ length: size }, (_, i) => ({ id: `tag-${i}`, value: `Topic ${i}` }));
  const paste = existingTags.map(tag => tag.value).join(',');
  const base = { scope: 'model-only' };
  const entry = (name, shape, run, outputCount) => ({ ...base, name, shape, run, outputCount });
  return [
    entry('Transfer.model.split-existing-selection',
      `${size} real items; ${half} selected; reports source+target count`,
      () => { const result = transfer.splitTransferItems(items, target); return result.source.length + result.target.length; }, size),
    entry('Transfer.model.move-all-source',
      `${size} real items; ${half} selected; move ${source.length} source keys to target`,
      () => transfer.moveTransferKeys(items, target, source, 'to-target').length, size),
    entry('Transfer.model.move-one-source',
      `${size} real items; ${half} selected; move one source key to target`,
      () => transfer.moveTransferKeys(items, target, [source[0]], 'to-target').length, half + 1),
    entry('Transfer.model.remove-one-target',
      `${size} real items; ${half} selected; move one target key to source`,
      () => transfer.moveTransferKeys(items, target, [target[0]], 'to-source').length, half - 1),
    entry('Transfer.model.normalize-known-and-unknown',
      `${size} real items; ${half} known plus ${unknown.length} unknown controlled target keys`,
      () => transfer.normalizeTargetKeys(items, controlled).length, controlled.length),
    entry('TreeSelect.model.build-index',
      `${size} nodes; breadth 8; includes normalization and index allocation`,
      () => tree.indexTreeSelectNodes(forest).orderedIds.length, size),
    entry('TreeSelect.model.search-one-leaf-indexed',
      `${size} nodes; breadth 8; warm index; unique leaf keyword; includes ancestor path`,
      () => tree.filterTreeSelectNodesFromIndex(index, 'exact-search-marker').visibleIds.size, pathCount),
    entry('TreeSelect.model.select-root-indexed',
      `${size} nodes; breadth 8; ${selected.length} leaves already selected; warm index; both-direction propagation`,
      () => tree.updateTreeSelectSelectionFromIndex(index, selected, nodes[0].id, true, allOptions).length, size),
    entry('TreeSelect.model.select-one-leaf-indexed',
      `${size} nodes; breadth 8; ${selected.length} leaves already selected; warm index; no propagation`,
      () => tree.updateTreeSelectSelectionFromIndex(index, selected, last.id, true, leafOptions).length, selected.length + 1),
    entry('TagInput.model.split-bulk-paste',
      `${size} comma-separated values; ${paste.length} characters; parser helper only, no validation or commit`,
      () => tags.splitTagInputValue(paste).parts.length, size),
    entry('TagInput.model.lookup-existing-tail',
      `${size} existing tags; case/whitespace-normalized duplicate at final position; standalone linear lookup helper`,
      () => Number(tags.hasTagValue(existingTags, `  TOPIC ${size - 1}  `)), 1),
    entry('TagInput.model.lookup-new-value',
      `${size} existing tags; absent candidate; standalone linear lookup helper, not component cached validation`,
      () => Number(tags.hasTagValue(existingTags, 'New unmatched topic')), 0),
  ];
}
