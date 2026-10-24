import assert from 'node:assert/strict';
import test from 'node:test';
import { createAgendaScale, layoutAgendaIntervals } from '../dist/day-agenda/layout.js';

function referenceLanes(intervals) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const result = [];
  let group = [], groupEnd = -Infinity, laneEnds = [];
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

function referenceScale(intervals, pointTimes, compact) {
  const rowHeight = compact ? 56 : 72;
  const points = new Set(pointTimes);
  const boundaries = [...new Set([0, 1440, ...pointTimes, ...intervals.flatMap(row => [row.start, row.end])])].sort((a, b) => a - b);
  const before = new Map(), after = new Map(), segments = [];
  let height = 0;
  for (let index = 0; index < boundaries.length; index++) {
    const time = boundaries[index]; before.set(time, height);
    if (points.has(time)) height += rowHeight;
    after.set(time, height);
    const next = boundaries[index + 1]; if (next === undefined) continue;
    const occupied = intervals.some(row => row.start < next && row.end > time);
    const size = Math.max(occupied ? rowHeight : 16, (next - time) / 60 * 32);
    segments.push({ start: time, end: next, top: height, size }); height += size;
  }
  return { height, position(minute, edge = 'before') {
    const time = Math.max(0, Math.min(1440, minute));
    const exact = (edge === 'after' ? after : before).get(time);
    if (exact !== undefined) return exact;
    const segment = segments.find(row => time >= row.start && time <= row.end);
    return segment ? segment.top + (time - segment.start) / (segment.end - segment.start) * segment.size : 0;
  } };
}

test('Agenda optimized scale and lane allocation match the original algorithm for dense, tied and point events', () => {
  let seed = 923;
  const random = maximum => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % maximum; };
  for (let round = 0; round < 150; round++) {
    const intervals = Array.from({ length: random(80) }, (_, index) => {
      const start = random(48) * 30; return { id: String(index), start, end: Math.min(1440, start + random(12) * 30) };
    });
    const points = Array.from({ length: random(12) }, () => random(48) * 30);
    assert.deepEqual(layoutAgendaIntervals(intervals), referenceLanes(intervals));
    const expected = referenceScale(intervals, points, round % 2 === 0);
    const actual = createAgendaScale(intervals, points, round % 2 === 0);
    assert.equal(actual.height, expected.height);
    for (let minute = -10; minute < 1460; minute += 7.5) for (const edge of ['before', 'after']) assert.equal(actual.position(minute, edge), expected.position(minute, edge));
  }
});

test('Agenda scale scans ordered interval endpoints rather than rescanning every interval at every boundary', () => {
  let reads = 0;
  const intervals = Array.from({ length: 1000 }, (_, index) => ({ id: String(index), get start() { reads++; return index; }, end: index + 0.5 }));
  const scale = createAgendaScale(intervals, [], false);
  assert.ok(scale.height > 0);
  assert.ok(reads < 20_000, `expected bounded endpoint reads, observed ${reads}`);
});

test('Agenda lanes retain lowest-available-lane ordering at large overlap counts', () => {
  const intervals = Array.from({ length: 20_000 }, (_, index) => ({ id: String(index).padStart(6, '0'), start: 0, end: 1440 }));
  const result = layoutAgendaIntervals(intervals);
  assert.equal(result.length, intervals.length);
  assert.ok(result.every((row, index) => row.lane === index && row.lanes === intervals.length));
});
