export interface TypewriterDelayOptions {
  speed: number;
  punctuationDelay: number;
}

interface SegmenterLike {
  segment(input: string): Iterable<{ segment: string }>;
}

interface SegmenterConstructor {
  new(locales: string | string[] | undefined, options: { granularity: 'grapheme' }): SegmenterLike;
}

const markPattern = /^\p{Mark}$/u;
const punctuationPattern = /^\p{Punctuation}+$/u;
const regionalIndicatorPattern = /^\p{Regional_Indicator}$/u;
const emojiModifierPattern = /^\p{Emoji_Modifier}$/u;
const tagPattern = /^[\u{E0020}-\u{E007F}]$/u;
const variationSelectorPattern = /^[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]$/u;
const zeroWidthJoiner = '\u200D';

function fallbackGraphemes(value: string): string[] {
  const clusters: string[] = [];
  let regionalIndicators = 0;

  for (const character of Array.from(value)) {
    const previous = clusters[clusters.length - 1];
    const joinsPrevious = previous !== undefined && (
      character === zeroWidthJoiner
      || previous.endsWith(zeroWidthJoiner)
      || markPattern.test(character)
      || emojiModifierPattern.test(character)
      || variationSelectorPattern.test(character)
      || tagPattern.test(character)
      || (regionalIndicatorPattern.test(character) && regionalIndicators % 2 === 1)
    );

    if (joinsPrevious) clusters[clusters.length - 1] += character;
    else clusters.push(character);

    if (regionalIndicatorPattern.test(character)) regionalIndicators += 1;
    else regionalIndicators = 0;
  }

  return clusters;
}

export function splitTypewriterGraphemes(value: string, locale?: string | string[]): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterConstructor }).Segmenter;
  if (!Segmenter) return fallbackGraphemes(value);
  return Array.from(new Segmenter(locale, { granularity: 'grapheme' }).segment(value), item => item.segment);
}

export function isTypewriterPunctuation(grapheme: string): boolean {
  return punctuationPattern.test(grapheme);
}

function duration(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function typewriterDelayAfter(
  grapheme: string,
  { speed, punctuationDelay }: TypewriterDelayOptions,
): number {
  return duration(speed) + (isTypewriterPunctuation(grapheme) ? duration(punctuationDelay) : 0);
}
