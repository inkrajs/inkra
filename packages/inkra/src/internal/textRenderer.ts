import { BoundedCache, PENCIL_RENDERER_VERSION, canvasByteCost, canvasIsUsable } from './cache.js';
import { seededRandom } from './random.js';

export interface PencilLetteringSettings {
  variation: number;
  breaks: number;
  outline: number;
  fill: number;
  grain: number;
}

export interface PencilTextSprite {
  ink: HTMLCanvasElement;
  width: number;
  height: number;
  advance: number;
  ascent: number;
  descent: number;
  padding: number;
}

export const pencilLettering: PencilLetteringSettings = Object.freeze({
  variation: 0.2,
  breaks: 0.5,
  outline: 0.9,
  fill: 0.9,
  grain: 0.6,
});

export const pencilHandwriting = '"Trip Map Hand","HanziPen SC","Hannotate SC","Kaiti SC","STKaiti",cursive';

const TEXT_PIXEL_LIMIT = 524288;
export function boundedTextResolution(width: number, height: number, dpr: number): number {
  if (![width, height, dpr].every(value => Number.isFinite(value) && value > 0)) return 0;
  return Math.floor(Math.min(
    Math.max(2, Math.min(4, Math.ceil(dpr * 2))),
    Math.sqrt(TEXT_PIXEL_LIMIT / (width * height)),
    8192 / width,
    8192 / height,
  ));
}
const textCache = new BoundedCache<PencilTextSprite>(160, 16 * 1024 * 1024);
const glyphCache = new BoundedCache<PencilTextSprite>(512, 8 * 1024 * 1024);
const clamp = (value: number): number => Math.max(0, Math.min(1, value));

function hash(x: number, y: number, seed: number): number {
  let value = Math.imul(x ^ seed, 374761393) ^ Math.imul(y, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function field(x: number, y: number, seed: number): number {
  const integerX = Math.floor(x);
  const integerY = Math.floor(y);
  const fractionX = x - integerX;
  const fractionY = y - integerY;
  const smoothX = fractionX * fractionX * (3 - 2 * fractionX);
  const smoothY = fractionY * fractionY * (3 - 2 * fractionY);
  return (hash(integerX, integerY, seed) * (1 - smoothX)
    + hash(integerX + 1, integerY, seed) * smoothX) * (1 - smoothY)
    + (hash(integerX, integerY + 1, seed) * (1 - smoothX)
      + hash(integerX + 1, integerY + 1, seed) * smoothX) * smoothY;
}

function distanceTo(mask: Uint8ClampedArray, width: number, height: number, inside: boolean): Float32Array {
  const distance = new Float32Array(width * height);
  for (let index = 0; index < distance.length; index += 1) {
    distance[index] = (mask[index * 4 + 3] > 100) === inside ? 0 : 1000;
  }
  const relax = (index: number, neighbor: number, cost: number) => {
    distance[index] = Math.min(distance[index], distance[neighbor] + cost);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (x) relax(index, index - 1, 1);
      if (y) {
        relax(index, index - width, 1);
        if (x) relax(index, index - width - 1, 1.414);
        if (x + 1 < width) relax(index, index - width + 1, 1.414);
      }
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      if (x + 1 < width) relax(index, index + 1, 1);
      if (y + 1 < height) {
        relax(index, index + width, 1);
        if (x) relax(index, index + width - 1, 1.414);
        if (x + 1 < width) relax(index, index + width + 1, 1.414);
      }
    }
  }

  return distance;
}

export function renderPencilText(
  text: string,
  options: {
    size: number;
    family?: string;
    weight?: string;
    style?: string;
    color: string;
    seed: number;
    dpr: number;
    settings?: PencilLetteringSettings;
    cache?: boolean;
    glyphSeed?: number;
  },
): PencilTextSprite {
  const { size, color, seed, dpr } = options;
  const family = options.family ?? pencilHandwriting;
  const settings = options.settings ?? pencilLettering;
  const cache = options.cache ?? true;
  if (text.length > 256 || !Number.isFinite(size) || size <= 0 || size > 128) {
    throw new RangeError('Pencil text exceeds the bounded renderer input');
  }
  let resolution = Math.max(2, Math.min(4, Math.ceil(dpr * 2)));
  const font = `${options.style ?? 'normal'} ${options.weight ?? '400'} ${size}px ${family}`;
  const fontReady = document.fonts?.check(font, text) ?? false;
  const key = cache ? JSON.stringify([
    PENCIL_RENDERER_VERSION,
    'adaptive-text-raster-v1',
    text,
    size,
    font,
    color,
    seed,
    dpr,
    resolution,
    settings,
    fontReady,
    options.glyphSeed,
  ]) : '';
  if (cache) {
    const cached = textCache.get(key);
    if (cached && canvasIsUsable(cached.ink)) return cached;
  }

  const mask = document.createElement('canvas');
  const measure = mask.getContext('2d', { willReadFrequently: true });
  if (!measure) throw new Error('Canvas 2D is unavailable');
  measure.fillStyle = color;
  measure.fillRect(0, 0, 1, 1);
  const rgb = measure.getImageData(0, 0, 1, 1).data;
  measure.font = font;
  measure.fontKerning = 'none';
  const characters = Array.from(text);
  const widths = characters.map(character => measure.measureText(character).width);
  const advance = Math.ceil(widths.reduce((sum, width) => sum + width, 0));
  const padding = 5;
  const ascent = Math.ceil(size * 1.1);
  const descent = Math.ceil(size * 0.35);
  const width = advance + padding * 2;
  const height = ascent + descent + padding * 2;
  // Wide lines on Retina displays can retain pencil ink at a lower sampling rate.
  resolution = boundedTextResolution(width, height, dpr);
  if (resolution < 1) {
    throw new RangeError('Pencil text exceeds the bounded pixel budget');
  }

  mask.width = width * resolution;
  mask.height = height * resolution;
  const context = mask.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D is unavailable');
  context.scale(resolution, resolution);
  // Plain Latin labels can reuse bounded character sprites. Complex scripts and
  // private editable text retain the original whole-line rendering path.
  if (cache && options.glyphSeed !== undefined && /^[\x20-\x7e]+$/.test(text)) {
    let left = 0;
    characters.forEach((character, index) => {
      if (character !== ' ') {
        const characterSeed = (options.glyphSeed! ^ Math.imul(character.charCodeAt(0), 16777619)
          ^ Math.imul(index % 3, 374761393)) >>> 0;
        const glyphKey = JSON.stringify([
          PENCIL_RENDERER_VERSION, character, size, font, color, characterSeed,
          resolution, settings, document.fonts?.check(font, character),
        ]);
        let glyph = glyphCache.get(glyphKey);
        if (!glyph || !canvasIsUsable(glyph.ink)) {
          glyph = renderPencilText(character, { ...options, seed: characterSeed, glyphSeed: undefined, cache: false });
          glyphCache.set(glyphKey, glyph, canvasByteCost(glyph.ink));
        }
        context.drawImage(glyph.ink, left, 0, glyph.width, glyph.height);
      }
      left += widths[index];
    });
    const sprite = { ink: mask, width, height, advance, ascent, descent, padding };
    return textCache.set(key, sprite, canvasByteCost(mask));
  }
  context.font = font;
  context.fontKerning = 'none';
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = size >= 16 ? 0.48 : 0.24;
  const random = seededRandom(seed);
  let x = padding;

  characters.forEach((character, index) => {
    const center = x + widths[index] / 2;
    const baseline = padding + ascent + (random() - 0.5) * 0.55;
    context.save();
    context.translate(center, baseline);
    context.rotate((random() - 0.5) * 0.035);
    context.globalAlpha = 1;
    context.fillText(character, -widths[index] / 2, 0);
    context.strokeText(character, -widths[index] / 2, 0);
    context.restore();
    x += widths[index];
  });

  const image = context.getImageData(0, 0, mask.width, mask.height);
  const shape = new Uint8ClampedArray(image.data);
  const outside = distanceTo(shape, mask.width, mask.height, true);
  const inside = distanceTo(shape, mask.width, mask.height, false);
  const cuts: Array<{ x: number; y: number; cosine: number; sine: number; long: number; short: number }> = [];
  let characterLeft = padding;

  for (let character = 0; character < characters.length; character += 1) {
    for (let attempt = 0, found = 0; attempt < 80 && found < 2; attempt += 1) {
      const centerX = characterLeft + random() * widths[character];
      const centerY = padding + ascent - size + random() * size;
      const pixel = Math.floor(centerY * resolution) * mask.width + Math.floor(centerX * resolution);
      if (shape[pixel * 4 + 3] < 130) continue;
      const angle = random() * Math.PI;
      cuts.push({
        x: centerX,
        y: centerY,
        cosine: Math.cos(angle),
        sine: Math.sin(angle),
        long: 1.1 + random() * 0.7,
        short: 0.22 + random() * 0.2,
      });
      found += 1;
    }
    characterLeft += widths[character];
  }

  const columnCuts = Array.from({ length: mask.width }, (_, column) => cuts.filter(cut =>
    Math.abs(column / resolution - cut.x)
      <= Math.hypot(cut.cosine * cut.long, cut.sine * cut.short) * 1.55));

  for (let y = 0; y < mask.height; y += 1) {
    for (let xIndex = 0; xIndex < mask.width; xIndex += 1) {
      const index = (y * mask.width + xIndex) * 4;
      const pixel = y * mask.width + xIndex;
      if (outside[pixel] > resolution * 1.1) {
        image.data[index + 3] = 0;
        continue;
      }
      const pixelX = xIndex / resolution;
      const pixelY = y / resolution;
      const force = field(pixelX / 2.7, pixelY / 2.4, seed + 31);
      const pressure = 1 - settings.variation * 0.94
        * (1 - clamp((force - 0.23) / 0.46) ** 0.85);
      const paperTooth = field(pixelX * 2.3, pixelY * 2.1, seed + 113);
      const tooth = 1 - settings.grain * 0.76
        * (1 - clamp((paperTooth - 0.2) / 0.53));
      let contact = 1;
      for (const cut of columnCuts[xIndex]) {
        const deltaX = pixelX - cut.x;
        const deltaY = pixelY - cut.y;
        const radius = Math.hypot(
          (deltaX * cut.cosine + deltaY * cut.sine) / cut.long,
          (-deltaX * cut.sine + deltaY * cut.cosine) / cut.short,
        );
        contact = Math.min(contact, clamp((radius - 0.85) / 0.7));
      }
      const distance = shape[index + 3] > 100
        ? -(inside[pixel] - 0.5) / resolution
        : (outside[pixel] - 0.5) / resolution;
      const edgeWidth = 0.34 + settings.outline * 0.5;
      const edgeWobble = (field(pixelX * 0.9, pixelY * 0.9, seed + 209) - 0.5)
        * 0.32 * settings.outline;
      const rim = clamp(1 - Math.abs(distance + edgeWobble) / edgeWidth);
      const core = (shape[index + 3] / 255) * (0.28 + 0.64 * settings.fill);
      const lift = 1 - settings.breaks * 1.75 * (1 - contact);
      const pigment = clamp(Math.max(core, rim * (0.48 + 0.52 * settings.outline))
        * pressure * tooth * Math.max(0.08, lift) * 1.38);
      image.data[index] = rgb[0];
      image.data[index + 1] = rgb[1];
      image.data[index + 2] = rgb[2];
      image.data[index + 3] = Math.round(255 * pigment);
    }
  }

  context.putImageData(image, 0, 0);
  const sprite = { ink: mask, width, height, advance, ascent, descent, padding };
  return cache ? textCache.set(key, sprite, canvasByteCost(mask)) : sprite;
}
