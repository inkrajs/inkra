// Real React-component scenarios. Dataset construction is deliberately outside
// timed mounts. Use React test renderer act() around mounts/updates/interact().
// No DOM, layout, paint, scroll, portal mounting, or input latency is measured.
import React from 'react';
import { Transfer } from '../packages/inkra/dist/transfer/index.js';
import { TreeSelect } from '../packages/inkra/dist/tree-select/index.js';
import { TagInput } from '../packages/inkra/dist/tag-input/index.js';
import { ChoiceGrid, ChoiceGridOption } from '../packages/inkra/dist/choice-grid/index.js';

function host(root, type, predicate) {
  const matches = root.findAll(node => node.type === type && predicate(node.props));
  if (matches.length !== 1) throw new Error(`Expected one ${type}, found ${matches.length}`);
  return matches[0];
}

export async function scenarios(size) {
  if (!Number.isSafeInteger(size) || size < 2) throw new Error('size must be an integer >= 2');
  const items = Array.from({ length: size }, (_, i) => ({
    id: `asset-${i}`,
    label: `Inventory asset ${String(i).padStart(6, '0')}`,
    description: `Equipment allocation for department ${i % 25}`,
    keywords: [`warehouse-${String(i % 100).padStart(3, '0')}`, `department-${i % 25}`],
    disabled: i % 37 === 0,
  }));
  const targetKeys = items.filter((_, i) => i % 5 === 0).map(item => item.id);
  const transferProps = { items, targetKeys, searchable: true };

  // Total includes both branches and leaves, never size + hidden branch nodes.
  const treeItems = [];
  const leafIds = [];
  for (let index = 0; index < size;) {
    const branch = { id: `department-${index}`, label: `Department ${index}`, children: [] };
    treeItems.push(branch);
    index += 1;
    for (let child = 0; child < 99 && index < size; child += 1, index += 1) {
      const id = `employee-${index}`;
      branch.children.push({ id, label: `Employee ${index}`, description: `Team ${child % 10}`, keywords: `region-${child % 8}` });
      leafIds.push(id);
    }
  }
  const selectedLeafIds = leafIds.slice(0, Math.min(100, Math.floor(leafIds.length / 5)));
  const treeProps = { items: treeItems, multiple: true, open: false, value: selectedLeafIds, 'aria-label': 'Assign employees' };

  const tags = Array.from({ length: size }, (_, i) => ({ id: `tag-${i}`, value: `topic-${i}`, label: `Project topic ${i}` }));
  let pasteResult;
  const tagProps = {
    value: tags,
    'aria-label': 'Project topics',
    onValueChange: (next, details) => { pasteResult = { length: next.length, added: details.tags.length, reason: details.reason }; },
  };
  const changedTags = tags.slice();
  changedTags[size - 1] = { ...tags[size - 1], label: `Updated project topic ${size - 1}` };
  const pasted = Array.from({ length: 100 }, (_, i) => `new-topic-${i}`).join(',');

  const children = Array.from({ length: size }, (_, i) => React.createElement(ChoiceGridOption, {
    key: `plan-${i}`, value: `plan-${i}`, label: `Service plan ${i}`,
    description: `Capacity tier ${i % 20}; region ${i % 12}`, disabled: i % 37 === 0,
  }));
  const values = Array.from({ length: Math.floor(size / 5) }, (_, i) => `plan-${i * 5}`);
  const gridProps = { name: 'service-plans', label: 'Service plans', type: 'multiple', columns: 4, values, children };

  return [
    {
      name: 'Transfer/full-two-panels', component: Transfer,
      props: transferProps,
      changedProps: { ...transferProps, targetKeys: [...targetKeys, 'asset-1'] },
      shape: `${size} nonvirtualized records; both panels visible, 20% initially transferred; changed selection moves one asset; search scans available panel`,
      counts: { inputRecords: size, renderedRecords: size, initiallyTransferred: targetKeys.length },
      interaction: 'Search available items for warehouse-007 (roughly 1% of input)',
      interact(root) {
        host(root, 'input', p => p.type === 'search' && p['aria-label'] === 'Search available items')
          .props.onChange({ currentTarget: { value: 'warehouse-007' }, target: { value: 'warehouse-007' } });
      },
      missingBrowserCoverage: ['DOM/layout/paint', 'keyboard and focus after moving records'],
    },
    {
      name: 'TreeSelect/closed-preprocessing', component: TreeSelect,
      props: treeProps,
      changedProps: { ...treeProps, value: [...selectedLeafIds, leafIds.at(-1)] },
      shape: `${size} total nodes, ${treeItems.length} branches, depth 2; CLOSED portal; normalization/indexing and React element construction run, but dropdown rows do not mount; changed selection adds one leaf`,
      counts: { inputNodes: size, branches: treeItems.length, leaves: leafIds.length, mountedDropdownRows: 0 },
      missingBrowserCoverage: ['OPEN TreeSelect dropdown mount', 'dropdown search/filter interaction', 'expanded tree row rendering', 'portal layout, focus and paint'],
    },
    {
      name: 'TagInput/full-controlled-tags', component: TagInput,
      props: tagProps,
      changedProps: { ...tagProps, value: changedTags },
      shape: `${size} visible nonvirtualized tags with remove controls; one label changed; controlled paste validates/emits 100 new tags but owner does not apply emitted value`,
      counts: { inputTags: size, renderedTags: size, pastedCandidates: 100 },
      interaction: 'Paste 100 distinct comma-separated tags; verify emitted size and added count (controlled value is not applied)',
      interact(root) {
        pasteResult = undefined;
        host(root, 'input', p => p.type === 'text' && p['aria-label'] === 'Project topics').props.onPaste({
          defaultPrevented: false,
          preventDefault() { this.defaultPrevented = true; },
          clipboardData: { getData: type => type === 'text' ? pasted : '' },
          currentTarget: { selectionStart: 0, selectionEnd: 0 },
        });
        if (pasteResult?.length !== size + 100 || pasteResult?.added !== 100 || pasteResult?.reason !== 'add') {
          throw new Error(`TagInput paste did not emit the expected result: ${JSON.stringify(pasteResult)}`);
        }
        return pasteResult;
      },
      missingBrowserCoverage: ['DOM/layout/paint', 'caret, keyboard and focus', 'mounting emitted extra tags after controlled callback'],
    },
    {
      name: 'ChoiceGrid/full-multiple-options', component: ChoiceGrid,
      props: gridProps,
      changedProps: { ...gridProps, values: [...values, 'plan-1'] },
      shape: `${size} actual ChoiceGridOption children, descriptions and checkboxes; 20% selected; changed values select one additional option; all options mounted without virtualization`,
      counts: { inputOptions: size, renderedOptions: size, initiallySelected: values.length },
      // onValuesChange aggregates actual DOM checkbox state via querySelectorAll.
      // With createNodeMock returning null, invoking it reports [] incorrectly.
      missingBrowserCoverage: ['multiple-selection DOM aggregation callback', 'native form and focus behavior', 'DOM/layout/paint'],
    },
  ];
}
