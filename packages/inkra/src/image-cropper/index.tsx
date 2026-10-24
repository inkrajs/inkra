import { __iconData as downloadIcon } from 'lucide-react/dist/esm/icons/download.mjs';
import { __iconData as imageOffIcon } from 'lucide-react/dist/esm/icons/image-off.mjs';
import { __iconData as rotateCcwIcon } from 'lucide-react/dist/esm/icons/rotate-ccw.mjs';
import Cropper from 'react-easy-crop';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useId,
  useRef,
  useState,
} from 'react';
import type { HTMLAttributeReferrerPolicy, HTMLAttributes, KeyboardEvent, RefObject } from 'react';
import type { Area, MediaSize, Point, Size } from 'react-easy-crop';

import { Button } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { Slider } from '../slider/index.js';
import {
  ImageCropperExportError,
  exportImageCrop,
} from './model.js';
import type {
  ImageCropperArea,
  ImageCropperExportOptions,
  ImageCropperExportType,
  ImageCropperPoint,
  ImageCropperSize,
} from './model.js';

const downloadPaths = downloadIcon.node.map(([, attributes]) => ({ d: attributes.d }));
const imageOffPaths = imageOffIcon.node.map(([, attributes]) => ({ d: attributes.d }));
const resetPaths = rotateCcwIcon.node.map(([, attributes]) => ({ d: attributes.d }));
// Lucide LoaderCircle geometry, rendered through the shared PencilIcon engine.
const loadingPaths = [{ d: 'M21 12a9 9 0 1 1-6.219-8.56' }];

const DEFAULT_CROP = Object.freeze({ x: 0, y: 0 });
const MIN_FREE_CROP_SIZE = 48;

export type ImageCropperAspect = number | 'free';
export type ImageCropperLoadState = 'loading' | 'ready' | 'error';
export type ImageCropperInteractionSource = 'mouse' | 'touch' | 'wheel' | 'keyboard';
export type ImageCropperChangeReason = ImageCropperInteractionSource | 'control' | 'reset' | 'source-change';

export interface ImageCropperChangeDetails {
  reason: ImageCropperChangeReason;
}

export interface ImageCropperSelection {
  /** Percentage coordinates relative to the original image. */
  percentages: ImageCropperArea;
  /** Integer coordinates in the original image's natural pixel space. */
  pixels: ImageCropperArea;
  naturalSize: ImageCropperSize;
}

export interface ImageCropperExportResult {
  blob: Blob;
  width: number;
  height: number;
  type: ImageCropperExportType;
  selection: ImageCropperSelection;
}

export interface ImageCropperLabels {
  cropper: string;
  instructions: string;
  loading: string;
  failedTitle: string;
  failedDescription: string;
  retry: string;
  zoom: string;
  cropWidth: string;
  cropHeight: string;
  reset: string;
  export: string;
  exporting: string;
}

const defaultLabels: ImageCropperLabels = {
  cropper: 'Image crop area',
  instructions: 'Use pointer gestures or arrow keys to move the image. Use the zoom control. In free aspect mode, use the size controls or Alt plus arrow keys to resize the crop area.',
  loading: 'Loading image',
  failedTitle: 'Image unavailable',
  failedDescription: 'The image could not be loaded. Check the source and try again.',
  retry: 'Retry image',
  zoom: 'Zoom',
  cropWidth: 'Crop width',
  cropHeight: 'Crop height',
  reset: 'Reset crop',
  export: 'Export crop',
  exporting: 'Exporting crop',
};

export interface ImageCropperHandle {
  exportCrop(options?: ImageCropperExportOptions): Promise<ImageCropperExportResult>;
  getSelection(): ImageCropperSelection | null;
  reset(): void;
}

export interface ImageCropperProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onError'> {
  source: string | Blob;
  alt: string;
  aspect?: ImageCropperAspect;
  crop?: ImageCropperPoint;
  defaultCrop?: ImageCropperPoint;
  onCropChange?: (crop: ImageCropperPoint, details: ImageCropperChangeDetails) => void;
  zoom?: number;
  defaultZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  onZoomChange?: (zoom: number, details: ImageCropperChangeDetails) => void;
  cropAreaSize?: ImageCropperSize;
  defaultCropAreaSize?: ImageCropperSize;
  onCropAreaSizeChange?: (size: ImageCropperSize, details: ImageCropperChangeDetails) => void;
  onSelectionChange?: (selection: ImageCropperSelection) => void;
  onSelectionCommit?: (selection: ImageCropperSelection) => void;
  onLoadStateChange?: (state: ImageCropperLoadState) => void;
  onMediaLoaded?: (naturalSize: ImageCropperSize) => void;
  onLoadError?: (error: Error) => void;
  onExport?: (result: ImageCropperExportResult) => void;
  onExportError?: (error: ImageCropperExportError) => void;
  exportOptions?: ImageCropperExportOptions;
  showControls?: boolean;
  showExport?: boolean;
  showGrid?: boolean;
  zoomWithScroll?: boolean;
  resetOnSourceChange?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  crossOrigin?: 'anonymous' | 'use-credentials';
  referrerPolicy?: HTMLAttributeReferrerPolicy;
  labels?: Partial<ImageCropperLabels>;
  nonce?: string;
}

function samePoint(left: ImageCropperPoint, right: ImageCropperPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

function sameSize(left: ImageCropperSize | null, right: ImageCropperSize | null): boolean {
  return left === right || Boolean(left && right && left.width === right.width && left.height === right.height);
}

function validAspect(aspect: ImageCropperAspect): number {
  return aspect === 'free' || !Number.isFinite(aspect) || aspect <= 0 ? 1 : aspect;
}

function exportFailure(error: unknown): ImageCropperExportError {
  return error instanceof ImageCropperExportError
    ? error
    : new ImageCropperExportError('canvas', 'The crop could not be exported.', { cause: error });
}

export const ImageCropper = forwardRef<ImageCropperHandle, ImageCropperProps>(function ImageCropper(
  {
    alt,
    aspect = 1,
    className,
    crop: cropProp,
    cropAreaSize: cropAreaSizeProp,
    crossOrigin,
    defaultCrop = DEFAULT_CROP,
    defaultCropAreaSize,
    defaultZoom = 1,
    disabled = false,
    exportOptions,
    labels: labelOverrides,
    maxZoom = 3,
    minZoom = 1,
    nonce,
    onCropAreaSizeChange,
    onCropChange,
    onExport,
    onExportError,
    onLoadError,
    onLoadStateChange,
    onMediaLoaded,
    onSelectionChange,
    onSelectionCommit,
    onZoomChange,
    readOnly = false,
    referrerPolicy,
    resetOnSourceChange = true,
    showControls = true,
    showExport = Boolean(onExport),
    showGrid = true,
    source,
    zoom: zoomProp,
    zoomStep = 0.1,
    zoomWithScroll = true,
    ...props
  },
  forwardedRef,
) {
  const labels = { ...defaultLabels, ...labelOverrides };
  const generatedId = useId();
  const resolvedId = props.id ?? `inkra-image-cropper-${generatedId}`;
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const selectionRef = useRef<ImageCropperSelection | null>(null);
  const interactionSourceRef = useRef<ImageCropperInteractionSource>('mouse');
  const initialSourceRef = useRef(source);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadState, setLoadState] = useState<ImageCropperLoadState>('loading');
  const [internalCrop, setInternalCrop] = useState<ImageCropperPoint>(defaultCrop);
  const [internalZoom, setInternalZoom] = useState(defaultZoom);
  const [internalCropAreaSize, setInternalCropAreaSize] = useState<ImageCropperSize | null>(defaultCropAreaSize ?? null);
  const [naturalSize, setNaturalSize] = useState<ImageCropperSize | null>(null);
  const [stageSize, setStageSize] = useState<ImageCropperSize>({ width: 640, height: 400 });
  const [exporting, setExporting] = useState(false);
  const crop = cropProp ?? internalCrop;
  const zoom = zoomProp ?? internalZoom;
  const cropAreaSize = cropAreaSizeProp ?? internalCropAreaSize;
  const freeCropAreaSize = cropAreaSize ?? (aspect === 'free'
    ? { width: Math.min(stageSize.width, stageSize.height), height: Math.min(stageSize.width, stageSize.height) }
    : null);
  const sourceUrl = typeof source === 'string' ? source : blobUrl;
  const interactionDisabled = disabled || readOnly || loadState !== 'ready';

  const announceLoadState = useCallback((state: ImageCropperLoadState) => {
    setLoadState(state);
    onLoadStateChange?.(state);
  }, [onLoadStateChange]);

  const commitCrop = useCallback((next: ImageCropperPoint, reason: ImageCropperChangeReason) => {
    if (cropProp === undefined) setInternalCrop(next);
    onCropChange?.(next, { reason });
  }, [cropProp, onCropChange]);

  const commitZoom = useCallback((next: number, reason: ImageCropperChangeReason) => {
    const bounded = Math.min(maxZoom, Math.max(minZoom, next));
    if (zoomProp === undefined) setInternalZoom(bounded);
    onZoomChange?.(bounded, { reason });
  }, [maxZoom, minZoom, onZoomChange, zoomProp]);

  const commitCropAreaSize = useCallback((next: ImageCropperSize, reason: ImageCropperChangeReason) => {
    const bounded = {
      width: Math.round(Math.min(Math.max(MIN_FREE_CROP_SIZE, next.width), Math.max(MIN_FREE_CROP_SIZE, stageSize.width))),
      height: Math.round(Math.min(Math.max(MIN_FREE_CROP_SIZE, next.height), Math.max(MIN_FREE_CROP_SIZE, stageSize.height))),
    };
    if (cropAreaSizeProp === undefined) setInternalCropAreaSize(bounded);
    onCropAreaSizeChange?.(bounded, { reason });
  }, [cropAreaSizeProp, onCropAreaSizeChange, stageSize.height, stageSize.width]);

  const reset = useCallback((reason: ImageCropperChangeReason = 'reset') => {
    if (!samePoint(crop, defaultCrop)) commitCrop(defaultCrop, reason);
    if (zoom !== defaultZoom) commitZoom(defaultZoom, reason);
    const nextSize = defaultCropAreaSize ?? null;
    if (!sameSize(cropAreaSize, nextSize)) {
      if (nextSize) commitCropAreaSize(nextSize, reason);
      else if (cropAreaSizeProp === undefined) setInternalCropAreaSize(null);
    }
    selectionRef.current = null;
  }, [commitCrop, commitCropAreaSize, commitZoom, crop, cropAreaSize, cropAreaSizeProp, defaultCrop, defaultCropAreaSize, defaultZoom, zoom]);

  useEffect(() => {
    if (typeof source === 'string') {
      setBlobUrl(null);
      return undefined;
    }
    const nextUrl = URL.createObjectURL(source);
    setBlobUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [source]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => {
      const rect = stage.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageSize(current => current.width === rect.width && current.height === rect.height
          ? current : { width: rect.width, height: rect.height });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (initialSourceRef.current === source) return;
    initialSourceRef.current = source;
    setAttempt(0);
    setNaturalSize(null);
    selectionRef.current = null;
    announceLoadState('loading');
    if (resetOnSourceChange) reset('source-change');
  }, [announceLoadState, reset, resetOnSourceChange, source]);

  const makeSelection = useCallback((percentages: Area, pixels: Area): ImageCropperSelection | null => {
    if (!naturalSize) return null;
    return {
      percentages: { ...percentages },
      pixels: { ...pixels },
      naturalSize,
    };
  }, [naturalSize]);

  const exportCurrent = useCallback(async (options: ImageCropperExportOptions = exportOptions ?? {}) => {
    const image = imageRef.current;
    const selection = selectionRef.current;
    if (!selection) throw new ImageCropperExportError('invalid-selection', 'No completed crop selection is available.');
    if (!image) throw new ImageCropperExportError('image-not-ready', 'The image element is not available.');
    const result = await exportImageCrop(image, selection.pixels, options);
    return { ...result, selection };
  }, [exportOptions]);

  useImperativeHandle(forwardedRef, () => ({
    exportCrop: exportCurrent,
    getSelection: () => selectionRef.current,
    reset: () => reset(),
  }), [exportCurrent, reset]);

  const handleExport = async () => {
    setExporting(true);
    try {
      onExport?.(await exportCurrent());
    } catch (error) {
      onExportError?.(exportFailure(error));
    } finally {
      setExporting(false);
    }
  };

  const resizeFreeCrop = (axis: 'width' | 'height', delta: number) => {
    if (aspect !== 'free' || interactionDisabled) return;
    const base = cropAreaSize ?? {
      width: Math.min(stageSize.width, stageSize.height),
      height: Math.min(stageSize.width, stageSize.height),
    };
    commitCropAreaSize({ ...base, [axis]: base[axis] + delta }, 'control');
  };

  const handleRootKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    props.onKeyDown?.(event);
    if (event.defaultPrevented || !event.altKey || aspect !== 'free') return;
    if (!stageRef.current?.contains(event.target as Node)) return;
    const step = event.shiftKey ? 24 : 8;
    if (event.key === 'ArrowLeft') resizeFreeCrop('width', -step);
    else if (event.key === 'ArrowRight') resizeFreeCrop('width', step);
    else if (event.key === 'ArrowUp') resizeFreeCrop('height', -step);
    else if (event.key === 'ArrowDown') resizeFreeCrop('height', step);
    else return;
    event.preventDefault();
  };

  const engineAspect = validAspect(aspect);
  const engineCropSize = aspect === 'free' && freeCropAreaSize ? freeCropAreaSize as Size : undefined;
  const rootProps = { ...props };
  delete rootProps.onKeyDown;

  return <div
    {...rootProps}
    className={['inkra-image-cropper', className].filter(Boolean).join(' ')}
    data-disabled={disabled || undefined}
    data-read-only={readOnly || undefined}
    data-state={loadState}
    onKeyDown={handleRootKeyDown}
  >
    <div
      aria-busy={loadState === 'loading' || undefined}
      aria-describedby={`${resolvedId}-instructions`}
      aria-disabled={disabled || undefined}
      aria-label={labels.cropper}
      className="inkra-image-cropper__stage"
      ref={stageRef}
    >
      <PencilSurface as="span" aria-hidden="true" className="inkra-image-cropper__stage-surface" radius={8} variant="outline" />
      {sourceUrl ? <Cropper
        aspect={engineAspect}
        classes={{
          containerClassName: 'inkra-image-cropper__engine',
          mediaClassName: 'inkra-image-cropper__media',
          cropAreaClassName: 'inkra-image-cropper__area',
        }}
        crop={crop as Point}
        cropSize={engineCropSize}
        image={sourceUrl}
        keyboardStep={1}
        maxZoom={maxZoom}
        mediaProps={{ alt, crossOrigin, referrerPolicy }}
        minZoom={minZoom}
        nonce={nonce}
        onCropAreaChange={(percentages, pixels) => {
          const selection = makeSelection(percentages, pixels);
          if (!selection) return;
          selectionRef.current = selection;
          onSelectionChange?.(selection);
        }}
        onCropChange={next => {
          if (!interactionDisabled) commitCrop(next, interactionSourceRef.current);
        }}
        onCropComplete={(percentages, pixels) => {
          const selection = makeSelection(percentages, pixels);
          if (!selection) return;
          selectionRef.current = selection;
          onSelectionCommit?.(selection);
        }}
        onCropSizeChange={next => {
          if (aspect === 'free' && !cropAreaSize) commitCropAreaSize(next, 'control');
        }}
        onInteractionStart={({ source: interactionSource }) => {
          interactionSourceRef.current = interactionSource;
        }}
        onMediaLoaded={(media: MediaSize) => {
          const nextNaturalSize = { width: media.naturalWidth, height: media.naturalHeight };
          setNaturalSize(nextNaturalSize);
          announceLoadState('ready');
          onMediaLoaded?.(nextNaturalSize);
        }}
        onZoomChange={next => {
          if (!interactionDisabled) commitZoom(next, interactionSourceRef.current);
        }}
        disableAutomaticStylesInjection
        restrictPosition
        roundCropAreaPixels
        setImageRef={(ref: RefObject<HTMLImageElement>) => {
          imageRef.current = ref.current;
        }}
        showGrid={showGrid}
        zoom={zoom}
        zoomWithScroll={zoomWithScroll && !interactionDisabled}
        key={`${sourceUrl}:${attempt}`}
      /> : null}

      {loadState === 'loading' ? <div className="inkra-image-cropper__state" role="status">
        <PencilIcon
          aria-hidden="true"
          className="inkra-image-cropper__spinner"
          paths={loadingPaths}
          seed={`${resolvedId}-loading`}
          size={40}
          sourceSize={24}
        />
        <PencilText>{labels.loading}</PencilText>
      </div> : null}

      {loadState === 'error' ? <div className="inkra-image-cropper__state" role="alert">
        <PencilIcon decorative paths={imageOffPaths} size={48} sourceSize={24} />
        <PencilText as="h3">{labels.failedTitle}</PencilText>
        <PencilText as="p">{labels.failedDescription}</PencilText>
        <Button variant="outline" onClick={() => {
          setAttempt(current => current + 1);
          announceLoadState('loading');
        }}>{labels.retry}</Button>
      </div> : null}

      {sourceUrl && loadState !== 'error' ? <img
        alt=""
        aria-hidden="true"
        className="inkra-image-cropper__load-probe"
        crossOrigin={crossOrigin}
        key={`probe:${sourceUrl}:${attempt}`}
        onError={() => {
          const error = new Error('The crop image could not be loaded.');
          announceLoadState('error');
          onLoadError?.(error);
        }}
        referrerPolicy={referrerPolicy}
        src={sourceUrl}
      /> : null}
    </div>

    <span className="inkra-image-cropper__instructions" id={`${resolvedId}-instructions`}>
      {labels.instructions}
    </span>

    {showControls ? <div className="inkra-image-cropper__controls">
      <label className="inkra-image-cropper__control">
        <span className="inkra-image-cropper__control-label">
          <PencilText>{labels.zoom}</PencilText>
          <output>{Math.round(zoom * 100)}%</output>
        </span>
        <Slider
          aria-label={labels.zoom}
          disabled={interactionDisabled}
          getValueLabel={value => `${Math.round(value * 100)}%`}
          max={maxZoom}
          min={minZoom}
          onValueChange={values => commitZoom(values[0], 'control')}
          step={zoomStep}
          value={[zoom]}
        />
      </label>

      {aspect === 'free' && freeCropAreaSize ? <div className="inkra-image-cropper__free-controls">
        {(['width', 'height'] as const).map(axis => {
          const label = axis === 'width' ? labels.cropWidth : labels.cropHeight;
          const maximum = Math.max(MIN_FREE_CROP_SIZE, axis === 'width' ? stageSize.width : stageSize.height);
          return <label className="inkra-image-cropper__control" key={axis}>
            <span className="inkra-image-cropper__control-label">
              <PencilText>{label}</PencilText>
              <output>{Math.round(freeCropAreaSize[axis])}px</output>
            </span>
            <Slider
              aria-label={label}
              disabled={interactionDisabled}
              max={maximum}
              min={MIN_FREE_CROP_SIZE}
              onValueChange={values => commitCropAreaSize({ ...freeCropAreaSize, [axis]: values[0] }, 'control')}
              step={4}
              value={[Math.min(maximum, freeCropAreaSize[axis])]}
            />
          </label>;
        })}
      </div> : null}

      <div className="inkra-image-cropper__actions">
        <Button
          aria-label={labels.reset}
          disabled={interactionDisabled}
          onClick={() => reset()}
          size="icon-sm"
          title={labels.reset}
          variant="outline"
        ><PencilIcon decorative paths={resetPaths} size={22} sourceSize={24} /></Button>
        {showExport ? <Button
          aria-label={labels.export}
          disabled={interactionDisabled || selectionRef.current === null}
          loading={exporting}
          onClick={() => void handleExport()}
          startIcon={<PencilIcon decorative paths={downloadPaths} size={22} sourceSize={24} />}
          variant="primary"
        >{exporting ? labels.exporting : labels.export}</Button> : null}
      </div>
    </div> : null}
  </div>;
});

export {
  IMAGE_CROPPER_DEFAULT_OUTPUT_PIXELS,
  IMAGE_CROPPER_MAX_OUTPUT_EDGE,
  IMAGE_CROPPER_MAX_OUTPUT_PIXELS,
  ImageCropperExportError,
  clampImageCropperArea,
  exportImageCrop,
  resolveImageCropperOutputSize,
} from './model.js';
export type {
  ImageCropperArea,
  ImageCropperExportErrorCode,
  ImageCropperExportOptions,
  ImageCropperExportType,
  ImageCropperPoint,
  ImageCropperSize,
} from './model.js';
