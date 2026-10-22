import { forwardRef, type OlHTMLAttributes, type ReactNode } from 'react';
import { PencilIcon, type PencilIconPath } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';

export type StepStatus = 'upcoming' | 'current' | 'complete' | 'error';

export interface StepItem {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  status?: StepStatus;
  disabled?: boolean;
}

export interface StepsProps extends Omit<OlHTMLAttributes<HTMLOListElement>, 'children'> {
  current?: number;
  items: readonly StepItem[];
  onStepChange?: (index: number, item: StepItem) => void;
  orientation?: 'horizontal' | 'vertical';
}

const markerPaths: Record<StepStatus, readonly PencilIconPath[]> = {
  upcoming: [{ d: 'M16 6a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z' }],
  current: [{ d: 'M16 6a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z' }, { d: 'M16 12a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', mode: 'wash' }],
  complete: [{ d: 'M6 17l6 6L27 8' }],
  error: [{ d: 'M16 6a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM16 10v8M16 22v1' }],
};

const copy = (value: ReactNode) => typeof value === 'string' ? <PencilText>{value}</PencilText> : value;

function resolvedStatus(item: StepItem, index: number, current: number): StepStatus {
  if (item.status) return item.status;
  if (index < current) return 'complete';
  if (index === current) return 'current';
  return 'upcoming';
}

export const Steps = forwardRef<HTMLOListElement, StepsProps>(function Steps(
  { 'aria-label': ariaLabel = 'Progress', className, current = 0, items, onStepChange, orientation = 'horizontal', ...props },
  ref,
) {
  return <ol {...props} ref={ref} aria-label={ariaLabel} className={['inkra-steps', className].filter(Boolean).join(' ')} data-orientation={orientation}>
    {items.map((item, index) => {
      const status = resolvedStatus(item, index, current);
      const interactive = onStepChange !== undefined;
      const content = <>
        {status === 'current' && <PencilSurface aria-hidden="true" className="inkra-steps__selection" variant="selection" seed={`step-${item.id}`} />}
        <span className="inkra-steps__marker" aria-hidden="true"><PencilIcon paths={markerPaths[status]} size={28} sourceSize={32} active={status === 'current'} /></span>
        <span className="inkra-steps__copy">
          <span className="inkra-steps__title">{copy(item.title)}</span>
          {item.description != null && <span className="inkra-steps__description">{copy(item.description)}</span>}
        </span>
      </>;
      const shared = {
        className: 'inkra-steps__control',
        'aria-current': status === 'current' ? 'step' as const : undefined,
        'aria-disabled': item.disabled || undefined,
      };
      return <li key={item.id} className="inkra-steps__item" data-status={status} data-disabled={item.disabled || undefined}>
        {interactive
          ? <button {...shared} type="button" disabled={item.disabled} onClick={() => onStepChange(index, item)}>{content}</button>
          : <div {...shared}>{content}</div>}
        {index < items.length - 1 && <PencilLine className="inkra-steps__connector" orientation={orientation === 'horizontal' ? 'horizontal' : 'vertical'} seed={`step-line-${item.id}`} />}
      </li>;
    })}
  </ol>;
});
