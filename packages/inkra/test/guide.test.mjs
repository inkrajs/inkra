import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

import { Guide, GuideRoot, GuideStep, GuideTrigger } from '../dist/guide/index.js';
import { inkraLocales } from '../dist/i18n/index.js';

const source = readFileSync(new URL('../src/guide/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/guide/styles.css', import.meta.url), 'utf8');

test('guide exposes stable compound and granular component identities', () => {
  assert.equal(Guide.Root, GuideRoot);
  assert.equal(Guide.Trigger, GuideTrigger);
  assert.equal(Guide.Step, GuideStep);
});

test('closed guides keep the trigger semantic and do not inline step content', () => {
  const html = renderToStaticMarkup(h(Guide.Root, null,
    h(Guide.Trigger, { asChild: true }, h('button', { type: 'button' }, 'Start')),
    h(Guide.Step, { target: '#first', title: 'First', description: 'Hidden until open' }),
  ));
  assert.match(html, /<button[^>]*>Start<\/button>/);
  assert.doesNotMatch(html, /Hidden until open/);
});

test('guide navigation copy is complete in all five dictionaries', () => {
  for (const [locale, messages] of Object.entries(inkraLocales)) {
    for (const key of ['guide.previous', 'guide.next', 'guide.finish', 'guide.skip', 'guide.close', 'guide.progress']) {
      assert.ok(messages[key].trim(), `${locale}:${key}`);
    }
    assert.match(messages['guide.progress'], /\{current\}/);
    assert.match(messages['guide.progress'], /\{total\}/);
  }
});

test('guide skip defaults to an accessible screen-corner icon with panel fallback and bounded focus', () => {
  for (const contract of [
    "export type GuideSkipPlacement = 'panel' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'",
    "export type GuideSkipAppearance = 'icon' | 'text'",
    "skipPlacement = 'top-end'",
    "skipAppearance = 'icon'",
    "data-tooltip={corner && skipAppearance === 'icon' ? labels.skip : undefined}",
    "title={corner && skipAppearance === 'icon' ? labels.skip : undefined}",
    "resolvedSkipPlacement === 'panel'",
    "handleSkipKeyDown",
  ]) assert(source.includes(contract), contract);
  assert.match(source, /alternatives\.find\([\s\S]*?overlaps\([\s\S]*?\)\) \?\? 'panel'/);
  const layer = styles.slice(styles.indexOf('.inkra-guide__skip-layer {'), styles.indexOf('.inkra-guide__skip {'));
  const action = styles.slice(styles.indexOf('.inkra-guide__skip {'), styles.indexOf('.inkra-guide__skip:is'));
  assert.match(layer, /position: fixed/);
  assert.match(layer, /pointer-events: none/);
  assert.match(action, /pointer-events: auto/);
  assert.match(action, /opacity: \.72/);
  for (const edge of ['top', 'bottom', 'start', 'end']) assert(styles.includes(`data-placement${edge === 'top' || edge === 'bottom' ? '^' : '$'}="${edge}"`));
});
