export interface TagInputIdentity {
  id: string;
  value: string;
}

export interface SplitTagInputResult {
  parts: string[];
  hasDelimiter: boolean;
}

export const defaultTagInputDelimiters = [',', ';', '\n'] as const;

export function normalizeTagInputValue(value: string): string {
  return value.trim();
}

export function defaultTagValueKey(value: string): string {
  return normalizeTagInputValue(value).toLocaleLowerCase();
}

export function splitTagInputValue(
  value: string,
  delimiters: readonly string[] = defaultTagInputDelimiters,
): SplitTagInputResult {
  const activeDelimiters = [...new Set(delimiters.filter(Boolean))]
    .sort((left, right) => right.length - left.length);
  if (activeDelimiters.length === 0) return { parts: [value], hasDelimiter: false };

  const parts: string[] = [];
  let start = 0;
  let index = 0;
  let hasDelimiter = false;
  while (index < value.length) {
    const delimiter = activeDelimiters.find(candidate => value.startsWith(candidate, index));
    if (!delimiter) {
      index += 1;
      continue;
    }
    parts.push(value.slice(start, index));
    index += delimiter.length;
    start = index;
    hasDelimiter = true;
  }
  parts.push(value.slice(start));
  return { parts, hasDelimiter };
}

export function hasTagValue(
  tags: readonly TagInputIdentity[],
  value: string,
  getTagValueKey: (value: string) => string = defaultTagValueKey,
): boolean {
  const candidateKey = getTagValueKey(value);
  return tags.some(tag => getTagValueKey(tag.value) === candidateKey);
}

export function createDefaultTag(value: string): TagInputIdentity {
  const normalized = normalizeTagInputValue(value);
  return { id: normalized, value: normalized };
}
