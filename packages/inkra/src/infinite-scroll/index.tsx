import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from 'react';

import { Button } from '../Button.js';
import { Progress } from '../display/index.js';
import { useInkraLocale } from '../i18n/index.js';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { createInfiniteScrollGesture } from './gesture.js';
import {
  boundarySignature,
  completeDirectionalRecord,
  directionalValue,
  finiteDistance,
  gestureStatusEnabled,
  infiniteScrollDirections,
  localScrollDelta,
  normalizeDirections,
  physicalBoundaryDistance,
  pullProgress,
  statusAfterCancellation,
  type InfiniteScrollDirection,
  type InfiniteScrollLoadSource,
  type InfiniteScrollStatus,
} from './model.js';

export type { InfiniteScrollDirection, InfiniteScrollLoadSource, InfiniteScrollStatus } from './model.js';
export type InfiniteScrollDirectional<T> = T | Partial<Record<InfiniteScrollDirection, T>>;

export interface InfiniteScrollDirectionState {
  status: InfiniteScrollStatus;
  error?: unknown;
}

export interface InfiniteScrollLoadContext {
  direction: InfiniteScrollDirection;
  source: InfiniteScrollLoadSource;
  signal: AbortSignal;
  scrollContainer: HTMLElement;
}

export interface InfiniteScrollStateChangeDetails {
  source?: InfiniteScrollLoadSource;
  error?: unknown;
  reason?: 'container-changed' | 'direction-removed' | 'disabled';
}

export interface InfiniteScrollAnchorContext {
  direction: 'top' | 'left';
  scrollContainer: HTMLElement;
  content: HTMLElement;
}

export interface InfiniteScrollIndicatorRenderProps {
  direction: InfiniteScrollDirection;
  status: InfiniteScrollStatus;
  progress: number;
  error?: unknown;
  label: string;
  retry: () => void;
  load: () => void;
}

export type InfiniteScrollLabelKey = InfiniteScrollStatus | 'retry' | 'loadMore';

export interface InfiniteScrollProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onLoad'> {
  directions?: InfiniteScrollDirection | readonly InfiniteScrollDirection[];
  onLoad: (context: InfiniteScrollLoadContext) => void | Promise<void>;
  state?: Partial<Record<InfiniteScrollDirection, InfiniteScrollDirectionState>>;
  defaultState?: Partial<Record<InfiniteScrollDirection, InfiniteScrollDirectionState>>;
  onStateChange?: (
    direction: InfiniteScrollDirection,
    state: InfiniteScrollDirectionState,
    details: InfiniteScrollStateChangeDetails,
  ) => void;
  hasMore?: InfiniteScrollDirectional<boolean>;
  disabled?: InfiniteScrollDirectional<boolean>;
  automatic?: InfiniteScrollDirectional<boolean>;
  scrollContainer?: HTMLElement | null | (() => HTMLElement | null);
  triggerDistance?: InfiniteScrollDirectional<number>;
  gestureThreshold?: InfiniteScrollDirectional<number>;
  gesture?: InfiniteScrollDirectional<boolean>;
  systemGestureInset?: number;
  getAnchor?: (context: InfiniteScrollAnchorContext) => HTMLElement | null;
  renderIndicator?: (props: InfiniteScrollIndicatorRenderProps) => ReactNode;
  labels?: Partial<Record<InfiniteScrollLabelKey, string>>;
  errorContent?: ReactNode | ((direction: InfiniteScrollDirection, error: unknown) => ReactNode);
  endContent?: ReactNode | ((direction: InfiniteScrollDirection) => ReactNode);
}

type StateMap = Record<InfiniteScrollDirection, InfiniteScrollDirectionState>;
type PullState = { direction: InfiniteScrollDirection | null; distance: number; progress: number };
type InfiniteScrollStyle = CSSProperties & Record<`--inkra-infinite-scroll-${string}`, string>;
interface ActiveRequest {
  controller: AbortController;
  anchor: AnchorStabilizer;
  container: HTMLElement;
  source: InfiniteScrollLoadSource;
}

const localeCopy = {
  'en-US': {
    top: { idle: 'Load earlier items', pulling: 'Pull down to load', ready: 'Release to load', loading: 'Loading earlier items', error: 'Earlier items could not be loaded', end: 'Beginning reached' },
    bottom: { idle: 'Load more items', pulling: 'Pull up to load', ready: 'Release to load', loading: 'Loading more items', error: 'More items could not be loaded', end: 'End reached' },
    left: { idle: 'Load items on the left', pulling: 'Pull right to load', ready: 'Release to load', loading: 'Loading left items', error: 'Left items could not be loaded', end: 'Left edge reached' },
    right: { idle: 'Load items on the right', pulling: 'Pull left to load', ready: 'Release to load', loading: 'Loading right items', error: 'Right items could not be loaded', end: 'Right edge reached' },
    retry: 'Retry', loadMore: 'Load more',
  },
  'zh-CN': {
    top: { idle: '加载更早内容', pulling: '下拉加载', ready: '松手加载', loading: '正在加载更早内容', error: '更早内容加载失败', end: '已到开头' },
    bottom: { idle: '加载更多内容', pulling: '上拉加载', ready: '松手加载', loading: '正在加载更多内容', error: '更多内容加载失败', end: '已到末尾' },
    left: { idle: '加载左侧内容', pulling: '向右拉动加载', ready: '松手加载', loading: '正在加载左侧内容', error: '左侧内容加载失败', end: '已到左侧边界' },
    right: { idle: '加载右侧内容', pulling: '向左拉动加载', ready: '松手加载', loading: '正在加载右侧内容', error: '右侧内容加载失败', end: '已到右侧边界' },
    retry: '重试', loadMore: '加载更多',
  },
  'ja-JP': {
    top: { idle: '前の項目を読み込む', pulling: '下に引いて読み込む', ready: '離して読み込む', loading: '前の項目を読み込み中', error: '前の項目を読み込めませんでした', end: '先頭です' },
    bottom: { idle: 'さらに読み込む', pulling: '上に引いて読み込む', ready: '離して読み込む', loading: '読み込み中', error: '読み込めませんでした', end: '末尾です' },
    left: { idle: '左側を読み込む', pulling: '右に引いて読み込む', ready: '離して読み込む', loading: '左側を読み込み中', error: '左側を読み込めませんでした', end: '左端です' },
    right: { idle: '右側を読み込む', pulling: '左に引いて読み込む', ready: '離して読み込む', loading: '右側を読み込み中', error: '右側を読み込めませんでした', end: '右端です' },
    retry: '再試行', loadMore: 'さらに読み込む',
  },
  'ko-KR': {
    top: { idle: '이전 항목 불러오기', pulling: '아래로 당겨 불러오기', ready: '놓아서 불러오기', loading: '이전 항목 불러오는 중', error: '이전 항목을 불러오지 못했습니다', end: '처음입니다' },
    bottom: { idle: '항목 더 불러오기', pulling: '위로 당겨 불러오기', ready: '놓아서 불러오기', loading: '불러오는 중', error: '항목을 불러오지 못했습니다', end: '마지막입니다' },
    left: { idle: '왼쪽 항목 불러오기', pulling: '오른쪽으로 당겨 불러오기', ready: '놓아서 불러오기', loading: '왼쪽 항목 불러오는 중', error: '왼쪽 항목을 불러오지 못했습니다', end: '왼쪽 끝입니다' },
    right: { idle: '오른쪽 항목 불러오기', pulling: '왼쪽으로 당겨 불러오기', ready: '놓아서 불러오기', loading: '오른쪽 항목 불러오는 중', error: '오른쪽 항목을 불러오지 못했습니다', end: '오른쪽 끝입니다' },
    retry: '다시 시도', loadMore: '더 불러오기',
  },
  'fr-FR': {
    top: { idle: 'Charger les éléments précédents', pulling: 'Tirez vers le bas pour charger', ready: 'Relâchez pour charger', loading: 'Chargement des éléments précédents', error: 'Impossible de charger les éléments précédents', end: 'Début atteint' },
    bottom: { idle: 'Charger plus d’éléments', pulling: 'Tirez vers le haut pour charger', ready: 'Relâchez pour charger', loading: 'Chargement en cours', error: 'Impossible de charger plus d’éléments', end: 'Fin atteinte' },
    left: { idle: 'Charger les éléments à gauche', pulling: 'Tirez vers la droite pour charger', ready: 'Relâchez pour charger', loading: 'Chargement à gauche', error: 'Impossible de charger les éléments à gauche', end: 'Bord gauche atteint' },
    right: { idle: 'Charger les éléments à droite', pulling: 'Tirez vers la gauche pour charger', ready: 'Relâchez pour charger', loading: 'Chargement à droite', error: 'Impossible de charger les éléments à droite', end: 'Bord droit atteint' },
    retry: 'Réessayer', loadMore: 'Charger plus',
  },
} as const;

function copyLocale(locale: string) {
  if (locale.toLowerCase().startsWith('zh')) return localeCopy['zh-CN'];
  if (locale.toLowerCase().startsWith('ja')) return localeCopy['ja-JP'];
  if (locale.toLowerCase().startsWith('ko')) return localeCopy['ko-KR'];
  if (locale.toLowerCase().startsWith('fr')) return localeCopy['fr-FR'];
  return localeCopy['en-US'];
}

function resolveContainer(
  value: InfiniteScrollProps['scrollContainer'],
  root: HTMLElement | null,
): HTMLElement | null {
  if (typeof value === 'function') return value();
  return value ?? root;
}

function visibleAnchor(content: HTMLElement, container: HTMLElement, direction: 'top' | 'left') {
  const viewport = container.getBoundingClientRect();
  const marked = Array.from(content.querySelectorAll<HTMLElement>('[data-infinite-scroll-anchor]'));
  const candidates = marked.length ? marked : Array.from(content.children).filter((node): node is HTMLElement => node instanceof HTMLElement);
  const visible = candidates.filter(node => {
    const rect = node.getBoundingClientRect();
    return direction === 'top'
      ? rect.bottom > viewport.top && rect.top < viewport.bottom
      : rect.right > viewport.left && rect.left < viewport.right;
  });
  visible.sort((a, b) => {
    const first = a.getBoundingClientRect();
    const second = b.getBoundingClientRect();
    return direction === 'top' ? first.top - second.top : first.left - second.left;
  });
  return visible[0] ?? null;
}

interface AnchorStabilizer { settle: () => Promise<void>; abort: () => void }

function createAnchorStabilizer(
  direction: 'top' | 'left',
  container: HTMLElement,
  content: HTMLElement,
  getAnchor: InfiniteScrollProps['getAnchor'],
): AnchorStabilizer {
  const view = container.ownerDocument.defaultView;
  let anchor: HTMLElement | null = getAnchor?.({ direction, scrollContainer: container, content }) ?? visibleAnchor(content, container, direction);
  if (!view || !anchor) return { settle: async () => {}, abort: () => {} };
  const key = anchor.dataset.infiniteScrollAnchor;
  const offset = () => {
    const viewport = container.getBoundingClientRect();
    const rect = anchor?.getBoundingClientRect();
    return rect ? (direction === 'top' ? rect.top - viewport.top : rect.left - viewport.left) : 0;
  };
  let expected = offset();
  let frame = 0;
  let stopped = false;
  let correcting = false;

  const findReplacement = () => {
    if (anchor?.isConnected) return anchor;
    if (!key) return null;
    return Array.from(content.querySelectorAll<HTMLElement>('[data-infinite-scroll-anchor]'))
      .find(node => node.dataset.infiniteScrollAnchor === key) ?? null;
  };
  const measure = () => {
    frame = 0;
    if (stopped) return;
    anchor = findReplacement();
    if (!anchor) return;
    const current = offset();
    const delta = current - expected;
    if (Math.abs(delta) > 0.5) {
      correcting = true;
      const scrollDelta = localScrollDelta(container, direction, delta);
      container.scrollBy(direction === 'top' ? { top: scrollDelta, behavior: 'auto' } : { left: scrollDelta, behavior: 'auto' });
      expected = offset();
    }
  };
  const schedule = () => {
    if (!frame && !stopped) frame = view.requestAnimationFrame(measure);
  };
  const onScroll = () => {
    if (correcting) correcting = false;
    anchor = findReplacement();
    if (anchor) expected = offset();
  };
  container.addEventListener('scroll', onScroll, { passive: true });
  const mutation = typeof MutationObserver === 'undefined' ? null : new MutationObserver(schedule);
  mutation?.observe(content, { childList: true, subtree: true });
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
  resize?.observe(content);
  resize?.observe(anchor);
  const root = content.closest<HTMLElement>('.inkra-infinite-scroll');
  if (root) for (const child of Array.from(root.children)) resize?.observe(child);

  const abort = () => {
    if (stopped) return;
    stopped = true;
    if (frame) view.cancelAnimationFrame(frame);
    container.removeEventListener('scroll', onScroll);
    mutation?.disconnect();
    resize?.disconnect();
  };
  const settle = () => new Promise<void>(resolve => {
    schedule();
    view.requestAnimationFrame(() => view.requestAnimationFrame(() => {
      measure();
      abort();
      resolve();
    }));
  });
  return { settle, abort };
}

function explicitDirectionalBoolean(
  value: InfiniteScrollProps['gesture'],
  direction: InfiniteScrollDirection,
): boolean {
  if (value === true) return true;
  return typeof value === 'object' && value !== null && value[direction] === true;
}

export const InfiniteScroll = forwardRef<HTMLDivElement, InfiniteScrollProps>(function InfiniteScroll(
  props,
  forwardedRef,
) {
  const {
    automatic,
    children,
    className,
    defaultState,
    disabled,
    directions: directionsProp,
    errorContent,
    endContent,
    getAnchor,
    gesture,
    gestureThreshold,
    hasMore,
    labels,
    onLoad: loadHandler,
    onStateChange,
    renderIndicator,
    scrollContainer,
    state,
    style,
    systemGestureInset = 24,
    triggerDistance,
    onTouchStart,
    ...domProps
  } = props;
  const { locale } = useInkraLocale();
  const copy = copyLocale(locale);
  const directions = useMemo(() => normalizeDirections(directionsProp), [directionsProp]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const sentinelRefs = useRef<Record<InfiniteScrollDirection, HTMLDivElement | null>>({ top: null, bottom: null, left: null, right: null });
  const [internalState, setInternalState] = useState<StateMap>(() => completeDirectionalRecord(
    defaultState,
    () => ({ status: 'idle' }),
  ));
  const [pull, setPull] = useState<PullState>({ direction: null, distance: 0, progress: 0 });
  const propsRef = useRef(props);
  const internalStateRef = useRef(internalState);
  const requests = useRef(new Map<InfiniteScrollDirection, ActiveRequest>());
  const lastBoundary = useRef(new Map<InfiniteScrollDirection, string>());
  const scheduleBoundaryRef = useRef<() => void>(() => {});
  const pullStatus = useRef<InfiniteScrollStatus>('idle');
  const pullDirection = useRef<InfiniteScrollDirection | null>(null);
  const [containerNode, setContainerNode] = useState<HTMLElement | null>(null);
  const containerNodeRef = useRef<HTMLElement | null>(null);

  useBrowserLayoutEffect(() => { propsRef.current = props; internalStateRef.current = internalState; });

  const setRoot = useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);

  const currentState = useCallback((direction: InfiniteScrollDirection) =>
    propsRef.current.state?.[direction] ?? internalStateRef.current[direction], []);

  const transition = useCallback((
    direction: InfiniteScrollDirection,
    next: InfiniteScrollDirectionState,
    details: InfiniteScrollStateChangeDetails = {},
  ) => {
    setInternalState(current => {
      if (propsRef.current.state?.[direction] !== undefined) return current;
      const updated = { ...current, [direction]: next };
      internalStateRef.current = updated;
      return updated;
    });
    propsRef.current.onStateChange?.(direction, next, details);
  }, []);

  const cancelDirection = useCallback((
    direction: InfiniteScrollDirection,
    reason: NonNullable<InfiniteScrollStateChangeDetails['reason']>,
  ) => {
    const request = requests.current.get(direction);
    request?.controller.abort();
    request?.anchor.abort();
    requests.current.delete(direction);
    const status = currentState(direction).status;
    const nextStatus = statusAfterCancellation(status);
    if (nextStatus !== status) transition(direction, { status: nextStatus }, { source: request?.source, reason });
  }, [currentState, transition]);

  const runLoad = useCallback((direction: InfiniteScrollDirection, source: InfiniteScrollLoadSource) => {
    const latest = propsRef.current;
    const root = rootRef.current;
    const content = contentRef.current;
    const container = resolveContainer(latest.scrollContainer, root);
    if (!root || !content || !container || requests.current.has(direction)) return;
    if (directionalValue(latest.disabled, direction, false) || !directionalValue(latest.hasMore, direction, true)) return;
    const status = currentState(direction).status;
    if (status === 'loading' || status === 'end' || (status === 'error' && source === 'boundary')) return;

    const controller = new AbortController();
    const anchor = direction === 'top' || direction === 'left'
      ? createAnchorStabilizer(direction, container, content, latest.getAnchor)
      : { settle: async () => {}, abort: () => {} };
    requests.current.set(direction, { controller, anchor, container, source });
    transition(direction, { status: 'loading' }, { source });
    Promise.resolve().then(() => {
      if (controller.signal.aborted) return undefined;
      return latest.onLoad({ direction, source, signal: controller.signal, scrollContainer: container });
    })
      .then(async () => {
        if (controller.signal.aborted) return;
        await anchor.settle();
        if (controller.signal.aborted) return;
        const more = directionalValue(propsRef.current.hasMore, direction, true);
        transition(direction, { status: more ? 'idle' : 'end' }, { source });
      })
      .catch(error => {
        anchor.abort();
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
        transition(direction, { status: 'error', error }, { source, error });
      })
      .finally(() => {
        const request = requests.current.get(direction);
        if (request?.controller === controller) requests.current.delete(direction);
        scheduleBoundaryRef.current();
      });
  }, [currentState, transition]);

  const gestureRef = useRef<ReturnType<typeof createInfiniteScrollGesture> | null>(null);
  if (!gestureRef.current) {
    gestureRef.current = createInfiniteScrollGesture(() => {
      const latest = propsRef.current;
      const root = rootRef.current;
      return {
        root,
        container: resolveContainer(latest.scrollContainer, root),
        directions: normalizeDirections(latest.directions),
        isEnabled: direction => !requests.current.has(direction)
          && !directionalValue(latest.disabled, direction, false)
          && directionalValue(latest.hasMore, direction, true)
          && directionalValue(latest.gesture, direction, true)
          && gestureStatusEnabled(currentState(direction).status),
        isExplicitlyEnabled: direction => explicitDirectionalBoolean(latest.gesture, direction),
        threshold: direction => finiteDistance(directionalValue(latest.gestureThreshold, direction, 72), 72, 24),
        sentinel: direction => sentinelRefs.current[direction],
        systemGestureInset: finiteDistance(latest.systemGestureInset, 24),
        onPull: (direction, distance, threshold, ready) => {
          const nextStatus: InfiniteScrollStatus = direction ? (ready ? 'ready' : 'pulling') : 'idle';
          if (direction && pullStatus.current !== nextStatus) transition(direction, { status: nextStatus });
          if (!direction && pullDirection.current && (pullStatus.current === 'pulling' || pullStatus.current === 'ready')) {
            const status = currentState(pullDirection.current).status;
            if (gestureStatusEnabled(status)) transition(pullDirection.current, { status: 'idle' });
          }
          pullStatus.current = nextStatus;
          pullDirection.current = direction;
          setPull({ direction, distance, progress: pullProgress(distance, threshold) });
        },
        onCommit: direction => runLoad(direction, 'gesture'),
      };
    });
  }

  useBrowserLayoutEffect(() => {
    const next = resolveContainer(scrollContainer, rootRef.current);
    const previous = containerNodeRef.current;
    if (next === previous) return;
    if (previous) {
      for (const [direction, request] of requests.current) {
        if (request.container === previous) cancelDirection(direction, 'container-changed');
      }
    }
    containerNodeRef.current = next;
    setContainerNode(next);
    gestureRef.current?.cancel();
  });

  useBrowserLayoutEffect(() => {
    const root = rootRef.current;
    const container = resolveContainer(scrollContainer, root) ?? containerNode;
    if (!root || !container) return undefined;
    const view = root.ownerDocument.defaultView;
    let frame = 0;
    const check = () => {
      frame = 0;
      const latest = propsRef.current;
      const activeDirections = normalizeDirections(latest.directions);
      for (const direction of activeDirections) {
        const threshold = finiteDistance(directionalValue(latest.triggerDistance, direction, 160), 160);
        const distance = physicalBoundaryDistance(container, sentinelRefs.current[direction], direction, root);
        if (distance > threshold + 4) {
          lastBoundary.current.delete(direction);
          continue;
        }
        const status = currentState(direction).status;
        if (distance <= threshold && status === 'idle' && !requests.current.has(direction)
          && directionalValue(latest.automatic, direction, true)
          && !directionalValue(latest.disabled, direction, false)
          && directionalValue(latest.hasMore, direction, true)) {
          const signature = boundarySignature(container, root);
          if (lastBoundary.current.get(direction) !== signature) {
            lastBoundary.current.set(direction, signature);
            runLoad(direction, 'boundary');
          }
        }
      }
    };
    const schedule = () => {
      if (!frame && view) frame = view.requestAnimationFrame(check);
      else if (!view) check();
    };
    scheduleBoundaryRef.current = schedule;
    const handleScroll = (event: Event) => {
      schedule();
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    resize?.observe(container);
    resize?.observe(root);
    const mutation = typeof MutationObserver === 'undefined' ? null : new MutationObserver(schedule);
    mutation?.observe(contentRef.current ?? root, { childList: true, subtree: true });
    schedule();
    return () => {
      if (frame && view) view.cancelAnimationFrame(frame);
      container.removeEventListener('scroll', handleScroll);
      resize?.disconnect();
      mutation?.disconnect();
      if (scheduleBoundaryRef.current === schedule) scheduleBoundaryRef.current = () => {};
    };
  }, [containerNode, scrollContainer, directionsProp, automatic, disabled, hasMore, triggerDistance, currentState, runLoad]);

  useBrowserLayoutEffect(() => {
    for (const direction of infiniteScrollDirections) {
      if (!directions.includes(direction) || directionalValue(disabled, direction, false)) {
        cancelDirection(direction, directions.includes(direction) ? 'disabled' : 'direction-removed');
      }
    }
    gestureRef.current?.cancel();
  }, [directions, disabled, gesture, gestureThreshold, scrollContainer, cancelDirection]);

  useBrowserLayoutEffect(() => () => {
    gestureRef.current?.dispose();
    for (const request of requests.current.values()) {
      request.controller.abort();
      request.anchor.abort();
    }
    requests.current.clear();
  }, []);

  const labelFor = (direction: InfiniteScrollDirection, status: InfiniteScrollStatus) =>
    labels?.[status] ?? copy[direction][status];
  const renderDefaultIndicator = (
    direction: InfiniteScrollDirection,
    status: InfiniteScrollStatus,
    progress: number,
    error: unknown,
  ) => {
    const label = labelFor(direction, status);
    if (status === 'loading') return <Progress aria-label={label} label={label} size="sm" value={null} />;
    if (status === 'pulling' || status === 'ready') {
      return <Progress aria-label={label} label={label} max={100} size="sm" value={progress * 100} />;
    }
    if (status === 'error') return <>
      {typeof errorContent === 'function' ? errorContent(direction, error) : errorContent ?? <PencilText>{label}</PencilText>}
      <Button size="sm" variant="outline" onClick={() => runLoad(direction, 'retry')}>{labels?.retry ?? copy.retry}</Button>
    </>;
    if (status === 'end') {
      return typeof endContent === 'function' ? endContent(direction) : endContent ?? <PencilText>{label}</PencilText>;
    }
    return <Button
      aria-label={label}
      size="sm"
      variant="ghost"
      onClick={() => runLoad(direction, 'button')}
    >{labels?.loadMore ?? label}</Button>;
  };

  const indicator = (direction: InfiniteScrollDirection) => {
    const active = directions.includes(direction);
    const resolved = state?.[direction] ?? internalState[direction];
    const directionHasMore = directionalValue(hasMore, direction, true);
    const status = directionHasMore ? resolved.status : 'end';
    const progress = pull.direction === direction ? pull.progress : status === 'ready' ? 1 : 0;
    const label = labelFor(direction, status);
    const content = renderIndicator?.({
      direction,
      status,
      progress,
      error: resolved.error,
      label,
      retry: () => runLoad(direction, 'retry'),
      load: () => runLoad(direction, 'button'),
    }) ?? renderDefaultIndicator(direction, status, progress, resolved.error);
    return <div
      aria-hidden={!active || undefined}
      aria-live={active ? 'polite' : undefined}
      className="inkra-infinite-scroll__indicator"
      data-active={active || undefined}
      data-direction={direction}
      data-status={active ? status : undefined}
      ref={node => { sentinelRefs.current[direction] = node; }}
    >{active && <PencilSurface as="div" className="inkra-infinite-scroll__indicator-surface" variant="quiet" radius={8}>
      <div className="inkra-infinite-scroll__indicator-content">{content}</div>
      <PencilLine className="inkra-infinite-scroll__indicator-line" orientation={direction === 'left' || direction === 'right' ? 'vertical' : 'horizontal'} />
    </PencilSurface>}</div>;
  };

  const resolvedStyle: InfiniteScrollStyle = {
    ...style,
    '--inkra-infinite-scroll-pull-distance': `${pull.distance}px`,
  };

  return <div
    {...domProps}
    className={['inkra-infinite-scroll', className].filter(Boolean).join(' ')}
    data-pull-direction={pull.direction ?? undefined}
    onTouchStart={(event: ReactTouchEvent<HTMLDivElement>) => {
      onTouchStart?.(event);
      if (!event.defaultPrevented) gestureRef.current?.start(event.nativeEvent);
    }}
    ref={setRoot}
    style={resolvedStyle}
  >
    {indicator('top')}
    <div className="inkra-infinite-scroll__body">
      {indicator('left')}
      <div className="inkra-infinite-scroll__content" ref={contentRef}>{children}</div>
      {indicator('right')}
    </div>
    {indicator('bottom')}
  </div>;
});
