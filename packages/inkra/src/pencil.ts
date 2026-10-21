export type PencilPoint = readonly [x: number, y: number];

export interface PencilPathOptions {
  seed: string | number;
  width?: number;
  height?: number;
  points?: number;
  roughness?: number;
}

function hashSeed(seed: string | number): number {
  const value = String(seed);
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRandom(seed: string | number): () => number {
  let state = hashSeed(seed) || 0x6d2b79f5;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPencilPoints({
  seed,
  width = 100,
  height = 8,
  points = 7,
  roughness = 1,
}: PencilPathOptions): PencilPoint[] {
  const random = createRandom(seed);
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const pointCount = Math.max(2, Math.floor(points));
  const center = safeHeight / 2;
  const amplitude = Math.min(safeHeight * 0.32, Math.max(0, roughness));

  return Array.from({ length: pointCount }, (_, index) => {
    const progress = index / (pointCount - 1);
    const xJitter = index === 0 || index === pointCount - 1 ? 0 : (random() - 0.5) * 1.4;
    const yJitter = (random() - 0.5) * 2 * amplitude;
    return [progress * safeWidth + xJitter, center + yJitter] as const;
  });
}

export function createPencilPath(options: PencilPathOptions): string {
  const points = createPencilPoints(options);

  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');
}
