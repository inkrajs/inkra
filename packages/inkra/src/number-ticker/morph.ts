import { ExactDecimal, tickerDecimal } from './precision.js';
import type { NumberTickerValue } from './precision.js';
import { rollingTokens } from './rolling.js';

const numericParts = new Set(['integer', 'fraction', 'decimal', 'group']);
const exponentParts = new Set(['exponentSeparator', 'exponentMinusSign', 'exponentInteger']);

interface DisplayDigits {
  indexes: number[];
  text: string[];
  first: number;
  last: number;
  exponent: number;
}

function displayDigits(parts: Intl.NumberFormatPart[], zeroGlyph: string): DisplayDigits | null {
  const tokens = rollingTokens(parts);
  const indexes = tokens.flatMap((token, index) => token.digit ? [index] : []);
  const text = indexes.map(index => tokens[index].text);
  const first = text.findIndex(digit => digit !== zeroGlyph);
  if (first < 0) return null;
  let last = text.length - 1;
  while (text[last] === zeroGlyph) last--;
  const integerLength = parts.filter(part => part.type === 'integer')
    .reduce((length, part) => length + Array.from(part.value).length, 0);
  return { indexes, text, first, last, exponent: integerLength - first - 1 };
}

/**
 * Match an exact decimal shift, rather than guessing identity from equal glyphs.
 * Pair indexes address rollingTokens(parts), including unchanged typed symbols.
 * A null result leaves the transition to the existing place-aligned reels.
 */
export function morphTokenMapping(
  fromParts: Intl.NumberFormatPart[],
  toParts: Intl.NumberFormatPart[],
  fromValue: NumberTickerValue,
  toValue: NumberTickerValue,
  zeroGlyph = '0',
): Array<[number, number]> | null {
  const from = tickerDecimal(fromValue);
  const to = tickerDecimal(toValue);
  if (!from.isFinite() || !to.isFinite() || from.isZero() || to.isZero()
    || from.isNegative() !== to.isNegative()) return null;
  const shift = to.e - from.e;
  if (shift === 0 || !from.times(new ExactDecimal(10).pow(shift)).eq(to)) return null;

  // Unit/sign/literal changes are separate semantic transitions. Exponents have
  // their own digit domain and must never be mistaken for mantissa digits.
  if ([...fromParts, ...toParts].some(part => exponentParts.has(part.type))) return null;
  const symbols = (parts: Intl.NumberFormatPart[]) => parts.filter(part => !numericParts.has(part.type));
  const fromSymbols = symbols(fromParts);
  const toSymbols = symbols(toParts);
  if (fromSymbols.length !== toSymbols.length || fromSymbols.some((part, index) => {
    const next = toSymbols[index];
    return part.type !== next.type || part.value !== next.value;
  })) return null;

  const before = displayDigits(fromParts, zeroGlyph);
  const after = displayDigits(toParts, zeroGlyph);
  if (!before || !after || after.exponent - before.exponent !== shift) return null;
  const core = before.text.slice(before.first, before.last + 1);
  const nextCore = after.text.slice(after.first, after.last + 1);
  // Rounding may change the visible significand even for an exact raw shift.
  if (core.length !== nextCore.length || core.some((digit, index) => digit !== nextCore[index])) return null;

  const mapping: Array<[number, number]> = [];
  for (let index = 0; index < core.length; index++) {
    mapping.push([before.indexes[before.first + index], after.indexes[after.first + index]]);
  }
  // Edge zeros retain their ordinal distance from the significant core. This
  // preserves 10 as the first 10 in 1000 without matching arbitrary repeats.
  for (let offset = 1; offset <= Math.min(before.first, after.first); offset++) {
    mapping.push([before.indexes[before.first - offset], after.indexes[after.first - offset]]);
  }
  const trailing = Math.min(before.text.length - before.last - 1, after.text.length - after.last - 1);
  for (let offset = 1; offset <= trailing; offset++) {
    mapping.push([before.indexes[before.last + offset], after.indexes[after.last + offset]]);
  }

  const fromTokens = rollingTokens(fromParts);
  const toTokens = rollingTokens(toParts);
  const targetSymbols = new Map(toTokens.flatMap((token, index) => token.digit ? [] : [[token.key, { token, index }] as const]));
  fromTokens.forEach((token, index) => {
    if (token.digit) return;
    const next = targetSymbols.get(token.key);
    if (next && next.token.text === token.text) mapping.push([index, next.index]);
  });
  return mapping.sort((left, right) => left[0] - right[0]);
}
