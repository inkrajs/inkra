import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const displayModule = process.env.INKRA_DISPLAY_MODULE
  ? new URL(process.env.INKRA_DISPLAY_MODULE, import.meta.url).href
  : new URL('../dist/index.js', import.meta.url).href;
const {
  Badge,
  Progress,
  Separator,
  Skeleton,
} = await import(displayModule);

test('Badge exposes six semantic variants through pencil surfaces', () => {
  for (const variant of ['neutral', 'accent', 'success', 'warning', 'danger', 'info']) {
    const markup = renderToStaticMarkup(createElement(Badge, {
      className: 'consumer-badge',
      'data-tracking-id': variant,
      variant,
    }, variant));

    assert.match(markup, /^<span/);
    assert.match(markup, /class="inkra-pencil-surface inkra-pencil-surface--badge inkra-badge consumer-badge"/);
    assert.match(markup, new RegExp(`data-variant="${variant}"`));
    assert.match(markup, new RegExp(`data-tracking-id="${variant}"`));
    assert.match(markup, /inkra-pencil-surface__ink/);
    assert.match(markup, new RegExp(`inkra-pencil-text__source">${variant}<\/span>`));
    assert.doesNotMatch(markup, /<svg|style="[^"]*background:/);
  }
});

test('Separator keeps native separator semantics and decorative opt-out', () => {
  const horizontal = renderToStaticMarkup(createElement(Separator, {
    'aria-label': 'Section boundary',
    className: 'consumer-separator',
  }));
  const vertical = renderToStaticMarkup(createElement(Separator, {
    orientation: 'vertical',
  }));
  const decorative = renderToStaticMarkup(createElement(Separator, {
    decorative: true,
    orientation: 'vertical',
  }));

  assert.match(horizontal, /^<div/);
  assert.match(horizontal, /role="separator"/);
  assert.match(horizontal, /aria-orientation="horizontal"/);
  assert.match(horizontal, /aria-label="Section boundary"/);
  assert.match(horizontal, /class="inkra-separator consumer-separator"/);
  assert.match(horizontal, /inkra-pencil-line/);
  assert.match(vertical, /aria-orientation="vertical"/);
  assert.match(vertical, /data-orientation="vertical"/);
  assert.match(decorative, /aria-hidden="true"/);
  assert.doesNotMatch(decorative, /role="separator"|aria-orientation=/);
});

test('Skeleton is static, hidden and accepts consumer dimensions', () => {
  const markup = renderToStaticMarkup(createElement(Skeleton, {
    className: 'consumer-skeleton',
    style: { height: 28, width: '12rem' },
  }));

  assert.match(markup, /^<div/);
  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /inkra-pencil-surface--quiet/);
  assert.match(markup, /class="inkra-pencil-surface inkra-pencil-surface--quiet inkra-skeleton consumer-skeleton"/);
  assert.match(markup, /style="height:28px;width:12rem"/);
  assert.doesNotMatch(markup, /role="progressbar"|animation/);
});

test('Progress clamps determinate values and keeps native progressbar ARIA', () => {
  const high = renderToStaticMarkup(createElement(Progress, {
    className: 'consumer-progress',
    label: 'Upload',
    max: 80,
    value: 120,
  }));
  const low = renderToStaticMarkup(createElement(Progress, {
    'aria-label': 'Download',
    max: 80,
    value: -20,
  }));
  const invalid = renderToStaticMarkup(createElement(Progress, {
    'aria-label': 'Invalid max',
    max: 0,
    value: Number.NaN,
  }));

  assert.match(high, /^<div/);
  assert.match(high, /role="progressbar"/);
  assert.match(high, /aria-valuemin="0"/);
  assert.match(high, /aria-valuemax="80"/);
  assert.match(high, /aria-valuenow="80"/);
  assert.match(high, /data-value="80"/);
  assert.match(high, /data-state="determinate"/);
  assert.match(high, /aria-labelledby="[^"]+-label"/);
  assert.match(high, /id="[^"]+-label"/);
  assert.match(high, /--inkra-progress-value:100%/);
  assert.equal((high.match(/inkra-pencil-surface__ink/g) ?? []).length, 2);
  assert.match(high, /inkra-pencil-surface--outline/);
  assert.match(high, /inkra-pencil-surface--selection/);
  assert.match(low, /aria-label="Download"/);
  assert.doesNotMatch(low, /aria-labelledby=/);
  assert.match(low, /aria-valuenow="0"/);
  assert.match(low, /--inkra-progress-value:0%/);
  assert.match(invalid, /aria-valuemax="100"/);
  assert.match(invalid, /aria-valuenow="0"/);
});

test('Progress null value is indeterminate without a fabricated aria-valuenow', () => {
  const markup = renderToStaticMarkup(createElement(Progress, {
    'aria-label': 'Loading',
    value: null,
  }));

  assert.match(markup, /role="progressbar"/);
  assert.match(markup, /data-state="indeterminate"/);
  assert.match(markup, /aria-valuemax="100"/);
  assert.match(markup, /--inkra-progress-value:36%/);
  assert.doesNotMatch(markup, /aria-valuenow=|data-value=/);
});

test('Circular Progress shares normalization and exposes custom content positions', () => {
  for (const contentPosition of ['center', 'top', 'bottom', 'start', 'end']) {
    const markup = renderToStaticMarkup(createElement(Progress, {
      shape: 'circular', value: 30, max: 40, diameter: 128, thickness: 6,
      contentPosition, label: 'Files', dir: 'rtl',
    }, state => {
      assert.deepEqual(state, { value: 30, max: 40, percent: 75 });
      return createElement('span', { 'data-custom-content': true }, '3 / 4');
    }));
    assert.match(markup, /role="progressbar"/);
    assert.match(markup, /aria-valuenow="30"/);
    assert.match(markup, /aria-valuemax="40"/);
    assert.match(markup, /--inkra-progress-angle:270deg/);
    assert.match(markup, /--inkra-progress-diameter:128px/);
    assert.match(markup, /stroke-dashoffset="25"/);
    assert.match(markup, /aria-labelledby="[^"]+-label"/);
    assert.match(markup, new RegExp(`data-content-position="${contentPosition}"`));
    assert.match(markup, /data-custom-content="true"/);
    assert.doesNotMatch(markup, /inkra-progress__track| diameter=| thickness=| contentPosition=/);
  }
});

test('Circular Progress handles empty, complete, unknown and invalid geometry in SSR', () => {
  for (const [value, expected, offset] of [[-10, 0, 100], [1000, 100, 0], [null, null, 72], [NaN, 0, 100]]) {
    const markup = renderToStaticMarkup(createElement(Progress, {
      shape: 'circular', value, max: -1, diameter: Infinity, thickness: -1, 'aria-label': 'Loading',
    }, state => {
      assert.equal(state.value, expected);
      assert.equal(state.percent, expected);
      assert.equal(state.max, 100);
      return expected === null ? '...' : `${expected}%`;
    }));
    assert.match(markup, /--inkra-progress-diameter:96px/);
    assert.match(markup, /stroke-width="1"/);
    assert.match(markup, new RegExp(`stroke-dashoffset="${offset}"`));
    if (expected === null) assert.doesNotMatch(markup, /aria-valuenow=/);
    else assert.match(markup, new RegExp(`aria-valuenow="${expected}"`));
  }
  const small = renderToStaticMarkup(createElement(Progress, { shape: 'circular', value: 50, diameter: 1, thickness: 100 }));
  assert.match(small, /--inkra-progress-diameter:32px/);
  assert.match(small, /stroke-width="4"/);
  const linear = renderToStaticMarkup(createElement(Progress, { value: 20, contentPosition: 'center' }, '20%'));
  assert.match(linear, /data-shape="linear"/);
  assert.match(linear, /data-content-position="end"/);
  assert.match(linear, /inkra-progress__track/);
  assert.doesNotMatch(linear, /inkra-progress__ring/);
});

test('Display CSS retains fixed geometry, pencil fills and reduced motion fallback', () => {
  const css = readFileSync(new URL('../src/display/styles.css', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../src/display/index.tsx', import.meta.url), 'utf8');

  assert.match(css, /\.inkra-progress__track[\s\S]*block-size:\s*16px/);
  assert.match(css, /\.inkra-progress__fill-clip[\s\S]*clip-path:/);
  assert.match(css, /\.inkra-progress:dir\(rtl\) \.inkra-progress__fill-clip[\s\S]*clip-path:\s*inset\(0 0 0 calc/);
  assert.match(css, /\.inkra-progress:dir\(rtl\)\[data-state="indeterminate"\][\s\S]*inkra-progress-indeterminate-rtl/);
  assert.match(css, /@keyframes inkra-progress-indeterminate-rtl/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.inkra-progress__fill-clip[\s\S]*transition:\s*none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none/);
  assert.match(css, /\.inkra-skeleton[\s\S]*max-inline-size:\s*100%/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(css.split('@media (forced-colors: active)')[0], /border:\s*1px\s+solid/);
  assert.match(source, /PencilSurface/);
  assert.match(source, /PencilLine/);
  assert.match(source, /role="progressbar"/);
  assert.match(source, /value: number \| null/);
});

test('Display components consume size, icon, weight and radius props', () => {
  const badge = renderToStaticMarkup(createElement(Badge, { size: 'lg', startIcon: createElement('i', null, '+'), endIcon: createElement('i', null, '-') }, 'Saved'));
  assert.match(badge, /data-size="lg"/);
  assert.equal((badge.match(/class="inkra-badge__icon" aria-hidden="true"/g) ?? []).length, 2);
  const progress = renderToStaticMarkup(createElement(Progress, { value: 40, size: 'sm', dir: 'rtl', 'aria-valuetext': '40 files', label: 'Upload' }));
  assert.match(progress, /data-size="sm"/);
  assert.match(progress, /aria-valuetext="40 files"/);
  const skeleton = renderToStaticMarkup(createElement(Skeleton, { radius: 0 }));
  const separator = renderToStaticMarkup(createElement(Separator, { weight: 2 }));
  assert.doesNotMatch(badge + progress + skeleton + separator, / radius=| weight=| startIcon=| endIcon=| size=/);
});
