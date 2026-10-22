import { forwardRef, type OlHTMLAttributes, type ReactNode } from 'react';
import { PencilIcon, type PencilIconPath } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';

export interface TimelineItem {
  id: string;
  date: ReactNode;
  dateTime?: string;
  title: ReactNode;
  description?: ReactNode;
  content?: ReactNode;
}

export interface TimelineProps extends Omit<OlHTMLAttributes<HTMLOListElement>, 'children'> {
  items: readonly TimelineItem[];
  orientation?: 'horizontal' | 'vertical';
}

const markerPaths: readonly PencilIconPath[] = [
  { d: 'M16 7a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z' },
  { d: 'M16 11v6l4 3' },
];
const copy = (value: ReactNode) => typeof value === 'string' ? <PencilText>{value}</PencilText> : value;

export const Timeline = forwardRef<HTMLOListElement, TimelineProps>(function Timeline(
  { 'aria-label': ariaLabel = 'Timeline', className, items, orientation = 'vertical', ...props },
  ref,
) {
  return <ol {...props} ref={ref} aria-label={ariaLabel} className={['inkra-timeline', className].filter(Boolean).join(' ')} data-orientation={orientation}>
    {items.map((item, index) => <li key={item.id} className="inkra-timeline__item">
      <span className="inkra-timeline__rail" aria-hidden="true">
        <PencilSurface as="span" className="inkra-timeline__marker" variant="quiet" radius={8} seed={`timeline-${item.id}`}>
          <PencilIcon paths={markerPaths} size={24} sourceSize={32} />
        </PencilSurface>
        {index < items.length - 1 && <PencilLine className="inkra-timeline__connector" orientation={orientation === 'vertical' ? 'vertical' : 'horizontal'} seed={`timeline-line-${item.id}`} />}
      </span>
      <div className="inkra-timeline__body">
        {item.dateTime
          ? <time className="inkra-timeline__date" dateTime={item.dateTime}>{copy(item.date)}</time>
          : <span className="inkra-timeline__date">{copy(item.date)}</span>}
        <div className="inkra-timeline__title">{copy(item.title)}</div>
        {item.description != null && <div className="inkra-timeline__description">{copy(item.description)}</div>}
        {item.content != null && <div className="inkra-timeline__content">{item.content}</div>}
      </div>
    </li>)}
  </ol>;
});
