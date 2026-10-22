import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const displayModule = process.env.INKRA_DISPLAY_MODULE
  ? new URL(process.env.INKRA_DISPLAY_MODULE, import.meta.url).href
  : new URL('../dist/index.js', import.meta.url).href;
const { Progress } = await import(displayModule);

function renderProgress(props = {}, children) {
  return renderToStaticMarkup(createElement(Progress, {
    'aria-label': 'Release progress',
    shape: 'segmented',
    value: 35,
    ...props,
  }, children));
}

test('segmented Progress reuses normalized Progress ARIA and custom max', () => {
  const markup = renderProgress({ value: 3, max: 8, segmentCount: 4 }, state => {
    assert.deepEqual(state, { value: 3, max: 8, percent: 37.5 });
    return '3 of 8';
  });

  assert.match(markup, /^<div/);
  assert.match(markup, /role="progressbar"/);
  assert.match(markup, /aria-valuemin="0"/);
  assert.match(markup, /aria-valuemax="8"/);
  assert.match(markup, /aria-valuenow="3"/);
  assert.match(markup, /data-shape="segmented"/);
  assert.match(markup, /--inkra-progress-segment-count:4/);
  assert.equal((markup.match(/class="inkra-progress__segment"/g) ?? []).length, 4);
  assert.match(markup, /--inkra-progress-segment-fill:50%/);
  assert.match(markup, />3 of 8</);
});

test('segmented Progress handles zero, complete and indeterminate states', () => {
  const empty = renderProgress({ value: 0, segmentCount: 5 });
  const complete = renderProgress({ value: 200, max: 120, segmentCount: 5 });
  const unknown = renderProgress({ value: null, segmentCount: 5 });

  assert.equal((empty.match(/data-fill="empty"/g) ?? []).length, 5);
  assert.equal((complete.match(/data-fill="full"/g) ?? []).length, 5);
  assert.match(complete, /aria-valuenow="120"/);
  assert.match(unknown, /data-state="indeterminate"/);
  assert.doesNotMatch(unknown, /aria-valuenow=|data-value=/);
  assert.equal((unknown.match(/data-fill="full"/g) ?? []).length, 5);
});

test('partial segment policies expose fractional, completed and touched cells', () => {
  const fractional = renderProgress({ value: 37.5, segmentCount: 4, partialSegment: 'fractional' });
  const complete = renderProgress({ value: 25, segmentCount: 6, partialSegment: 'complete' });
  const next = renderProgress({ value: 25, segmentCount: 6, partialSegment: 'next' });

  assert.equal((fractional.match(/data-fill="full"/g) ?? []).length, 1);
  assert.equal((fractional.match(/data-fill="partial"/g) ?? []).length, 1);
  assert.equal((complete.match(/data-fill="full"/g) ?? []).length, 1);
  assert.equal((next.match(/data-fill="full"/g) ?? []).length, 2);
  assert.match(fractional, /--inkra-progress-segment-fill:50%/);
  assert.match(complete, /--inkra-progress-segment-fill:0%/);
});

test('segment geometry clamps count and gap without leaking props to the DOM', () => {
  const low = renderProgress({ segmentCount: 0, segmentGap: -4 });
  const high = renderProgress({ segmentCount: 100, segmentGap: 40 });

  assert.equal((low.match(/class="inkra-progress__segment"/g) ?? []).length, 1);
  assert.equal((high.match(/class="inkra-progress__segment"/g) ?? []).length, 64);
  assert.match(low, /--inkra-progress-segment-gap:0px/);
  assert.match(high, /--inkra-progress-segment-gap:24px/);
  assert.doesNotMatch(low + high, /segmentCount=|segmentGap=|partialSegment=|thresholds=|segmentColors=/);
});

test('threshold pigments are sorted by value and per-segment colors override them', () => {
  const markup = renderProgress({
    max: 200,
    segmentCount: 4,
    segmentColors: [undefined, '#123456'],
    thresholds: [
      { value: 100, color: '#aabbcc' },
      { value: 0, color: '#112233' },
      { value: 150, color: '#ddeeff' },
    ],
  });

  assert.match(markup, /--inkra-selection-pigment:#112233/);
  assert.match(markup, /--inkra-selection-pigment:#123456/);
  assert.match(markup, /--inkra-selection-pigment:#aabbcc/);
  assert.match(markup, /--inkra-selection-pigment:#ddeeff/);
});

test('segmented styles retain pencil surfaces, RTL clipping and accessible fallbacks', () => {
  const css = readFileSync(new URL('../src/display/styles.css', import.meta.url), 'utf8');
  const display = readFileSync(new URL('../src/display/index.tsx', import.meta.url), 'utf8');
  const segmented = readFileSync(new URL('../src/segmented-progress/SegmentedProgress.tsx', import.meta.url), 'utf8');

  assert.match(css, /grid-template-columns:\s*repeat\(var\(--inkra-progress-segment-count\), minmax\(0, 1fr\)\)/);
  assert.match(css, /\.inkra-progress:dir\(rtl\) \.inkra-progress__segment-fill-clip[\s\S]*clip-path:\s*inset\(0 0 0 calc/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*inkra-progress__segment-fill-clip[\s\S]*transition:\s*none/);
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*inkra-progress__segment-fill[\s\S]*background:\s*Highlight/);
  assert.match(segmented, /variant="selection"/);
  assert.match(segmented, /variant="outline"/);
  assert.doesNotMatch(segmented, /backgroundColor|linear-gradient|<meter/);
  assert.match(display, /shape\?: 'linear' \| 'circular' \| 'segmented'/);
  assert.match(display, /<ProgressRing/);
  assert.match(display, /inkra-progress__track/);
});
