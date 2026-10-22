import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const moduleUrl = process.env.INKRA_RATING_MODULE
  ? new URL(process.env.INKRA_RATING_MODULE, import.meta.url).href
  : new URL('../dist/rating/index.js', import.meta.url).href;
const source = await readFile(new URL('../src/rating/index.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/rating/styles.css', import.meta.url), 'utf8');
const { Rating, normalizeRatingValue } = await import(moduleUrl);

test('Rating normalizes finite values to count and step', () => {
  assert.equal(normalizeRatingValue(3.74, 5, 0.5), 3.5);
  assert.equal(normalizeRatingValue(3.76, 5, 0.5), 4);
  assert.equal(normalizeRatingValue(-2, 5, 0.5), 0);
  assert.equal(normalizeRatingValue(9, 5, 0.5), 5);
  assert.equal(normalizeRatingValue(Number.NaN, 5, 0.25), 0);
  assert.equal(normalizeRatingValue(0.3, 1, 0.1), 0.3);
  assert.equal(normalizeRatingValue(0.0026, 1, 1e-3), 0.003);
});

test('Rating renders one named slider with semantic committed value', () => {
  const html = renderToStaticMarkup(h(Rating, {
    'aria-label': 'Drawing quality',
    defaultValue: 3.5,
    count: 5,
    step: 0.5,
    getValueLabel: value => `${value} pencils`,
  }));
  assert.match(html, /role="slider"/);
  assert.match(html, /aria-label="Drawing quality"/);
  assert.match(html, /aria-valuemin="0"/);
  assert.match(html, /aria-valuemax="5"/);
  assert.match(html, /aria-valuenow="3.5"/);
  assert.match(html, /aria-valuetext="3.5 pencils"/);
  assert.match(html, /style="inline-size:50%"/);
  assert.equal((html.match(/inkra-rating__symbol-target/g) ?? []).length, 5);
  assert.equal((html.match(/inkra-pencil-icon/g) ?? []).length, 10);
});

test('Rating supports custom symbols without imposing star semantics', () => {
  const html = renderToStaticMarkup(h(Rating, {
    'aria-label': 'Confidence',
    count: 3,
    defaultValue: 2,
    symbol: h('span', { className: 'custom-mark' }, 'mark'),
  }));
  assert.equal((html.match(/custom-mark/g) ?? []).length, 6);
  assert.equal((html.match(/>mark</g) ?? []).length, 6);
  assert.doesNotMatch(html, /star/i);
});

test('Rating preserves read-only focus and removes disabled tab stop', () => {
  const readOnly = renderToStaticMarkup(h(Rating, { readOnly: true, defaultValue: 2 }));
  assert.match(readOnly, /aria-readonly="true"/);
  assert.match(readOnly, /tabindex="0"/);
  const disabled = renderToStaticMarkup(h(Rating, { disabled: true, defaultValue: 2 }));
  assert.match(disabled, /aria-disabled="true"/);
  assert.doesNotMatch(disabled, /tabindex=/);
});

test('Rating source separates hover preview from committed change', () => {
  assert.match(source, /const \[previewValue, setPreviewValue\] = useState<number \| null>\(null\)/);
  assert.match(source, /onPointerMove=\{\(event\) => \{[\s\S]*setPreviewValue\(valueFromPointer/);
  assert.match(source, /onClick=\{\(event\) => commit\(valueFromPointer/);
  assert.doesNotMatch(source, /onPointerMove=\{[\s\S]{0,240}onValueChange/);
  assert.match(source, /if \(!controlled\) setUncontrolledValue/);
  assert.match(source, /aria-valuenow=\{committedValue\}/);
  assert.match(source, /if \(disabled \|\| readOnly\) setPreviewValue\(null\)/);
});

test('Rating source defines keyboard endpoints, RTL and clear strategies', () => {
  assert.match(source, /event\.key === 'ArrowRight'/);
  assert.match(source, /event\.key === 'ArrowLeft'/);
  assert.match(source, /event\.key === 'Home'/);
  assert.match(source, /event\.key === 'End'/);
  assert.match(source, /\['Backspace', 'Delete', 'Escape'\]/);
  assert.match(source, /rtl \? -step : step/);
  assert.match(source, /allowsReselectClear/);
  assert.match(source, /allowsKeyboardClear/);
  assert.match(source, /normalized === 0 && committedValue > 0 && !allowsKeyboardClear/);
});

test('Rating styles keep stable touch targets and logical fractional clipping', () => {
  assert.match(styles, /block-size:\s*var\(--inkra-touch-target\)/);
  assert.match(styles, /inline-size:\s*var\(--inkra-touch-target\)/);
  assert.match(styles, /inset-inline-start:\s*0/);
  assert.match(styles, /overflow:\s*hidden/);
  assert.match(styles, /touch-action:\s*manipulation/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(styles, /border-radius:\s*999|#[0-9a-f]{3,8}/i);
});
