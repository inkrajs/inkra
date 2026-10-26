export type InfiniteScrollDirection = 'top' | 'bottom' | 'left' | 'right';
export type InfiniteScrollAxis = 'horizontal' | 'vertical';
export type InfiniteScrollStatus = 'idle' | 'pulling' | 'ready' | 'loading' | 'error' | 'end';
export type InfiniteScrollLoadSource = 'boundary' | 'gesture' | 'button' | 'retry';

export const infiniteScrollDirections = ['top', 'bottom', 'left', 'right'] as const;

export function completeDirectionalRecord<T>(
  value: Partial<Record<InfiniteScrollDirection, T>> | undefined,
  fallback: (direction: InfiniteScrollDirection) => T,
): Record<InfiniteScrollDirection, T> {
  return {
    top: value?.top ?? fallback('top'),
    bottom: value?.bottom ?? fallback('bottom'),
    left: value?.left ?? fallback('left'),
    right: value?.right ?? fallback('right'),
  };
}

export function normalizeDirections(
  value: InfiniteScrollDirection | readonly InfiniteScrollDirection[] | undefined,
): InfiniteScrollDirection[] {
  const requested = value === undefined ? ['bottom'] : Array.isArray(value) ? value : [value];
  return infiniteScrollDirections.filter(direction => requested.includes(direction));
}

export function directionAxis(direction: InfiniteScrollDirection): InfiniteScrollAxis {
  return direction === 'top' || direction === 'bottom' ? 'vertical' : 'horizontal';
}

export function directionSign(direction: InfiniteScrollDirection): -1 | 1 {
  return direction === 'top' || direction === 'left' ? 1 : -1;
}

export function directionalValue<T>(
  value: T | Partial<Record<InfiniteScrollDirection, T>> | undefined,
  direction: InfiniteScrollDirection,
  fallback: T,
): T {
  if (value === undefined) return fallback;
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return (value as Partial<Record<InfiniteScrollDirection, T>>)[direction] ?? fallback;
  }
  return value as T;
}

export function finiteDistance(value: number | undefined, fallback: number, minimum = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(minimum, value)
    : fallback;
}

export interface ScrollMetrics {
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  clientHeight: number;
  clientWidth: number;
}

export type RtlScrollType = 'default' | 'negative' | 'reverse';

const rtlScrollTypes = new WeakMap<Document, RtlScrollType>();

export function boundaryDistance(metrics: ScrollMetrics, direction: InfiniteScrollDirection): number {
  if (direction === 'top') return Math.max(0, metrics.scrollTop);
  if (direction === 'bottom') {
    return Math.max(0, metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop);
  }
  // Horizontal browser scroll coordinates differ in RTL. Physical edge
  // detection is performed from sentinels in the component; these values are
  // the LTR/non-negative fallback used when geometry is unavailable.
  if (direction === 'left') return Math.max(0, metrics.scrollLeft);
  return Math.max(0, metrics.scrollWidth - metrics.clientWidth - metrics.scrollLeft);
}

export function physicalHorizontalBoundaryDistance(
  metrics: ScrollMetrics,
  direction: 'left' | 'right',
  rtl = false,
  rtlType: RtlScrollType = 'negative',
): number {
  const maximum = Math.max(0, metrics.scrollWidth - metrics.clientWidth);
  const fromLeft = !rtl ? metrics.scrollLeft
    : rtlType === 'negative' ? maximum + metrics.scrollLeft
      : rtlType === 'reverse' ? maximum - metrics.scrollLeft
        : metrics.scrollLeft;
  const normalized = Math.max(0, Math.min(maximum, fromLeft));
  return direction === 'left' ? normalized : maximum - normalized;
}

function detectRtlScrollType(document: Document): RtlScrollType {
  const cached = rtlScrollTypes.get(document);
  if (cached) return cached;
  if (!document.body || typeof document.createElement !== 'function') return 'negative';
  const outer = document.createElement('div');
  const inner = document.createElement('div');
  Object.assign(outer.style, {
    direction: 'rtl',
    height: '1px',
    overflow: 'scroll',
    position: 'absolute',
    top: '-1000px',
    width: '4px',
  });
  Object.assign(inner.style, { height: '1px', width: '8px' });
  outer.append(inner);
  document.body.append(outer);
  let type: RtlScrollType;
  if (outer.scrollLeft > 0) type = 'default';
  else {
    outer.scrollLeft = 1;
    type = outer.scrollLeft === 0 ? 'negative' : 'reverse';
  }
  outer.remove();
  rtlScrollTypes.set(document, type);
  return type;
}

function scrollBoundaryDistance(container: HTMLElement, direction: InfiniteScrollDirection): number {
  if (direction === 'top' || direction === 'bottom') return boundaryDistance(container, direction);
  const rtl = container.ownerDocument.defaultView?.getComputedStyle(container).direction === 'rtl';
  return physicalHorizontalBoundaryDistance(
    container,
    direction,
    rtl,
    rtl ? detectRtlScrollType(container.ownerDocument) : 'negative',
  );
}

export function dampPullDistance(distance: number, threshold: number): number {
  const safeDistance = finiteDistance(distance, 0);
  const limit = finiteDistance(threshold, 72, 1) * 2;
  // Continuous resistance, bounded to twice the trigger distance even on a long pull.
  return limit * (safeDistance / (limit + safeDistance));
}

export function pullProgress(distance: number, threshold: number): number {
  return Math.max(0, Math.min(1, distance / Math.max(1, threshold)));
}

export function gestureStatusEnabled(status: InfiniteScrollStatus): boolean {
  return status === 'idle' || status === 'pulling' || status === 'ready';
}

export function indicatorVisible(status: InfiniteScrollStatus, automatic: boolean, gesture = false): boolean {
  return status !== 'idle' || (!automatic && !gesture);
}

export function statusAfterCancellation(status: InfiniteScrollStatus): InfiniteScrollStatus {
  return status === 'loading' || status === 'pulling' || status === 'ready' ? 'idle' : status;
}

export function localScrollDelta(
  container: Pick<HTMLElement, 'clientHeight' | 'clientWidth' | 'getBoundingClientRect'>,
  direction: 'top' | 'left',
  physicalDelta: number,
): number {
  const rect = container.getBoundingClientRect();
  const renderedSize = direction === 'top' ? rect.height : rect.width;
  const localSize = direction === 'top' ? container.clientHeight : container.clientWidth;
  return renderedSize > 0 && localSize > 0 ? physicalDelta * localSize / renderedSize : physicalDelta;
}

export function boundarySignature(container: HTMLElement, root: HTMLElement): string {
  return [
    container.scrollWidth,
    container.scrollHeight,
    container.clientWidth,
    container.clientHeight,
    root.childElementCount,
    root.querySelectorAll('[data-infinite-scroll-anchor]').length,
  ].join(':');
}

export function isPageScrollContainer(container: HTMLElement): boolean {
  const doc = container.ownerDocument;
  return container === doc.documentElement || container === doc.body || container === doc.scrollingElement;
}

export function physicalBoundaryDistance(
  container: HTMLElement,
  sentinel: HTMLElement | null,
  direction: InfiniteScrollDirection,
  root?: HTMLElement | null,
): number {
  if (container === root || !sentinel) return scrollBoundaryDistance(container, direction);
  const viewport = container.getBoundingClientRect();
  const edge = sentinel.getBoundingClientRect();
  const scaleX = viewport.width > 0 && container.offsetWidth > 0 ? viewport.width / container.offsetWidth : 1;
  const scaleY = viewport.height > 0 && container.offsetHeight > 0 ? viewport.height / container.offsetHeight : 1;
  const top = viewport.top + container.clientTop * scaleY;
  const left = viewport.left + container.clientLeft * scaleX;
  const bottom = top + container.clientHeight * scaleY;
  const right = left + container.clientWidth * scaleX;
  if (direction === 'top') return Math.abs(top - edge.top) / scaleY;
  if (direction === 'bottom') return Math.abs(edge.bottom - bottom) / scaleY;
  if (direction === 'left') return Math.abs(left - edge.left) / scaleX;
  return Math.abs(edge.right - right) / scaleX;
}

export function isEditableOrInteractiveTarget(target: Element | null): boolean {
  return Boolean(target?.closest(
    'input, textarea, select, button, a[href], [contenteditable]:not([contenteditable="false"]), '
    + '[role="slider"], [role="spinbutton"], [role="combobox"], [role="listbox"], '
    + 'video, audio, [data-infinite-scroll-gesture-ignore]',
  ));
}

export function hasNestedScrollOwner(
  target: HTMLElement,
  root: HTMLElement,
  container: HTMLElement,
  axis: InfiniteScrollAxis,
): boolean {
  const view = root.ownerDocument.defaultView;
  if (!view) return false;
  for (let node: HTMLElement | null = target; node && node !== root && node !== container; node = node.parentElement) {
    const style = view.getComputedStyle(node);
    if (axis === 'vertical') {
      if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll|overlay/.test(style.overflowY)) return true;
    } else if (node.scrollWidth > node.clientWidth + 1 && /auto|scroll|overlay/.test(style.overflowX)) return true;
  }
  return false;
}
