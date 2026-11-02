export interface JourneyPlaceTransition {
  /** Milliseconds per target update, 0..60000; default 420. */
  duration?: number;
  easing?: 'linear' | 'ease-in-out';
  /** Freeze at the displayed position; resume the remaining transition later. */
  paused?: boolean;
}
export type JourneyPlaceAnimation = boolean | JourneyPlaceTransition;
export interface JourneyPosition { latitude: number; longitude: number }
interface FrameRuntime { now(): number; request(callback: (time: number) => void): number; cancel(id: number): void }
interface Movement { from: JourneyPosition; to: JourneyPosition; start: number; duration: number; configuredDuration: number; easing: 'linear' | 'ease-in-out'; paused: boolean; remaining: number }
const longitudeDelta = (from: number, to: number) => ((to - from + 180) % 360 + 360) % 360 - 180;
const same = (a: JourneyPosition, b: JourneyPosition) => a.latitude === b.latitude && Math.abs(longitudeDelta(a.longitude, b.longitude)) < 1e-10;
export function interpolateJourneyPosition(from: JourneyPosition, to: JourneyPosition, progress: number, easing: 'linear' | 'ease-in-out' = 'linear'): JourneyPosition {
  const t = Math.max(0, Math.min(1, progress));
  const amount = easing === 'ease-in-out' ? t * t * (3 - 2 * t) : t;
  return { latitude: from.latitude + (to.latitude - from.latitude) * amount, longitude: from.longitude + longitudeDelta(from.longitude, to.longitude) * amount };
}

/** One frame loop per map; only marker transforms change, never the terrain raster. */
export class JourneyPlaceMotion {
  private movements = new Map<string, Movement>();
  private frame: number | undefined;
  constructor(private write: (id: string, position: JourneyPosition) => void, private runtime: FrameRuntime = {
    now: () => performance.now(), request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id),
  }) {}
  move(id: string, current: JourneyPosition, target: JourneyPosition, option: JourneyPlaceAnimation, reducedMotion = false) {
    const options = typeof option === 'object' && option ? option : {};
    const duration = !option || reducedMotion ? 0 : Number.isFinite(options.duration) ? Math.max(0, Math.min(60000, options.duration!)) : 420;
    const easing = options.easing === 'ease-in-out' ? 'ease-in-out' : 'linear';
    const paused = Boolean(options.paused);
    const previous = this.movements.get(id), now = this.runtime.now();
    if (!previous && same(current, target)) return;
    if (previous && same(previous.to, target) && previous.configuredDuration === duration && previous.easing === easing) {
      if (previous.paused === paused) return;
      if (paused) previous.remaining = Math.max(0, previous.duration - (now - previous.start));
      previous.from = current; previous.start = now; previous.duration = previous.remaining; previous.paused = paused;
    } else if (!paused && (!duration || same(current, target))) {
      this.movements.delete(id); this.write(id, target);
    } else {
      this.movements.set(id, { from: current, to: target, start: now, duration, configuredDuration: duration, easing, paused, remaining: duration });
    }
    this.schedule();
  }
  remove(id: string) { this.movements.delete(id); this.schedule(); }
  clear() { this.movements.clear(); if (this.frame !== undefined) this.runtime.cancel(this.frame); this.frame = undefined; }
  private schedule() {
    const active = [...this.movements.values()].some(movement => !movement.paused);
    if (active && this.frame === undefined) this.frame = this.runtime.request(this.tick);
    if (!active && this.frame !== undefined) { this.runtime.cancel(this.frame); this.frame = undefined; }
  }
  private tick = (time: number) => {
    this.frame = undefined;
    for (const [id, movement] of this.movements) {
      if (movement.paused) continue;
      const progress = movement.duration ? Math.min(1, (time - movement.start) / movement.duration) : 1;
      this.write(id, interpolateJourneyPosition(movement.from, movement.to, progress, movement.easing));
      if (progress === 1) this.movements.delete(id);
    }
    this.schedule();
  };
}
