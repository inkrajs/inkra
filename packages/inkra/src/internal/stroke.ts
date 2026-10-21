export type PencilPoint = readonly [x: number, y: number];

export interface StrokeSettings {
  variation?: number;
  breaks?: number;
  grain?: number;
  taperLength?: number;
  scale?: number;
  distanceOffset?: number;
  totalDistance?: number;
  step?: number;
  detail?: 'fill';
  viewport?: readonly [width: number, height: number];
  viewportTop?: number;
  filaments?: number;
  gain?: number;
  edgeGrain?: boolean;
}

function hash(index: number, seed: number): number {
  let value = Math.imul(index ^ seed, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function noise(at: number, seed: number): number {
  const cell = Math.floor(at);
  const progress = at - cell;
  const blend = progress * progress * (3 - 2 * progress);
  return hash(cell, seed) * (1 - blend) + hash(cell + 1, seed) * blend;
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

export function strokeProfile(at: number, total: number, seed: number, settings: StrokeSettings = {}) {
  const variation = settings.variation ?? 1;
  const breaks = settings.breaks ?? 0.8;
  const grainValue = settings.grain ?? 0.7;
  const force = clamp(0.12 + noise(at / 19, seed + 17) * 0.97
    + (noise(at / 5.3, seed + 39) - 0.5) * 0.3);
  const pressure = clamp(0.72 * (1 - variation) + force * variation);
  let contact = 1;
  const cell = Math.floor(at / 37);

  for (let index = cell - 1; index <= cell + 1; index += 1) {
    if (hash(index, seed + 277) > breaks * 0.9) continue;
    const middle = index * 37 + 5 + hash(index, seed + 283) * 27;
    const halfGap = (1.1 + hash(index, seed + 293) * 3.6) * breaks;
    contact = Math.min(contact, clamp((Math.abs(at - middle) - halfGap) / 2.1));
  }

  const tooth = noise(at * 1.6, seed + 401);
  const deposit = clamp((tooth - grainValue * 0.22) / Math.max(0.2, 1 - grainValue * 0.22));
  const taper = 0.2 + 0.8 * clamp(Math.min(at, total - at) / (settings.taperLength ?? 3));
  return { pressure, contact, deposit, taper };
}

export function pencilStroke(
  context: CanvasRenderingContext2D,
  points: readonly PencilPoint[],
  color: string,
  width: number,
  seed: number,
  amplitude: number,
  passes = 2,
  closed = false,
  settings: StrokeSettings = {},
): void {
  if (points.length < 2) return;
  const scale = Math.max(0.4, settings.scale ?? 1);
  const line = points.map(point => [...point] as [number, number]);
  const lastPoint = line[line.length - 1];
  if (closed && Math.hypot(line[0][0] - lastPoint[0], line[0][1] - lastPoint[1]) > 0.01) {
    line.push(line[0]);
  }

  const segments: Array<{ a: PencilPoint; b: PencilPoint; start: number; length: number }> = [];
  let total = 0;
  for (let index = 1; index < line.length; index += 1) {
    const a = line[index - 1];
    const b = line[index];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]) / scale;
    if (length < 0.0001) continue;
    segments.push({ a, b, start: total, length });
    total += length;
  }
  if (!total) return;

  const distanceOffset = settings.distanceOffset ?? 0;
  const totalDistance = settings.totalDistance ?? distanceOffset + total;
  const step = settings.step ?? (settings.detail === 'fill' ? 2.1 : 1.05);
  const samples = [];
  let segmentIndex = 0;

  for (let at = 0; ; at = Math.min(total, at + step)) {
    while (segmentIndex < segments.length - 1
      && at > segments[segmentIndex].start + segments[segmentIndex].length) segmentIndex += 1;
    const segment = segments[segmentIndex];
    const progress = clamp((at - segment.start) / segment.length);
    const normalX = -(segment.b[1] - segment.a[1]) / (segment.length * scale);
    const normalY = (segment.b[0] - segment.a[0]) / (segment.length * scale);
    const globalAt = distanceOffset + at;
    const offset = (noise(globalAt / 8, seed + 503) - 0.5) * amplitude * Math.sqrt(scale);
    samples.push({
      at: globalAt,
      x: segment.a[0] + (segment.b[0] - segment.a[0]) * progress + normalX * offset,
      y: segment.a[1] + (segment.b[1] - segment.a[1]) * progress + normalY * offset,
      normalX,
      normalY,
      ...strokeProfile(globalAt, totalDistance, seed, settings),
    });
    if (at === total) break;
  }

  const inheritedAlpha = context.globalAlpha;
  const material = 0.65 + hash(0, seed + 619) * 0.65;
  const viewport = settings.viewport;
  const filaments = Math.max(0, settings.filaments ?? 3);
  context.save();
  context.strokeStyle = color;
  context.lineCap = 'round';

  for (let pass = 0; pass < passes; pass += 1) {
    for (let index = 1; index < samples.length; index += 1) {
      const a = samples[index - 1];
      const b = samples[index];
      if (viewport && ((a.x < -8 && b.x < -8) || (a.x > viewport[0] + 8 && b.x > viewport[0] + 8)
        || (a.y < (settings.viewportTop ?? 36) && b.y < (settings.viewportTop ?? 36))
        || (a.y > viewport[1] + 8 && b.y > viewport[1] + 8))) continue;
      const contact = Math.min(a.contact, b.contact);
      if (!contact || (pass > 0 && noise(a.at / 11, seed + pass * 127) < 0.48)) continue;
      const pressure = (a.pressure + b.pressure) / 2;
      const deposit = 0.12 + 0.88 * (a.deposit + b.deposit) / 2;
      const opacity = Math.pow(pressure, 1.4) * contact * deposit * material * a.taper;
      if (opacity < 0.012) continue;
      const nib = width * (0.3 + pressure * 1.65) * Math.pow(scale, 0.32);
      const drift = pass ? (noise(a.at / 6, seed + pass * 107) - 0.5) * width * 1.1 : 0;
      context.globalAlpha = Math.min(1, inheritedAlpha * opacity * (pass ? 0.56 : 1.2)
        * (settings.gain ?? 1));
      context.lineWidth = Math.max(0.18, nib * (pass ? 0.4 : 1));
      const baseAlpha = context.globalAlpha;
      const grainValue = settings.grain ?? 0.7;
      context.globalAlpha = baseAlpha * (1 - grainValue * 0.78);
      context.beginPath();
      context.moveTo(a.x + a.normalX * drift, a.y + a.normalY * drift);
      context.lineTo(b.x + b.normalX * drift, b.y + b.normalY * drift);
      context.stroke();

      if (grainValue > 0.05) {
        for (let filament = 0; filament < filaments; filament += 1) {
          const tooth = noise(a.at * 2.7, seed + filament * 191 + pass * 317);
          if (tooth < 0.28) continue;
          const offset = drift + (filament - (filaments - 1) / 2) * nib * 0.3;
          context.globalAlpha = baseAlpha * grainValue * tooth;
          context.lineWidth = Math.max(0.15, nib * (0.12 + tooth * 0.17));
          context.beginPath();
          context.moveTo(a.x + a.normalX * offset, a.y + a.normalY * offset);
          context.lineTo(b.x + b.normalX * offset, b.y + b.normalY * offset);
          context.stroke();
        }
      }

      if (pass === 0 && settings.detail !== 'fill' && settings.edgeGrain !== false
        && a.deposit > 0.52 && grainValue > 0.05) {
        const toothOffset = (noise(a.at * 2, seed + 727) - 0.5) * nib * 1.9;
        context.lineWidth = 0.18 + pressure * 0.24;
        context.globalAlpha = baseAlpha * 0.55;
        context.beginPath();
        context.moveTo(a.x + a.normalX * toothOffset, a.y + a.normalY * toothOffset);
        context.lineTo(b.x + b.normalX * toothOffset, b.y + b.normalY * toothOffset);
        context.stroke();
      }
    }
  }

  context.restore();
}
