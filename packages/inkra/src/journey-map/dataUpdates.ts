export type JourneyMapDataUpdateMode = 'fit' | 'preserve-view';

export interface JourneyMapSetup<T> {
  mode: JourneyMapDataUpdateMode;
  /** Only the default fit lifecycle retains its setup inputs. */
  data: T | undefined;
  fitLimit: number;
  background: 'sea' | 'paper';
  revision: number;
}

export function journeyMapDataUpdateMode(value: JourneyMapDataUpdateMode | undefined): JourneyMapDataUpdateMode {
  return value === 'preserve-view' ? 'preserve-view' : 'fit';
}

export function createJourneyMapSetup<T>(mode: JourneyMapDataUpdateMode, data: T, fitLimit: number, background: 'sea' | 'paper'): JourneyMapSetup<T> {
  return { mode, data: mode === 'fit' ? data : undefined, fitLimit, background, revision: 0 };
}

/** Pure derived state: entering preserve-view keeps the existing setup;
 * leaving it explicitly restores the default fit lifecycle exactly once. */
export function nextJourneyMapSetup<T>(previous: JourneyMapSetup<T>, mode: JourneyMapDataUpdateMode, data: T, fitLimit: number, background: 'sea' | 'paper'): JourneyMapSetup<T> {
  if (mode === 'preserve-view') return previous.mode === mode ? previous : { ...previous, mode, data: undefined };
  if (previous.mode !== mode || previous.data !== data || previous.fitLimit !== fitLimit || previous.background !== background) {
    return { mode, data, fitLimit, background, revision: previous.revision + 1 };
  }
  return previous;
}
