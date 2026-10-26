import type { PencilIconPath } from '../PencilIcon.js';
import { cachedPathParts } from './iconGeometry.js';
import { pencilStroke, type PencilPoint } from './stroke.js';

export function isClosedIconContour(points: readonly PencilPoint[]): boolean {
  if (points.length < 4) return false;
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) > 0.3) return false;
  let area = 0;
  for (let i = 1; i < points.length; i++) {
    area += points[i - 1][0] * points[i][1] - points[i][0] * points[i - 1][1];
  }
  return Math.abs(area) > 0.1;
}

function contourPath(points: readonly PencilPoint[]): Path2D {
  const path = new Path2D();
  if (!points.length) return path;
  path.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) path.lineTo(x, y);
  return path;
}

export function softenIconFillMask(
  pixels: Uint8ClampedArray, width: number, height: number, scale: number, seed: number, roughness: number,
): void {
  const distance = new Float32Array(width * height);
  const feather = Math.max(1.5, scale * 0.8);
  for (let i = 0; i < distance.length; i++) {
    const alpha = pixels[i * 4 + 3];
    distance[i] = alpha === 255 ? feather : alpha / 255;
  }
  // Distance into the silhouette, including holes, without spreading pigment outside it.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (x) distance[i] = Math.min(distance[i], distance[i - 1] + 1);
    if (y) distance[i] = Math.min(distance[i], distance[i - width] + 1);
    if (x && y) distance[i] = Math.min(distance[i], distance[i - width - 1] + Math.SQRT2);
    if (x + 1 < width && y) distance[i] = Math.min(distance[i], distance[i - width + 1] + Math.SQRT2);
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x;
    if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i + 1] + 1);
    if (y + 1 < height) distance[i] = Math.min(distance[i], distance[i + width] + 1);
    if (x && y + 1 < height) distance[i] = Math.min(distance[i], distance[i + width - 1] + Math.SQRT2);
    if (x + 1 < width && y + 1 < height) distance[i] = Math.min(distance[i], distance[i + width + 1] + Math.SQRT2);
  }
  const grain = Math.min(1, Math.max(0, roughness));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (!pixels[i * 4 + 3] || distance[i] >= feather) continue;
    const t = distance[i] / feather;
    const edge = 1 - t * t * (3 - 2 * t);
    let hash = Math.imul(Math.floor(x / scale * 3) + seed, 374761393)
      ^ Math.imul(Math.floor(y / scale * 3), 668265263);
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    const tooth = ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
    // Keep at least half the existing coverage so fine details remain legible.
    pixels[i * 4 + 3] *= 1 - edge * (0.35 + tooth * 0.15 * grain);
  }
}

export function paintFilledIcon(
  target: CanvasRenderingContext2D,
  paths: readonly PencilIconPath[],
  options: { color: string; fillColor: string; sourceSize: number; seed: number; weightScale: number; roughnessScale: number; breaks: number; breakCount: number; pressureVariation: number; coordinateScale: number },
): void {
  const { color, fillColor, seed, weightScale, roughnessScale } = options;
  const layer = () => {
    const canvas = document.createElement('canvas');
    canvas.width = target.canvas.width;
    canvas.height = target.canvas.height;
    const context = canvas.getContext('2d')!;
    context.setTransform(target.getTransform());
    return { canvas, context };
  };
  const body = layer();
  const outline = layer();
  const washOutline = paths.some(path => path.mode === 'wash') ? layer() : null;
  const texture = layer();
  const automatic: { path: Path2D; points: readonly PencilPoint[]; bounds: number[]; depth: number }[] = [];
  const details = new Path2D();
  const fills: { path: Path2D; color?: string; rule: CanvasFillRule; wash: boolean; narrowest: number }[] = [];
  const cutouts: { path: Path2D; rule: CanvasFillRule }[] = [];
  let samples = 0;
  paths.forEach((path, index) => {
    if (path.d.length > 65536) return;
    if (path.mode === 'fill' || path.mode === 'wash' || path.mode === 'cutout') {
      const shape = { path: new Path2D(path.d), rule: path.fillRule ?? 'nonzero' as CanvasFillRule };
      if (path.mode === 'cutout') {
        const closedParts = new Path2D();
        let closedCount = 0;
        const openParts = new Path2D();
        for (const part of cachedPathParts(path.d)) {
          samples += part.length;
          if (samples > 65536) throw new RangeError('Pencil icon exceeds the bounded sampling budget');
          if (isClosedIconContour(part)) { closedParts.addPath(contourPath(part)); closedCount++; }
          else openParts.addPath(contourPath(part));
        }
        // Native stroking preserves tiny disjoint dots that distance sampling can skip.
        details.addPath(closedCount ? openParts : shape.path);
        cutouts.push({ path: closedParts, rule: shape.rule });
      }
      else {
        let narrowest = Infinity;
        if (washOutline) {
          // A front region covers earlier edges, but retains its own complete stroke.
          washOutline.context.globalCompositeOperation = 'destination-out';
          washOutline.context.fill(shape.path, shape.rule);
          washOutline.context.globalCompositeOperation = 'source-over';
        }
        if (path.mode === 'wash') for (const points of cachedPathParts(path.d)) {
          samples += points.length;
          if (samples > 65536) throw new RangeError('Pencil icon exceeds the bounded sampling budget');
          let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
          for (const [x, y] of points) {
            left = Math.min(left, x); top = Math.min(top, y);
            right = Math.max(right, x); bottom = Math.max(bottom, y);
          }
          const breadth = Math.max(0, Math.min(right - left, bottom - top)) * options.coordinateScale;
          narrowest = Math.min(narrowest, breadth);
          // Subpixel color accents need lighter edges, not a full-size ink border.
          const edgeWeight = Math.min(1, breadth / 2);
          pencilStroke(washOutline!.context, points, color, 0.65 * weightScale * edgeWeight,
            seed + index * 137, 0.3 * roughnessScale, 2, false,
            { variation: options.pressureVariation, fitPressure: true, breaks: options.breaks,
              breakCount: options.breakCount, breakScale: options.coordinateScale, continuousBreaks: true,
              grain: 0.68, gain: 1.5, step: 0.35, taperLength: 0.65 });
        }
        fills.push({ ...shape, color: path.color, wash: path.mode === 'wash', narrowest });
      }
      return;
    }
    const parts = cachedPathParts(path.d);
    samples += parts.reduce((total, part) => total + part.length, 0);
    if (samples > 65536) throw new RangeError('Pencil icon exceeds the bounded sampling budget');
    for (const points of parts) {
      const closed = path.mode !== 'stroke' && isClosedIconContour(points);
      const shape = contourPath(points);
      if (closed) {
        shape.closePath();
        const bounds = [Infinity, Infinity, -Infinity, -Infinity];
        for (const [x, y] of points) {
          bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
          bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
        }
        automatic.push({ path: shape, points, bounds, depth: 0 });
      } else details.addPath(shape);
      pencilStroke(outline.context, points, color, (closed ? 1.65 : 2.4) * weightScale,
        seed + index * 137, 0.2 * roughnessScale, 3, false,
        { variation: options.pressureVariation, fitPressure: true, breaks: options.breaks,
          breakCount: options.breakCount, breakScale: options.coordinateScale, continuousBreaks: true,
          grain: 0.68, gain: 3, step: 0.35 });
      if (!closed) pencilStroke(outline.context, points, fillColor, 1.5 * weightScale,
        seed + index * 137, 0.15 * roughnessScale, 3, false,
        { variation: 0.25, fitPressure: true, breaks: 0, grain: 0.68, gain: 3, step: 0.35 });
    }
    if (parts.every(points => !isClosedIconContour(points))) details.addPath(new Path2D(path.d));
  });
  // Only containment creates a hole. Overlapping independent silhouettes are a union.
  const area = (bounds: number[]) => (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]);
  automatic.sort((a, b) => area(b.bounds) - area(a.bounds));
  let containmentChecks = 0;
  texture.context.save();
  texture.context.resetTransform();
  for (let index = 0; index < automatic.length; index++) {
    const shape = automatic[index];
    for (let parentIndex = index - 1; parentIndex >= 0; parentIndex--) {
      const parent = automatic[parentIndex];
      const a = shape.bounds, b = parent.bounds;
      if (area(a) >= area(b) || a[0] < b[0] || a[1] < b[1] || a[2] > b[2] || a[3] > b[3]) continue;
      const inside = shape.points.every(([x, y]) => {
        if (++containmentChecks > 131072) throw new RangeError('Pencil icon exceeds the bounded containment budget');
        return texture.context.isPointInPath(parent.path, x, y, 'evenodd');
      });
      if (inside) { shape.depth = parent.depth + 1; break; }
    }
    body.context.globalCompositeOperation = shape.depth % 2 ? 'destination-out' : 'source-over';
    body.context.fill(shape.path, 'evenodd');
  }
  texture.context.restore();
  body.context.globalCompositeOperation = 'source-over';
  for (const fill of fills) body.context.fill(fill.path, fill.rule);

  // Keep the exterior contour, but do not paint positive strokes over interior details.
  outline.context.save();
  outline.context.resetTransform();
  outline.context.globalCompositeOperation = 'destination-out';
  outline.context.drawImage(body.canvas, 0, 0);
  outline.context.restore();
  outline.context.globalCompositeOperation = 'destination-out';
  for (const shape of automatic) {
    if (shape.depth % 2) outline.context.fill(shape.path, 'evenodd');
  }
  body.context.globalCompositeOperation = 'destination-out';
  body.context.lineWidth = 1.5 * weightScale;
  body.context.lineCap = 'round';
  body.context.lineJoin = 'round';
  body.context.stroke(details);
  for (const shape of automatic) {
    if (shape.depth % 2 && Math.min(shape.bounds[2] - shape.bounds[0], shape.bounds[3] - shape.bounds[1]) < 1.5) {
      // Tiny negative dots must survive the normal 24-40px icon sizes.
      body.context.lineWidth = 0.8;
      body.context.stroke(shape.path);
    }
  }
  for (const cutout of cutouts) body.context.fill(cutout.path, cutout.rule);
  if (washOutline) {
    washOutline.context.globalCompositeOperation = 'destination-out';
    washOutline.context.lineWidth = 1.5 * weightScale;
    washOutline.context.lineCap = 'round';
    washOutline.context.lineJoin = 'round';
    washOutline.context.stroke(details);
    for (const cutout of cutouts) washOutline.context.fill(cutout.path, cutout.rule);
  }

  const mask = body.context.getImageData(0, 0, body.canvas.width, body.canvas.height);
  softenIconFillMask(mask.data, mask.width, mask.height, target.getTransform().a, seed, roughnessScale);
  body.context.putImageData(mask, 0, 0);

  const paint = (pigment: string, wash = false, narrowest = Infinity) => {
    // Wash leaves paper between strokes; solid fill retains its established density.
    texture.context.fillStyle = pigment;
    texture.context.globalAlpha = wash ? 0.32 + 0.2 * Math.max(0, 1 - narrowest / 2) : 0.65;
    const start = (options.sourceSize - 40) / 2;
    texture.context.fillRect(start, start, 40, 40);
    texture.context.globalAlpha = 1;
    for (let y = start - 10; y < start + 50; y += wash ? 1.1 : 0.8) {
      pencilStroke(texture.context, [[start - 2, y + 6], [start + 42, y - 6]], pigment,
        wash ? 0.8 : 0.9, seed + Math.round(y * 97), (wash ? 0.2 : 0.15) * roughnessScale, 1, false,
        { variation: 0.3, fitPressure: true, breaks: 0, grain: 0.7, gain: wash ? 0.75 : 1.5, step: 0.5 });
    }
  };
  paint(fillColor);
  for (const fill of fills) {
    if (!fill.color && !fill.wash) continue;
    texture.context.save();
    texture.context.clip(fill.path, fill.rule);
    texture.context.clearRect(-4096, -4096, 8192, 8192);
    paint(fill.color ?? fillColor, fill.wash, fill.narrowest);
    texture.context.restore();
  }
  texture.context.resetTransform();
  texture.context.globalCompositeOperation = 'destination-in';
  texture.context.drawImage(body.canvas, 0, 0);
  target.save();
  target.resetTransform();
  target.drawImage(texture.canvas, 0, 0);
  target.drawImage(outline.canvas, 0, 0);
  if (washOutline) target.drawImage(washOutline.canvas, 0, 0);
  target.restore();
}
