import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';

import { Loading } from '../dist/loading/index.js';
import { resolveLoadingLabels } from '../dist/loading/locales.js';
import { nextTipIndex, normalizeLoadingProgress } from '../dist/loading/model.js';

test('Loading renders honest inline and region progress semantics', () => {
  const unknown = render(h(Loading, { progress: null, progressLabel: 'Preparing' }));
  assert.match(unknown, /role="status"/);
  assert.match(unknown, /aria-busy="true"/);
  assert.match(unknown, /role="progressbar"/);
  assert.doesNotMatch(unknown, /aria-valuenow/);
  assert.doesNotMatch(unknown.replace(/<[^>]*>/g, ''), /\d+(?:\.\d+)?%/);

  const determinate = render(h(Loading, { mode: 'region', preset: 'intel', progress: 42, max: 80, title: 'Downloading' }));
  assert.match(determinate, /aria-valuenow="42"/);
  assert.match(determinate, />53%<|>52%<|>53%<\/span>/);
  assert.match(determinate, /Downloading/);
});

test('business actions only report explicit states', () => {
  const loading = render(h(Loading, { onRetry() {}, onContinue() {} }));
  assert.doesNotMatch(loading, />Retry<|>Continue</);
  const error = render(h(Loading, { status: 'error', onRetry() {}, progress: 100 }));
  assert.match(error, />Retry</);
  assert.doesNotMatch(error, />Continue</);
  const complete = render(h(Loading, { status: 'complete', onContinue() {} }));
  assert.match(complete, />Continue</);
});

test('stages and fullscreen SSR retain readable structure', () => {
  const html = render(h(Loading, {
    mode: 'fullscreen', preset: 'staged', activeStage: 'assets', stages: [
      { id: 'session', label: 'Session', state: 'complete' },
      { id: 'assets', label: 'Assets' },
    ],
  }));
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /Step 2 of 2/);
  assert.match(html, /Session/);
  assert.match(html, /Assets/);
});

test('inactive and delayed Loading do not flash in SSR', () => {
  assert.equal(render(h(Loading, { active: false })), '');
  assert.equal(render(h(Loading, { delay: 200 })), '');
});

test('model normalization and random order never invent invalid values or immediate repeats', () => {
  assert.equal(normalizeLoadingProgress(120, 100), 100);
  assert.equal(normalizeLoadingProgress(Number.NaN, 100), 0);
  assert.equal(normalizeLoadingProgress(null, 100), null);
  assert.equal(nextTipIndex(1, 3, 'sequence'), 2);
  assert.notEqual(nextTipIndex(1, 3, 'random', () => 0), 1);
  assert.notEqual(nextTipIndex(1, 3, 'random', () => .999), 1);
});

test('Loading defaults cover all five locales and accept copy overrides', () => {
  for (const locale of ['en', 'zh-CN', 'ja', 'ko', 'fr']) {
    const labels = resolveLoadingLabels(locale);
    for (const value of Object.values(labels)) assert.ok(value.trim(), `${locale} has complete copy`);
  }
  assert.equal(resolveLoadingLabels('fr', { retry: 'Encore' }).retry, 'Encore');
});
