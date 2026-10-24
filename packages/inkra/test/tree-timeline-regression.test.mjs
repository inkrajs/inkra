import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

test('Tree supports state-aware disclosure and row icons without a permanent button surface', () => {
  const tree = source('tree/index.tsx');
  assert.match(tree, /export interface TreeItemContentState/);
  assert.match(tree, /disclosureIcon\?: ReactNode \| \(\(state: TreeItemContentState\) => ReactNode\)/);
  assert.match(tree, /typeof disclosureIcon === 'function' \? disclosureIcon\(state\)/);
  assert.match(tree, /typeof icon === 'function' \? icon\(state\)/);
  assert.match(tree, /slot="chevron"/);
  assert.doesNotMatch(tree, /inkra-tree__disclosure-surface/);
  assert.doesNotMatch(tree, /variant="quiet"/);
  assert.match(source('tree/styles.css'), /disclosure-spacer \{ width: var\(--inkra-touch-target\); height: var\(--inkra-touch-target\)/);
});

test('Tree rows contain deep logical indentation and focus within their own bounds', () => {
  const css = source('tree/styles.css');
  assert.match(css, /box-sizing: border-box/);
  assert.match(css, /inline-size: 100%/);
  assert.match(css, /padding-inline-start: min\(calc\(\(var\(--inkra-tree-level/);
  assert.match(css, /max\(0px, calc\(100% - var\(--inkra-tree-reserved-inline\)\)\)/);
  assert.match(css, /\[data-has-icon\] \{ --inkra-tree-reserved-inline:/);
  assert.match(css, /\.inkra-tree__focus \{ inset: 1px/);
  assert.doesNotMatch(css, /\.inkra-tree__focus \{ inset: -1px/);
  assert.match(css, /\.inkra-pencil-surface\.inkra-tree__focus[\s\S]*display: none !important/);
  assert.match(css, /align-items: start/);
  assert.match(css, /\.inkra-tree__icon \{[^}]*margin-block-start: var\(--inkra-space-1\)/);
  assert.match(source('tree/index.tsx'), /TreeItemDescription[\s\S]*typeof children === 'string' \? <PencilText>/);
});

test('Timeline sizes replaced canvas elements explicitly along their connecting axis', () => {
  const css = source('timeline/styles.css');
  const vertical = css.match(/\[data-orientation="vertical"\] \.inkra-timeline__connector \{([^}]+)\}/)?.[1] ?? '';
  const horizontal = css.match(/\[data-orientation="horizontal"\] \.inkra-timeline__connector \{([^}]+)\}/)?.[1] ?? '';
  assert.match(vertical, /height: calc\(100%/);
  assert.match(horizontal, /width: calc\(100%/);
  assert.doesNotMatch(vertical, /height: auto/);
  assert.doesNotMatch(horizontal, /width: auto/);
  assert.match(vertical, /inset-inline-start/);
  assert.match(horizontal, /inset-inline-start/);
});
