import { BoundedCache, PENCIL_RENDERER_VERSION, canvasByteCost, canvasIsUsable } from './cache.js';
import { pencilStroke } from './stroke.js';

export interface PencilWashOptions {
  strength?: number;
  spacing?: number;
  roughness?: number;
  inset?: number;
  radius?: number;
  edgeReach?: number;
  dpr?: number;
  angle?: number;
}

interface ResolvedWashSettings {
  strength: number;
  spacing: number;
  roughness: number;
  inset: number;
  radius: number;
  edgeReach: number;
  angle: number;
}

const washCache = new BoundedCache<HTMLCanvasElement>(64, 32 * 1024 * 1024);

function randomAt(index: number, seed: number): number {
  let value = Math.imul(index ^ seed, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function makeWash(
  width: number,
  height: number,
  color: string,
  seed: number,
  dpr: number,
  settings: ResolvedWashSettings,
): HTMLCanvasElement {
  const { strength, spacing, roughness, inset, radius, edgeReach, angle } = settings;
  const bleed = edgeReach ? Math.ceil(edgeReach + 4) : 0;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((width + bleed * 2) * dpr);
  canvas.height = Math.ceil((height + bleed * 2) * dpr);
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.scale(dpr, dpr);
  context.translate(bleed, bleed);
  const margin = inset + spacing + roughness * 0.4;
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const halfWidth = Math.max(0, width / 2 - inset);
  const halfHeight = Math.max(0, height / 2 - inset);
  const projectedHeight = Math.abs(sin) * halfWidth * 2 + Math.abs(cos) * halfHeight * 2;
  const rows = Math.max(1, Math.floor(((angle ? projectedHeight : height) - margin * 2) / spacing));

  context.save();
  if (angle) {
    context.beginPath();
    context.roundRect(inset, inset, halfWidth * 2, halfHeight * 2, Math.min(radius, halfWidth, halfHeight));
    context.clip();
    context.translate(width / 2, height / 2);
    context.rotate(radians);
  }

  for (let row = 0; row <= rows; row += 1) {
    const noise = (offset: number) => randomAt(row, seed + offset);
    const y = margin + row * spacing - (angle ? projectedHeight / 2 : 0);
    const edgeDistance = Math.max(0, Math.min(y - inset, height - inset - y));
    const corner = edgeDistance < radius
      ? radius - Math.sqrt(radius * radius - (radius - edgeDistance) ** 2) : 0;
    const leftReach = edgeReach * (0.15 + noise(359) * 0.85);
    const rightReach = edgeReach * (0.15 + noise(383) * 0.85);
    let left = inset + corner + noise(31) * roughness * 1.8 - leftReach;
    let right = width - inset - corner - noise(67) * roughness * 1.8 + rightReach;
    if (angle) {
      // Intersect each rotated stroke with the original box, so wide controls
      // keep short diagonal marks rather than rotating their entire surface.
      left = -Infinity;
      right = Infinity;
      for (const [direction, offset, halfExtent] of [[cos, -sin * y, halfWidth], [sin, cos * y, halfHeight]]) {
        if (Math.abs(direction) < 1e-8) continue;
        const a = (-halfExtent - offset) / direction;
        const b = (halfExtent - offset) / direction;
        left = Math.max(left, Math.min(a, b));
        right = Math.min(right, Math.max(a, b));
      }
      left += noise(31) * roughness * 1.8;
      right -= noise(67) * roughness * 1.8;
    }
    if (right <= left) continue;
    const tilt = Math.min(4, width * 0.02) * (0.35 + noise(101) * 0.65);
    const wave = Math.sin(row * 0.63 + seed % 19) * roughness * 0.24;
    const edgeLift = edgeReach
      ? (margin + edgeReach) * Math.max(0, 1 - edgeDistance / (radius + spacing * 3))
        * (y < height / 2 ? -1 : 1)
      : 0;
    const points = [
      [left, y + wave + edgeLift * noise(397)],
      [left + (right - left) * 0.32, y - tilt * 0.3 + noise(149) - 0.5 + edgeLift * noise(401)],
      [left + (right - left) * 0.7, y - tilt * 0.7 + noise(181) - 0.5 + edgeLift * noise(409)],
      [right, y - tilt + wave + edgeLift * noise(419)],
    ] as const;
    const feather = Math.min(1, (row + 1) / 3, (rows - row + 1) / 3);
    context.globalAlpha = Math.min(1, strength * feather * (0.48 + noise(211) * 0.35));
    pencilStroke(context, points, color, spacing * 1.55, seed + row * 337, 0.9, 1, false, {
      variation: 0.94,
      breaks: 0.28,
      grain: 0.76,
      gain: 2.1,
      step: 2.2,
      detail: 'fill',
      taperLength: 5 + noise(257) * 8,
    });
    if (row % 4 === 1) {
      context.globalAlpha = Math.min(1, strength * 0.28 * feather);
      pencilStroke(context, points, color, 0.5, seed + row * 613, 0.65, 1, false, {
        variation: 0.85,
        breaks: 0.4,
        grain: 0.8,
        gain: 1.5,
        step: 2.4,
        detail: 'fill',
        taperLength: 9,
      });
    }
  }

  context.restore();

  context.globalCompositeOperation = 'destination-out';
  const grains = Math.ceil((width + bleed * 2) * (height + bleed * 2) / 12);
  for (let index = 0; index < grains; index += 1) {
    const x = randomAt(index, seed + 811) * (width + bleed * 2) - bleed;
    const y = randomAt(index, seed + 977) * (height + bleed * 2) - bleed;
    const size = 0.35 + randomAt(index, seed + 1193) * 0.65;
    context.globalAlpha = 0.2 + randomAt(index, seed + 1301) * 0.5;
    context.fillRect(x, y, size, size * 0.6);
  }

  return canvas;
}

export function drawPencilWash(
  context: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  color: string,
  seed: number,
  options: PencilWashOptions = {},
): void {
  const width = Math.ceil(box.width);
  const height = Math.ceil(box.height);
  if (width < 1 || height < 1) return;
  const dpr = Math.max(1, Math.min(options.dpr ?? 1, 2));
  const settings: ResolvedWashSettings = {
    strength: Math.max(0, options.strength ?? 1),
    spacing: Math.max(1, options.spacing ?? 2),
    roughness: Math.max(0, options.roughness ?? 3),
    inset: Math.max(2, options.inset ?? 3),
    radius: Math.max(0, Math.min(options.radius ?? 0, width / 2, height / 2)),
    edgeReach: Math.max(0, Math.min(options.edgeReach ?? 0, width / 4, height / 4)),
    angle: Number.isFinite(options.angle) ? Math.max(-85, Math.min(85, options.angle!)) : 0,
  };
  const key = JSON.stringify([
    PENCIL_RENDERER_VERSION,
    width,
    height,
    color,
    seed,
    dpr,
    settings,
  ]);
  let texture = washCache.get(key);
  if (texture && !canvasIsUsable(texture)) {
    washCache.delete(key);
    texture = undefined;
  }
  if (!texture) {
    texture = makeWash(width, height, color, seed, dpr, settings);
    washCache.set(key, texture, canvasByteCost(texture));
  }
  const bleed = settings.edgeReach ? Math.ceil(settings.edgeReach + 4) : 0;
  const scaleX = box.width / width;
  const scaleY = box.height / height;
  context.drawImage(
    texture,
    box.x - bleed * scaleX,
    box.y - bleed * scaleY,
    box.width + bleed * 2 * scaleX,
    box.height + bleed * 2 * scaleY,
  );
}
