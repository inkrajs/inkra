// Adapted from the trip site's scheduleCardScale.js and layoutIntervals.
export interface ScheduleInterval { id: string; start: number; end: number }
export function layoutAgendaIntervals<T extends ScheduleInterval>(intervals: T[]) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const result: (T & { lane: number; lanes: number })[] = [];
  let group: (T & { lane: number })[] = [], groupEnd = -Infinity, laneEnds: number[] = [];
  const flush = () => { for (const item of group) result.push({ ...item, lanes: laneEnds.length }); group = []; laneEnds = []; };
  for (const item of sorted) {
    if (item.start >= groupEnd) flush();
    let lane = laneEnds.findIndex(end => end <= item.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = item.end;
    group.push({ ...item, lane });
    groupEnd = Math.max(groupEnd, item.end);
  }
  flush();
  return result;
}
export function createAgendaScale(intervals: ScheduleInterval[], pointTimes: number[], compact: boolean) {
  const rowHeight = compact ? 56 : 72;
  const points = new Set(pointTimes);
  const boundaries = [...new Set([0, 1440, ...pointTimes, ...intervals.flatMap(row => [row.start, row.end])])].sort((a, b) => a - b);
  const before = new Map<number, number>(), after = new Map<number, number>();
  const segments: { start: number; end: number; top: number; size: number }[] = [];
  let height = 0;
  for (let index = 0; index < boundaries.length; index++) {
    const time = boundaries[index];
    before.set(time, height);
    if (points.has(time)) height += rowHeight;
    after.set(time, height);
    const next = boundaries[index + 1];
    if (next === undefined) continue;
    const occupied = intervals.some(row => row.start < next && row.end > time);
    const size = Math.max(occupied ? rowHeight : 16, (next - time) / 60 * 32);
    segments.push({ start: time, end: next, top: height, size });
    height += size;
  }
  const position = (minute: number, edge: 'before' | 'after' = 'before') => {
    const time = Math.max(0, Math.min(1440, minute));
    const exact = (edge === 'after' ? after : before).get(time);
    if (exact !== undefined) return exact;
    const segment = segments.find(row => time >= row.start && time <= row.end);
    return segment ? segment.top + (time - segment.start) / (segment.end - segment.start) * segment.size : 0;
  };
  return { position, height, rowHeight };
}

export function layoutAgendaCards<T extends ScheduleInterval>(rows: T[], scale: ReturnType<typeof createAgendaScale>) {
  // Allocate lanes in the shared pixel scale so a point inside a long event cannot cover it.
  const positioned = rows.map(row => {
    const point = row.start === row.end;
    const top = scale.position(row.start, point ? 'before' : 'after');
    const height = point ? scale.rowHeight : scale.position(row.end) - top;
    return { id: row.id, start: top, end: top + height, row, top, height };
  });
  return layoutAgendaIntervals(positioned).map(({ row, top, height, lane, lanes }) => ({ ...row, top, height, lane, lanes }));
}
