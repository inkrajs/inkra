import { useId, useMemo, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { TravelIcon } from '../internal/travelIcons.js';
import { Button } from '../Button.js';
import { createAgendaScale, layoutAgendaCards } from './layout.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilLine } from '../PencilLine.js';
import { PencilText } from '../PencilText.js';

export interface AgendaEvent {
  id: string;
  title: string;
  /** Minutes from the selected local day's midnight. Negative/over-1440 values indicate continuation. */
  startMinute?: number;
  endMinute?: number;
  description?: ReactNode;
  kind?: 'activity' | 'travel' | 'stay';
  color?: string;
  icon?: ReactNode;
  disabled?: boolean;
}
export interface DayAgendaProps extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
  date: string;
  /** Immutable snapshots: replace the events array and changed event records when editing. */
  events: readonly AgendaEvent[];
  selectedEvent?: string;
  onEventSelect?: (event: AgendaEvent) => void;
  locale?: string;
  timeZoneLabel?: string;
  emptyLabel?: string;
  untimedLabel?: string;
  showOverview?: boolean;
  hourCycle?: 'h12' | 'h23';
  density?: 'compact' | 'comfortable';
  showDescriptions?: boolean;
  divided?: boolean;
  disabled?: boolean;
  onPreviousDay?: () => void;
  onNextDay?: () => void;
  navigationLabels?: { previous: string; next: string };
}
function formatAgendaMinute(minute: number, formatter?: Intl.DateTimeFormat): string {
  const value = Math.max(0, Math.min(1440, Math.floor(minute)));
  if (formatter) {
    const time = new Date(Date.UTC(2000, 0, 1, 0, value));
    return formatter.format(time) + (value === 1440 ? ' +1' : '');
  }
  return value === 1440 ? '00:00 +1' : `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
export function agendaTime(minute: number, hourCycle: 'h12' | 'h23' = 'h23', locale = 'en'): string {
  return formatAgendaMinute(minute, hourCycle === 'h12'
    ? new Intl.DateTimeFormat(locale, { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hourCycle })
    : undefined);
}
export function agendaInterval(event: AgendaEvent) {
  if (event.startMinute === undefined || !Number.isFinite(event.startMinute)) return null;
  const end = event.endMinute;
  if (end !== undefined && (!Number.isFinite(end) || end < event.startMinute)) return null;
  if (event.startMinute >= 1440 || (end ?? event.startMinute) < 0 || (end === 0 && event.startMinute < 0)) return null;
  return { start: Math.max(0, event.startMinute), end: Math.min(1440, end ?? event.startMinute), before: event.startMinute < 0, after: (end ?? 0) > 1440 };
}

export function DayAgenda({ date, events, selectedEvent, onEventSelect, locale = 'en', timeZoneLabel, emptyLabel = 'No events', untimedLabel = 'Time pending', showOverview = true, hourCycle = 'h23', density = 'comfortable', showDescriptions = true, divided = true, disabled = false, onPreviousDay, onNextDay, navigationLabels = { previous: 'Previous day', next: 'Next day' }, className, ...props }: DayAgendaProps) {
  const id = useId();
  const title = useMemo(() => {
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : new Date(NaN);
    return Number.isFinite(validDate.getTime()) ? new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long', day: 'numeric', weekday: 'short' }).format(validDate) : date;
  }, [date, locale]);
  const timeFormatter = useMemo(() => hourCycle === 'h12'
    ? new Intl.DateTimeFormat(locale, { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hourCycle })
    : undefined, [hourCycle, locale]);
  const { ordered, pending, scale, cards, ticks } = useMemo(() => {
    const records = events.map(event => ({ event, interval: agendaInterval(event) }))
      .sort((a, b) => (a.interval?.start ?? Infinity) - (b.interval?.start ?? Infinity));
    const ordered = records.map(row => row.event);
    const pending = records.filter(row => !row.interval).map(row => row.event);
    const timed = records.flatMap(({ event, interval }) => interval ? [{ ...interval, id: event.id, event }] : []);
    const intervals = timed.filter(row => row.end > row.start);
    const points = timed.filter(row => row.end === row.start);
    const scale = createAgendaScale(intervals, points.map(row => row.start), density === 'compact');
    const formatTime = (minute: number) => formatAgendaMinute(minute, timeFormatter);
    const cards = layoutAgendaCards(timed, scale).sort((a, b) => a.start - b.start).map(row => ({
      ...row,
      time: `${row.before ? '\u2190 ' : ''}${formatTime(row.start)}${row.event.endMinute !== undefined ? ` - ${formatTime(row.end)}` : ''}${row.after ? ' \u2192' : ''}`,
    }));
    const ticks = Array.from({ length: 25 }, (_, hour) => hour * 60)
      .filter((minute, index, list) => index === 0 || index === 24 || scale.position(minute) - scale.position(list[index - 1]) >= 25)
      .map(minute => ({ minute, label: formatTime(minute) }));
    return { ordered, pending, scale, cards, ticks };
  }, [density, events, timeFormatter]);
  const renderCard = (event: AgendaEvent, time: string) => <PencilSurface variant="quiet" radius={6} className="inkra-agenda__card" data-selected={selectedEvent === event.id}
    style={{ '--inkra-accent-soft': event.color ?? (event.kind === 'stay' ? '#c8c38f' : event.kind === 'travel' ? '#87bbc0' : '#a7c7ad') } as CSSProperties}>
    {onEventSelect && <button type="button" className="inkra-agenda__hit" disabled={disabled || event.disabled} aria-label={`${time}, ${event.title}`} aria-pressed={selectedEvent === event.id} onClick={() => onEventSelect(event)} />}
    <div className="inkra-agenda__card-copy"><span className="inkra-agenda__card-title" title={event.title}>{event.icon && <span aria-hidden="true">{event.icon}</span>}<PencilText ellipsis>{event.title}</PencilText></span>
      {showDescriptions && event.description && <span className="inkra-agenda__description">{event.description}</span>}
    </div>
  </PencilSurface>;
  return <section {...props} data-density={density} data-hour-cycle={hourCycle} className={['inkra-agenda', className].filter(Boolean).join(' ')} aria-labelledby={props['aria-labelledby'] ?? id}>
    <header className="inkra-agenda__heading"><PencilText as="h3" id={id}>{title}</PencilText>{timeZoneLabel && <PencilText>{timeZoneLabel}</PencilText>}</header>
    <PencilLine />
    {ordered.length === 0 ? <PencilText as="p">{emptyLabel}</PencilText> : <>
      <div className="inkra-agenda__timeline" data-overview={showOverview}>
        <div className="inkra-agenda__scale" style={{ height: scale.height + 24 }}>
          {ticks.map(({ minute, label }) => <div key={minute} className="inkra-agenda__tick" style={{ top: scale.position(minute) + 12 }}>
            <span><PencilText>{label}</PencilText></span>{divided && <PencilLine />}
          </div>)}
          <ol className="inkra-agenda__lanes">{cards.map(row => {
            const time = row.time;
            return <li key={row.id} data-kind={row.event.kind} style={{ top: row.top + 14, height: Math.max(44, row.height - 4), insetInlineStart: `${row.lane / row.lanes * 100}%`, width: `${100 / row.lanes}%` }}>
              {renderCard(row.event, time)}<span className="inkra-agenda__accessible-time">{time}</span>
            </li>;
          })}</ol>
        </div>
      </div>
      {pending.length > 0 && <div className="inkra-agenda__pending"><PencilText>{untimedLabel}</PencilText>{pending.map(event => <div key={event.id}>{renderCard(event, untimedLabel)}</div>)}</div>}
    </>}
    {(onPreviousDay || onNextDay) && <footer className="inkra-agenda__navigation"><PencilLine /><Button variant="ghost" size="icon" aria-label={navigationLabels.previous} title={navigationLabels.previous} disabled={!onPreviousDay} onClick={onPreviousDay}><TravelIcon name="previous" /></Button><Button variant="ghost" size="icon" aria-label={navigationLabels.next} title={navigationLabels.next} disabled={!onNextDay} onClick={onNextDay}><TravelIcon name="next" /></Button></footer>}
  </section>;
}
