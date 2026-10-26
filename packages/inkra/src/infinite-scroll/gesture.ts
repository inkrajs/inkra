import {
  dampPullDistance,
  directionAxis,
  directionSign,
  hasNestedScrollOwner,
  isEditableOrInteractiveTarget,
  isPageScrollContainer,
  physicalBoundaryDistance,
  type InfiniteScrollDirection,
} from './model.js';

export interface InfiniteScrollGestureOptions {
  root: HTMLElement | null;
  container: HTMLElement | null;
  directions: readonly InfiniteScrollDirection[];
  isEnabled: (direction: InfiniteScrollDirection) => boolean;
  isExplicitlyEnabled: (direction: InfiniteScrollDirection) => boolean;
  threshold: (direction: InfiniteScrollDirection) => number;
  sentinel: (direction: InfiniteScrollDirection) => HTMLElement | null;
  systemGestureInset: number;
  onPull: (
    direction: InfiniteScrollDirection | null,
    distance: number,
    threshold: number,
    ready: boolean,
  ) => void;
  onCommit: (direction: InfiniteScrollDirection) => void;
}

const slop = 8;
const axisRatio = 1.25;

export function createInfiniteScrollGesture(read: () => InfiniteScrollGestureOptions) {
  let cancelCurrent = () => {};
  let clearClick = () => {};
  let cancelWheel = () => {};
  let wheelSession: { direction: InfiniteScrollDirection; distance: number; timer: number } | null = null;

  function wheel(event: WheelEvent) {
    const options = read();
    const { root, container } = options;
    const view = root?.ownerDocument.defaultView;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!root || !container || !view || !target || !root.contains(target)
      || event.defaultPrevented || event.ctrlKey || !event.cancelable
      || isEditableOrInteractiveTarget(target)) return;
    const dx = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
    const dy = event.shiftKey && !event.deltaX ? 0 : event.deltaY;
    const horizontal = Math.abs(dx) > Math.abs(dy) * axisRatio;
    const vertical = Math.abs(dy) > Math.abs(dx) * axisRatio;
    if (!horizontal && !vertical) { cancelWheel(); return; }
    const direction: InfiniteScrollDirection = horizontal ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'top' : 'bottom');
    if (!options.directions.includes(direction) || !options.isEnabled(direction)
      || hasNestedScrollOwner(target, root, container, directionAxis(direction))
      || (isPageScrollContainer(container) && !options.isExplicitlyEnabled(direction))) {
      cancelWheel();
      return;
    }
    if (wheelSession && wheelSession.direction !== direction) cancelWheel();
    // Native scrolling reaches the edge first; only later outward input belongs to the pull.
    if (!wheelSession && physicalBoundaryDistance(container, options.sentinel(direction), direction, root) > 1) return;
    if (!wheelSession) {
      cancelCurrent();
      const session = { direction, distance: 0, timer: 0 };
      wheelSession = session;
      const abort = () => {
        view.clearTimeout(session.timer);
        view.removeEventListener('blur', abort);
        wheelSession = null;
        options.onPull(null, 0, options.threshold(direction), false);
        cancelWheel = () => {};
      };
      cancelWheel = abort;
      view.addEventListener('blur', abort);
    }
    const session = wheelSession;
    const threshold = Math.max(1, options.threshold(direction));
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2
      ? (horizontal ? container.clientWidth : container.clientHeight) : 1;
    const rect = container.getBoundingClientRect();
    const scale = horizontal ? container.clientWidth / (rect.width || container.clientWidth)
      : container.clientHeight / (rect.height || container.clientHeight);
    session.distance += Math.min(Math.abs(horizontal ? dx : dy) * unit * scale, threshold);
    event.preventDefault();
    event.stopPropagation();
    options.onPull(direction, dampPullDistance(session.distance, threshold), threshold, session.distance >= threshold);
    view.clearTimeout(session.timer);
    session.timer = view.setTimeout(() => {
      const latest = read();
      const commit = session.distance >= threshold && root.isConnected
        && latest.root === root && latest.container === container && latest.isEnabled(direction);
      cancelWheel();
      if (commit) latest.onCommit(direction);
    }, 160);
  }

  function start(event: TouchEvent) {
    cancelWheel();
    cancelCurrent();
    clearClick();
    const options = read();
    const { root, container } = options;
    const view = root?.ownerDocument.defaultView;
    if (!root || !container || !view || event.defaultPrevented || event.touches.length !== 1) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target || !root.contains(target) || isEditableOrInteractiveTarget(target)) return;

    const viewportWidth = root.ownerDocument.documentElement.clientWidth || view.innerWidth;
    const touch = event.touches[0];
    const inset = Math.max(0, options.systemGestureInset);
    const page = isPageScrollContainer(container);
    const candidates = options.directions.filter(direction => {
      if (!options.isEnabled(direction)) return false;
      const axis = directionAxis(direction);
      const scrollable = axis === 'vertical'
        ? container.scrollHeight > container.clientHeight + 1
        : container.scrollWidth > container.clientWidth + 1;
      if ((page || (container === root && !scrollable)) && !options.isExplicitlyEnabled(direction)) return false;
      if (physicalBoundaryDistance(container, options.sentinel(direction), direction, root) > 1) return false;
      if (direction === 'left' && touch.clientX <= inset) return false;
      if (direction === 'right' && viewportWidth - touch.clientX <= inset) return false;
      return !hasNestedScrollOwner(target, root, container, axis);
    });
    if (!candidates.length) return;

    const doc = root.ownerDocument;
    const rect = container.getBoundingClientRect();
    const scaleX = rect.width > 0 && container.clientWidth > 0 ? container.clientWidth / rect.width : 1;
    const scaleY = rect.height > 0 && container.clientHeight > 0 ? container.clientHeight / rect.height : 1;
    let direction: InfiniteScrollDirection | null = null;
    let locked = false;
    let stopped = false;
    let rawDistance = 0;
    let threshold = 1;

    const suppressClick = () => {
      clearClick();
      const block = (click: MouseEvent) => {
        if (!click.detail || ('pointerType' in click && click.pointerType !== 'touch')) return;
        click.preventDefault();
        click.stopImmediatePropagation();
        clearClick();
      };
      root.addEventListener('click', block, { capture: true });
      const timer = view.setTimeout(() => clearClick(), 700);
      clearClick = () => {
        root.removeEventListener('click', block, { capture: true });
        view.clearTimeout(timer);
        clearClick = () => {};
      };
    };

    const cleanup = () => {
      if (stopped) return;
      stopped = true;
      doc.removeEventListener('touchstart', multi);
      doc.removeEventListener('touchmove', move);
      doc.removeEventListener('touchend', end);
      doc.removeEventListener('touchcancel', abort);
      view.removeEventListener('blur', abort);
      options.onPull(null, 0, threshold, false);
      if (locked) suppressClick();
      cancelCurrent = () => {};
    };

    const valid = () => {
      const latest = read();
      return root.isConnected && latest.root === root && latest.container === container
        && (!direction || latest.isEnabled(direction));
    };
    const abort = () => cleanup();
    const multi = (next: TouchEvent) => { if (next.touches.length !== 1) cleanup(); };
    const chooseDirection = (dx: number, dy: number) => {
      const horizontal = Math.abs(dx) >= Math.abs(dy) * axisRatio;
      const vertical = Math.abs(dy) >= Math.abs(dx) * axisRatio;
      if (!horizontal && !vertical) return null;
      return candidates.find(candidate => {
        if (horizontal !== (directionAxis(candidate) === 'horizontal')) return false;
        const distance = (horizontal ? dx : dy) * directionSign(candidate);
        return distance > 0;
      }) ?? null;
    };

    const move = (next: TouchEvent) => {
      if (stopped) return;
      const point = Array.from(next.touches).find(item => item.identifier === touch.identifier);
      if (!valid() || next.defaultPrevented || next.touches.length !== 1 || !point) { cleanup(); return; }
      const dx = (point.clientX - touch.clientX) * scaleX;
      const dy = (point.clientY - touch.clientY) * scaleY;
      if (!locked) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < slop) return;
        direction = chooseDirection(dx, dy);
        if (!direction || hasNestedScrollOwner(target, root, container, directionAxis(direction))) {
          cleanup();
          return;
        }
        threshold = Math.max(1, options.threshold(direction));
      }
      if (!next.cancelable || !direction) { cleanup(); return; }
      locked = true;
      rawDistance = Math.max(0, (directionAxis(direction) === 'horizontal' ? dx : dy) * directionSign(direction));
      next.preventDefault();
      options.onPull(direction, dampPullDistance(rawDistance, threshold), threshold, rawDistance >= threshold);
    };

    const end = (next: TouchEvent) => {
      const commit = !next.defaultPrevented && next.touches.length === 0 && valid() && locked
        && direction !== null && rawDistance >= threshold;
      const committedDirection = direction;
      cleanup();
      if (commit && committedDirection) read().onCommit(committedDirection);
    };

    doc.addEventListener('touchstart', multi, { passive: true });
    doc.addEventListener('touchmove', move, { passive: false });
    doc.addEventListener('touchend', end);
    doc.addEventListener('touchcancel', abort);
    view.addEventListener('blur', abort);
    cancelCurrent = cleanup;
  }

  return {
    start,
    wheel,
    cancel: () => { cancelCurrent(); cancelWheel(); },
    dispose: () => { cancelCurrent(); cancelWheel(); clearClick(); },
  };
}
