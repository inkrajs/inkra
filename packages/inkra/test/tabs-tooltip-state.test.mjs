import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { Tabs } from '../dist/tabs/index.js';
import { Tooltip } from '../dist/tooltip/index.js';
import { shouldCollapseTabLabels } from '../dist/tabs/useLabels.js';

const icon = h('span', { 'data-synthetic-icon': true }, 'I');
const attr = (tag, name) => tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];
const tabsIn = html => (html.match(/<button\b[^>]*>/g) ?? []).filter(tag => attr(tag, 'role') === 'tab');
function assertSelection(tags, selected) {
  assert.equal(tags.length, 2);
  for (const tag of tags) {
    const active = attr(tag, 'data-tabs-value') === selected;
    assert.equal(attr(tag, 'aria-selected'), String(active));
    assert.equal(attr(tag, 'data-state'), active ? 'active' : 'inactive', 'assert the tab itself, never a panel');
    assert.ok(attr(tag, 'aria-controls'));
  }
}
function example({ value = 'one', visibility = 'always', outerTooltip, provider = false } = {}) {
  const one = h(Tabs.Trigger, { value: 'one', startIcon: icon, 'data-state': 'closed' }, 'One');
  const first = outerTooltip === undefined ? one : h(Tooltip.Root, { open: outerTooltip }, h(Tooltip.Trigger, { asChild: true }, one));
  const tree = h(Tabs.Root, { value }, h(Tabs.List, { labelVisibility: visibility, 'aria-label': 'Synthetic pages' }, first,
    h(Tabs.Trigger, { value: 'two', startIcon: icon, disabled: true, 'aria-label': 'Two page' }, 'Two')),
  h(Tabs.Content, { value: 'one', forceMount: true }, 'Panel one'), h(Tabs.Content, { value: 'two', forceMount: true }, 'Panel two'));
  return provider ? h(Tooltip.Provider, null, tree) : tree;
}

test('selected and inactive tab attributes survive the always-present closed tooltip in every label mode', () => {
  for (const visibility of ['always', 'auto', 'hidden']) for (const provider of [false, true]) {
    const html = render(example({ visibility, provider }));
    const tags = tabsIn(html); assertSelection(tags, 'one');
    assert.equal(attr(tags[1], 'aria-label'), 'Two page');
    assert.match(tags[1], /\sdisabled=""/);
    assert.equal(attr(tags[0], 'data-label-collapsed'), visibility === 'hidden' ? 'true' : undefined);
    assert.match(html, /inkra-tabs__label/); assert.match(html, /One/);
  }
});

test('controlled selection wins over incoming disclosure state and matches selected panel semantics', () => {
  const html = render(example({ value: 'two' }));
  assertSelection(tabsIn(html), 'two');
  const panels = (html.match(/<div\b[^>]*>/g) ?? []).filter(tag => attr(tag, 'role') === 'tabpanel');
  assert.equal(panels.length, 2);
  assert.equal(attr(panels[1], 'data-state'), 'active');
  assert.doesNotMatch(panels[1], /\shidden(?:=|\s|>)/);
});

test('an omitted root value uses the same empty-string selection in Radix and visual contexts', () => {
  const html = render(h(Tabs.Root, null, h(Tabs.List, { 'aria-label': 'Empty value' },
    h(Tabs.Trigger, { value: '' }, 'Empty'), h(Tabs.Trigger, { value: 'one' }, 'One')),
  h(Tabs.Content, { value: '', forceMount: true }, 'Empty panel')));
  assertSelection(tabsIn(html), '');
  const panel = (html.match(/<div\b[^>]*>/g) ?? []).find(tag => attr(tag, 'role') === 'tabpanel');
  assert.ok(panel); assert.equal(attr(panel, 'data-state'), 'active'); assert.doesNotMatch(panel, /\shidden(?:=|\s|>)/);
});

test('open and closed Tooltip asChild composition preserves tab state and ordinary tooltip state', () => {
  for (const open of [false, true]) {
    const tags = tabsIn(render(example({ outerTooltip: open, visibility: 'hidden' })));
    assertSelection(tags, 'one');
    if (open) assert.ok(attr(tags[0], 'aria-describedby'), 'the tooltip description still reaches the tab');
    const plain = render(h(Tooltip.Provider, null, h(Tooltip.Root, { open },
      h(Tooltip.Trigger, { asChild: true }, h('button', { type: 'button', disabled: true }, 'Ordinary tooltip')))));
    const button = plain.match(/<button\b[^>]*>/)?.[0]; assert.ok(button);
    if (open) assert.match(attr(button, 'data-state'), /^(?:instant|delayed)-open$/);
    else assert.equal(attr(button, 'data-state'), 'closed');
    assert.match(button, /\sdisabled=""/);
  }
});

test('width decisions cover shrink-expand-shrink while selection and forced-colors selectors remain compatible', () => {
  // Geometry-decision + SSR contract only; this does not run ResizeObserver or CSS layout.
  const items = [{ width: 120, icon: true }, { width: 120, icon: true }];
  const decisions = [100, 400, 100].map(width => shouldCollapseTabLabels(items, width, 8, false, false));
  assert.deepEqual(decisions, [true, false, true]);
  for (const collapsed of decisions) assertSelection(tabsIn(render(example({ visibility: collapsed ? 'hidden' : 'always' }))), 'one');
  const css = readFileSync(new URL('../dist/styles/tabs.css', import.meta.url), 'utf8');
  assert.match(css, /\.inkra-tabs__trigger\[data-state="active"\][^{]*\{[^}]*color: var\(--inkra-selection-foreground\)/);
  assert.match(css, /\.inkra-tabs__trigger\[data-state="active"\] > \.inkra-pencil-surface\.inkra-tabs__selection/);
  assert.match(css, /forced-colors: active[\s\S]*?\.inkra-tabs__trigger\[data-state="active"\][^}]*outline: 2px solid Highlight/);
});
