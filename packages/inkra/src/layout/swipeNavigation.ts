export interface LayoutSwipeNavigation {
  enabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: 'start' | 'end';
  /** Opening starts within this many local CSS pixels of the sidebar edge. */
  edgeWidth?: number;
  /** Minimum horizontal travel before release commits the gesture. */
  threshold?: number;
}

const ignored = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="spinbutton"], [role="combobox"], [role="separator"], [role="listbox"], video, audio, [data-layout-swipe-ignore]';
const positive = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;

// Listen only for the lifetime of one edge/closing gesture. Vertical scroll and
// nested horizontal tools keep their native behavior; no global touch-action override.
export function createLayoutSwipeNavigation(read: () => LayoutSwipeNavigation | undefined) {
  let cancel = () => {};
  let clearClick = () => {};

  function start(event: TouchEvent, root: HTMLElement) {
    clearClick();
    cancel();
    const options = read();
    const view = root.ownerDocument.defaultView;
    if (!options || options.enabled === false || !view || event.defaultPrevented || event.touches.length !== 1) return;
    const target = event.target as HTMLElement | null;
    if (!target?.closest || target.closest(ignored) || target.closest('.inkra-layout') !== root) return;
    for (let node: HTMLElement | null = target; node && node !== root; node = node.parentElement) {
      if (node.scrollWidth > node.clientWidth + 1 && /auto|scroll/.test(view.getComputedStyle(node).overflowX)) return;
    }
    const rect = root.getBoundingClientRect();
    if (!rect.width || !root.clientWidth) return;
    const scale = root.clientWidth / rect.width;
    const touch = event.touches[0];
    const rtl = view.getComputedStyle(root).direction === 'rtl';
    const right = (options.side === 'end') !== rtl;
    const edge = Math.min(root.clientWidth / 2, positive(options.edgeWidth, 24));
    const startX = (touch.clientX - rect.left) * scale;
    if (!options.open && (right ? root.clientWidth - startX : startX) > edge) return;
    const direction = (right ? -1 : 1) * (options.open ? -1 : 1);
    const threshold = positive(options.threshold, 48);
    const doc = root.ownerDocument;
    let locked = false;
    let stopped = false;
    let travel = 0;

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
      stopped = true;
      doc.removeEventListener('touchstart', multi);
      doc.removeEventListener('touchmove', move);
      doc.removeEventListener('touchend', end);
      doc.removeEventListener('touchcancel', abort);
      view.removeEventListener('blur', abort);
      if (locked) suppressClick();
      cancel = () => {};
    };
    const valid = () => {
      const next = read();
      return root.isConnected && next && next.enabled !== false && next.open === options.open
        && (next.side ?? 'start') === (options.side ?? 'start')
        && (view.getComputedStyle(root).direction === 'rtl') === rtl
        && Math.abs(root.getBoundingClientRect().width - rect.width) < 1;
    };
    const abort = () => cleanup();
    const multi = (next: TouchEvent) => { if (next.touches.length !== 1) cleanup(); };
    const move = (next: TouchEvent) => {
      if (stopped) return;
      const point = Array.from(next.touches).find(item => item.identifier === touch.identifier);
      if (!valid() || next.defaultPrevented || next.touches.length !== 1 || !point) { cleanup(); return; }
      const dx = (point.clientX - touch.clientX) * scale;
      const dy = (point.clientY - touch.clientY) * scale;
      if (!locked) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
        if (dx * direction <= 0 || Math.abs(dx) < Math.abs(dy) * 1.25) { cleanup(); return; }
      }
      if (!next.cancelable) { cleanup(); return; }
      locked = true;
      travel = Math.abs(dx) >= Math.abs(dy) * 1.25 ? dx * direction : 0;
      next.preventDefault();
    };
    const end = (next: TouchEvent) => {
      const point = Array.from(next.changedTouches).find(item => item.identifier === touch.identifier);
      const dx = point ? (point.clientX - touch.clientX) * scale : 0;
      const dy = point ? (point.clientY - touch.clientY) * scale : 0;
      const commit = !next.defaultPrevented && next.touches.length === 0 && valid() && locked
        && point && travel >= threshold && dx * direction >= threshold && Math.abs(dx) >= Math.abs(dy) * 1.25;
      cleanup();
      if (commit) read()?.onOpenChange(!options.open);
    };
    doc.addEventListener('touchstart', multi, { passive: true });
    doc.addEventListener('touchmove', move, { passive: false });
    doc.addEventListener('touchend', end);
    doc.addEventListener('touchcancel', abort);
    view.addEventListener('blur', abort);
    cancel = cleanup;
  }

  return { start, cancel: () => cancel(), dispose: () => { cancel(); clearClick(); } };
}
