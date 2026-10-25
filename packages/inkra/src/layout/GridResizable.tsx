import { Fragment, forwardRef, useId, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { Resizable } from '../resizable/index.js';
import type { ResizableLayout, ResizablePanelProps } from '../resizable/index.js';

export interface GridTrack {
  id: string;
  minSize?: ResizablePanelProps['minSize'];
  maxSize?: ResizablePanelProps['maxSize'];
}

export interface GridResizableProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  columns: readonly GridTrack[];
  rows: readonly GridTrack[];
  columnSizes?: ResizableLayout;
  defaultColumnSizes?: ResizableLayout;
  rowSizes?: ResizableLayout;
  defaultRowSizes?: ResizableLayout;
  onColumnSizesChange?: (sizes: ResizableLayout) => void;
  onRowSizesChange?: (sizes: ResizableLayout) => void;
  onColumnSizesCommit?: (sizes: ResizableLayout) => void;
  onRowSizesCommit?: (sizes: ResizableLayout) => void;
  resizeColumns?: boolean;
  resizeRows?: boolean;
  disabled?: boolean;
  getHandleLabel?: (axis: 'column' | 'row', before: string, after: string) => string;
  children: (cell: { row: string; column: string; rowIndex: number; columnIndex: number }) => ReactNode;
}

const equal = (a: ResizableLayout, b: ResizableLayout) => Object.keys(a).length === Object.keys(b).length
  && Object.keys(a).every(key => Math.abs(a[key] - (b[key] ?? -1)) < 0.001);
const even = (tracks: readonly GridTrack[]): ResizableLayout => Object.fromEntries(tracks.map(track => [track.id, 100 / tracks.length]));
const scoped = (layout: ResizableLayout, prefix: string): ResizableLayout => Object.fromEntries(Object.entries(layout).map(([key, value]) => [`${prefix}${key}`, value]));
const unscoped = (layout: ResizableLayout, prefix: string): ResizableLayout => Object.fromEntries(Object.entries(layout).map(([key, value]) => [key.slice(prefix.length), value]));

/** Shared column sizes keep every row aligned; the existing Resizable engine owns all gestures. */
export const GridResizable = forwardRef<HTMLDivElement, GridResizableProps>(function GridResizable({
  columns, rows, columnSizes, defaultColumnSizes, rowSizes, defaultRowSizes,
  onColumnSizesChange, onRowSizesChange, onColumnSizesCommit, onRowSizesCommit,
  resizeColumns = true, resizeRows = true, disabled = false, getHandleLabel,
  className, children, ...props
}, ref) {
  const id = useId();
  const [localColumns, setColumns] = useState(() => defaultColumnSizes ?? even(columns));
  const [localRows, setRows] = useState(() => defaultRowSizes ?? even(rows));
  const currentColumns = columnSizes ?? localColumns;
  const currentRows = rowSizes ?? localRows;
  const rowPrefix = `${id}-row-`;
  const changeColumns = (next: ResizableLayout) => {
    if (equal(next, currentColumns)) return;
    if (columnSizes === undefined) setColumns(next);
    onColumnSizesChange?.(next);
  };
  const changeRows = (next: ResizableLayout) => {
    if (equal(next, currentRows)) return;
    if (rowSizes === undefined) setRows(next);
    onRowSizesChange?.(next);
  };
  return <div {...props} ref={ref} className={['inkra-grid-resizable', className].filter(Boolean).join(' ')}>
    <Resizable.Root id={`${id}-rows`} orientation="vertical" disabled={disabled || !resizeRows}
      layout={scoped(currentRows, rowPrefix)} onLayoutChange={next => changeRows(unscoped(next, rowPrefix))}
      onLayoutCommit={next => onRowSizesCommit?.(unscoped(next, rowPrefix))}>
      {rows.map((row, rowIndex) => {
        const columnPrefix = `${id}-${row.id}-column-`;
        return <Fragment key={row.id}>
        {rowIndex > 0 && <Resizable.Handle label={getHandleLabel?.('row', rows[rowIndex - 1].id, row.id)} />}
        <Resizable.Panel {...row} id={`${rowPrefix}${row.id}`}>
          <Resizable.Root id={`${id}-${row.id}-columns`} disabled={disabled || !resizeColumns}
            layout={scoped(currentColumns, columnPrefix)} onLayoutChange={next => changeColumns(unscoped(next, columnPrefix))}
            onLayoutCommit={next => onColumnSizesCommit?.(unscoped(next, columnPrefix))}>
            {columns.map((column, columnIndex) => <Fragment key={column.id}>
              {columnIndex > 0 && <Resizable.Handle label={getHandleLabel?.('column', columns[columnIndex - 1].id, column.id)} />}
              <Resizable.Panel {...column} id={`${columnPrefix}${column.id}`}>
                <div className="inkra-grid-resizable__cell">{children({ row: row.id, column: column.id, rowIndex, columnIndex })}</div>
              </Resizable.Panel>
            </Fragment>)}
          </Resizable.Root>
        </Resizable.Panel>
      </Fragment>;
      })}
    </Resizable.Root>
  </div>;
});
