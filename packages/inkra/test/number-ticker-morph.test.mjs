import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NumberTicker } from '../dist/number-ticker/index.js';
import { morphTokenMapping } from '../dist/number-ticker/morph.js';
import { createTickerFormatter } from '../dist/number-ticker/model.js';
import { rollingTokens } from '../dist/number-ticker/rolling.js';
import { createMorphMotion, sampleMorphGlyph } from '../dist/number-ticker/morph-motion.js';

function transition(from, to, locale = 'en', options = {}, compact = false) {
  const formatter = createTickerFormatter(locale, options, compact);
  const before = formatter.formatToParts(from);
  const after = formatter.formatToParts(to);
  const zero = new Intl.NumberFormat(locale, { useGrouping: false }).format(0);
  const mapping = morphTokenMapping(before, after, from, to, zero);
  const source = rollingTokens(before);
  const target = rollingTokens(after);
  if (mapping) {
    assert.equal(new Set(mapping.map(pair => pair[0])).size, mapping.length, 'source identities are unique');
    assert.equal(new Set(mapping.map(pair => pair[1])).size, mapping.length, 'target identities are unique');
    for (const [left, right] of mapping) {
      assert.equal(source[left].text, target[right].text, 'mapped glyphs retain their text');
      assert.equal(source[left].digit, target[right].digit, 'symbols and digits stay separate');
    }
    const digits = mapping.filter(([left]) => source[left].digit);
    assert(digits.every((pair, index) => index === 0 || pair[1] > digits[index - 1][1]), 'digit identities never cross');
  }
  return { mapping, source, target, digits: mapping?.filter(([left]) => source[left].digit) };
}

function matchedDigits(...args) {
  const { digits, source, target } = transition(...args);
  assert(digits, 'expected an exact decimal shift');
  return digits.map(([left, right]) => [source[left].key, target[right].key, source[left].text]);
}

test('decimal shifts preserve the significant sequence and adjacent trailing zeros', () => {
  assert.deepEqual(matchedDigits(1, 100), [['integer-0', 'integer-2', '1']]);
  assert.deepEqual(matchedDigits(10, 1000), [
    ['integer-1', 'integer-3', '1'], ['integer-0', 'integer-2', '0'],
  ]);
  assert.deepEqual(matchedDigits(1000, 10), [
    ['integer-3', 'integer-1', '1'], ['integer-2', 'integer-0', '0'],
  ]);
  assert.deepEqual(matchedDigits(101, 10100).map(pair => pair[2]), ['1', '0', '1']);
  assert.deepEqual(matchedDigits(11, 1100).map(pair => pair[2]), ['1', '1']);
});

test('digits can cross a decimal while separators keep their typed identity', () => {
  assert.deepEqual(matchedDigits(12.34, 123.4), [
    ['integer-1', 'integer-2', '1'], ['integer-0', 'integer-1', '2'],
    ['fraction-0', 'integer-0', '3'], ['fraction-1', 'fraction-0', '4'],
  ]);
  assert.deepEqual(matchedDigits(1.2, 120).map(pair => pair[2]), ['1', '2']);
  assert.deepEqual(matchedDigits(12, 0.12), [
    ['integer-1', 'fraction-0', '1'], ['integer-0', 'fraction-1', '2'],
  ]);
  const { mapping, source, target } = transition(12.34, 123.4);
  const decimal = mapping.find(([left]) => source[left].key === 'decimal-0');
  assert.equal(target[decimal[1]].key, 'decimal-0');
});

test('fixed fractional and integer zero padding maps only by distance from the core', () => {
  assert.deepEqual(matchedDigits(1, 100, 'en', { minimumFractionDigits: 2 }).map(pair => pair[2]), ['1', '0', '0']);
  assert.deepEqual(matchedDigits(0.001, 0.1).map(pair => pair[2]), ['0', '1']);
  assert.deepEqual(matchedDigits(1, 100, 'en', { minimumIntegerDigits: 4 }).map(pair => pair[2]), ['0', '1']);
});

test('carries, arbitrary edits, zero, sign flips and unchanged magnitudes use place fallback', () => {
  for (const [from, to] of [[99, 100], [123, 312], [1, 101], [9, 99], [0, 100], [100, 0], [-1, 100], [1, -100], [1, 1], [-0, 0]]) {
    assert.equal(transition(from, to).mapping, null, `${from} → ${to}`);
  }
});

test('visible rounding must preserve both significand and decimal shift', () => {
  assert.equal(transition(1.249, 124.9, 'en', { maximumFractionDigits: 2 }).mapping, null);
  assert.equal(transition(0.001, 0.1, 'en', { maximumFractionDigits: 2 }).mapping, null);
  assert.equal(transition(0.014, 0.14, 'en', { maximumFractionDigits: 1 }).mapping, null);
  assert(transition(1.249, 124.9, 'en', { maximumSignificantDigits: 2 }).mapping);
});

test('same-sign negatives, exact large integers and tiny exact decimals retain identity', () => {
  assert.deepEqual(matchedDigits(-12, -1200).map(pair => pair[2]), ['1', '2']);
  assert.deepEqual(matchedDigits(9007199254740993n, 900719925474099300n).map(pair => pair[2]).join(''), '9007199254740993');
  assert(transition('1e-20', '1e-18', 'en', { maximumFractionDigits: 20 }).mapping);
});

test('currency, grouping and localized digits preserve typed symbols without matching punctuation as digits', () => {
  for (const locale of ['fr', 'ar-EG', 'hi-IN']) {
    const { mapping, source, target } = transition(-12.34, -1234, locale, { style: 'currency', currency: 'EUR' });
    assert(mapping, locale);
    const currency = mapping.find(([left]) => source[left].key.startsWith('currency-'));
    assert(currency, locale);
    assert(target[currency[1]].key.startsWith('currency-'));
  }
});

test('compact unit changes, exponent notation and unit/sign changes cannot reuse numeric identities', () => {
  assert.equal(transition(1000, 1000000, 'en', {}, 'en').mapping, null);
  assert.equal(transition(1, 100, 'en', { notation: 'scientific' }).mapping, null);
  assert.equal(transition(1000, 100000, 'en', { notation: 'engineering' }).mapping, null);
  assert.equal(transition(1, 100, 'en', { style: 'unit', unit: 'meter', unitDisplay: 'long' }).mapping, null);
  const before = [{ type: 'integer', value: '1' }, { type: 'currency', value: '$' }];
  const after = [{ type: 'integer', value: '100' }, { type: 'currency', value: '€' }];
  assert.equal(morphTokenMapping(before, after, 1, 100), null);
  assert(transition(1000, 100000, 'en', {}, 'en').mapping, 'unchanged compact units remain comparable');
});

const motionFormatter = createTickerFormatter('en', { useGrouping: false });
const motionTokens = value => rollingTokens(motionFormatter.formatToParts(value));
function motionStep(from, to, previous, direction = 'up') {
  return createMorphMotion(motionTokens(from), motionTokens(to), morphTokenMapping(
    motionFormatter.formatToParts(from), motionFormatter.formatToParts(to), from, to,
  ), direction, token => token.digit ? 1 : 0.4, previous);
}

function assertContinuous(first, progress, next) {
  const visible = first.glyphs.map(glyph => sampleMorphGlyph(glyph, progress))
    .filter(glyph => glyph.opacity > .001 && Math.abs(glyph.y) < 1.001);
  assert.equal(new Set(next.glyphs.map(glyph => glyph.id)).size, next.glyphs.length);
  for (const glyph of visible) {
    const continued = next.glyphs.find(item => item.id === glyph.id);
    assert(continued, `visible glyph ${glyph.id} must keep its identity`);
    const resumed = sampleMorphGlyph(continued, 0);
    assert.equal(resumed.x, glyph.x, `${glyph.id}: horizontal position`);
    assert.equal(resumed.y, glyph.y, `${glyph.id}: vertical position`);
    assert.equal(resumed.opacity, glyph.opacity, `${glyph.id}: opacity`);
    assert.equal(resumed.width, glyph.width, `${glyph.id}: glyphs never stretch`);
  }
  assert.equal(next.glyphs.filter(glyph => glyph.target).map(glyph => glyph.text).join(''), next.tokens.map(token => token.text).join(''));
  for (const glyph of next.glyphs.filter(item => item.target)) {
    const final = sampleMorphGlyph(glyph, 1);
    assert.equal(final.y, 0);
    assert.equal(final.opacity, 1);
  }
}

test('expanded zeros start beyond the right edge and reveal without stretching existing digits', () => {
  for (const [from, to] of [[1, 100], [12, 1200], [10, 1000]]) {
    const motion = motionStep(from, to);
    assert.equal(motion.kind, 'shift');
    const retained = motion.glyphs.filter(glyph => glyph.id.startsWith('settled-') && glyph.target);
    assert.equal(retained.length, motionTokens(from).length);
    assert(retained.every(glyph => glyph.toX < glyph.fromX && glyph.fromY === 0 && glyph.toY === 0));
    const incoming = motion.glyphs.filter(glyph => !glyph.id.startsWith('settled-'));
    assert(incoming.length > 0);
    for (const glyph of incoming) {
      assert(glyph.fromX >= 0, 'incoming zeros begin outside the fixed right edge');
      assert.equal(sampleMorphGlyph(glyph, 0).opacity, 0);
      assert.equal(sampleMorphGlyph(glyph, .5).opacity, .5);
      assert.equal(sampleMorphGlyph(glyph, 1).opacity, 1);
      assert.equal(glyph.width, 1);
      assert.equal(glyph.fromY, 0);
      assert.equal(glyph.toY, 0);
    }
  }
});

test('reverse shifts retain digit identities and fade departing zeros toward the right', () => {
  const motion = motionStep(1000, 10, undefined, 'down');
  assert.equal(motion.kind, 'shift');
  const retained = motion.glyphs.filter(glyph => glyph.target);
  assert.deepEqual(retained.map(glyph => glyph.text), ['1', '0']);
  assert(retained.every(glyph => glyph.toX > glyph.fromX && glyph.fromOpacity === 1 && glyph.toOpacity === 1));
  const departing = motion.glyphs.filter(glyph => !glyph.target);
  assert.equal(departing.length, 2);
  assert(departing.every(glyph => glyph.toX >= 0 && glyph.toOpacity === 0 && glyph.width === 1));
});

test('ordinary fallback rolls changed places vertically and retains unchanged glyphs', () => {
  for (const direction of ['up', 'down']) {
    const motion = motionStep(12, 13, undefined, direction);
    assert.equal(motion.kind, 'roll');
    const unchanged = motion.glyphs.find(glyph => glyph.target && glyph.text === '1');
    assert.equal(unchanged.id, 'settled-integer-1');
    assert.equal(unchanged.fromX, unchanged.toX);
    const incoming = motion.glyphs.find(glyph => glyph.target && glyph.text === '3');
    const outgoing = motion.glyphs.find(glyph => !glyph.target && glyph.text === '2');
    assert.equal(incoming.fromY, direction === 'up' ? 1 : -1);
    assert.equal(outgoing.toY, direction === 'up' ? -1 : 1);
    assert.equal(incoming.fromX, incoming.toX);
    assert.equal(outgoing.fromX, outgoing.toX);
    assert.equal(incoming.fromOpacity, 1);
  }
});

test('interrupted shift, roll and reversed shifts retain actual offsets, opacity and repeated identities', () => {
  for (const [from, middle, to] of [
    [1, 100, 99], [12, 1200, 121], [99, 100, 10000], [11, 1100, 11],
    [12, 21, 2100], [-11, -1100, -111], [100, 99, 9900],
  ]) {
    for (const progress of [.07, .37, .81]) {
      const first = motionStep(from, middle);
      const next = motionStep(middle, to, { motion: first, progress }, 'down');
      assertContinuous(first, progress, next);
    }
  }
});

test('completed shrink releases its old width before the next short edit', () => {
  const shrink = motionStep(1000000000, 1);
  assert.equal(shrink.width, 10);
  assert.equal(shrink.targetWidth, 1);
  const interrupted = motionStep(1, 2, { motion: shrink, progress: .5 });
  assert.equal(interrupted.width, 10, 'in-flight content keeps its viewport');
  const next = motionStep(1, 2, { motion: shrink, progress: 1 });
  assert.equal(next.width, 1, 'completed long history must not re-expand a short value');
  assert.equal(next.targetWidth, 1);
});

test('rapid repeated retargets keep visible glyph IDs and resolve to the latest formatted endpoint', () => {
  const values = [11, 1100, 111, 11100, 99, 9900, 101, 10100, 10, 1000, 1];
  let current = motionStep(1, values[0]);
  for (let index = 1; index < values.length; index++) {
    const next = motionStep(values[index - 1], values[index], { motion: current, progress: .23 }, index % 2 ? 'up' : 'down');
    assertContinuous(current, .23, next);
    current = next;
  }
  assert.equal(current.glyphs.filter(glyph => glyph.target).map(glyph => glyph.text).join(''), '1');
});

test('public morph SSR renders the final native glyphs and one announcement with custom and oversized fallbacks', () => {
  const markup = renderToStaticMarkup(createElement(NumberTicker, { value: 1200, animation: 'morph', locale: 'en' }));
  assert.match(markup, /data-animation="morph"/);
  assert.match(markup, /inkra-number-ticker__morph"/);
  assert.equal((markup.match(/class="inkra-number-ticker__morph-glyph"/g) ?? []).length, 5);
  assert.equal((markup.match(/aria-live="polite"/g) ?? []).length, 1);
  assert.match(markup, /aria-live="polite">1,200<\/span>/);
  assert.equal([...markup.matchAll(/class="inkra-pencil-text__source">([^<]*)<\/span>/g)].map(match => match[1]).join(''), '1,200');
  assert.doesNotMatch(markup, /data-face="from"|data-animating="true"/);
  const custom = renderToStaticMarkup(createElement(NumberTicker, {
    value: 12, animation: 'morph', renderValue: (_value, details) => `Custom ${details.formattedValue}`,
  }));
  assert.match(custom, /Custom 12/);
  assert.doesNotMatch(custom, /inkra-number-ticker__morph|inkra-number-ticker__reels/);
  const oversized = renderToStaticMarkup(createElement(NumberTicker, {
    value: '1e200', animation: 'morph', locale: 'en', formatOptions: { useGrouping: false },
  }));
  assert.doesNotMatch(oversized, /inkra-number-ticker__morph|inkra-number-ticker__reels/);
  assert.match(oversized, /aria-live="polite">10{200}<\/span>/);
});
