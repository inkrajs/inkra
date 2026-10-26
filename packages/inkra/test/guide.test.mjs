import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Guide, GuideRoot, GuideStep, GuideTrigger } from '../dist/guide/index.js';
import { inkraLocales } from '../dist/i18n/index.js';

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
