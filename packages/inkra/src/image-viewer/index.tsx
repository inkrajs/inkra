import { __iconData as chevronLeftIcon } from 'lucide-react/dist/esm/icons/chevron-left.mjs';
import { __iconData as chevronRightIcon } from 'lucide-react/dist/esm/icons/chevron-right.mjs';
import { __iconData as imageOffIcon } from 'lucide-react/dist/esm/icons/image-off.mjs';
import { __iconData as rotateIcon } from 'lucide-react/dist/esm/icons/rotate-cw.mjs';
import { __iconData as zoomInIcon } from 'lucide-react/dist/esm/icons/zoom-in.mjs';
import { __iconData as zoomOutIcon } from 'lucide-react/dist/esm/icons/zoom-out.mjs';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ComponentPropsWithoutRef,
  ComponentRef,
  KeyboardEvent,
  ReactNode,
} from 'react';

import { Button } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { PanZoom } from '../pan-zoom/index.js';
import type { PanZoomRef, PanZoomWheelMode } from '../pan-zoom/index.js';
import {
  OverlayBackdrop,
  OverlayContent,
  OverlayDescription,
  OverlayHeader,
  OverlayPortal,
  OverlayRoot,
  OverlayTitle,
  OverlayTrigger,
} from '../overlay/index.js';
import type {
  OverlayContentProps,
  OverlayRootProps,
  OverlayTriggerProps,
} from '../overlay/index.js';
import { nextImageViewerIndex, resolveImageViewerSelection } from './model.js';

const chevronLeftPaths = chevronLeftIcon.node.map(([, attributes]) => ({ d: attributes.d }));
const chevronRightPaths = chevronRightIcon.node.map(([, attributes]) => ({ d: attributes.d }));
const imageOffPaths = imageOffIcon.node.map(([, attributes]) => ({ d: attributes.d }));
const rotatePaths = rotateIcon.node.map(([, attributes]) => ({ d: attributes.d }));
const zoomInPaths = zoomInIcon.node.map(([, attributes]) => ({ d: attributes.d }));
const zoomOutPaths = zoomOutIcon.node.map(([, attributes]) => ({ d: attributes.d }));

export interface ImageViewerItem {
  id: string;
  src: string;
  alt: string;
  thumbnailSrc?: string;
  thumbnailAlt?: string;
  width?: number;
  height?: number;
}

export type ImageViewerChangeReason =
  | 'previous'
  | 'next'
  | 'thumbnail'
  | 'home'
  | 'end'
  | 'items-change';

export interface ImageViewerChangeDetails {
  item: ImageViewerItem | null;
  reason: ImageViewerChangeReason;
}

export interface ImageViewerRootProps extends Omit<OverlayRootProps, 'open' | 'defaultOpen' | 'onOpenChange'> {
  items: readonly ImageViewerItem[];
  activeId?: string | null;
  defaultActiveId?: string | null;
  onActiveIdChange?: (activeId: string | null, details: ImageViewerChangeDetails) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  loop?: boolean;
}

interface ImageViewerContextValue {
  items: readonly ImageViewerItem[];
  activeItem: ImageViewerItem | null;
  activeIndex: number;
  loop: boolean;
  selectIndex: (index: number, reason: ImageViewerChangeReason) => void;
  step: (direction: -1 | 1) => void;
}

const ImageViewerContext = createContext<ImageViewerContextValue | null>(null);

function useImageViewerContext(): ImageViewerContextValue {
  const context = useContext(ImageViewerContext);
  if (!context) throw new Error('ImageViewer components must be used inside ImageViewer.Root.');
  return context;
}

export function ImageViewerRoot({
  activeId,
  defaultActiveId,
  defaultOpen = false,
  items,
  loop = true,
  onActiveIdChange,
  onOpenChange,
  open,
  ...props
}: ImageViewerRootProps) {
  const activeControlled = activeId !== undefined;
  const openControlled = open !== undefined;
  const [internalActiveId, setInternalActiveId] = useState<string | null>(
    defaultActiveId ?? items[0]?.id ?? null,
  );
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const previousIndexRef = useRef(0);
  const repairRef = useRef('');
  const requestedId = activeControlled ? activeId : internalActiveId;
  const selection = resolveImageViewerSelection(items, requestedId, previousIndexRef.current);

  if (selection.index >= 0) previousIndexRef.current = selection.index;

  const commitActiveId = useCallback((nextId: string | null, reason: ImageViewerChangeReason) => {
    if (!activeControlled) setInternalActiveId(nextId);
    onActiveIdChange?.(nextId, {
      item: items.find(item => item.id === nextId) ?? null,
      reason,
    });
  }, [activeControlled, items, onActiveIdChange]);

  useEffect(() => {
    if (requestedId === selection.activeId) {
      repairRef.current = '';
      return;
    }
    const repairKey = `${String(requestedId)}:${String(selection.activeId)}:${items.map(item => item.id).join('|')}`;
    if (repairRef.current === repairKey) return;
    repairRef.current = repairKey;
    commitActiveId(selection.activeId, 'items-change');
  }, [commitActiveId, items, requestedId, selection.activeId]);

  const selectIndex = useCallback((index: number, reason: ImageViewerChangeReason) => {
    if (items.length === 0) return;
    const nextIndex = Math.min(Math.max(0, index), items.length - 1);
    if (items[nextIndex].id !== selection.activeId) commitActiveId(items[nextIndex].id, reason);
  }, [commitActiveId, items, selection.activeId]);

  const step = useCallback((direction: -1 | 1) => {
    const nextIndex = nextImageViewerIndex(items.length, selection.index, direction, loop);
    if (nextIndex !== selection.index) selectIndex(nextIndex, direction < 0 ? 'previous' : 'next');
  }, [items.length, loop, selectIndex, selection.index]);

  const context = useMemo<ImageViewerContextValue>(() => ({
    items,
    activeItem: selection.index < 0 ? null : items[selection.index],
    activeIndex: selection.index,
    loop,
    selectIndex,
    step,
  }), [items, loop, selectIndex, selection.index, step]);

  return (
    <ImageViewerContext.Provider value={context}>
      <OverlayRoot
        {...props}
        open={openControlled ? open : internalOpen}
        onOpenChange={(nextOpen) => {
          if (!openControlled) setInternalOpen(nextOpen);
          onOpenChange?.(nextOpen);
        }}
      />
    </ImageViewerContext.Provider>
  );
}

export type ImageViewerTriggerProps = OverlayTriggerProps;

export const ImageViewerTrigger = forwardRef<
  ComponentRef<typeof OverlayTrigger>,
  ImageViewerTriggerProps
>(function ImageViewerTrigger(props, ref) {
  return <OverlayTrigger {...props} ref={ref} />;
});

export interface ImageViewerLabels {
  title: string;
  description: string;
  close: string;
  previous: string;
  next: string;
  thumbnails: string;
  imagePosition: (current: number, total: number) => string;
  thumbnail: (item: ImageViewerItem, current: number, total: number) => string;
  failedTitle: string;
  failedDescription: (item: ImageViewerItem) => string;
  retry: string;
  zoomIn: string;
  zoomOut: string;
  resetZoom: string;
  rotate: string;
  panZoom: (item: ImageViewerItem) => string;
  emptyTitle: string;
  emptyDescription: string;
}

const defaultLabels: ImageViewerLabels = {
  title: 'Image viewer',
  description: 'Use the previous and next controls or arrow keys to browse images.',
  close: 'Close image viewer',
  previous: 'Previous image',
  next: 'Next image',
  thumbnails: 'Image thumbnails',
  imagePosition: (current, total) => `${current} of ${total}`,
  thumbnail: (item, current, total) => `Show ${item.alt}, ${current} of ${total}`,
  failedTitle: 'Image unavailable',
  failedDescription: item => `${item.alt} could not be loaded.`,
  retry: 'Retry',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetZoom: 'Reset zoom',
  rotate: 'Rotate clockwise',
  panZoom: item => `Pan and zoom ${item.alt}`,
  emptyTitle: 'No images',
  emptyDescription: 'There are no images to show.',
};

export interface ImageViewerImageRenderProps {
  alt: string;
  className: string;
  height?: number;
  key: string;
  onError: () => void;
  onLoad: () => void;
  src: string;
  width?: number;
}

export interface ImageViewerContentProps extends Omit<OverlayContentProps, 'children' | 'layout'> {
  labels?: Partial<ImageViewerLabels>;
  showThumbnails?: boolean;
  renderImage?: (item: ImageViewerItem, props: ImageViewerImageRenderProps) => ReactNode;
  emptyState?: ReactNode;
  zoomable?: boolean;
  rotatable?: boolean;
  minScale?: number;
  maxScale?: number;
  wheel?: PanZoomWheelMode;
}

function directionFor(node: HTMLElement): 'ltr' | 'rtl' {
  return getComputedStyle(node).direction === 'rtl' ? 'rtl' : 'ltr';
}

export const ImageViewerContent = forwardRef<
  ComponentRef<typeof OverlayContent>,
  ImageViewerContentProps
>(function ImageViewerContent(
  {
    className,
    emptyState,
    labels: labelOverrides,
    onOpenAutoFocus,
    renderImage,
    rotatable = false,
    showThumbnails = true,
    zoomable = true,
    minScale = 0.5,
    maxScale = 6,
    wheel = 'modifier',
    ...props
  },
  forwardedRef,
) {
  const { activeIndex, activeItem, items, loop, selectIndex, step } = useImageViewerContext();
  const labels = { ...defaultLabels, ...labelOverrides };
  const stageRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef(new Map<string, HTMLButtonElement>());
  const panZoomRef = useRef<PanZoomRef>(null);
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [rotation, setRotation] = useState(0);
  const total = items.length;
  const atStart = activeIndex <= 0;
  const atEnd = activeIndex >= total - 1;

  useEffect(() => {
    if (activeItem) thumbnailRefs.current.get(activeItem.id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    setRotation(0);
  }, [activeItem]);

  const handleStageKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const rtl = directionFor(event.currentTarget) === 'rtl';
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(rtl ? 1 : -1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(rtl ? -1 : 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectIndex(0, 'home');
    } else if (event.key === 'End') {
      event.preventDefault();
      selectIndex(total - 1, 'end');
    }
  };

  const selectThumbnail = (index: number, reason: ImageViewerChangeReason = 'thumbnail') => {
    selectIndex(index, reason);
    const item = items[index];
    if (item) requestAnimationFrame(() => thumbnailRefs.current.get(item.id)?.focus());
  };

  const renderDefaultImage = (item: ImageViewerItem, { key, ...imageProps }: ImageViewerImageRenderProps) => (
    <img key={key} {...imageProps} draggable={false} />
  );

  const failed = activeItem ? failedIds.has(activeItem.id) : false;
  const imageProps: ImageViewerImageRenderProps | null = activeItem ? {
    alt: activeItem.alt,
    className: 'inkra-image-viewer__image',
    height: activeItem.height,
    key: `${activeItem.id}:${attempts[activeItem.id] ?? 0}`,
    onError: () => setFailedIds(current => new Set(current).add(activeItem.id)),
    onLoad: () => setFailedIds(current => {
      if (!current.has(activeItem.id)) return current;
      const next = new Set(current);
      next.delete(activeItem.id);
      return next;
    }),
    src: activeItem.src,
    width: activeItem.width,
  } : null;

  return (
    <OverlayPortal>
      <OverlayBackdrop />
      <OverlayContent
        {...props}
        className={['inkra-image-viewer', className].filter(Boolean).join(' ')}
        layout="sections"
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          stageRef.current?.focus();
        }}
        ref={forwardedRef}
        surfaceRadius={8}
      >
        <OverlayHeader closeLabel={labels.close}>
          <OverlayTitle>{labels.title}</OverlayTitle>
          <OverlayDescription className="inkra-image-viewer__description">{labels.description}</OverlayDescription>
          {total > 0 ? <PencilText as="span" className="inkra-image-viewer__counter">
            {labels.imagePosition(activeIndex + 1, total)}
          </PencilText> : null}
        </OverlayHeader>

        <div className="inkra-image-viewer__body">
          {activeItem && imageProps ? <>
            <div
              aria-label={activeItem.alt}
              className="inkra-image-viewer__stage"
              onKeyDown={handleStageKeyDown}
              ref={stageRef}
              tabIndex={0}
            >
              {failed ? <div className="inkra-image-viewer__state" role="alert">
                <PencilIcon decorative paths={imageOffPaths} size={48} sourceSize={24} />
                <PencilText as="h3">{labels.failedTitle}</PencilText>
                <PencilText as="p">{labels.failedDescription(activeItem)}</PencilText>
                <Button variant="outline" onClick={() => {
                  const failedId = activeItem.id;
                  setFailedIds(current => {
                    const next = new Set(current);
                    next.delete(failedId);
                    return next;
                  });
                  setAttempts(current => ({ ...current, [failedId]: (current[failedId] ?? 0) + 1 }));
                }}>{labels.retry}</Button>
              </div> : <PanZoom
                aria-label={labels.panZoom(activeItem)}
                centerOnInit
                className="inkra-image-viewer__pan-zoom"
                fitOnInit="contain"
                key={activeItem.id}
                keyboard={zoomable}
                maxScale={maxScale}
                minScale={minScale}
                pan={zoomable}
                pinch={zoomable}
                readOnly={!zoomable}
                ref={panZoomRef}
                wheel={zoomable ? wheel : 'disabled'}
              >
                <div className="inkra-image-viewer__image-transform" style={{ transform: `rotate(${rotation}deg)` }}>
                  {(renderImage ?? renderDefaultImage)(activeItem, imageProps)}
                </div>
              </PanZoom>}

              {!failed && (zoomable || rotatable) ? <div className="inkra-image-viewer__tools" role="group" aria-label={labels.panZoom(activeItem)} data-pan-zoom-no-drag>
                {zoomable ? <>
                  <Button aria-label={labels.zoomOut} onClick={() => void panZoomRef.current?.zoomOut()} size="icon-sm" variant="outline">
                    <PencilIcon decorative paths={zoomOutPaths} size={24} sourceSize={24} />
                  </Button>
                  <Button aria-label={labels.resetZoom} onClick={() => void panZoomRef.current?.reset()} size="sm" variant="outline">100%</Button>
                  <Button aria-label={labels.zoomIn} onClick={() => void panZoomRef.current?.zoomIn()} size="icon-sm" variant="outline">
                    <PencilIcon decorative paths={zoomInPaths} size={24} sourceSize={24} />
                  </Button>
                </> : null}
                {rotatable ? <Button aria-label={labels.rotate} onClick={() => {
                  setRotation(current => (current + 90) % 360);
                  requestAnimationFrame(() => void panZoomRef.current?.fit({ mode: 'contain' }));
                }} size="icon-sm" variant="outline">
                  <PencilIcon decorative paths={rotatePaths} size={24} sourceSize={24} />
                </Button> : null}
              </div> : null}

              {total > 1 ? <div className="inkra-image-viewer__navigation">
                <Button
                  aria-label={labels.previous}
                  className="inkra-image-viewer__previous"
                  disabled={!loop && atStart}
                  onClick={() => step(-1)}
                  size="icon"
                  variant="outline"
                ><PencilIcon decorative paths={chevronLeftPaths} size={30} sourceSize={24} /></Button>
                <Button
                  aria-label={labels.next}
                  className="inkra-image-viewer__next"
                  disabled={!loop && atEnd}
                  onClick={() => step(1)}
                  size="icon"
                  variant="outline"
                ><PencilIcon decorative paths={chevronRightPaths} size={30} sourceSize={24} /></Button>
              </div> : null}
            </div>
          </> : <div className="inkra-image-viewer__state" ref={stageRef} tabIndex={0}>
            {emptyState ?? <>
              <PencilIcon decorative paths={imageOffPaths} size={48} sourceSize={24} />
              <PencilText as="h3">{labels.emptyTitle}</PencilText>
              <PencilText as="p">{labels.emptyDescription}</PencilText>
            </>}
          </div>}
        </div>

        {showThumbnails && total > 1 ? <div
          aria-label={labels.thumbnails}
          className="inkra-image-viewer__thumbnails"
          role="listbox"
        >
          {items.map((item, index) => {
            const selected = index === activeIndex;
            return <button
              aria-label={labels.thumbnail(item, index + 1, total)}
              aria-selected={selected}
              className="inkra-image-viewer__thumbnail"
              key={item.id}
              onClick={() => selectIndex(index, 'thumbnail')}
              onKeyDown={(event) => {
                const rtl = directionFor(event.currentTarget) === 'rtl';
                let nextIndex = index;
                if (event.key === 'ArrowLeft') nextIndex = nextImageViewerIndex(total, index, rtl ? 1 : -1, loop);
                else if (event.key === 'ArrowRight') nextIndex = nextImageViewerIndex(total, index, rtl ? -1 : 1, loop);
                else if (event.key === 'Home') nextIndex = 0;
                else if (event.key === 'End') nextIndex = total - 1;
                else return;
                event.preventDefault();
                selectThumbnail(nextIndex, event.key === 'Home' ? 'home' : event.key === 'End' ? 'end' : 'thumbnail');
              }}
              ref={(node) => {
                if (node) thumbnailRefs.current.set(item.id, node);
                else thumbnailRefs.current.delete(item.id);
              }}
              role="option"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              <PencilSurface as="span" className="inkra-image-viewer__thumbnail-surface" radius={6} variant={selected ? 'selection' : 'outline'}>
                <img alt="" className="inkra-image-viewer__thumbnail-image" draggable={false} src={item.thumbnailSrc ?? item.src} />
              </PencilSurface>
              <PencilSurface as="span" aria-hidden="true" className="inkra-image-viewer__thumbnail-focus" radius={6} variant="outline" />
            </button>;
          })}
        </div> : null}
      </OverlayContent>
    </OverlayPortal>
  );
});

export const ImageViewer = Object.freeze({
  Root: ImageViewerRoot,
  Trigger: ImageViewerTrigger,
  Content: ImageViewerContent,
});

export { nextImageViewerIndex, resolveImageViewerSelection } from './model.js';
export type { ImageViewerIdentifiable, ImageViewerSelection } from './model.js';
