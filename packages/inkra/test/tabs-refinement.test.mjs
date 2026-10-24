import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/tabs/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/tabs/styles.css', import.meta.url), 'utf8');

test('Tabs deduplicates one synchronous pointer interaction but allows controlled retries', () => {
  assert.match(source, /const pendingRequest = useRef<string \| null>\(null\)/);
  assert.match(source, /if \(pendingRequest\.current === next\) return/);
  assert.match(source, /pendingRequest\.current = next/);
  assert.match(source, /queueMicrotask\(\(\) => \{[\s\S]*?pendingRequest\.current = null/);
  assert.doesNotMatch(source, /lastChange/);
  assert.match(source, /if \(value === undefined\) setInternal\(next\)/);
  assert.match(source, /onValueChange\?\.\(next\)/);
});

test('Tabs forced colors override PencilSurface display and selection specificity', () => {
  assert.match(styles, /\.inkra-pencil-surface\.inkra-tabs__focus-ring/);
  assert.match(styles, /\.inkra-pencil-surface\.inkra-tabs__selection/);
  assert.match(styles, /forced-colors: active[\s\S]*?\.inkra-pencil-surface\.inkra-tabs__focus-ring \{ display: none !important; \}/);
  assert.match(styles, /forced-colors: active[\s\S]*?\.inkra-pencil-surface\.inkra-tabs__selection \{ display: none !important; \}/);
  assert.match(styles, /\.inkra-tabs__trigger\[data-state="active"\][\s\S]*?outline: 2px solid Highlight/);
});

test('Tabs narrow overflow keeps focus ink inside stable trigger geometry', () => {
  assert.match(styles, /\.inkra-tabs__list[\s\S]*?overflow-x: auto[\s\S]*?overflow-y: hidden/);
  assert.match(styles, /scroll-padding-inline: var\(--inkra-focus-offset\)/);
  assert.match(styles, /\.inkra-pencil-surface\.inkra-tabs__focus-ring[\s\S]*?inset: var\(--inkra-focus-width\)/);
  assert.doesNotMatch(styles, /\.inkra-tabs__list[^{]*\{[^}]*padding-block/);
});

test('Tabs continues to delegate mature semantics to Radix', () => {
  assert.match(source, /<Primitive\.Root/);
  assert.match(source, /<Primitive\.List/);
  assert.match(source, /<Primitive\.Trigger/);
  assert.match(source, /<Primitive\.Content/);
  assert.match(source, /hidden=\{current !== value\}/);
  assert.doesNotMatch(source, /onKeyDown=|addEventListener\(['"]keydown/);
});
