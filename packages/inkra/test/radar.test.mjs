import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Radar } from '../dist/radar/index.js';

const axes = [
  { id: 'speed', label: 'Speed', min: -10, max: 10 },
  { id: 'quality', label: 'Quality', min: 0, max: 100 },
  { id: 'clarity', label: 'Clarity', min: 0, max: 10 },
  { id: 'reach', label: 'Reach', min: 0, max: 100 },
];

test('Radar renders multiple series, axis domains, negative values and accessible table data', () => {
  const markup = renderToStaticMarkup(createElement(Radar, {
    axes,
    series: [
      { id: 'alpha', label: 'Alpha', data: [{ axisId: 'speed', value: -4 }, { axisId: 'quality', value: 80 }, { axisId: 'clarity', value: 7 }, { axisId: 'reach', value: 40 }] },
      { id: 'beta', label: 'Beta', pattern: 'dash', data: [{ axisId: 'speed', value: 4 }, { axisId: 'quality', value: 60 }, { axisId: 'clarity', value: 5 }, { axisId: 'reach', value: 72 }] },
    ],
    label: 'Capability profile',
    description: 'Compare two teams',
    selectedSeries: 'beta',
    getValueLabel: value => `${value} pts`,
  }));

  assert.match(markup, /Capability profile/);
  assert.match(markup, /Compare two teams/);
  assert.match(markup, /inkra-radar__ink/);
  assert.match(markup, /aria-pressed="true"/);
  assert.match(markup, /<table/);
  assert.match(markup, /inkra-table/);
  assert.match(markup, /Alpha/);
  assert.match(markup, /-4 pts/);
  assert.match(markup, /Quality/);
  assert.match(markup, /<svg/);
});

test('Radar distinguishes zero, missing values and equal-value domains', () => {
  const markup = renderToStaticMarkup(createElement(Radar, {
    axes: [{ id: 'one', label: 'One' }, { id: 'two', label: 'Two' }, { id: 'three', label: 'Three' }],
    series: [{ id: 'same', label: 'Same', data: [{ axisId: 'one', value: 0 }, { axisId: 'two', value: null }, { axisId: 'three', value: 0 }] }],
    label: 'Boundary values',
    missingLabel: 'No data',
  }));

  assert.match(markup, /data-missing="true"/);
  assert.match(markup, />No data</);
  assert.match(markup, /data-missing="true"/);
  assert.match(markup, /No data/);
  assert.match(markup, />0</);
  assert.doesNotMatch(markup, /linear-gradient|radial-gradient/);
});

test('Radar source uses the shared d3 scale and shape direction without a chart framework', () => {
  const source = readFileSync(new URL('../src/radar/index.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/radar/styles.css', import.meta.url), 'utf8');
  assert.match(source, /import \{ scaleLinear \} from 'd3-scale'/);
  assert.match(source, /lineRadial/);
  assert.match(source, /curveLinearClosed/);
  assert.match(source, /pencilStroke/);
  assert.match(source, /drawPencilWash/);
  assert.match(source, /strokeWidth \* \(0\.68/);
  assert.match(source, /typeof value === 'string' \|\| typeof value === 'number'/);
  assert.match(source, /textNode\(item\.label, `\$\{id\}-summary/);
  assert.match(source, /textNode\(item\.label, `\$\{id\}-legend/);
  assert.doesNotMatch(source, /typeof item\.label === 'string' \? item\.label : String\(item\.id\)/);
  assert.match(source, /context\.setTransform\(dpr, 0, 0, dpr/);
  assert.match(source, /const scaleX = width \/ 1000/);
  assert.match(source, /const scaleY = height \/ 1000/);
  assert.doesNotMatch(source, /setTransform\(\(width \* dpr\) \/ 1000/);
  assert.match(source, /resolvePaint/);
  assert.match(source, /observeCanvasRecovery/);
  assert.match(source, /<Table\.Root/);
  assert.doesNotMatch(source, /<table/);
  assert.doesNotMatch(source, /<button/);
  assert.match(source, /<Button/);
  assert.match(source, /<PencilText/);
  assert.match(source, /className="inkra-radar__ink"/);
  assert.match(source, /className="inkra-radar__axis-label"/);
  assert.match(source, /transform=\{`translate\(\$\{center\} \$\{center\}\)`\}/);
  assert.match(styles, /\.inkra-radar__ink\[data-ready=true\] \+ \.inkra-radar__svg-fallback,\.inkra-radar__svg-fallback\{opacity:1\}/);
  assert.match(source, /--inkra-wash-strength/);
  assert.match(source, /0\.18 \/ pencilRenderDefaults\.washStrength/);
  assert.match(source, /Table\.Container aria-label=/);
  assert.match(styles, /word-break:normal/);
  assert.doesNotMatch(source, /className="inkra-radar__table-wrap"/);
  assert.match(source, /context\.clip\(\)/);
  assert.doesNotMatch(source, /context\.globalAlpha|`\$\{color\}20`/);
  assert.doesNotMatch(source, /strokeDasharray|stroke-dasharray/);
  assert.match(styles, /data-ready=true/);
  assert.match(styles, /opacity:1/);
  assert.doesNotMatch(source, /recharts|echarts|chart\.js|from 'd3'/i);
  assert.match(source, /selectedSeries/);
  assert.match(source, /role="group"/);
  assert.match(source, /<Table\.Root/);
  assert.match(styles, /min-block-size:220px/);
  assert.match(styles, /@media\(forced-colors:active\)/);
  assert.doesNotMatch(styles, /linear-gradient|radial-gradient|stroke-dasharray/);
});
