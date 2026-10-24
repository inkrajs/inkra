import { Decimal } from 'decimal.js';

export type NumberTickerValue = number | bigint | string;

// Isolated arithmetic context; never change the application's Decimal defaults.
// Covers the full span of the bounded input exponents and significant digits.
export const ExactDecimal = Decimal.clone({ precision: 30050, toExpNeg: -7, toExpPos: 21 });
const decimalPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const maxDigits = 10000;

export function tickerDecimal(value: NumberTickerValue): Decimal {
  const source = typeof value === 'number' && Object.is(value, -0) ? '-0' : String(value).trim();
  if (typeof value !== 'number') {
    const [coefficient, exponent = '0'] = source.split(/[eE]/);
    if (!decimalPattern.test(source) || coefficient.replace(/\D/g, '').length > maxDigits
      || exponent.length > 7 || Math.abs(Number(exponent)) > maxDigits) {
      throw new RangeError('NumberTicker requires a decimal value with at most 10000 digits and an exponent between -10000 and 10000');
    }
  }
  const decimal = new ExactDecimal(source);
  if (decimal.isFinite() && Math.abs(decimal.e) > maxDigits) {
    throw new RangeError('NumberTicker decimal magnitude exceeds the supported exponent range');
  }
  return decimal;
}

export function tickerValueKey(value: unknown): string {
  return JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? { $bigint: String(item) } : item);
}

const roundingModes: Record<string, Decimal.Rounding> = {
  ceil: Decimal.ROUND_CEIL, floor: Decimal.ROUND_FLOOR,
  expand: Decimal.ROUND_UP, trunc: Decimal.ROUND_DOWN,
  halfCeil: Decimal.ROUND_HALF_CEIL, halfFloor: Decimal.ROUND_HALF_FLOOR,
  halfExpand: Decimal.ROUND_HALF_UP, halfTrunc: Decimal.ROUND_HALF_DOWN,
  halfEven: Decimal.ROUND_HALF_EVEN,
};

function roundedDecimal(value: Decimal, options: Intl.ResolvedNumberFormatOptions): { value: Decimal; decimals: number } {
  const extra = options as typeof options & { roundingMode?: string; roundingPriority?: string; roundingIncrement?: number; trailingZeroDisplay?: string };
  const mode = roundingModes[extra.roundingMode ?? 'halfExpand'];
  const maxFraction = options.maximumFractionDigits ?? 0;
  const increment = new ExactDecimal(extra.roundingIncrement ?? 1).times(new ExactDecimal(10).pow(-maxFraction));
  const fraction = value.div(increment).toDecimalPlaces(0, mode).times(increment);
  const significant = options.maximumSignificantDigits === undefined ? null : value.toSignificantDigits(options.maximumSignificantDigits, mode);
  const significantPlace = value.e - (options.maximumSignificantDigits ?? 1) + 1;
  const useSignificant = significant !== null && (extra.roundingPriority === 'morePrecision'
    ? significantPlace < -maxFraction : extra.roundingPriority === 'lessPrecision'
      ? significantPlace >= -maxFraction : true);
  const rounded = useSignificant ? significant! : fraction;
  const decimals = extra.trailingZeroDisplay === 'stripIfInteger' && rounded.isInteger() ? 0
    : useSignificant ? Math.max(0, (options.minimumSignificantDigits ?? 1) - rounded.e - 1)
      : options.minimumFractionDigits ?? 0;
  return { value: rounded, decimals };
}

let exactDecimalStringsSupported: boolean | undefined;
function supportsExactDecimalStrings(): boolean {
  if (exactDecimalStringsSupported === undefined) {
    const probe = new Intl.NumberFormat('en-US', { useGrouping: false });
    exactDecimalStringsSupported = (probe.format as unknown as (value: string) => string)('9007199254740993') === '9007199254740993';
  }
  return exactDecimalStringsSupported;
}

// Intl accepts exact decimal strings in modern engines, but some engines still
// turn strings beyond Number.MAX_VALUE into Infinity. BigInt bypasses that path.
export function formatExactParts(formatter: Intl.NumberFormat, value: NumberTickerValue | Decimal): Intl.NumberFormatPart[] {
  if (typeof value === 'number') return formatter.formatToParts(value);
  const decimal = Decimal.isDecimal(value) ? value : tickerDecimal(value);
  if (!decimal.isFinite()) return formatter.formatToParts(decimal.toNumber());
  if (decimal.isZero()) return formatter.formatToParts(decimal.isNegative() ? -0 : 0);
  if (decimal.isInteger()) return formatter.formatToParts(BigInt(decimal.toFixed(0)));
  if (decimal.e < 308) {
    const exactFormat = formatter.formatToParts as unknown as (value: string) => Intl.NumberFormatPart[];
    if (!supportsExactDecimalStrings()) {
      throw new RangeError('NumberTicker decimal strings require exact Intl.NumberFormat string support');
    }
    return exactFormat.call(formatter, decimal.toString());
  }
  const options = formatter.resolvedOptions();
  // Directed rounding still observes tiny tails at huge magnitudes. Round the
  // mantissa before converting to BigInt, then let Intl supply locale notation.
  if (options.notation === 'scientific' || options.notation === 'engineering') {
    const display = options.style === 'percent' ? decimal.times(100) : decimal;
    const exponent = options.notation === 'engineering' ? Math.floor(display.e / 3) * 3 : display.e;
    const factor = new ExactDecimal(10).pow(exponent);
    const rounded = roundedDecimal(display.div(factor), options).value.times(factor);
    const originalScale = options.style === 'percent' ? rounded.div(100) : rounded;
    return formatter.formatToParts(BigInt(originalScale.toFixed(0)));
  }
  let scaled = options.style === 'percent' ? decimal.times(100) : decimal;
  if (options.notation === 'compact') {
    const probe = new Intl.NumberFormat(options.locale, { ...options, style: 'decimal', useGrouping: false });
    const digits = probe.formatToParts(BigInt(new ExactDecimal(10).pow(scaled.e).toFixed(0)))
      .filter(part => part.type === 'integer').map(part => Array.from(part.value).length).reduce((sum, length) => sum + length, 0);
    scaled = scaled.div(new ExactDecimal(10).pow(scaled.e - digits + 1));
  }
  const rounded = roundedDecimal(scaled, options);
  const [integer, fraction = ''] = rounded.value.abs().toFixed().split('.');
  const fractionalDigits = fraction.padEnd(rounded.decimals, '0');
  const plain = new Intl.NumberFormat(options.locale, {
    numberingSystem: options.numberingSystem, minimumIntegerDigits: options.minimumIntegerDigits,
    useGrouping: options.useGrouping, maximumFractionDigits: 0,
  });
  const numericParts = plain.formatToParts(BigInt(integer));
  if (fractionalDigits) {
    const digits = new Intl.NumberFormat(options.locale, { numberingSystem: options.numberingSystem, useGrouping: false });
    const symbols = Array.from({ length: 10 }, (_, digit) => digits.format(digit));
    numericParts.push({ type: 'decimal', value: digits.formatToParts(1.1).find(part => part.type === 'decimal')!.value },
      { type: 'fraction', value: fractionalDigits.replace(/\d/g, digit => symbols[Number(digit)]) });
  }
  const pattern = formatter.formatToParts(BigInt(decimal.trunc().toFixed(0)));
  // Long unit/currency names depend on the displayed fraction as well as the
  // integer ending. Preserve plural operands without passing an overflowing
  // decimal string to Intl (CLDR cardinal rules inspect at most six end digits).
  const pluralParts = options.style === 'unit' || (options.style === 'currency' && options.currencyDisplay === 'name')
    ? formatExactParts(new Intl.NumberFormat(options.locale, {
      numberingSystem: options.numberingSystem, style: options.style,
      unit: options.unit, unitDisplay: options.unitDisplay,
      currency: options.currency, currencyDisplay: options.currencyDisplay,
      minimumFractionDigits: fractionalDigits.length, maximumFractionDigits: fractionalDigits.length,
    }), `${BigInt(integer) > 1000000n ? 1000000n + BigInt(integer) % 1000000n : BigInt(integer)}${fractionalDigits ? `.${fractionalDigits}` : ''}`)
    : undefined;
  let inserted = false;
  return pattern.flatMap(part => {
    if (part.type === 'unit' || part.type === 'currency') {
      return [pluralParts?.find(candidate => candidate.type === part.type) ?? part];
    }
    if (!['integer', 'group', 'decimal', 'fraction'].includes(part.type)) return [part];
    if (inserted) return [];
    inserted = true;
    return numericParts;
  });
}

export function subtractTickerValues(next: NumberTickerValue, previous: NumberTickerValue): NumberTickerValue | null {
  const to = tickerDecimal(next);
  const from = tickerDecimal(previous);
  if (!to.isFinite() || !from.isFinite()) return null;
  if (typeof next === 'number' && typeof previous === 'number') return next - previous;
  const difference = to.minus(from);
  return typeof next === 'bigint' && typeof previous === 'bigint' ? BigInt(difference.toFixed(0)) : difference.toString();
}
