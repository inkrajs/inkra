import { ExactDecimal, formatExactParts, tickerDecimal } from './precision.js';
import type { NumberTickerValue } from './precision.js';
export { subtractTickerValues, tickerValueKey } from './precision.js';
export type { NumberTickerValue } from './precision.js';

export type NumberTickerLocale = string | readonly string[];
export type NumberTickerCompact = boolean | 'en' | 'zh';
export interface NumberTickerFormatOptions extends Intl.NumberFormatOptions {
  roundingMode?: 'ceil' | 'floor' | 'expand' | 'trunc' | 'halfCeil' | 'halfFloor' | 'halfExpand' | 'halfTrunc' | 'halfEven';
}
export interface NumberTickerUnit {
  factor: NumberTickerValue;
  label: string;
  /** Absolute display magnitude required to enter this unit. */
  threshold?: NumberTickerValue;
}
export interface NumberTickerCompactOptions {
  units?: readonly NumberTickerUnit[];
  minUnit?: string;
  maxUnit?: string;
  separator?: string;
  promotionThreshold?: NumberTickerValue;
  promoteAfterRounding?: boolean;
  overflow?: 'unit' | 'scientific';
}

export const numberTickerUnits: Readonly<Record<'en' | 'zh', readonly NumberTickerUnit[]>> = {
  en: ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']
    .map((label, index) => ({ label, factor: Number(`1e${(index + 1) * 3}`) })),
  zh: [{ label: '千', factor: 1e3 }, ...['万', '亿', '兆', '京', '垓', '秭', '穰', '沟', '涧', '正', '载', '极', '恒河沙', '阿僧祇', '那由他', '不可思议', '无量大数']
    .map((label, index) => ({ label, factor: Number(`1e${(index + 1) * 4}`) }))],
};
type TickerFormatter = {
  format(value: NumberTickerValue): string;
  formatToParts(value: NumberTickerValue): Intl.NumberFormatPart[];
  formatDecimal(value: ReturnType<typeof tickerDecimal>): Intl.NumberFormatPart[];
};

export function createNumberFormatter(
  locale: NumberTickerLocale = 'en-US',
  options?: NumberTickerFormatOptions,
): Intl.NumberFormat {
  const formatter = new Intl.NumberFormat(locale, options);
  if (options?.roundingMode && options.roundingMode !== 'halfExpand' && !('roundingMode' in formatter.resolvedOptions())) {
    throw new RangeError('NumberTicker roundingMode requires Intl.NumberFormat rounding support');
  }
  return formatter;
}

export function createTickerFormatter(
  locale: NumberTickerLocale = 'en-US',
  options?: NumberTickerFormatOptions,
  compact: NumberTickerCompact = false,
  compactOptions: NumberTickerCompactOptions = {},
): TickerFormatter {
  if (!compact || options?.notation === 'scientific' || options?.notation === 'engineering') {
    const native = createNumberFormatter(locale, options);
    const formatToParts = (value: NumberTickerValue) => formatExactParts(native, value);
    return { formatToParts, formatDecimal: value => formatExactParts(native, value), format: value => formatToParts(value).map(part => part.value).join('') };
  }
  const precision = {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.max(1, options?.minimumFractionDigits ?? 0),
    ...options,
    notation: 'standard' as const,
  };
  const formatter = createNumberFormatter(locale, precision);
  const language = compact === true
    ? (formatter.resolvedOptions().locale.startsWith('zh') ? 'zh' : 'en')
    : compact;
  const multiplier = tickerDecimal(compactOptions.promotionThreshold ?? 1);
  if (!multiplier.gt(0) || !multiplier.isFinite()) throw new RangeError('promotionThreshold must be positive and finite');
  const supplied = [...(compactOptions.units ?? numberTickerUnits[language])]
    .map(unit => ({ ...unit, factor: tickerDecimal(unit.factor), threshold: unit.threshold === undefined ? undefined : tickerDecimal(unit.threshold) }))
    .sort((a, b) => a.factor.cmp(b.factor));
  const labels = new Set<string>();
  let previousFactor = tickerDecimal(1);
  let previousThreshold = tickerDecimal(0);
  for (const unit of supplied) {
    const threshold = unit.threshold ?? unit.factor.times(multiplier);
    if (!unit.label.trim() || labels.has(unit.label) || !unit.factor.isFinite() || unit.factor.lte(previousFactor)
      || !threshold.isFinite() || threshold.lte(previousThreshold)) {
      throw new RangeError('Compact units need unique nonempty labels, increasing finite factors > 1 and positive increasing thresholds');
    }
    labels.add(unit.label);
    previousFactor = unit.factor;
    previousThreshold = threshold;
  }
  const units = [{ factor: tickerDecimal(1), label: '', threshold: undefined }, ...supplied];
  const indexFor = (label: string | undefined, fallback: number) => {
    if (label === undefined) return fallback;
    const index = units.findIndex(unit => unit.label === label);
    if (index < 0) throw new RangeError(`Unknown compact unit: ${label}`);
    return index;
  };
  const minIndex = indexFor(compactOptions.minUnit, 0);
  const maxIndex = indexFor(compactOptions.maxUnit, units.length - 1);
  if (minIndex > maxIndex) throw new RangeError('minUnit must not exceed maxUnit');
  const thresholdFor = (index: number) => units[index].threshold ?? units[index].factor.times(multiplier);
  const last = units[maxIndex];
  const overflowThreshold = maxIndex + 1 < units.length ? thresholdFor(maxIndex + 1)
    : thresholdFor(maxIndex).times(maxIndex > 0 ? last.factor.div(units[maxIndex - 1].factor) : 1000);
  const overflow = compactOptions.overflow ?? (compactOptions.maxUnit !== undefined ? 'unit' : 'scientific');
  const scientific = createNumberFormatter(locale, { ...precision, notation: 'scientific' });
  const rounding = createNumberFormatter('en-US', {
    ...precision, style: 'decimal', numberingSystem: 'latn', useGrouping: false,
  });
  const percentScale = options?.style === 'percent' ? 100 : 1;
  const formatDecimal = (exact: ReturnType<typeof tickerDecimal>): Intl.NumberFormatPart[] => {
    if (!exact.isFinite()) return formatExactParts(formatter, exact);
    let index = minIndex;
    const reaches = (threshold: ReturnType<typeof tickerDecimal>) => {
      if (compactOptions.promoteAfterRounding === false) return exact.abs().times(percentScale).gte(threshold);
      const scaled = exact.div(units[index].factor).times(percentScale);
      const rounded = formatExactParts(rounding, scaled).map(part => part.value).join('');
      return new ExactDecimal(rounded).abs().times(units[index].factor).gte(threshold);
    };
    while (index < maxIndex) {
      if (!reaches(thresholdFor(index + 1))) break;
      index++;
    }
    if (index === maxIndex && overflow === 'scientific' && reaches(overflowThreshold)) return formatExactParts(scientific, exact);
    const { factor, label } = units[index];
    const parts = formatExactParts(formatter, exact.div(factor));
    if (label) {
      let insertion = parts.length;
      while (insertion > 0 && !['integer', 'fraction'].includes(parts[insertion - 1].type)) insertion--;
      const separator = compactOptions.separator ?? ' ';
      parts.splice(insertion, 0, ...(separator ? [{ type: 'literal' as const, value: separator }] : []), { type: 'compact', value: label });
    }
    return parts;
  };
  const formatToParts = (value: NumberTickerValue) => formatDecimal(tickerDecimal(value));
  return { formatToParts, formatDecimal, format: value => formatToParts(value).map(part => part.value).join('') };
}

export function formatTickerValue(formatter: TickerFormatter | Intl.NumberFormat, value: NumberTickerValue): string {
  return formatter instanceof Intl.NumberFormat ? formatExactParts(formatter, value).map(part => part.value).join('') : formatter.format(value);
}

export function formatTickerDelta(formatter: TickerFormatter | Intl.NumberFormat, delta: NumberTickerValue): string {
  const exact = tickerDecimal(delta);
  return formatDecimalDelta(formatter, exact);
}

// Deltas are derived from validated inputs and can legitimately exceed input bounds.
export function formatDerivedTickerDelta(formatter: TickerFormatter, delta: NumberTickerValue): string {
  return formatDecimalDelta(formatter, new ExactDecimal(String(delta)));
}

function formatDecimalDelta(formatter: TickerFormatter | Intl.NumberFormat, exact: ReturnType<typeof tickerDecimal>): string {
  const sign = exact.gt(0) ? '+' : exact.lt(0) ? '\u2212' : '';
  const magnitude = (formatter instanceof Intl.NumberFormat ? formatExactParts(formatter, exact) : formatter.formatDecimal(exact))
    .filter(part => part.type !== 'plusSign' && part.type !== 'minusSign')
    .filter(part => part.type !== 'literal' || !/^[()]$/.test(part.value))
    .map(part => part.value)
    .join('');
  return `${sign}${magnitude}`;
}

export function interpolateTickerValue(from: number, to: number, progress: number): number;
export function interpolateTickerValue(from: bigint, to: bigint, progress: number): bigint;
export function interpolateTickerValue(from: NumberTickerValue, to: NumberTickerValue, progress: number): NumberTickerValue;
export function interpolateTickerValue(from: NumberTickerValue, to: NumberTickerValue, progress: number): NumberTickerValue {
  if (!tickerDecimal(from).isFinite() || !tickerDecimal(to).isFinite()) return to;
  const boundedProgress = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 1;
  if (boundedProgress === 0) return from;
  if (boundedProgress === 1) return to;
  if (typeof from === 'number' && typeof to === 'number') {
    const distance = to - from;
    return Number.isFinite(distance) ? from + distance * boundedProgress
      : from * (1 - boundedProgress) + to * boundedProgress;
  }
  const start = tickerDecimal(from);
  const next = start.plus(tickerDecimal(to).minus(start).times(String(boundedProgress)));
  return typeof from === 'bigint' && typeof to === 'bigint' ? BigInt(next.trunc().toFixed(0)) : next.toString();
}

export function tickerValueChanged(previous: NumberTickerValue, next: NumberTickerValue): boolean {
  if (Object.is(previous, next)) return false;
  const before = tickerDecimal(previous);
  const after = tickerDecimal(next);
  return !before.eq(after) || (before.isZero() && before.isNegative() !== after.isNegative());
}

export function canAnimateTickerValue(from: NumberTickerValue, to: NumberTickerValue, duration: number): boolean {
  const start = tickerDecimal(from);
  const end = tickerDecimal(to);
  return start.isFinite() && end.isFinite()
    && typeof from === typeof to
    && (typeof to === 'number' || (Math.max(start.sd(), end.sd(), Math.abs(start.e - end.e)) <= 512))
    && Number.isFinite(duration)
    && duration > 0
    && tickerValueChanged(from, to);
}

export function easeOutCubic(progress: number): number {
  const boundedProgress = Math.min(1, Math.max(0, progress));
  return 1 - (1 - boundedProgress) ** 3;
}
