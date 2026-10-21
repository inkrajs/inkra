const subscribers = new Set<() => void>();
let frame = 0;

function recover(): void {
  frame = 0;
  if (document.visibilityState === 'hidden') return;
  for (const callback of subscribers) {
    try {
      callback();
    } catch {
      // One failed canvas must not block independent painters.
    }
  }
}

function scheduleRecovery(): void {
  if (!frame && document.visibilityState !== 'hidden') frame = requestAnimationFrame(recover);
}

function onVisibility(): void {
  if (document.visibilityState === 'hidden') {
    cancelAnimationFrame(frame);
    frame = 0;
  } else {
    scheduleRecovery();
  }
}

function onPageShow(event: PageTransitionEvent): void {
  if (event.persisted) scheduleRecovery();
}

export function observeCanvasRecovery(callback: () => void): () => void {
  if (!subscribers.size) {
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('resume', scheduleRecovery);
    document.addEventListener('contextrestored', scheduleRecovery, true);
    window.addEventListener('pageshow', onPageShow);
  }
  subscribers.add(callback);

  return () => {
    subscribers.delete(callback);
    if (subscribers.size) return;
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('resume', scheduleRecovery);
    document.removeEventListener('contextrestored', scheduleRecovery, true);
    window.removeEventListener('pageshow', onPageShow);
    cancelAnimationFrame(frame);
    frame = 0;
  };
}
