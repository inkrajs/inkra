import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  canAnimateTickerValue,
  createNumberFormatter,
  easeOutCubic,
  formatTickerDelta,
  formatTickerValue,
  interpolateTickerValue,
} from '../src/number-ticker/model.ts';

const source = readFileSync(new URL('../src/number-ticker/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/number-ticker/styles.css', import.meta.url), 'utf8');

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

