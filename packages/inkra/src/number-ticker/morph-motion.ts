import { rollMix } from './rolling.js';
import type { RollingToken } from './rolling.js';

export interface MorphGlyph {
  id: string;
  referenceKey: string;
  text: string;
  digit: boolean;
  width: number;
  target: boolean;
  fromX: number;
  toX: number;
  fromY: number;
  toY: number;
  fromOpacity: number;
  toOpacity: number;
}
export interface MorphMotion {
  glyphs: MorphGlyph[];
  tokens: RollingToken[];
  width: number;
  targetWidth: number;
  kind: 'shift' | 'roll';
}
export interface MorphFrame { motion: MorphMotion; progress: number }
export type MorphWidths = (token: RollingToken) => number;
let nextGlyph = 0;

export function measureMorphWidths(root: HTMLElement | null, tokens: RollingToken[]): MorphWidths {
  if (!root || typeof document === 'undefined') return token => token.digit ? 1 : Math.max(.25, Array.from(token.text).length);
  const style = getComputedStyle(root);
  const probe = document.createElement('span');
  Object.assign(probe.style, { position: 'fixed', visibility: 'hidden', pointerEvents: 'none',
    font: style.font, fontVariantNumeric: 'tabular-nums lining-nums', fontKerning: 'none',
    fontVariantLigatures: 'none', letterSpacing: '0', whiteSpace: 'pre', width: '1ch', display: 'inline-block' });
  document.body.append(probe);
  const ch = probe.getBoundingClientRect().width || 1;
  probe.style.width = 'auto';
  const widths = new Map<string, number>();
  // Measurement happens once when a target changes, never in the frame loop.
  const measure = (token: RollingToken) => {
    if (token.digit) return 1;
    if (!widths.has(token.text)) {
      probe.textContent = token.text;
      widths.set(token.text, Math.max(.05, probe.getBoundingClientRect().width / ch));
    }
    return widths.get(token.text)!;
  };
  // The returned callback cannot retain a live measuring node.
  tokens.forEach(measure);
  const result: MorphWidths = token => token.digit ? 1 : widths.get(token.text) ?? Math.max(.25, Array.from(token.text).length);
  probe.remove();
  return result;
}

function layout(tokens: RollingToken[], widths: MorphWidths) {
  const total = tokens.reduce((sum, token) => sum + widths(token), 0);
  let x = -total;
  return { width: total, items: tokens.map(token => {
    const width = widths(token);
    const item = { ...token, x, width };
    x += width;
    return item;
  }) };
}

export function sampleMorphGlyph(glyph: MorphGlyph, progress: number) {
  const fade = progress * progress * (3 - 2 * progress);
  return { ...glyph, x: rollMix(glyph.fromX, glyph.toX, progress), y: rollMix(glyph.fromY, glyph.toY, progress),
    opacity: rollMix(glyph.fromOpacity, glyph.toOpacity, fade) };
}

export function createMorphMotion(from: RollingToken[], to: RollingToken[], mapping: Array<[number, number]> | null,
  direction: 'up' | 'down', widths: MorphWidths, previous?: MorphFrame): MorphMotion {
  const before = layout(from, widths), after = layout(to, widths);
  const source = previous ? previous.motion.glyphs.map(glyph => sampleMorphGlyph(glyph, previous.progress))
    .filter(glyph => glyph.opacity > .001 && Math.abs(glyph.y) < 1.001)
    : before.items.map(token => ({ id: `settled-${token.key}`, referenceKey: token.key, text: token.text,
      digit: token.digit, width: token.width, target: true, x: token.x, y: 0, opacity: 1 }));
  const used = new Set<string>();
  const glyphs: MorphGlyph[] = [];
  const sign = direction === 'up' ? -1 : 1;
  const pairs = mapping ?? from.flatMap((token, index) => {
    const next = to.findIndex(item => item.key === token.key);
    return next < 0 ? [] : [[index, next] as [number, number]];
  });
  const oldIndexes = new Map(pairs.map(([left, right]) => [right, left]));
  const findSource = (index: number) => source.filter(item => item.referenceKey === from[index]?.key)
    .sort((left, right) => right.opacity - left.opacity);
  const decimalEnd = (items: typeof before.items) => {
    const integers = items.filter(item => item.key.startsWith('integer-'));
    const integer = integers[integers.length - 1];
    return integer ? integer.x + integer.width : 0;
  };
  for (let index = 0; index < to.length; index++) {
    const token = to[index], target = after.items[index];
    const oldIndex = oldIndexes.get(index);
    const candidates = oldIndex === undefined ? [] : findSource(oldIndex);
    const existing = candidates.find(item => item.text === token.text && !used.has(item.id));
    if (existing) {
      used.add(existing.id);
      glyphs.push({ id: existing.id, referenceKey: token.key, text: token.text, digit: token.digit,
        width: existing.width, target: true, fromX: existing.x, toX: target.x,
        fromY: existing.y, toY: 0, fromOpacity: existing.opacity, toOpacity: 1 });
      continue;
    }
    let x = candidates[0]?.x ?? before.items[oldIndex ?? -1]?.x ?? target.x;
    let y = token.digit && !mapping ? -sign : 0;
    if (mapping) {
      if (token.key.startsWith('decimal-')) x = decimalEnd(before.items);
      else if (token.digit) {
        const anchor = pairs.filter(([left, right]) => right < index && from[left].digit)
          .sort((left, right) => right[1] - left[1])[0];
        if (anchor) {
          const visible = findSource(anchor[0])[0];
          x = (visible?.x ?? before.items[anchor[0]].x) + target.x - after.items[anchor[1]].x;
        }
      }
    }
    glyphs.push({ id: `morph-${nextGlyph++}`, referenceKey: token.key, text: token.text,
      digit: token.digit, width: target.width, target: true, fromX: x, toX: target.x,
      fromY: y, toY: 0, fromOpacity: mapping || !token.digit ? 0 : 1, toOpacity: 1 });
  }
  for (const item of source) {
    if (used.has(item.id)) continue;
    let x = item.x;
    let y = item.digit && !mapping ? sign : 0;
    if (mapping) {
      if (item.referenceKey.startsWith('decimal-')) x = decimalEnd(after.items);
      else {
        const oldIndex = from.findIndex(token => token.key === item.referenceKey);
        const anchor = pairs.filter(([left]) => left < oldIndex && from[left].digit)
          .sort((left, right) => right[0] - left[0])[0];
        if (anchor) {
          const visible = findSource(anchor[0])[0];
          x += after.items[anchor[1]].x - (visible?.x ?? before.items[anchor[0]].x);
        }
      }
    }
    glyphs.push({ id: item.id, referenceKey: item.referenceKey, text: item.text, digit: item.digit,
      width: item.width, target: false, fromX: item.x, toX: x, fromY: item.y, toY: y,
      fromOpacity: item.opacity, toOpacity: mapping || !item.digit ? 0 : 1 });
  }
  return { glyphs, tokens: to, width: Math.max(before.width, after.width, previous && previous.progress < 1 ? previous.motion.width : 0),
    targetWidth: after.width, kind: mapping ? 'shift' : 'roll' };
}
