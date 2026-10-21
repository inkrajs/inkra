export function seedToNumber(seed: string | number): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  const value = String(seed);
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function seededRandom(seed: string | number): () => number {
  let state = seedToNumber(seed) || 1;

  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function grain(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string,
  seed: string | number,
  amount: number,
): void {
  const random = seededRandom(seed);
  context.save();
  context.fillStyle = color;

  for (let index = 0; index < width * height * 0.2; index += 1) {
    context.globalAlpha = (0.02 + random() * 0.13) * amount;
    context.fillRect(random() * width, random() * height, 0.5 + random() * 0.6, 0.4 + random() * 0.7);
  }

  context.restore();
}
