import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NumberTicker } from '../dist/number-ticker/index.js';

import {
  canAnimateTickerValue,
  createNumberFormatter,
  createTickerFormatter,
  easeOutCubic,
  formatTickerDelta,
  formatDerivedTickerDelta,
  formatTickerValue,
  interpolateTickerValue,
  subtractTickerValues,
  tickerValueChanged,
} from '../dist/number-ticker/model.js';

const source = readFileSync(new URL('../src/number-ticker/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/number-ticker/styles.css', import.meta.url), 'utf8');

test('bigint and decimal strings preserve digits beyond the Number safe range', () => {
  const plain = createTickerFormatter('en-US', { useGrouping: false, maximumFractionDigits: 20 });
  for (const value of [9007199254740993n, '9007199254740993', '-9007199254740993', '12345678901234567890.1234567890123456789']) {
    assert.equal(plain.format(value), String(value));
  }
  assert.equal(plain.format('  +0012.50  '), '12.5');
  assert.equal(plain.format('-0'), '-0');
  assert.equal(plain.format(10n ** 1000n), '1' + '0'.repeat(1000));
  assert.equal(plain.format('1e1000'), '1' + '0'.repeat(1000));
  assert.equal(createTickerFormatter('hi-IN').format('9007199254740993'), '9,00,71,99,25,47,40,993');
});

test('huge decimal tails and locale parts survive outside Number.MAX_VALUE', () => {
  const digits = '9'.repeat(400);
  const rounded = createTickerFormatter('en-US', { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  assert.equal(rounded.format(`${digits}.995`), '1' + '0'.repeat(400) + '.00');
  assert.equal(rounded.format(`${digits}.123`), digits + '.12');
  const accounting = createTickerFormatter('en-US', { style: 'currency', currency: 'USD', currencySign: 'accounting', useGrouping: false });
  assert.equal(accounting.format(`-${digits}.125`), `($${digits}.13)`);
  assert.equal(createTickerFormatter('de-DE', { useGrouping: false, maximumFractionDigits: 2 }).format(`${digits}.123`), digits + ',12');
  const percent = createTickerFormatter('en-US', { style: 'percent', useGrouping: false, maximumFractionDigits: 2 });
  assert.equal(percent.format(`${digits}.1234`), digits + '12.34%');
  const compact = createTickerFormatter('en-US', { notation: 'compact', useGrouping: false, maximumFractionDigits: 15 });
  assert.equal(compact.format('1' + '0'.repeat(400) + '.123'), '1' + '0'.repeat(388) + '.000000000000123T');
  const russian = createTickerFormatter('ru-RU', { style: 'unit', unit: 'meter', unitDisplay: 'long', maximumFractionDigits: 1 });
  assert.match(russian.format('1' + '0'.repeat(308) + '1.5'), /001,5 метра$/);
  assert.match(russian.format('1' + '0'.repeat(308) + '1.0'), /001 метр$/);
});

test('scientific and engineering accept string exponents outside Number range', () => {
  const scientific = createTickerFormatter('en-US', { notation: 'scientific', maximumFractionDigits: 5 });
  assert.equal(scientific.format('1.23456789e1000'), '1.23457E1000');
  assert.equal(scientific.format('-1.23456789e-1000'), '-1.23457E-1000');
  assert.equal(createTickerFormatter('en-US', { notation: 'engineering', maximumFractionDigits: 2 }).format('1.23456789e1000'), '12.35E999');
});

test('compact conversion and promotion use exact factors and thresholds', () => {
  const units = [{ label: 'huge', factor: '1e400', threshold: '1e401' }];
  const format = createTickerFormatter('en-US', { maximumFractionDigits: 4 }, 'en', { units, promoteAfterRounding: false, overflow: 'unit' });
  assert.equal(format.format('1.234567e401'), '12.3457 huge');
  assert.doesNotMatch(format.format('9.9999e400'), /huge/);
  const exact = createTickerFormatter('en-US', { useGrouping: false, maximumFractionDigits: 0 }, 'en', {
    units: [{ label: 'U', factor: 9007199254740993n, threshold: '9007199254740995' }], promoteAfterRounding: false,
  });
  assert.equal(exact.format('9007199254740994'), '9007199254740994');
  assert.equal(exact.format('9007199254740995'), '1 U');
  const fixed = createTickerFormatter('en-US', { useGrouping: false, maximumFractionDigits: 3 }, 'en', { minUnit: 'K', maxUnit: 'K' });
  assert.equal(fixed.format('9007199254740993'), '9007199254740.993 K');
  assert.equal(createTickerFormatter('en-US', { maximumFractionDigits: 1 }, 'en').format('999949.999999999999999999'), '999.9 K');
  assert.equal(createTickerFormatter('en-US', { maximumFractionDigits: 1 }, 'en').format('999950'), '1 M');
});

test('scientific directed rounding preserves tiny tails of huge fractions', () => {
  const value = '1' + '0'.repeat(309) + '.1';
  for (const notation of ['scientific', 'engineering']) {
    for (const [sign, roundingMode, expected] of [
      ['', 'ceil', '1.01E309'], ['', 'expand', '1.01E309'],
      ['-', 'floor', '-1.01E309'], ['-', 'ceil', '-1E309'],
    ]) {
      assert.equal(createTickerFormatter('en-US', { notation, roundingMode, maximumFractionDigits: 2 }).format(sign + value), expected);
    }
  }
});

test('exact deltas and animation never coerce bigint or strings into Number', () => {
  assert.equal(subtractTickerValues(9007199254740994n, 9007199254740993n), 1n);
  assert.equal(subtractTickerValues('9007199254740993.00000002', '9007199254740993.00000001'), '1e-8');
  assert.equal(subtractTickerValues('9007199254740993', 9007199254740992n), '1');
  assert.equal(tickerValueChanged('1.00', 1n), false);
  assert.equal(interpolateTickerValue(9007199254740993n, 9007199254740995n, 0.5), 9007199254740994n);
  assert.equal(interpolateTickerValue('9007199254740993.1', '9007199254740993.3', 0.5), '9007199254740993.2');
  assert.equal(interpolateTickerValue('1e1000', '2e1000', 0.5), '1.5e+1000');
  assert.equal(canAnimateTickerValue('1e1000', '2e1000', 420), true);
  assert.equal(canAnimateTickerValue('1e1000', '1e-1000', 420), false, 'bound expensive animation spans');
  assert.equal(canAnimateTickerValue(1, '2', 420), false, 'type changes settle without lossy coercion');
});

test('invalid strings and oversized decimal work fail explicitly, not as zero or Infinity', () => {
  const formatter = createTickerFormatter('en-US');
  for (const value of ['', ' ', 'abc', '1,000', '0xff', 'Infinity', 'NaN', '1e', '1_000', '1e10001', '1e-10001', '1'.repeat(10001)]) {
    assert.throws(() => formatter.format(value), RangeError, value.slice(0, 40));
  }
});

test('derived deltas can exceed the public input bounds without losing precision', () => {
  const formatter = createTickerFormatter('en-US', { notation: 'scientific', maximumFractionDigits: 2 });
  assert.equal(formatDerivedTickerDelta(formatter, subtractTickerValues('9e10000', '-9e10000')), '+1.8E10001');
  assert.equal(formatDerivedTickerDelta(formatter, subtractTickerValues('1e10000', '1e-10000')), '+1E10000');
  assert.throws(() => formatter.format('1e10001'), RangeError, 'public inputs retain bounds');
});

test('SSR preserves exact callbacks, announcements and BigInt unit configuration', () => {
  let callbackValue;
  const markup = renderToStaticMarkup(createElement(NumberTicker, {
    value: 9007199254740993n, compact: 'en', compactOptions: { units: [{ factor: 1000n, label: 'K' }], maxUnit: 'K' },
    getValueLabel: (value, formatted) => { callbackValue = value; return formatted; },
  }));
  assert.equal(callbackValue, 9007199254740993n);
  assert.match(markup, /aria-live="polite">9,007,199,254,740,993<\/span>/);
  const huge = renderToStaticMarkup(createElement(NumberTicker, { value: '1e1000', formatOptions: { notation: 'scientific' } }));
  assert.match(huge, /1E1000/);
  assert.doesNotMatch(huge, /Infinity|∞/);
});

test('compact unit systems cover English and Chinese magnitudes without changing defaults', () => {
  const en = createTickerFormatter('en-US', undefined, 'en');
  const zh = createTickerFormatter('zh-CN', undefined, 'zh');
  for (const [value, english, chinese] of [
    [0, '0', '0'], [12.34, '12.3', '12.3'], [999, '999', '999'],
    [1000, '1 K', '1 千'], [12840, '12.8 K', '1.3 万'],
    [1e6, '1 M', '100 万'], [1e8, '100 M', '1 亿'],
    [1e9, '1 B', '10 亿'], [1e12, '1 T', '1 兆'], [1e15, '1 Qa', '1,000 兆'],
    [1e16, '10 Qa', '1 京'], [1e24, '1 Sp', '1 秭'], [1e33, '1 Dc', '10 沟'],
    [1e68, '1E68', '1 无量大数'], [1e100, '1E100', '1E100'],
    [-12840, '-12.8 K', '-1.3 万'],
  ]) {
    assert.equal(en.format(value), english);
    assert.equal(zh.format(value), chinese);
  }
  assert.equal(createTickerFormatter('zh-CN').format(12840), '12,840');
  assert.equal(createTickerFormatter(['zh-CN', 'en-US'], undefined, true).format(1e12), '1 兆');
  assert.equal(createTickerFormatter('en-US', undefined, true).format(1e12), '1 T');
  assert.equal(createTickerFormatter('zh-CN', undefined, 'en').format(1000), '1 K');
  assert.equal(createTickerFormatter('en-US', undefined, 'zh').format(1000), '1 千');
});

test('compact rounding promotes units at boundaries and respects caller precision', () => {
  const en = createTickerFormatter('en-US', undefined, 'en');
  const zh = createTickerFormatter('zh-CN', undefined, 'zh');
  for (const [value, english, chinese] of [
    [999.96, '1 K', '1 千'], [9950, '10 K', '1 万'],
    [999949, '999.9 K', '100 万'], [999950, '1 M', '100 万'],
    [-999950, '-1 M', '-100 万'], [99995000, '100 M', '9,999.5 万'],
    [99999500, '100 M', '1 亿'], [999950000000, '1 T', '9,999.5 亿'],
    [999995000000, '1 T', '1 兆'],
  ]) {
    assert.equal(en.format(value), english, String(value));
    assert.equal(zh.format(value), chinese, String(value));
  }
  assert.equal(createTickerFormatter('en-US', { maximumFractionDigits: 2 }, 'en').format(12840), '12.84 K');
  assert.equal(createTickerFormatter('en-US', { minimumFractionDigits: 2 }, 'en').format(12000), '12.00 K');
  assert.equal(createTickerFormatter('en-US', { maximumSignificantDigits: 3 }, 'en').format(999999), '1 M');
});

test('compact parts preserve locale, signs, currency, percentages and non-finite values', () => {
  const en = createTickerFormatter('en-US', undefined, 'en');
  assert.equal(en.format(NaN), 'NaN');
  assert.equal(en.format(Infinity), '∞');
  assert.equal(en.format(-Infinity), '-∞');
  assert.equal(en.format(-0), '-0');
  assert.equal(formatTickerDelta(en, -12840), '−12.8 K');
  assert.equal(formatTickerDelta(createTickerFormatter('zh-CN', undefined, 'zh'), 12840), '+1.3 万');
  assert.equal(createTickerFormatter('en-US', { style: 'currency', currency: 'USD', currencySign: 'accounting' }, 'en').format(-12840), '($12.8 K)');
  assert.equal(createTickerFormatter('en-US', { style: 'percent' }, 'en').format(12.84), '1.3 K%');
  assert.equal(createTickerFormatter('de-DE', undefined, 'en').format(12840), '12,8 K');
  assert.deepEqual(en.formatToParts(12840).filter(part => part.type === 'compact'), [{ type: 'compact', value: 'K' }]);
  const options = { notation: 'compact', maximumFractionDigits: 1 };
  assert.equal(createTickerFormatter('zh-CN', options).format(1e12), createNumberFormatter('zh-CN', options).format(1e12));
});

test('compact SSR preserves pencil text and announces the unabbreviated final value', () => {
  const markup = renderToStaticMarkup(createElement(NumberTicker, { value: 12840, locale: 'zh-CN', compact: 'zh', prefix: '积分' }));
  assert.match(markup, /inkra-pencil-text/);
  assert.match(markup, /1.3 万/);
  assert.match(markup, /aria-live="polite">积分 12,840<\/span>/);
  assert.doesNotMatch(markup, / compact=/);
  let details;
  renderToStaticMarkup(createElement(NumberTicker, {
    value: 12840, compact: 'en', renderValue: (_value, info) => { details = info; return info.formattedValue; },
  }));
  assert.equal(details.formattedValue, '12.8 K');
  const fixed = renderToStaticMarkup(createElement(NumberTicker, {
    value: 12840, compact: 'zh', compactOptions: { minUnit: '万', maxUnit: '万', separator: '' },
    prefix: createElement('svg', { 'data-test-icon': 'prefix' }), suffix: createElement('svg', { 'data-test-icon': 'suffix' }),
    getValueLabel: (_value, formatted) => `Points ${formatted}`,
  }));
  assert.match(fixed, /1.3万/);
  assert.match(fixed, /data-test-icon="prefix"/);
  assert.match(fixed, /data-test-icon="suffix"/);
  assert.match(fixed, /aria-live="polite">Points 12,840/);
  assert.doesNotMatch(fixed, /compactOptions=/);
});

test('unit bounds, fixed units, separators, custom tables and overflow are independent', () => {
  const format = (value, config) => createTickerFormatter('en-US', undefined, 'en', config).format(value);
  assert.equal(format(1e9, { maxUnit: 'M' }), '1,000 M');
  assert.equal(format(1234, { minUnit: 'M', maxUnit: 'M' }), '0 M');
  assert.equal(format(100000, { minUnit: 'M', maxUnit: 'M' }), '0.1 M');
  assert.equal(format(1234, { separator: '' }), '1.2K');
  assert.equal(format(1e36, { overflow: 'unit' }), '1,000 Dc');
  assert.equal(format(1e9, { maxUnit: 'M', overflow: 'scientific' }), '1E9');
  assert.equal(createTickerFormatter('zh-CN', undefined, 'zh', { maxUnit: '万' }).format(1e8), '10,000 万');
  const units = [{ factor: 1024 ** 2, label: 'MiB' }, { factor: 1024, label: 'KiB' }];
  assert.equal(format(1536, { units }), '1.5 KiB');
  assert.equal(format(1024 ** 2, { units }), '1 MiB');
  assert.equal(units[0].label, 'MiB', 'caller array is not sorted in place');
  for (const config of [{ maxUnit: 'missing' }, { minUnit: 'M', maxUnit: 'K' }, { promotionThreshold: 0 },
    { units: [{ factor: 0, label: 'bad' }] }, { units: [{ factor: 1000, label: 'K' }, { factor: 1e6, label: 'K' }] },
    { units: [{ factor: 1000, label: 'K', threshold: 1e6 }, { factor: 1e6, label: 'M', threshold: 1e5 }] }]) {
    assert.throws(() => format(1234, config), RangeError);
  }
});

test('promotion thresholds and rounding are configurable for signs and precision', () => {
  const delayed = createTickerFormatter('en-US', undefined, 'en', { promotionThreshold: 10, promoteAfterRounding: false });
  assert.equal(delayed.format(9999), '9,999');
  assert.equal(delayed.format(10000), '10 K');
  assert.equal(delayed.format(1e6), '1,000 K');
  assert.equal(delayed.format(1e7), '10 M');
  assert.equal(createTickerFormatter('en-US', undefined, 'en', { promotionThreshold: 0.1 }).format(100), '0.1 K');
  assert.equal(createTickerFormatter('en-US', undefined, 'en', { promoteAfterRounding: false }).format(999950), '1,000 K');
  const custom = createTickerFormatter('zh-CN', undefined, 'zh', { units: [{ factor: 1e4, label: '万', threshold: 1e5 }] });
  assert.equal(custom.format(99999), '99,999');
  assert.equal(custom.format(100000), '10 万');
  const trunc = createTickerFormatter('en-US', { roundingMode: 'trunc', maximumFractionDigits: 1 }, 'en');
  assert.equal(trunc.format(12999), '12.9 K');
  assert.equal(trunc.format(-12999), '-12.9 K');
  assert.equal(trunc.format(999950), '999.9 K');
  assert.equal(createTickerFormatter('en-US', { roundingMode: 'floor', maximumFractionDigits: 1 }, 'en').format(-999.96), '-1 K');
  assert.equal(formatTickerDelta(createTickerFormatter('en-US', { roundingMode: 'ceil', maximumFractionDigits: 1 }, 'en'), -12840), '−12.8 K');
  assert.equal(formatTickerDelta(createTickerFormatter('en-US', { roundingMode: 'floor', maximumFractionDigits: 1 }, 'en'), -999960), '−1 M');
  assert.equal(formatTickerDelta(createTickerFormatter('en-US', { style: 'currency', currency: 'USD', currencySign: 'accounting' }, 'en'), -12840), '−$12.8 K');
  assert.equal(createTickerFormatter('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }, 'en').format(12000), '12.00 K');
});

test('scientific and engineering notation take precedence and cover tiny and huge numbers', () => {
  const scientific = createTickerFormatter('en-US', { notation: 'scientific', maximumFractionDigits: 2 }, 'zh');
  assert.equal(scientific.format(12840), '1.28E4');
  assert.equal(scientific.format(0.000001284), '1.28E-6');
  assert.equal(scientific.format(1.234e100), '1.23E100');
  assert.equal(createTickerFormatter('en-US', { notation: 'engineering', maximumFractionDigits: 2 }).format(12840), '12.84E3');
  assert.equal(interpolateTickerValue(-Number.MAX_VALUE, Number.MAX_VALUE, 0.5), 0);
  assert.equal(interpolateTickerValue(-Number.MAX_VALUE, Number.MAX_VALUE, 1), Number.MAX_VALUE);
});

test('NumberTicker formats ordinary, negative and decimal values with Intl.NumberFormat', () => {
  const en = createNumberFormatter('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const zh = createNumberFormatter('zh-CN', { notation: 'compact', maximumFractionDigits: 1 });
  assert.equal(formatTickerValue(en, 1234.5), '1,234.50');
  assert.equal(formatTickerValue(en, -12.25), '-12.25');
  assert.equal(formatTickerValue(zh, 12500), '1.3万');
});

test('NumberTicker delta formatting keeps an explicit direction without double signs', () => {
  const formatter = createNumberFormatter('en-US', { maximumFractionDigits: 2 });
  assert.equal(formatTickerDelta(formatter, 12.5), '+12.5');
  assert.equal(formatTickerDelta(formatter, -3.25), '−3.25');
  assert.equal(formatTickerDelta(formatter, 0), '0');
  const signed = createNumberFormatter('en-US', { signDisplay: 'always' });
  assert.equal(formatTickerDelta(signed, 12), '+12');
  assert.equal(formatTickerDelta(signed, -12), '−12');
});

test('interpolation is bounded and preserves non-finite final values deterministically', () => {
  assert.equal(interpolateTickerValue(10, 20, -1), 10);
  assert.equal(interpolateTickerValue(10, 20, 0.5), 15);
  assert.equal(interpolateTickerValue(10, 20, 2), 20);
  assert.equal(interpolateTickerValue(10, Infinity, 0.5), Infinity);
  assert(Number.isNaN(interpolateTickerValue(10, Number.NaN, 0.5)));
});

test('animation eligibility rejects zero duration, unchanged and non-finite endpoints', () => {
  assert.equal(canAnimateTickerValue(-1.5, 2.75, 420), true);
  assert.equal(canAnimateTickerValue(1, 1, 420), false);
  assert.equal(canAnimateTickerValue(1, 2, 0), false);
  assert.equal(canAnimateTickerValue(1, Infinity, 420), false);
  assert.equal(canAnimateTickerValue(Number.NaN, 2, 420), false);
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
});

test('component continues rapid updates from the displayed frame and cleans schedulers', () => {
  assert.match(source, /const from = displayedRef\.current/);
  assert.match(source, /displayedRef\.current = next/);
  assert.match(source, /cancelAnimationFrame\(frameRef\.current\)/);
  assert.match(source, /clearTimeout\(deltaTimerRef\.current\)/);
  assert.match(source, /return \(\) => \{[\s\S]*cancelAnimationFrame/);
});

test('SSR starts at the supplied final value and assistive technology sees no animation frames', () => {
  assert.match(source, /useState\(value\)/);
  assert.match(source, /setAnnouncedValue\(value\)/);
  assert.match(source, /aria-hidden="true" className="inkra-number-ticker__visual"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /accessibleAffix\(prefix\).*announcedFormattedValue.*accessibleAffix\(suffix\)/s);
  assert.match(source, /\{accessibleLabel\}<\/span>/);
  assert.doesNotMatch(source, /aria-live[^\n]+displayedValue/);
});

test('default animation avoids regenerating PencilText on each frame', () => {
  assert.match(source, /animating[\s\S]*inkra-number-ticker__native-value/);
  assert.match(source, /<PencilText seed=\{`number-ticker-\$\{finalFormattedValue\}`\}>/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(styles, /font-variant-numeric:\s*tabular-nums/);
  assert.match(styles, /forced-colors: active/);
  assert.doesNotMatch(source, /import ['"]\.\/styles\.css['"]/);
});

