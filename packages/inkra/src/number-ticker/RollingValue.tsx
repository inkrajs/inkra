import { PencilText } from '../PencilText.js';
import { rollMix } from './rolling.js';
import type { RollingMotionColumn } from './rolling.js';

export function RollingValue({ columns, progress, direction }: {
  columns: RollingMotionColumn[];
  progress: number;
  direction: 'up' | 'down';
}) {
  return <span className="inkra-number-ticker__reels" dir="ltr" data-direction={direction}>
    {columns.map(column => {
      const width = rollMix(column.fromWidth, column.toWidth, progress);
      return <span className="inkra-number-ticker__column" data-place={column.key} data-digit={column.digit || undefined} data-departing={column.target === '' || undefined}
        key={column.key} style={column.digit ? { width: `${width}ch` } : { gridTemplateColumns: `${width}fr` }}>
        <span className="inkra-number-ticker__column-inner">
          {column.faces.map(face => <span className="inkra-number-ticker__face" data-face={face.text === column.target ? 'to' : 'from'} key={face.text}
            style={{ transform: column.digit ? `translateY(${rollMix(face.fromOffset, face.toOffset, progress) * 100}%)` : undefined,
              opacity: rollMix(face.fromOpacity, face.toOpacity, progress) }}>
            <PencilText seed={`ticker-reel-${column.key}-${face.text}`}>{face.text}</PencilText>
          </span>)}
        </span>
      </span>;
    })}
  </span>;
}
