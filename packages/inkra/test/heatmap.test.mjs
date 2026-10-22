import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Heatmap } from '../dist/heatmap/index.js';

const rows = [
  { id: 'design', label: 'Design' },
  { id: 'engineering', label: 'Engineering' },
];

const columns = [
  { id: 'quality', label: 'Quality' },
  { id: 'speed', label: 'Speed' },
];

test('Heatmap renders an accessible matrix and keeps zero distinct from missing values', () => {
  const markup = renderToStaticMarkup(createElement(Heatmap, {
    rows,
    columns,
    cells: [
      { rowId: 'design', columnId: 'quality', value: 0 },
      { rowId: 'design', columnId: 'speed', value: 8 },
      { rowId: 'engineering', columnId: 'quality', value: null },
    ],
    label: 'Delivery health',
    description: 'Quarterly review',
    selectedCell: { rowId: 'design', columnId: 'quality' },
    getValueLabel: value => `${value}%`,
    missingValueLabel: 'No measurement',
  }));

  assert.match(markup, /role="grid"/);
  assert.match(markup, /aria-rowcount="3"/);
  assert.match(markup, /aria-colcount="3"/);
  assert.equal((markup.match(/role="gridcell"/g) ?? []).length, 4);
  assert.equal((markup.match(/role="rowheader"/g) ?? []).length, 2);
  assert.equal((markup.match(/role="columnheader"/g) ?? []).length, 3);
  assert.match(markup, /data-value="0"/);
  assert.match(markup, /Design, Quality: 0%/);
  assert.equal((markup.match(/data-missing="true"/g) ?? []).length, 2);
  assert.match(markup, /Engineering, Speed: No measurement/);
  assert.match(markup, /aria-selected="true"/);
  assert.match(markup, /data-selected="true"/);
  assert.match(markup, /tabindex="0"/);
  assert.match(markup, /Delivery health/);
  assert.match(markup, /Quarterly review/);
});

test('Heatmap quantize legend exposes readable ranges and missing semantics', () => {
  const markup = renderToStaticMarkup(createElement(Heatmap, {
    rows: rows.slice(0, 1),
    columns,
    cells: [
      { rowId: 'design', columnId: 'quality', value: -4 },
      { rowId: 'design', columnId: 'speed', value: 12 },
    ],
    label: 'Variance',
    scaleType: 'quantize',
    binCount: 3,
    domain: [-6, 18],
    getValueLabel: value => `${value} pts`,
  }));

  assert.match(markup, /inkra-heatmap__legend-bins" role="list"/);
  assert.equal((markup.match(/role="listitem"/g) ?? []).length, 3);
  assert.match(markup, /-6 pts–2 pts/);
  assert.match(markup, /10 pts–18 pts/);
  assert.match(markup, />Missing</);
});

test('Heatmap supports custom cell and detail renderers without hiding grid values from assistive technology', () => {
  const markup = renderToStaticMarkup(createElement(Heatmap, {
    rows: rows.slice(0, 1),
    columns: columns.slice(0, 1),
    cells: [{ rowId: 'design', columnId: 'quality', value: 6, data: { trend: 'up' } }],
    label: 'Custom cells',
    renderCell: (cell, context) => createElement('span', { 'data-custom-cell': context.color }, `Score ${cell.value}`),
    renderDetails: (_cell, context) => createElement('span', { 'data-custom-details': '' }, `${context.row.id}/${context.column.id}/${context.valueLabel}`),
  }));

  assert.match(markup, /data-custom-cell="[^"]+"/);
  assert.match(markup, />Score 6</);
  assert.match(markup, /aria-label="Design, Quality: 6"/);
  assert.match(markup, /data-custom-details="">design\/quality\/6/);
});

test('Heatmap renders an honest empty state without an empty grid', () => {
  const markup = renderToStaticMarkup(createElement(Heatmap, {
    rows: [],
    columns: [],
    cells: [],
    label: 'Empty matrix',
    emptyMessage: 'Nothing measured',
  }));

  assert.match(markup, /Nothing measured/);
  assert.doesNotMatch(markup, /role="grid"/);
});

test('Heatmap source uses the shared d3-scale direction and local accessible rendering', () => {
  const source = readFileSync(new URL('../src/heatmap/index.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/heatmap/styles.css', import.meta.url), 'utf8');

  assert.match(source, /import \{ scaleLinear, scaleQuantize \} from 'd3-scale'/);
  assert.doesNotMatch(source, /d3-scale-chromatic|recharts|echarts|chart\.js|from 'd3'/i);
  assert.match(source, /event\.key === 'ArrowLeft'/);
  assert.match(source, /event\.key === 'ArrowRight'/);
  assert.match(source, /event\.key === 'ArrowUp'/);
  assert.match(source, /event\.key === 'ArrowDown'/);
  assert.match(source, /event\.key === 'Home'/);
  assert.match(source, /event\.key === 'End'/);
  assert.match(source, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(source, /role="gridcell"/);
  assert.match(source, /variant=\{missing \? 'outline' : 'action'\}/);
  assert.match(styles, /overflow: auto/);
  assert.match(styles, /min-block-size: 44px/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(styles, /linear-gradient|radial-gradient/);
});
