// Adapted from the trip site's scheduleCardScale.js and layoutIntervals.
export interface ScheduleInterval { id: string; start: number; end: number }
function heapPush<T>(heap: T[], value: T, less: (left: T, right: T) => boolean): void {
  let index = heap.length;
  heap.push(value);
  while (index > 0) {
    const parent = (index - 1) >>> 1;
    if (!less(value, heap[parent])) break;
    heap[index] = heap[parent];
    index = parent;
  }
  heap[index] = value;
}

function heapPop<T>(heap: T[], less: (left: T, right: T) => boolean): T {
  const first = heap[0];
  const last = heap.pop()!;
  if (heap.length) {
    let index = 0;
    while (index * 2 + 1 < heap.length) {
      let child = index * 2 + 1;
      if (child + 1 < heap.length && less(heap[child + 1], heap[child])) child++;
      if (!less(heap[child], last)) break;
      heap[index] = heap[child];
      index = child;
    }
    heap[index] = last;
  }
  return first;
}

const lowerLane = (left: number, right: number) => left < right;
const earlierEnd = (left: { end: number; lane: number }, right: { end: number; lane: number }) => left.end < right.end || (left.end === right.end && left.lane < right.lane);

export function layoutAgendaIntervals<T extends ScheduleInterval>(intervals: T[]) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const result: (T & { lane: number; lanes: number })[] = [];
  let group: (T & { lane: number })[] = [], groupEnd = -Infinity, laneCount = 0;
  let occupied: { end: number; lane: number }[] = [], available: number[] = [];
  const flush = () => {
    for (const item of group) result.push({ ...item, lanes: laneCount });
    group = []; occupied = []; available = []; laneCount = 0;
  };
  for (const item of sorted) {
    if (item.start >= groupEnd) flush();
    while (occupied.length && occupied[0].end <= item.start) {
      heapPush(available, heapPop(occupied, earlierEnd).lane, lowerLane);
    }
    const lane = available.length ? heapPop(available, lowerLane) : laneCount++;
    heapPush(occupied, { end: item.end, lane }, earlierEnd);
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
  // Boundaries already contain every endpoint, so the furthest active end is
  // enough to decide occupancy without rescanning every event for every segment.
  const ordered = [...intervals].sort((a, b) => a.start - b.start);
  let intervalIndex = 0, occupiedUntil = -Infinity;
  let height = 0;
  for (let index = 0; index < boundaries.length; index++) {
    const time = boundaries[index];
    before.set(time, height);
    if (points.has(time)) height += rowHeight;
    after.set(time, height);
    const next = boundaries[index + 1];
    if (next === undefined) continue;
    while (intervalIndex < ordered.length && ordered[intervalIndex].start < next) {
      occupiedUntil = Math.max(occupiedUntil, ordered[intervalIndex].end);
      intervalIndex++;
    }
    const occupied = occupiedUntil > time;
    const size = Math.max(occupied ? rowHeight : 16, (next - time) / 60 * 32);
    segments.push({ start: time, end: next, top: height, size });
    height += size;
  }
  const position = (minute: number, edge: 'before' | 'after' = 'before') => {
    const time = Math.max(0, Math.min(1440, minute));
    const exact = (edge === 'after' ? after : before).get(time);
    if (exact !== undefined) return exact;
    let low = 0, high = segments.length - 1;
    while (low <= high) {
      const middle = (low + high) >>> 1;
      if (segments[middle].start <= time) low = middle + 1;
      else high = middle - 1;
    }
    const segment = high >= 0 && time <= segments[high].end ? segments[high] : undefined;
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
