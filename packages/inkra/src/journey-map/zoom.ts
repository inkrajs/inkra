/** Per-map event state. The getter keeps prop replacement independent of map setup. */
export function createJourneyZoomNotifier(callback: () => ((zoom: number) => void) | undefined, enabled: () => boolean = () => true, waitForInitialFit = false) {
  let active = true, fitted = !waitForInitialFit, previous: number | undefined;
  return {
    // Once a real fit occurred, temporarily empty layer data must not silence
    // later user zooms. This state is distinct from the map's late-data fit flag.
    markFitted() { fitted = true; },
    notify(zoom: number) {
      if (!active || !fitted || !enabled() || !Number.isFinite(zoom) || zoom === previous) return;
      previous = zoom;
      callback()?.(zoom);
    },
    dispose() { active = false; },
  };
}

/** The official property wins even when invalid; the compatibility alias keeps its old range. */
export function resolveJourneyFitZoom(maxFitZoom?: number, fitMaxZoom?: number): number {
  const value = maxFitZoom === undefined ? fitMaxZoom : maxFitZoom;
  const ceiling = maxFitZoom === undefined ? 24 : 20;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(ceiling, value)) : 12;
}

/** One initial camera fit shared by native places and independently arriving layers. */
export function createJourneyInitialFit(attempt: () => boolean, enabled: () => boolean = () => true) {
  let active = true, fitted = false, attempting = false;
  return {
    markFitted() { if (active) fitted = true; },
    tryFit() {
      if (!active || fitted || attempting || !enabled()) return false;
      attempting = true;
      try {
        const completed = attempt();
        if (active && completed) fitted = true;
        return active && completed;
      } finally { attempting = false; }
    },
    dispose() { active = false; },
  };
}
