import { BoundedCache, PENCIL_RENDERER_VERSION } from './cache.js';
import type { PencilPoint } from './stroke.js';

const geometryCache = new BoundedCache<readonly PencilPoint[][]>(256, 180000);

export function cachedPathParts(data: string): readonly PencilPoint[][] {
  // Limit both parsing input and samples before allocating. Cache eviction only
  // bounds retained geometry, not the work needed to construct a huge path.
  if (data.length > 65536) throw new RangeError('Pencil icon path exceeds the bounded input');
  const key = `${PENCIL_RENDERER_VERSION}:${data}`;
  const cached = geometryCache.get(key);
  if (cached) return cached;
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', data);
  const length = path.getTotalLength();
  const count = Math.max(1, Math.ceil(length / 0.25));
  if (!Number.isFinite(length) || length < 0 || count > 16384) {
    throw new RangeError('Pencil icon path exceeds the bounded sampling budget');
  }
  const parts: PencilPoint[][] = [[]];
  for (let index = 0; index <= count; index += 1) {
    const point = path.getPointAtLength(length * index / count);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new RangeError('Pencil icon path contains invalid coordinates');
    }
    const activePart = parts[parts.length - 1];
    const previous = activePart[activePart.length - 1];
    if (previous && Math.hypot(point.x - previous[0], point.y - previous[1]) > 0.5) parts.push([]);
    parts[parts.length - 1].push([point.x, point.y]);
  }
  return geometryCache.set(key, parts, parts.reduce((total, part) => total + part.length, 0));
}
