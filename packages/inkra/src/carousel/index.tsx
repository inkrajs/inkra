import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';
import {
  Children,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  FocusEvent,
  HTMLAttributes,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
} from 'react';

import { Button } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';

const previousPaths = [{ d: 'm15 18-6-6 6-6' }] as const;
const nextPaths = [{ d: 'm9 18 6-6-6-6' }] as const;
const pausePaths = [{ d: 'M8 5v14M16 5v14' }] as const;
const playPaths = [{ d: 'm7 4 12 8-12 8Z' }] as const;

export interface CarouselVisibleItems {
  base?: number;
  sm?: number;
  md?: number;
  lg?: number;
}

export interface CarouselAutoplayOptions {
  delay?: number;
  pauseOnHover?: boolean;
  pauseOnFocus?: boolean;
  stopOnInteraction?: boolean;
  respectReducedMotion?: boolean;
}

export interface CarouselLabels {
  previous?: string;
  next?: string;
  pause?: string;
  play?: string;
  pages?: string;
  empty?: string;
  slide?: (index: number, count: number) => string;
  page?: (index: number, count: number) => string;
  status?: (index: number, count: number) => string;
}

export interface CarouselProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'> {
  children?: ReactNode;
  currentIndex?: number;
  defaultIndex?: number;
  onCurrentIndexChange?: (index: number) => void;
  visibleItems?: number | CarouselVisibleItems;
  gap?: number;
  align?: 'start' | 'center' | 'end';
  loop?: boolean;
  dragFree?: boolean;
  disabled?: boolean;
  controls?: boolean;
  pagination?: boolean;
  autoplay?: boolean | CarouselAutoplayOptions;
  emptyState?: ReactNode;
  labels?: CarouselLabels;
}

export interface CarouselRef {
  root: HTMLDivElement | null;
  previous: () => void;
  next: () => void;
  scrollTo: (index: number) => void;
  play: () => void;
  pause: () => void;
}

type CarouselStyle = CSSProperties & Record<`--inkra-carousel-${string}`, string | number>;

function finiteInteger(value: number | undefined, fallback: number, minimum = 1, maximum = 12): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.round(value!))) : fallback;
}

function clampIndex(value: number | undefined, count: number): number {
  if (count === 0) return 0;
  const index = Number.isFinite(value) ? Math.round(value!) : 0;
  return Math.min(count - 1, Math.max(0, index));
}

function visibleItemValues(value: CarouselProps['visibleItems']): Required<CarouselVisibleItems> {
  if (typeof value === 'number') {
    const fixed = finiteInteger(value, 1);
    return { base: fixed, sm: fixed, md: fixed, lg: fixed };
  }
  const base = finiteInteger(value?.base, 1);
  const sm = finiteInteger(value?.sm, base);
  const md = finiteInteger(value?.md, sm);
  const lg = finiteInteger(value?.lg, md);
  return { base, sm, md, lg };
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export const Carousel = forwardRef<CarouselRef, CarouselProps>(function Carousel(
  {
    'aria-label': ariaLabel = 'Carousel',
    align = 'start',
    autoplay = false,
    children,
    className,
    controls = true,
    currentIndex,
    defaultIndex = 0,
    dir,
    disabled = false,
    dragFree = false,
    emptyState,
    gap = 16,
    labels,
    loop = false,
    onBlurCapture,
    onCurrentIndexChange,
    onFocusCapture,
    onKeyDown,
    onPointerEnter,
    onPointerLeave,
    pagination = true,
    role = 'region',
    style,
    tabIndex,
    visibleItems = { base: 1, sm: 2, md: 3 },
    ...props
  },
  forwardedRef,
) {
  const generatedId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const slideItems = Children.toArray(children);
  const count = slideItems.length;
  const controlled = currentIndex !== undefined;
  const initialIndex = clampIndex(controlled ? currentIndex : defaultIndex, count);
  const [uncontrolledIndex, setUncontrolledIndex] = useState(initialIndex);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [inferredDir, setInferredDir] = useState<'ltr' | 'rtl'>('ltr');
  const [playing, setPlaying] = useState(false);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const userPausedRef = useRef(false);
  const autoplayControlPointerRef = useRef(false);
  const reducedMotion = useReducedMotion();
  const selectionCount = scrollSnaps.length || count;
  const activeIndex = clampIndex(controlled ? currentIndex : uncontrolledIndex, selectionCount);
  const resolvedDir: 'ltr' | 'rtl' = dir === 'rtl' ? 'rtl' : dir === 'ltr' ? 'ltr' : inferredDir;
  const autoplayOptions = typeof autoplay === 'object' ? autoplay : {};
  const stopOnInteraction = autoplayOptions.stopOnInteraction ?? true;
  const autoplayEnabled = Boolean(autoplay) && count > 1 && !disabled;
  const autoplayAllowed = autoplayEnabled && !(autoplayOptions.respectReducedMotion !== false && reducedMotion);
  const requestedVisible = visibleItemValues(visibleItems);
  const visible = count > 0 ? {
    base: Math.min(count, requestedVisible.base),
    sm: Math.min(count, requestedVisible.sm),
    md: Math.min(count, requestedVisible.md),
    lg: Math.min(count, requestedVisible.lg),
  } : requestedVisible;
  const resolvedGap = Number.isFinite(gap) ? Math.max(0, gap) : 16;
  const autoplayActive = Boolean(autoplay);

  const autoplayPlugin = useMemo(() => Autoplay({
    active: autoplayActive,
    delay: Number.isFinite(autoplayOptions.delay) ? Math.max(1000, autoplayOptions.delay!) : 5000,
    playOnInit: false,
    stopOnFocusIn: false,
    stopOnInteraction,
    stopOnMouseEnter: false,
  }), [autoplayActive, autoplayOptions.delay, stopOnInteraction]);

  const plugins = useMemo(() => autoplayActive ? [autoplayPlugin] : [], [autoplayActive, autoplayPlugin]);

  const [viewportRef, emblaApi] = useEmblaCarousel({
    active: !disabled && count > 0,
    align,
    containScroll: 'trimSnaps',
    direction: resolvedDir,
    dragFree,
    loop: loop && count > 1,
    slidesToScroll: 1,
    startIndex: initialIndex,
    watchResize: true,
    watchSlides: true,
  }, plugins);

  const refresh = useCallback(() => {
    if (!emblaApi) return;
    const nextIndex = clampIndex(emblaApi.selectedScrollSnap(), count);
    setSelectedIndex(nextIndex);
    setScrollSnaps(emblaApi.scrollSnapList());
    setCanScrollPrevious(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [count, emblaApi]);

  const select = useCallback(() => {
    if (!emblaApi) return;
    const nextIndex = clampIndex(emblaApi.selectedScrollSnap(), count);
    setSelectedIndex(nextIndex);
    setCanScrollPrevious(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
    if (!controlled) setUncontrolledIndex(nextIndex);
    if (nextIndex !== activeIndex) onCurrentIndexChange?.(nextIndex);
  }, [activeIndex, controlled, count, emblaApi, onCurrentIndexChange]);

  useEffect(() => {
    if (!emblaApi) return undefined;
    refresh();
    emblaApi.on('reInit', refresh);
    emblaApi.on('select', select);
    return () => {
      emblaApi.off('reInit', refresh);
      emblaApi.off('select', select);
    };
  }, [emblaApi, refresh, select]);

  useEffect(() => {
    if (controlled || count === 0) return;
    setUncontrolledIndex(index => clampIndex(index, count));
  }, [controlled, count]);

  useEffect(() => {
    if (!emblaApi || count === 0 || selectedIndex === activeIndex) return;
    emblaApi.scrollTo(activeIndex, reducedMotion);
  }, [activeIndex, count, emblaApi, reducedMotion, selectedIndex]);

  useEffect(() => {
    const root = rootRef.current;
    if (dir || !root) return undefined;
    const update = () => setInferredDir(getComputedStyle(root).direction === 'rtl' ? 'rtl' : 'ltr');
    update();
    const observer = new MutationObserver(update);
    for (let node: HTMLElement | null = root; node; node = node.parentElement) {
      observer.observe(node, { attributes: true, attributeFilter: ['class', 'dir', 'style'] });
    }
    return () => observer.disconnect();
  }, [dir]);

  const pause = useCallback(() => {
    autoplayPlugin.stop();
    setPlaying(false);
  }, [autoplayPlugin]);

  const play = useCallback((explicit = false) => {
    const blockedByHover = autoplayOptions.pauseOnHover !== false && hoveredRef.current;
    const blockedByFocus = autoplayOptions.pauseOnFocus !== false && focusedRef.current;
    if (!autoplayAllowed || (!explicit && (blockedByHover || blockedByFocus))) return;
    autoplayPlugin.play();
    setPlaying(true);
  }, [autoplayAllowed, autoplayOptions.pauseOnFocus, autoplayOptions.pauseOnHover, autoplayPlugin]);

  useEffect(() => {
    if (!emblaApi || !autoplayEnabled) {
      autoplayPlugin.stop();
      setPlaying(false);
      return undefined;
    }
    const updatePlaying = () => setPlaying(autoplayPlugin.isPlaying());
    const stopForInteraction = () => {
      if (!stopOnInteraction) return;
      userPausedRef.current = true;
      pause();
    };
    emblaApi.on('autoplay:play', updatePlaying);
    emblaApi.on('autoplay:stop', updatePlaying);
    emblaApi.on('pointerDown', stopForInteraction);
    if (autoplayAllowed && !userPausedRef.current) play();
    else pause();
    return () => {
      emblaApi.off('autoplay:play', updatePlaying);
      emblaApi.off('autoplay:stop', updatePlaying);
      emblaApi.off('pointerDown', stopForInteraction);
      autoplayPlugin.stop();
    };
  }, [autoplayAllowed, autoplayEnabled, autoplayPlugin, emblaApi, pause, play, stopOnInteraction]);

  const stopForControlInteraction = useCallback(() => {
    if (!autoplayEnabled || !stopOnInteraction) return;
    userPausedRef.current = true;
    pause();
  }, [autoplayEnabled, pause, stopOnInteraction]);
  const previous = useCallback(() => {
    stopForControlInteraction();
    emblaApi?.scrollPrev(reducedMotion);
  }, [emblaApi, reducedMotion, stopForControlInteraction]);
  const next = useCallback(() => {
    stopForControlInteraction();
    emblaApi?.scrollNext(reducedMotion);
  }, [emblaApi, reducedMotion, stopForControlInteraction]);
  const scrollTo = useCallback((index: number) => {
    stopForControlInteraction();
    emblaApi?.scrollTo(clampIndex(index, selectionCount), reducedMotion);
  }, [emblaApi, reducedMotion, selectionCount, stopForControlInteraction]);

  useImperativeHandle(forwardedRef, () => ({ root: rootRef.current, previous, next, scrollTo, play: () => play(true), pause }), [next, pause, play, previous, scrollTo]);

  const resumeAfterTransientPause = () => {
    const blockedByHover = autoplayOptions.pauseOnHover !== false && hoveredRef.current;
    const blockedByFocus = autoplayOptions.pauseOnFocus !== false && focusedRef.current;
    if (!userPausedRef.current && autoplayAllowed && !blockedByHover && !blockedByFocus) play();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.target !== event.currentTarget || disabled || count < 2) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      resolvedDir === 'rtl' ? next() : previous();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      resolvedDir === 'rtl' ? previous() : next();
    } else if (event.key === 'Home') {
      event.preventDefault();
      scrollTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      scrollTo(count - 1);
    }
  };

  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    onPointerEnter?.(event);
    hoveredRef.current = true;
    if (autoplayOptions.pauseOnHover !== false) pause();
  };

  const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    onPointerLeave?.(event);
    hoveredRef.current = false;
    resumeAfterTransientPause();
  };

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    onFocusCapture?.(event);
    focusedRef.current = true;
    if (autoplayControlPointerRef.current) {
      autoplayControlPointerRef.current = false;
      return;
    }
    if (autoplayOptions.pauseOnFocus !== false) pause();
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    onBlurCapture?.(event);
    if (event.currentTarget.contains(event.relatedTarget)) return;
    focusedRef.current = false;
    resumeAfterTransientPause();
  };

  const toggleAutoplay = () => {
    if (playing) {
      userPausedRef.current = true;
      pause();
    } else {
      userPausedRef.current = false;
      play(true);
    }
  };

  const rootStyle: CarouselStyle = {
    ...style,
    '--inkra-carousel-gap': `${resolvedGap}px`,
    '--inkra-carousel-visible-base': visible.base,
    '--inkra-carousel-visible-sm': visible.sm,
    '--inkra-carousel-visible-md': visible.md,
    '--inkra-carousel-visible-lg': visible.lg,
  };
  const slideLabel = labels?.slide ?? ((index: number, total: number) => `Slide ${index} of ${total}`);
  const pageLabel = labels?.page ?? ((index: number, total: number) => `Go to page ${index} of ${total}`);
  const statusLabel = labels?.status ?? ((index: number, total: number) => `Slide ${index} of ${total}`);
  const showNavigation = controls && count > 1;
  const showPagination = pagination && scrollSnaps.length > 1;

  return <div
    {...props}
    aria-label={ariaLabel}
    aria-roledescription="carousel"
    className={['inkra-carousel', className].filter(Boolean).join(' ')}
    data-autoplay={autoplayEnabled || undefined}
    data-disabled={disabled || undefined}
    data-playing={playing || undefined}
    dir={resolvedDir}
    onBlurCapture={handleBlur}
    onFocusCapture={handleFocus}
    onKeyDown={handleKeyDown}
    onPointerEnter={handlePointerEnter}
    onPointerLeave={handlePointerLeave}
    ref={rootRef}
    role={role}
    style={rootStyle}
    tabIndex={!disabled && count > 1 ? (tabIndex ?? 0) : tabIndex}
  >
    {count === 0 ? <div className="inkra-carousel__empty">{emptyState ?? labels?.empty ?? 'No items'}</div> : <>
      <div className="inkra-carousel__viewport" ref={viewportRef}>
        <div className="inkra-carousel__container">
          {slideItems.map((item, index) => <div
            aria-label={slideLabel(index + 1, count)}
            aria-roledescription="slide"
            className="inkra-carousel__slide"
            data-current={index === activeIndex || undefined}
            key={(item as { key?: string | null }).key ?? index}
            role="group"
          >{item}</div>)}
        </div>
      </div>
      {(showNavigation || showPagination || autoplayEnabled) && <div className="inkra-carousel__toolbar">
        {showNavigation && <div className="inkra-carousel__navigation">
          <Button
            aria-label={labels?.previous ?? 'Previous slide'}
            disabled={disabled || !canScrollPrevious}
            onClick={previous}
            size="icon"
            variant="outline"
          ><PencilIcon decorative paths={resolvedDir === 'rtl' ? nextPaths : previousPaths} seed={`${generatedId}-previous`} size={20} sourceSize={24} /></Button>
          <Button
            aria-label={labels?.next ?? 'Next slide'}
            disabled={disabled || !canScrollNext}
            onClick={next}
            size="icon"
            variant="outline"
          ><PencilIcon decorative paths={resolvedDir === 'rtl' ? previousPaths : nextPaths} seed={`${generatedId}-next`} size={20} sourceSize={24} /></Button>
        </div>}
        {showPagination && <div aria-label={labels?.pages ?? 'Carousel pages'} className="inkra-carousel__pagination" role="group">
          {scrollSnaps.map((_, index) => <button
            aria-current={index === selectedIndex ? 'true' : undefined}
            aria-label={pageLabel(index + 1, scrollSnaps.length)}
            className="inkra-carousel__page"
            disabled={disabled}
            key={index}
            onClick={() => scrollTo(index)}
            type="button"
          ><PencilSurface as="span" aria-hidden="true" className="inkra-carousel__page-mark" radius={6} seed={`${generatedId}-page-${index}`} variant={index === selectedIndex ? 'selection' : 'outline'} /></button>)}
        </div>}
        {autoplayEnabled && <Button
          aria-label={playing ? (labels?.pause ?? 'Pause autoplay') : (labels?.play ?? 'Play autoplay')}
          disabled={!autoplayAllowed}
          onClick={toggleAutoplay}
          onPointerDown={() => { autoplayControlPointerRef.current = true; }}
          size="icon"
          variant="ghost"
        ><PencilIcon decorative paths={playing ? pausePaths : playPaths} seed={`${generatedId}-autoplay`} size={20} sourceSize={24} /></Button>}
      </div>}
    </>}
    {count > 0 && <span aria-atomic="true" aria-live={playing ? 'off' : 'polite'} className="inkra-carousel__status">
      {statusLabel(activeIndex + 1, count)}
    </span>}
  </div>;
});

