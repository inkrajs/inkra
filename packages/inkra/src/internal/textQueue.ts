const jobs = new Set<() => void>();
let pending: number | null = null;

interface IdleDeadlineLike {
  timeRemaining(): number;
}

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: (deadline: IdleDeadlineLike) => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function schedule(): void {
  if (pending !== null || !jobs.size) return;
  const run = (deadline?: IdleDeadlineLike) => {
    pending = null;
    const start = performance.now();
    do {
      const job = jobs.values().next().value as (() => void) | undefined;
      if (!job) break;
      jobs.delete(job);
      job();
    } while (jobs.size && performance.now() - start < 6 && (deadline?.timeRemaining() ?? 3) > 2);
    schedule();
  };
  const idleWindow = window as IdleWindow;
  pending = idleWindow.requestIdleCallback
    ? idleWindow.requestIdleCallback(run, { timeout: 300 })
    : window.setTimeout(run, 16);
}

export function queueTextPaint(job: () => void): () => void {
  jobs.add(job);
  schedule();
  return () => {
    jobs.delete(job);
    if (!jobs.size && pending !== null) {
      const idleWindow = window as IdleWindow;
      if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(pending);
      else window.clearTimeout(pending);
      pending = null;
    }
  };
}
