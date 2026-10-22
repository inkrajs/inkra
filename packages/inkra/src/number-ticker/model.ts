export type NumberTickerLocale = string | readonly string[];

export function createNumberFormatter(
  locale: NumberTickerLocale = 'en-US',
  options?: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, options);
}

export function formatTickerValue(formatter: Intl.NumberFormat, value: number): string {
  return formatter.format(value);
}

export function formatTickerDelta(formatter: Intl.NumberFormat, delta: number): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '\u2212' : '';
  const magnitude = formatter.formatToParts(Math.abs(delta))
    .filter(part => part.type !== 'plusSign' && part.type !== 'minusSign')
    .map(part => part.value)
    .join('');
  return `${sign}${magnitude}`;
}

export function interpolateTickerValue(from: number, to: number, progress: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return to;
  const boundedProgress = Math.min(1, Math.max(0, progress));
  return from + (to - from) * boundedProgress;
}

export function tickerValueChanged(previous: number, next: number): boolean {
  return !Object.is(previous, next);
}

export function canAnimateTickerValue(from: number, to: number, duration: number): boolean {
  return Number.isFinite(from)
    && Number.isFinite(to)
    && Number.isFinite(duration)
    && duration > 0
    && tickerValueChanged(from, to);
}

export function easeOutCubic(progress: number): number {
  const boundedProgress = Math.min(1, Math.max(0, progress));
  return 1 - (1 - boundedProgress) ** 3;
}
