import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NumberTicker } from '../dist/number-ticker/index.js';
import { createTickerFormatter } from '../dist/number-ticker/model.js';
import { createRollingMotion, rollMix, rollingColumns, rollingTokens, sameRollingTokens } from '../dist/number-ticker/rolling.js';

const tokens = (value, locale = 'en', options = {}) => rollingTokens(createTickerFormatter(locale, options).formatToParts(value));
const columns = (from, to) => rollingColumns(tokens(from), tokens(to));

test('same formatted places do not require a new rolling animation', () => {
  assert(sameRollingTokens(tokens(1.1, 'en', { maximumFractionDigits: 0 }), tokens(1.2, 'en', { maximumFractionDigits: 0 })));
  assert(!sameRollingTokens(tokens(1), tokens(2)));
  assert(!sameRollingTokens(tokens(1), tokens(10)));
});

test('retargeting preserves visible offsets and column widths instead of snapping to the start', () => {
  const first = createRollingMotion(tokens(12), tokens(1200), 'up');
  const progress = 0.37;
  const next = createRollingMotion(tokens(12), tokens(9), 'down', { columns: first, progress });
  for (const column of first) {
    const following = next.find(item => item.key === column.key);
    assert(following);
    assert.equal(following.fromWidth, rollMix(column.fromWidth, column.toWidth, progress));
    for (const face of column.faces) {
      const offset = rollMix(face.fromOffset, face.toOffset, progress);
      const opacity = rollMix(face.fromOpacity, face.toOpacity, progress);
      if (Math.abs(offset) >= 1 || opacity <= 0.01) continue;
      const continued = following.faces.find(item => item.text === face.text);
      assert(continued);
      assert.equal(continued.fromOffset, offset);
      assert.equal(continued.fromOpacity, opacity);
    }
  }
});

test('repeated retargets keep unique bounded digit faces and resolve to the latest target', () => {
  let frame = { columns: createRollingMotion(tokens(0), tokens(1), 'up'), progress: 0.2 };
  for (let value = 2; value < 100; value += 1) {
    frame = { columns: createRollingMotion(tokens(0), tokens(value), 'up', frame), progress: 0.2 };
    for (const column of frame.columns.filter(item => item.digit)) {
      assert.equal(new Set(column.faces.map(face => face.text)).size, column.faces.length);
      assert(column.faces.length <= 10);
      assert.equal(column.faces.find(face => face.text === column.target)?.toOffset, 0);
    }
  }
  assert.equal(frame.columns.map(column => column.target).join(''), '99');
});

test('multiplication by 100 aligns places and expands incoming digits', () => {
  assert.deepEqual(columns(12, 1200).filter(c => c.digit).map(c => [c.key, c.from, c.to]), [
    ['integer-3', '', '1'], ['integer-2', '', '2'], ['integer-1', '1', '0'], ['integer-0', '2', '0'],
  ]);
});

test('carry, shrink, zero and negative transitions preserve both formatted endpoints', () => {
  for (const [from, to] of [[999, 1000], [1000, 9], [9, 0], [0, -12], [-12, 12], [12.34, 1234], [1.234, 0.01]]) {
    const result = columns(from, to);
    assert.equal(result.map(c => c.from).join(''), tokens(from).map(c => c.text).join(''));
    assert.equal(result.map(c => c.to).join(''), tokens(to).map(c => c.text).join(''));
    assert.equal(new Set(result.map(c => c.key)).size, result.length);
  }
});

test('fractions align from decimal; symbols never roll as digits', () => {
  const result = columns(-12.34, 1234.5);
  assert.deepEqual(result.filter(c => c.key.startsWith('fraction')).map(c => [c.from, c.to]), [['3', '5'], ['4', '']]);
  assert(result.filter(c => ['minusSign-0', 'group-3', 'decimal-0'].includes(c.key)).every(c => !c.digit));
});

test('localized digits, Indian grouping, currency and exact bigint retain original text', () => {
  for (const locale of ['en', 'zh-CN', 'ja', 'ko', 'fr', 'ar-EG', 'hi-IN']) {
    const format = createTickerFormatter(locale, { style: 'currency', currency: 'EUR' });
    for (const value of [9007199254740993n, '-1234567.89']) {
      const result = rollingTokens(format.formatToParts(value));
      assert.equal(result.map(c => c.text).join(''), format.format(value));
      assert.equal(result.length, new Set(result.map(c => c.key)).size);
      assert(result.filter(c => c.key.startsWith('currency')).every(c => !c.digit));
    }
  }
});

test('compact and scientific parts use separate digit places', () => {
  for (const format of [createTickerFormatter('en', {}, 'en'), createTickerFormatter('en', { notation: 'scientific' })]) {
    const result = rollingColumns(rollingTokens(format.formatToParts(999)), rollingTokens(format.formatToParts(100000)));
    assert.equal(result.map(c => c.to).join(''), format.format(100000));
    assert.equal(result.length, new Set(result.map(c => c.key)).size);
  }
});

test('all localized endpoints keep accounting parentheses and whitespace in their original positions', () => {
  const values = [-120000.123, -999, -0, 0, 0.001, 1, 9, 12.34, 999, 1000, 10000000];
  for (const locale of ['en', 'fr', 'ar', 'hi']) {
    for (const options of [{}, { style: 'currency', currency: 'USD', currencySign: 'accounting' }, { notation: 'scientific' }]) {
      const format = createTickerFormatter(locale, options);
      for (const from of values) for (const to of values) {
        const result = rollingColumns(rollingTokens(format.formatToParts(from)), rollingTokens(format.formatToParts(to)));
        assert.equal(result.map(c => c.from).join(''), format.format(from), `${locale}: ${from} -> ${to}`);
        assert.equal(result.map(c => c.to).join(''), format.format(to), `${locale}: ${from} -> ${to}`);
      }
    }
  }
});

test('SSR renders final reels and one announcement; custom rendering takes precedence', () => {
  const markup = renderToStaticMarkup(createElement(NumberTicker, { value: 1200, animation: 'roll', rollDirection: 'down' }));
  assert.match(markup, /inkra-number-ticker__reels/);
  assert.match(markup, /aria-live="polite">1,200/);
  assert.doesNotMatch(markup, /data-face="from"|rollDirection=/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(NumberTicker, { value: 12, animation: 'roll', renderValue: () => 'Custom' })), /__reels/);
  const huge = renderToStaticMarkup(createElement(NumberTicker, { value: '1e200', animation: 'roll' }));
  assert.doesNotMatch(huge, /__reels/);
  assert.match(huge, /aria-live="polite"/);
});
