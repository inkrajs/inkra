export interface ImageCropperPoint {
  x: number;
  y: number;
}

export interface ImageCropperSize {
  width: number;
  height: number;
}

export interface ImageCropperArea extends ImageCropperPoint, ImageCropperSize {}

export type ImageCropperExportType = 'image/png' | 'image/jpeg' | 'image/webp';

export interface ImageCropperExportOptions {
  /** Maximum output width. The crop aspect ratio is always preserved. */
  maxWidth?: number;
  /** Maximum output height. The crop aspect ratio is always preserved. */
  maxHeight?: number;
  /** Maximum output pixel count. Defaults to 16,777,216 and never exceeds the hard 33,554,432 limit. */
  maxPixels?: number;
  /** Permit enlarging beyond the selected original pixels. Defaults to false. */
  allowUpscale?: boolean;
  type?: ImageCropperExportType;
  quality?: number;
}

export type ImageCropperExportErrorCode =
  | 'canvas'
  | 'cors'
  | 'image-not-ready'
  | 'invalid-selection'
  | 'unsupported-format';

export class ImageCropperExportError extends Error {
  readonly code: ImageCropperExportErrorCode;
  readonly cause?: unknown;

  constructor(code: ImageCropperExportErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'ImageCropperExportError';
    this.code = code;
    this.cause = options?.cause;
  }
}

export const IMAGE_CROPPER_MAX_OUTPUT_EDGE = 8192;
export const IMAGE_CROPPER_MAX_OUTPUT_PIXELS = 33_554_432;
export const IMAGE_CROPPER_DEFAULT_OUTPUT_PIXELS = 16_777_216;

const EXPORT_TYPES = new Set<ImageCropperExportType>(['image/png', 'image/jpeg', 'image/webp']);

function finitePositive(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(maximum, value);
}

export function clampImageCropperArea(
  area: ImageCropperArea,
  naturalSize: ImageCropperSize,
): ImageCropperArea {
  const naturalWidth = Math.max(0, Math.floor(naturalSize.width));
  const naturalHeight = Math.max(0, Math.floor(naturalSize.height));
  const x = Math.min(naturalWidth, Math.max(0, Math.round(area.x)));
  const y = Math.min(naturalHeight, Math.max(0, Math.round(area.y)));
  const width = Math.min(naturalWidth - x, Math.max(0, Math.round(area.width)));
  const height = Math.min(naturalHeight - y, Math.max(0, Math.round(area.height)));
  return { x, y, width, height };
}

export function resolveImageCropperOutputSize(
  area: ImageCropperSize,
  options: ImageCropperExportOptions = {},
): ImageCropperSize {
  const sourceWidth = Math.floor(area.width);
  const sourceHeight = Math.floor(area.height);
  if (sourceWidth < 1 || sourceHeight < 1) {
    throw new ImageCropperExportError('invalid-selection', 'The crop selection has no exportable pixels.');
  }

  const maxWidth = finitePositive(options.maxWidth, IMAGE_CROPPER_MAX_OUTPUT_EDGE, IMAGE_CROPPER_MAX_OUTPUT_EDGE);
  const maxHeight = finitePositive(options.maxHeight, IMAGE_CROPPER_MAX_OUTPUT_EDGE, IMAGE_CROPPER_MAX_OUTPUT_EDGE);
  const maxPixels = finitePositive(
    options.maxPixels,
    IMAGE_CROPPER_DEFAULT_OUTPUT_PIXELS,
    IMAGE_CROPPER_MAX_OUTPUT_PIXELS,
  );
  const upscaleLimit = options.allowUpscale ? Number.POSITIVE_INFINITY : 1;
  const scale = Math.min(
    upscaleLimit,
    maxWidth / sourceWidth,
    maxHeight / sourceHeight,
    Math.sqrt(maxPixels / (sourceWidth * sourceHeight)),
  );

  return {
    width: Math.max(1, Math.floor(sourceWidth * scale)),
    height: Math.max(1, Math.floor(sourceHeight * scale)),
  };
}

function exportError(error: unknown): ImageCropperExportError {
  if (error instanceof ImageCropperExportError) return error;
  if (error instanceof DOMException && error.name === 'SecurityError') {
    return new ImageCropperExportError(
      'cors',
      'The image can be displayed, but its server did not permit canvas export. Configure CORS or use a same-origin Blob.',
      { cause: error },
    );
  }
  return new ImageCropperExportError('canvas', 'The browser could not render the crop to a canvas.', { cause: error });
}

export async function exportImageCrop(
  image: HTMLImageElement,
  area: ImageCropperArea,
  options: ImageCropperExportOptions = {},
): Promise<{ blob: Blob; width: number; height: number; type: ImageCropperExportType }> {
  if (!image.complete || image.naturalWidth < 1 || image.naturalHeight < 1) {
    throw new ImageCropperExportError('image-not-ready', 'The image has not finished loading.');
  }

  const type = options.type ?? 'image/png';
  if (!EXPORT_TYPES.has(type)) {
    throw new ImageCropperExportError('unsupported-format', `Unsupported crop export format: ${String(type)}`);
  }

  const selection = clampImageCropperArea(area, {
    width: image.naturalWidth,
    height: image.naturalHeight,
  });
  const output = resolveImageCropperOutputSize(selection, options);
  const canvas = document.createElement('canvas');
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext('2d');
  if (!context) throw new ImageCropperExportError('canvas', 'The browser did not provide a 2D canvas context.');

  try {
    context.drawImage(
      image,
      selection.x,
      selection.y,
      selection.width,
      selection.height,
      0,
      0,
      output.width,
      output.height,
    );
    const quality = options.quality === undefined
      ? undefined
      : Math.min(1, Math.max(0, options.quality));
    const blob = await new Promise<Blob>((resolve, reject) => {
      try {
        canvas.toBlob(
          value => value ? resolve(value) : reject(new ImageCropperExportError('canvas', 'Canvas export returned no image data.')),
          type,
          quality,
        );
      } catch (error) {
        reject(error);
      }
    });
    return { blob, width: output.width, height: output.height, type };
  } catch (error) {
    throw exportError(error);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
