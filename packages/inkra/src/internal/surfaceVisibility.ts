// Keep visible/prewarm surfaces synchronous. An offscreen surface retains DOM,
// geometry and any existing bitmap; only its decorative paint is deferred.
export function surfaceIsNearViewport(root: HTMLElement, margin = 240): boolean {
  const view = root.ownerDocument?.defaultView;
  if (!view || !Number.isFinite(view.innerWidth) || !Number.isFinite(view.innerHeight)
    || typeof root.getBoundingClientRect !== 'function') return true;
  const rect = root.getBoundingClientRect();
  if (![rect.left, rect.right, rect.top, rect.bottom].every(Number.isFinite)) return true;
  return rect.bottom >= -margin && rect.top <= view.innerHeight + margin
    && rect.right >= -margin && rect.left <= view.innerWidth + margin;
}

interface ViewportState {
  observer: IntersectionObserver;
  callbacks: Map<Element, () => void>;
}
const documents = new WeakMap<Document, ViewportState>();

/** One observer per document, explicitly released after the final subscription. */
export function observeSurfaceViewport(root: HTMLElement, refresh: () => void): (() => void) | undefined {
  if (typeof IntersectionObserver === 'undefined' || !root.ownerDocument) return undefined;
  const document = root.ownerDocument;
  let state = documents.get(document);
  if (!state) {
    const callbacks = new Map<Element, () => void>();
    try {
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) callbacks.get(entry.target)?.();
      }, { rootMargin: '240px', threshold: 0 });
      state = { observer, callbacks };
      documents.set(document, state);
    } catch { return undefined; }
  }
  const current = state;
  current.callbacks.set(root, refresh);
  try { current.observer.observe(root); }
  catch {
    current.callbacks.delete(root);
    if (!current.callbacks.size) { current.observer.disconnect(); documents.delete(document); }
    return undefined;
  }
  return () => {
    // Ignore a stale unsubscribe if a newer owner registered the same element.
    if (current.callbacks.get(root) !== refresh) return;
    current.callbacks.delete(root);
    current.observer.unobserve(root);
    if (!current.callbacks.size) { current.observer.disconnect(); documents.delete(document); }
  };
}
