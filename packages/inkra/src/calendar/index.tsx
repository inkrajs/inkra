import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react';
import { CaptionLabel, Day, DayButton, DayPicker, Weekday, type CaptionLabelProps, type ChevronProps, type DayProps, type DayButtonProps, type DayPickerProps, type PreviousMonthButtonProps, type WeekdayProps } from 'react-day-picker';
import { Button } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';

export interface CalendarEvent { date: Date; label: string; id?: string; color?: string; description?: string }
export type CalendarProps = DayPickerProps & {
  events?: readonly CalendarEvent[];
  eventIndicator?: 'count' | 'dot' | 'none';
  appearance?: 'itinerary' | 'picker';
  onEventSelect?: (event: CalendarEvent) => void;
  renderDayAccessory?: (date: Date) => ReactNode;
  displayRange?: { from: Date; to: Date };
};
const emptyEvents: readonly CalendarEvent[] = [];
const EventContext = createContext<{
  eventsByDay: ReadonlyMap<string, readonly CalendarEvent[]>; indicator: 'count' | 'dot' | 'none';
  appearance: 'itinerary' | 'picker'; onEventSelect?: (event: CalendarEvent) => void;
  renderDayAccessory?: (date: Date) => ReactNode;
}>({ eventsByDay: new Map(), indicator: 'count', appearance: 'itinerary' });
// Match local calendar dates, not UTC dates, and retain input order within each day.
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

function CalendarCaption({ children, ...props }: CaptionLabelProps) {
  return <CaptionLabel {...props}>{typeof children === 'string' ? <PencilText>{children}</PencilText> : children}</CaptionLabel>;
}
function CalendarWeekday({ children, ...props }: WeekdayProps) {
  return <Weekday {...props}>{typeof children === 'string' ? <PencilText>{children}</PencilText> : children}</Weekday>;
}
function CalendarMonthButton({ disabled, ...props }: PreviousMonthButtonProps) {
  return <Button {...props} size="icon" variant="ghost" disabled={disabled || props['aria-disabled'] === true || props['aria-disabled'] === 'true'} />;
}
// Lucide chevrons retain their geometry and use the shared pencil renderer.
const chevrons = { left: 'm15 18-6-6 6-6', right: 'm9 18 6-6-6-6', up: 'm18 15-6-6-6 6', down: 'm6 9 6 6 6-6' };
function CalendarChevron({ className, orientation = 'left', size = 28 }: ChevronProps) {
  return <PencilIcon className={className} paths={[{ d: chevrons[orientation] }]} sourceSize={24} size={size} />;
}

// The trip calendar uses a full-cell date target with sibling event buttons.
function CalendarCell({ children, day, modifiers, ...props }: DayProps) {
  const { eventsByDay, appearance, onEventSelect, renderDayAccessory } = useContext(EventContext);
  if (appearance === 'picker') return <Day {...props} day={day} modifiers={modifiers}>{children}</Day>;
  const entries = eventsByDay.get(dayKey(day.date)) ?? emptyEvents;
  return <Day {...props} day={day} modifiers={modifiers}>
    <div className="inkra-calendar__day-card">
      <PencilSurface variant={modifiers.selected ? 'action' : 'quiet'} radius={8} className="inkra-calendar__day-paper" aria-hidden="true" seed={`day-${day.date.toISOString()}`} />
      {children}
      {renderDayAccessory && <div className="inkra-calendar__accessory">{renderDayAccessory(day.date)}</div>}
      <div className="inkra-calendar__events">{entries.map((event, index) => <PencilSurface key={event.id ?? index} as="button" variant="quiet" radius={3}
        className="inkra-calendar__event-card" disabled={modifiers.disabled || !onEventSelect}
        style={event.color ? { '--inkra-accent-soft': event.color } as CSSProperties : undefined}
        aria-label={`${event.label}${event.description ? `, ${event.description}` : ''}`} title={event.description ?? event.label}
        onClick={click => { click.stopPropagation(); onEventSelect?.(event); }}><PencilText ellipsis>{event.label}</PencilText></PencilSurface>)}</div>
    </div>
  </Day>;
}

function CalendarDay({ children, modifiers, day, ...props }: DayButtonProps) {
  const { eventsByDay, indicator, appearance } = useContext(EventContext);
  const events = eventsByDay.get(dayKey(day.date)) ?? emptyEvents;
  return <DayButton {...props} day={day} modifiers={modifiers}
    aria-label={[props['aria-label'], ...events.map(event => event.label)].filter(Boolean).join(', ')}>
    {modifiers.selected && appearance === 'picker' && <PencilSurface variant="selection" className="inkra-calendar__selection" aria-hidden="true" />}
    <PencilText>{String(children)}</PencilText>
    {appearance === 'picker' && events.length > 0 && indicator !== 'none' && <span className="inkra-calendar__event" data-indicator={indicator} aria-hidden="true">{indicator === 'count' ? events.length : '\u2022'}</span>}
  </DayButton>;
}

export function Calendar({ events = emptyEvents, eventIndicator = 'count', appearance = 'itinerary', onEventSelect, renderDayAccessory, displayRange, className, components, showOutsideDays = true, ...props }: CalendarProps) {
  const eventsByDay = useMemo(() => {
    const index = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = dayKey(event.date);
      const entries = index.get(key);
      if (entries) entries.push(event);
      else index.set(key, [event]);
    }
    return index;
  }, [events]);
  const context = useMemo(() => ({ eventsByDay, indicator: eventIndicator, appearance, onEventSelect, renderDayAccessory }),
    [eventsByDay, eventIndicator, appearance, onEventSelect, renderDayAccessory]);
  const hidden = displayRange ? [...(Array.isArray(props.hidden) ? props.hidden : props.hidden ? [props.hidden] : []), { before: displayRange.from }, { after: displayRange.to }] : props.hidden;
  return <EventContext.Provider value={context}><div className="inkra-calendar-scroll" data-appearance={appearance}>
    <DayPicker {...props} hidden={hidden} data-appearance={appearance} data-week-numbers={props.showWeekNumber || undefined} showOutsideDays={showOutsideDays} className={['inkra-calendar', className].filter(Boolean).join(' ')}
      components={{ CaptionLabel: CalendarCaption, Weekday: CalendarWeekday, Chevron: CalendarChevron, PreviousMonthButton: CalendarMonthButton, NextMonthButton: CalendarMonthButton, Day: CalendarCell, DayButton: CalendarDay, ...components }} />
  </div></EventContext.Provider>;
}
