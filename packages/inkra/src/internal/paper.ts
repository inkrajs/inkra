import { BoundedCache, PENCIL_RENDERER_VERSION, canvasByteCost, canvasIsUsable } from './cache.js';
import { grain, seededRandom } from './random.js';

const PAPER_SIZE = 384;
const paperCache = new BoundedCache<HTMLCanvasElement>(8, 24 * 1024 * 1024);

export function pencilPaper(color = '#fcfcfa', dark = false, dpr = 1): HTMLCanvasElement {
  const ratio = Math.max(1, Math.min(dpr, 2));
  const key = JSON.stringify([PENCIL_RENDERER_VERSION, PAPER_SIZE, color, dark, ratio]);
  const cached = paperCache.get(key);
  if (cached && canvasIsUsable(cached)) return cached;
  if (cached) paperCache.delete(key);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAPER_SIZE * ratio);
  canvas.height = Math.round(PAPER_SIZE * ratio);
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.scale(ratio, ratio);
  context.fillStyle = color;
  context.fillRect(0, 0, PAPER_SIZE, PAPER_SIZE);

  if (dark) {
    grain(context, PAPER_SIZE, PAPER_SIZE, '#3b392f', 4331, 0.42);
    grain(context, PAPER_SIZE, PAPER_SIZE, '#0a0a08', 7013, 0.3);
  } else {
    grain(context, PAPER_SIZE, PAPER_SIZE, '#808278', 4331, 0.85);
    grain(context, PAPER_SIZE, PAPER_SIZE, '#ffffff', 7013, 1.7);
  }

  const random = seededRandom(8119);
  context.lineCap = 'round';
  const fibreCount = dark ? 700 : 1100;

  for (let index = 0; index < fibreCount; index += 1) {
    const x = random() * PAPER_SIZE;
    const y = random() * PAPER_SIZE;
    const length = 2 + random() * 12;
    const angle = random() * Math.PI;
    const deltaX = Math.cos(angle) * length;
    const deltaY = Math.sin(angle) * length * 0.45;
    const bend = (random() - 0.5) * 2;
    const alpha = dark ? 0.025 + random() * 0.025 : 0.025 + random() * 0.055;
    context.lineWidth = 0.35 + random() * 0.45;

    for (const offsetX of [-PAPER_SIZE, 0, PAPER_SIZE]) {
      for (const offsetY of [-PAPER_SIZE, 0, PAPER_SIZE]) {
        if (x + offsetX + length < 0 || x + offsetX - length > PAPER_SIZE
          || y + offsetY + length < 0 || y + offsetY - length > PAPER_SIZE) continue;
        context.strokeStyle = dark ? '#0d0d0b' : '#82877b';
        context.globalAlpha = alpha;
        context.beginPath();
        context.moveTo(x + offsetX, y + offsetY);
        context.quadraticCurveTo(
          x + offsetX + deltaX / 2,
          y + offsetY + deltaY / 2 + bend,
          x + offsetX + deltaX,
          y + offsetY + deltaY,
        );
        context.stroke();
        context.strokeStyle = dark ? '#494737' : '#ffffff';
        context.globalAlpha = dark ? alpha * 1.2 : alpha * 2.5;
        context.beginPath();
        context.moveTo(x + offsetX, y + offsetY + 0.7);
        context.quadraticCurveTo(
          x + offsetX + deltaX / 2,
          y + offsetY + deltaY / 2 + bend + 0.7,
          x + offsetX + deltaX,
          y + offsetY + deltaY + 0.7,
        );
        context.stroke();
      }
    }
  }

  context.globalAlpha = 1;
  return paperCache.set(key, canvas, canvasByteCost(canvas));
}
