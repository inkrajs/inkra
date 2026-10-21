import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { Calendar, DayAgenda, JourneyMap, agendaInterval, agendaTime } from '../dist/index.js';

test('Calendar uses pencil captions, weekdays and native Inkra month buttons', () => {
  const html = render(h(Calendar, { mode: 'single', defaultMonth: new Date(2026, 9, 1) }));
  assert.match(html, /class="rdp-caption_label"[^>]*><span[^>]*class="inkra-pencil-text"/);
  assert.match(html, /class="rdp-weekday"[^>]*><span[^>]*class="inkra-pencil-text"/);
  assert.match(html, /inkra-button rdp-button_previous/);
  assert.match(html, /inkra-pencil-icon rdp-chevron/);
  const custom = render(h(Calendar, { components: { CaptionLabel: () => h('strong', null, 'Custom month') } }));
  assert.match(custom, /<strong>Custom month<\/strong>/);
});

test('JourneyMap offers compact credits without removing the failure fallback', () => {
  const html = render(h(JourneyMap, { places: [{ id: 'lake', label: 'Lake', latitude: -43, longitude: 170 }], attribution: 'Illustration', attributionDisplay: 'popover', showPlaceList: false }));
  assert.match(html, /aria-label="Map credits"/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.doesNotMatch(html, /<p class="inkra-journey-map__attribution"/);
  assert.match(html, /inkra-journey-map__places/);
  assert.doesNotMatch(html, /attributionDisplay=/);
});
import { createAgendaScale, layoutAgendaIntervals, layoutAgendaCards } from '../dist/day-agenda/layout.js';

test('Agenda clips cross-midnight windows without inventing missing durations', () => {
  assert.deepEqual(agendaInterval({ startMinute: -60, endMinute: 90 }), { start: 0, end: 90, before: true, after: false });
  assert.deepEqual(agendaInterval({ startMinute: 1380, endMinute: 1500 }), { start: 1380, end: 1440, before: false, after: true });
  assert.deepEqual(agendaInterval({ startMinute: 600 }), { start: 600, end: 600, before: false, after: false });
  for (const event of [{}, { startMinute: NaN }, { startMinute: 700, endMinute: 600 }, { startMinute: 1500 }, { startMinute: -60, endMinute: 0 }]) assert.equal(agendaInterval(event), null);
  assert.equal(agendaTime(1440), '00:00 +1');
});

test('Agenda is readable and selectable without canvas, with empty state', () => {
  const html = render(h(DayAgenda, { date: '2026-10-21', events: [{ id: 'walk', title: 'Walk', startMinute: 540 }, { id: 'free', title: 'Free time' }], selectedEvent: 'walk', onEventSelect() {} }));
  assert.match(html, /<ol/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /09:00/);
  assert.match(html, /Time pending/);
  assert.match(render(h(DayAgenda, { date: '2026-10-21', events: [], emptyLabel: 'Empty' })), /Empty/);
});

test('Calendar retains DayPicker date labels and event names', () => {
  const date = new Date(2026, 9, 21);
  const html = render(h(Calendar, { mode: 'single', defaultMonth: date, selected: date, events: [{ date, label: 'Lakeside walk' }] }));
  assert.match(html, /Lakeside walk/);
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /inkra-calendar__day-card/);
});

test('JourneyMap SSR retains attribution and accessible places without loading Leaflet', () => {
  const html = render(h(JourneyMap, { places: [{ id: 'lake', label: 'Lake', latitude: -43, longitude: 170 }, { id: 'invalid', label: 'Invalid', latitude: NaN, longitude: 0 }], attribution: 'Illustration only', selectedPlace: 'lake' }));
  assert.match(html, /Lake/);
  assert.match(html, /Illustration only/);
  assert.match(html, /aria-pressed="true"/);
  assert.doesNotMatch(html, /Invalid/);
});

test('Calendar marker presentation never removes event names', () => {
  const date = new Date(2026, 9, 21);
  for (const eventIndicator of ['count', 'dot', 'none']) {
    const html = render(h(Calendar, { appearance: 'picker', mode: 'single', defaultMonth: date, showWeekNumber: true, eventIndicator, events: [{ date, label: 'Walk' }] }));
    assert.match(html, /aria-label="[^"]*Walk/);
    assert.match(html, /data-week-numbers="true"/);
    if (eventIndicator === 'none') assert.doesNotMatch(html, /class="inkra-calendar__event"/);
    else assert.match(html, new RegExp(`data-indicator="${eventIndicator}"`));
  }
});

test('Agenda supports localized clocks and preserves next-day boundaries', () => {
  assert.equal(agendaTime(540, 'h12', 'en-US'), '9:00 AM');
  assert.equal(agendaTime(900, 'h12', 'en-US'), '3:00 PM');
  assert.equal(agendaTime(1440, 'h12', 'en-US'), '12:00 AM +1');
  assert.match(agendaTime(900, 'h12', 'zh-CN'), /下午/);
});

test('Agenda display options and native event disabling remain independent', () => {
  const events = [{ id: 'a', title: 'A', startMinute: 900, description: 'Private detail', disabled: true }, { id: 'b', title: 'B', startMinute: 540 }];
  const props = { date: '2026-10-21', events, onEventSelect() {}, density: 'compact', hourCycle: 'h12', showDescriptions: false, divided: false, showOverview: false };
  const html = render(h(DayAgenda, props));
  assert.match(html, /data-density="compact"/);
  assert.match(html, /3:00 PM/);
  assert.doesNotMatch(html, /Private detail|inkra-agenda__overview/);
  assert.equal((html.match(/ disabled=""/g) ?? []).length, 1);
  assert.equal((render(h(DayAgenda, { ...props, disabled: true })).match(/ disabled=""/g) ?? []).length, 2);
  assert.equal(events[0].id, 'a', 'ordering never mutates caller data');
});

test('JourneyMap hidden controls preserve SSR fallback and attribution', () => {
  const html = render(h(JourneyMap, { places: [{ id: 'lake', label: 'Lake', latitude: -43, longitude: 170 }], attribution: 'Illustration', showControls: false, showPlaceList: false, interactive: false, scrollWheelZoom: true, focusSelectedPlace: true }));
  assert.match(html, /Lake/);
  assert.match(html, /Illustration/);
  assert.doesNotMatch(html, /inkra-journey-map__tools|scrollWheelZoom|focusSelectedPlace/);
});

test('Trip timeline uses overlapping lanes and the same expanded scale for cards and ticks', () => {
  const intervals = [{ id: 'a', start: 540, end: 630 }, { id: 'b', start: 600, end: 720 }, { id: 'c', start: 900, end: 905 }];
  const lanes = layoutAgendaIntervals(intervals);
  assert.equal(lanes[0].lanes, 2);
  assert.equal(lanes[1].lane, 1);
  assert.equal(lanes[2].lanes, 1);
  const scale = createAgendaScale(intervals, [800], false);
  assert(scale.position(905) - scale.position(900, 'after') >= 72);
  assert.equal(scale.position(800, 'after') - scale.position(800), 72);
  assert.equal(scale.position(1440), scale.height);
});

test('Itinerary calendar exposes separate date and event targets', () => {
  const date = new Date(2026, 9, 21);
  const html = render(h(Calendar, { mode: 'single', defaultMonth: date, displayRange: { from: date, to: date }, onEventSelect() {}, events: [{ date, id: 'walk', label: 'Walk' }] }));
  assert.match(html, /data-appearance="itinerary"/);
  assert.match(html, /inkra-calendar__event-card/);
  assert.doesNotMatch(html, /<button[^>]*>(?:(?!<\/button>)[\s\S])*<button/);
});

test('Point events inside a duration occupy separate lanes without invented time', () => {
  const rows = [{ id: 'stay', start: 540, end: 720 }, { id: 'meet', start: 600, end: 600 }, { id: 'call', start: 600, end: 600 }];
  const scale = createAgendaScale([rows[0]], [600], false);
  const cards = layoutAgendaCards(rows, scale);
  assert.equal(new Set(cards.map(card => card.lane)).size, 3);
  assert(cards.every(card => card.lanes === 3));
  assert.equal(cards[1].start, cards[1].end);
  assert.equal(cards[1].height, scale.rowHeight);
});
