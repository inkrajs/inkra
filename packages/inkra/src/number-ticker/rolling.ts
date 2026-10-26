export interface RollingToken {
  key: string;
  text: string;
  digit: boolean;
}

export function sameRollingTokens(from: readonly RollingToken[], to: readonly RollingToken[]): boolean {
  return from.length === to.length && from.every((token, index) => {
    const next = to[index];
    return token.key === next.key && token.text === next.text && token.digit === next.digit;
  });
}

export interface RollingColumn {
  key: string;
  from: string;
  to: string;
  digit: boolean;
}

export interface RollingFace {
  text: string;
  fromOffset: number;
  toOffset: number;
  fromOpacity: number;
  toOpacity: number;
}

export interface RollingMotionColumn {
  key: string;
  digit: boolean;
  target: string;
  fromWidth: number;
  toWidth: number;
  faces: RollingFace[];
}

export interface RollingFrame {
  columns: RollingMotionColumn[];
  progress: number;
}

export const rollMix = (from: number, to: number, progress: number) => from + (to - from) * progress;

export function createRollingMotion(from: RollingToken[], to: RollingToken[], direction: 'up' | 'down', previous?: RollingFrame): RollingMotionColumn[] {
  const sign = direction === 'up' ? -1 : 1;
  const snapshot = previous?.columns.map(column => ({
    key: column.key, digit: column.digit,
    width: rollMix(column.fromWidth, column.toWidth, previous.progress),
    faces: column.faces.map(face => ({
      text: face.text,
      offset: rollMix(face.fromOffset, face.toOffset, previous.progress),
      opacity: rollMix(face.fromOpacity, face.toOpacity, previous.progress),
    })).filter(face => Math.abs(face.offset) < 1 && face.opacity > 0.01),
  })) ?? from.map(token => ({ key: token.key, digit: token.digit, width: 1, faces: [{ text: token.text, offset: 0, opacity: 1 }] }));
  const sources = new Map(snapshot.map(column => [column.key, column]));
  const sourceTokens = snapshot.filter(column => column.width > 0 || column.faces.length > 0)
    .map(column => ({ key: column.key, digit: column.digit, text: column.faces[0]?.text ?? '' }));
  return rollingColumns(sourceTokens, to).map(column => {
    const source = sources.get(column.key);
    const faces = [...(source?.faces ?? [])];
    if (column.to !== '' && !faces.some(face => face.text === column.to)) {
      faces.push({ text: column.to, offset: column.digit ? -sign : 0, opacity: column.digit ? 1 : 0 });
    }
    return {
      key: column.key, digit: column.digit, target: column.to,
      fromWidth: source?.width ?? 0, toWidth: column.to === '' ? 0 : 1,
      // Existing faces continue from their actual offset on a rapid retarget.
      faces: faces.map(face => ({ text: face.text, fromOffset: face.offset,
        toOffset: face.text === column.to ? 0 : column.digit ? sign : 0,
        fromOpacity: face.opacity, toOpacity: face.text === column.to || column.digit ? 1 : 0,
      })),
    };
  });
}

// Align integer places from the right and fractional places from the decimal.
// Intl parts keep signs, grouping, currency and compact units out of digit reels.
export function rollingTokens(parts: Intl.NumberFormatPart[]): RollingToken[] {
  const remaining = new Map<string, number>();
  for (const part of parts) {
    if (part.type === 'integer' || part.type === 'exponentInteger') {
      remaining.set(part.type, (remaining.get(part.type) ?? 0) + Array.from(part.value).length);
    }
  }
  const occurrences = new Map<string, number>();
  return parts.flatMap<RollingToken>((part, index) => {
    if (part.type === 'integer' || part.type === 'exponentInteger') {
      return Array.from(part.value, text => {
        const position = (remaining.get(part.type) ?? 1) - 1;
        remaining.set(part.type, position);
        return { key: `${part.type}-${position}`, text, digit: true };
      });
    }
    if (part.type === 'fraction') {
      return Array.from(part.value, (text, position) => ({ key: `fraction-${position}`, text, digit: true }));
    }
    const identity = part.type === 'literal'
      ? `literal-${part.value}-${parts.slice(index + 1).find(next => next.type !== 'literal')?.type ?? 'end'}`
      : part.type;
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    const key = part.type === 'group' ? `group-${remaining.get('integer')}` : `${identity}-${occurrence}`;
    return [{ key, text: part.value, digit: false }];
  });
}

export function rollingColumns(from: RollingToken[], to: RollingToken[]): RollingColumn[] {
  const old = new Map(from.map(token => [token.key, token]));
  const next = new Map(to.map(token => [token.key, token]));
  const result: RollingColumn[] = to.map(token => ({
    key: token.key, from: old.get(token.key)?.text ?? '', to: token.text, digit: token.digit,
  }));
  // Departing places retain their old order until their width reaches zero.
  for (let index = from.length - 1; index >= 0; index -= 1) {
    const token = from[index];
    if (next.has(token.key)) continue;
    const following = from[index + 1];
    const insertion = following ? result.findIndex(column => column.key === following.key) : -1;
    result.splice(insertion < 0 ? result.length : insertion, 0, {
      key: token.key, from: token.text, to: '', digit: token.digit,
    });
  }
  return result;
}
