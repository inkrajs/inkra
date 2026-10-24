// Real component scenarios, not model-only timings. Build the package first.
// The harness owns mount/update/unmount and timing. No DOM/canvas mocks here.
import { Calendar } from '../packages/inkra/dist/calendar/index.js';
import { DayAgenda } from '../packages/inkra/dist/day-agenda/index.js';

const DAYS = 365;
const DATE = '2026-01-01';
const onEventSelect = () => {};

function agendaEvent(index) {
  const startMinute = 7 * 60 + ((index * 37) % (13 * 60));
  return {
    id: `event-${index}`,
    title: `Activity ${index + 1}`,
    description: `Location ${index % 40}; scheduled activity`,
    kind: index % 7 === 0 ? 'travel' : 'activity',
    // Include pending and point events, as well as overlapping intervals.
    ...(index % 20 === 19 ? {} : {
      startMinute,
      ...(index % 11 === 10 ? {} : { endMinute: startMinute + 30 + (index % 4) * 15 }),
    }),
  };
}

function editFirst(events, field) {
  return events.map((event, index) => index === 0
    ? { ...event, [field]: `${event[field]} (updated)` }
    : event);
}

function calendarCase(name, events, appearance, size, distribution) {
  const props = {
    events,
    appearance,
    mode: 'single',
    month: new Date(2026, 0, 1, 12),
    today: new Date(2026, 0, 1, 12),
    selected: new Date(2026, 0, 1, 12),
    numberOfMonths: 1,
    // Fixed 35 cells, with adjacent-month days omitted for clear input counts.
    showOutsideDays: false,
    weekStartsOn: 1,
    onEventSelect,
  };
  return {
    name,
    component: Calendar,
    props,
    changedProps: { ...props, events: editFirst(events, 'label') },
    shape: {
      sourceRecords: size,
      componentInputRecords: events.length,
      distribution,
      appearance,
      renderedMonths: 1,
      januaryEvents: events.filter(event => event.date.getMonth() === 0).length,
      changedUpdate: 'New events array; first event label edited; remaining records retain identity',
    },
  };
}

function agendaCase(name, events, size, distribution) {
  const props = {
    date: DATE,
    events,
    locale: 'en-US',
    hourCycle: 'h23',
    density: 'comfortable',
    selectedEvent: events[0]?.id,
    onEventSelect,
  };
  return {
    name,
    component: DayAgenda,
    props,
    changedProps: { ...props, events: editFirst(events, 'title') },
    shape: {
      sourceRecords: size,
      componentInputRecords: events.length,
      distribution,
      selectedDate: DATE,
      timedRecords: events.filter(event => event.startMinute !== undefined).length,
      pendingRecords: events.filter(event => event.startMinute === undefined).length,
      changedUpdate: 'New events array; first event title edited; remaining records retain identity',
      preprocessing: 'Input generation and any day selection happen outside timing; DayAgenda accepts one day, not a year',
    },
  };
}

export async function scenarios(size) {
  if (!Number.isSafeInteger(size) || size < 1) throw new RangeError('size must be a positive safe integer');
  // Use local noon dates: Calendar groups by local day, not UTC timestamps.
  const yearEvents = Array.from({ length: size }, (_, index) => ({
    id: `event-${index}`,
    date: new Date(2026, 0, 1 + index % DAYS, 12),
    label: `Activity ${index + 1}`,
    description: `Location ${index % 40}; scheduled activity`,
  }));
  const selectedDayEvents = [];
  for (let index = 0; index < size; index += DAYS) selectedDayEvents.push(agendaEvent(index));
  const concentratedSize = Math.min(size, 1000);
  const concentratedEvents = Array.from({ length: concentratedSize }, (_, index) => agendaEvent(index));
  return [
    calendarCase('Calendar / year / picker', yearEvents, 'picker', size, 'Uniform round-robin across 365 local days'),
    calendarCase('Calendar / year / itinerary', yearEvents, 'itinerary', size, 'Uniform round-robin across 365 local days'),
    agendaCase('DayAgenda / selected day from year', selectedDayEvents, size, 'January 1 subset of uniformly distributed 365-day source'),
    agendaCase('DayAgenda / concentrated day (cap 1000)', concentratedEvents, concentratedSize,
      'All input events belong to one day; count is min(requested size, 1000); this is a stress case, not a realistic personal itinerary'),
  ];
}
