export const PENCIL_RENDERER_VERSION = 'inkra-pencil-v5';

interface CacheEntry<Value> {
  value: Value;
  cost: number;
}

export class BoundedCache<Value> {
  private readonly entries = new Map<string, CacheEntry<Value>>();
  private totalCost = 0;

  constructor(
    private readonly maxEntries: number,
    private readonly maxCost: number,
  ) {}

  get(key: string): Value | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: Value, cost: number): Value {
    const previous = this.entries.get(key);
    if (previous) {
      this.totalCost -= previous.cost;
      this.entries.delete(key);
    }

    this.entries.set(key, { value, cost });
    this.totalCost += cost;

    while (this.entries.size > this.maxEntries || this.totalCost > this.maxCost) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      const oldest = this.entries.get(oldestKey);
      this.entries.delete(oldestKey);
      this.totalCost -= oldest?.cost ?? 0;
    }

    return value;
  }

  delete(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.totalCost -= entry.cost;
  }
}

export function canvasByteCost(canvas: HTMLCanvasElement): number {
  return canvas.width * canvas.height * 4;
}

export function canvasIsUsable(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('2d');
  return Boolean(context && !context.isContextLost?.());
}

export function effectiveDpr(limit = 2): number {
  if (typeof window === 'undefined') return 1;
  return Math.max(1, Math.min(window.devicePixelRatio || 1, limit));
}
