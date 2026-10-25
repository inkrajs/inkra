import { useInkraLocale } from '../i18n/index.js';
import { scaleLinear, scaleQuantize } from 'd3-scale';
import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from 'react';

import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';

export type HeatmapKey = string | number;
export type HeatmapScaleType = 'continuous' | 'quantize';

export interface HeatmapAxisItem {
  id: HeatmapKey;
  label: ReactNode;
  ariaLabel?: string;
}

export interface HeatmapCell {
  rowId: HeatmapKey;
  columnId: HeatmapKey;
  value?: number | null;
  disabled?: boolean;
  data?: unknown;
}

export interface HeatmapSelection {
  rowId: HeatmapKey;
  columnId: HeatmapKey;
}

export interface HeatmapCellContext {
  row: HeatmapAxisItem;
  column: HeatmapAxisItem;
  color: string | null;
  missing: boolean;
  selected: boolean;
  active: boolean;
}

export interface HeatmapDetailsContext extends HeatmapCellContext {
  valueLabel: string;
}

export interface HeatmapProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'> {
  rows: readonly HeatmapAxisItem[];
  columns: readonly HeatmapAxisItem[];
  cells: readonly HeatmapCell[];
  label: ReactNode;
  description?: ReactNode;
  scaleType?: HeatmapScaleType;
  domain?: readonly [number, number];
  colorRange?: readonly string[];
  binCount?: number;
  showLegend?: boolean;
  showValues?: boolean;
  legendLabel?: ReactNode;
  missingLabel?: ReactNode;
  missingValueLabel?: string;
  selectionMode?: 'single' | 'none';
  selectedCell?: HeatmapSelection | null;
  defaultSelectedCell?: HeatmapSelection | null;
  onSelectedCellChange?: (selection: HeatmapSelection | null, cell: HeatmapCell | null) => void;
  getValueLabel?: (value: number) => string;
  getCellAriaLabel?: (cell: HeatmapCell, context: HeatmapDetailsContext) => string;
  renderCell?: (cell: HeatmapCell, context: HeatmapCellContext) => ReactNode;
  renderDetails?: (cell: HeatmapCell, context: HeatmapDetailsContext) => ReactNode;
  cellSize?: number | string;
  rowLabelWidth?: number | string;
  rowHeaderLabel?: string;
  emptyMessage?: ReactNode;
}

interface Position {
  rowIndex: number;
  columnIndex: number;
}

const defaultColors = ['#f0dda0', '#b6d09b', '#70b19c', '#43869a', '#365f82'] as const;

function classes(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

function keyPart(value: HeatmapKey) {
  return JSON.stringify([typeof value, value]);
}

function cellKey(rowId: HeatmapKey, columnId: HeatmapKey) {
  return JSON.stringify([typeof rowId, rowId, typeof columnId, columnId]);
}

function sameSelection(a: HeatmapSelection | null | undefined, b: HeatmapSelection | null | undefined) {
  return a != null && b != null && a.rowId === b.rowId && a.columnId === b.columnId;
}

function axisLabel(item: HeatmapAxisItem) {
  if (item.ariaLabel) return item.ariaLabel;
  if (typeof item.label === 'string' || typeof item.label === 'number') return String(item.label);
  return String(item.id);
}

function isMissing(cell: HeatmapCell) {
  return typeof cell.value !== 'number' || !Number.isFinite(cell.value);
}

function normalizeCssSize(value: number | string, fallback: string) {
  return typeof value === 'number'
    ? Number.isFinite(value) ? `${Math.max(1, value)}px` : fallback
    : value || fallback;
}

function normalizeDomain(values: readonly number[], requested?: readonly [number, number]): [number, number] {
  let minimum: number;
  let maximum: number;

  if (requested && Number.isFinite(requested[0]) && Number.isFinite(requested[1])) {
    minimum = Math.min(requested[0], requested[1]);
    maximum = Math.max(requested[0], requested[1]);
  } else if (values.length > 0) {
    minimum = values[0];
    maximum = values[0];
    for (let index = 1; index < values.length; index += 1) {
      minimum = Math.min(minimum, values[index]);
      maximum = Math.max(maximum, values[index]);
    }
  } else {
    return [0, 1];
  }

  if (minimum !== maximum) return [minimum, maximum];
  const padding = Math.abs(minimum) * 0.5 || 1;
  return [minimum - padding, maximum + padding];
}

function paletteDomain(domain: readonly [number, number], count: number) {
  const [minimum, maximum] = domain;
  if (count <= 1) return [minimum];
  return Array.from({ length: count }, (_, index) => minimum + ((maximum - minimum) * index) / (count - 1));
}

function clampBinCount(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return 5;
  return Math.max(2, Math.min(9, Math.round(value ?? 5)));
}

function resolvePosition(
  selection: HeatmapSelection | null | undefined,
  rows: readonly HeatmapAxisItem[],
  columns: readonly HeatmapAxisItem[],
): Position | null {
  if (!selection) return null;
  const rowIndex = rows.findIndex(row => row.id === selection.rowId);
  const columnIndex = columns.findIndex(column => column.id === selection.columnId);
  return rowIndex < 0 || columnIndex < 0 ? null : { rowIndex, columnIndex };
}

function positionEquals(a: Position | null, b: Position | null) {
  return a?.rowIndex === b?.rowIndex && a?.columnIndex === b?.columnIndex;
}

function defaultValueLabel(value: number) {
  return String(value);
}

function paintStyle(color: string) {
  return {
    '--inkra-accent': color,
    '--inkra-accent-soft': color,
    '--inkra-accent-strong': color,
  } as CSSProperties;
}

export const Heatmap = forwardRef<HTMLDivElement, HeatmapProps>(function Heatmap(inkraProps, forwardedRef) {
  const { t } = useInkraLocale();
  const {
  rows,
  columns,
  cells,
  label,
  description,
  scaleType = 'continuous',
  domain: requestedDomain,
  colorRange = defaultColors,
  binCount,
  showLegend = true,
  showValues = true,
  legendLabel = t('heatmap.intensity'),
  missingLabel = '—',
  missingValueLabel = t('common.missing'),
  selectionMode = 'single',
  selectedCell,
  defaultSelectedCell = null,
  onSelectedCellChange,
  getValueLabel = defaultValueLabel,
  getCellAriaLabel,
  renderCell,
  renderDetails,
  cellSize = 56,
  rowLabelWidth = '8rem',
  rowHeaderLabel = t('heatmap.rows'),
  emptyMessage = t('heatmap.empty'),
  className,
  style,
  ...props
} = inkraProps;
  const generatedId = useId();
  const labelId = `inkra-heatmap-${generatedId}-label`;
  const descriptionId = description == null ? undefined : `inkra-heatmap-${generatedId}-description`;
  const detailsId = `inkra-heatmap-${generatedId}-details`;
  const isControlled = selectedCell !== undefined;
  const [internalSelection, setInternalSelection] = useState<HeatmapSelection | null>(defaultSelectedCell);
  const resolvedSelection = isControlled ? selectedCell ?? null : internalSelection;
  const initialPosition = resolvePosition(resolvedSelection, rows, columns) ?? (
    rows.length > 0 && columns.length > 0 ? { rowIndex: 0, columnIndex: 0 } : null
  );
  const [activePosition, setActivePosition] = useState<Position | null>(initialPosition);
  const [hoveredPosition, setHoveredPosition] = useState<Position | null>(null);
  const [focusedPosition, setFocusedPosition] = useState<Position | null>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const rowSignature = JSON.stringify(rows.map(row => [typeof row.id, row.id]));
  const columnSignature = JSON.stringify(columns.map(column => [typeof column.id, column.id]));

  const cellsByKey = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    for (const cell of cells) map.set(cellKey(cell.rowId, cell.columnId), cell);
    return map;
  }, [cells]);

  const matrix = useMemo(() => rows.map(row => columns.map(column => (
    cellsByKey.get(cellKey(row.id, column.id)) ?? { rowId: row.id, columnId: column.id, value: null }
  ))), [cellsByKey, columns, rows]);

  const values = useMemo(() => matrix.flat().filter(cell => !isMissing(cell)).map(cell => cell.value as number), [matrix]);
  const domain = useMemo(() => normalizeDomain(values, requestedDomain), [requestedDomain, values]);
  const colors = colorRange.length >= 2 ? colorRange : defaultColors;
  const continuousScale = useMemo(() => scaleLinear<string>()
    .domain(paletteDomain(domain, colors.length))
    .range([...colors])
    .clamp(true), [colors, domain]);
  const resolvedBinCount = clampBinCount(binCount);
  const quantizedColors = useMemo(() => Array.from(
    { length: resolvedBinCount },
    (_, index) => continuousScale(domain[0] + ((domain[1] - domain[0]) * index) / Math.max(1, resolvedBinCount - 1)),
  ), [continuousScale, domain, resolvedBinCount]);
  const quantizeScale = useMemo(() => scaleQuantize<string>()
    .domain(domain)
    .range(quantizedColors), [domain, quantizedColors]);
  const colorForValue = (value: number) => scaleType === 'quantize' ? quantizeScale(value) : continuousScale(value);

  const selectedPosition = resolvePosition(resolvedSelection, rows, columns);
  const inspectedPosition = focusedPosition ?? hoveredPosition ?? selectedPosition ?? activePosition;
  const inspectedCell = inspectedPosition ? matrix[inspectedPosition.rowIndex]?.[inspectedPosition.columnIndex] : undefined;

  useEffect(() => {
    const next = resolvePosition(resolvedSelection, rows, columns);
    if (next) setActivePosition(current => positionEquals(current, next) ? current : next);
  }, [columnSignature, resolvedSelection?.columnId, resolvedSelection?.rowId, rowSignature]);

  useEffect(() => {
    if (rows.length === 0 || columns.length === 0) {
      setActivePosition(null);
      return;
    }
    setActivePosition(current => current && current.rowIndex < rows.length && current.columnIndex < columns.length
      ? current
      : { rowIndex: 0, columnIndex: 0 });
  }, [columns.length, rows.length]);

  const focusPosition = (position: Position) => {
    setActivePosition(position);
    const cell = matrix[position.rowIndex]?.[position.columnIndex];
    if (!cell) return;
    cellRefs.current.get(cellKey(cell.rowId, cell.columnId))?.focus();
  };

  const select = (cell: HeatmapCell) => {
    if (selectionMode === 'none' || cell.disabled) return;
    const next = { rowId: cell.rowId, columnId: cell.columnId };
    if (!isControlled) setInternalSelection(next);
    onSelectedCellChange?.(next, cell);
  };

  const onCellKeyDown = (event: KeyboardEvent<HTMLButtonElement>, position: Position, cell: HeatmapCell) => {
    let next = position;
    if (event.key === 'ArrowLeft') next = { ...position, columnIndex: Math.max(0, position.columnIndex - 1) };
    else if (event.key === 'ArrowRight') next = { ...position, columnIndex: Math.min(columns.length - 1, position.columnIndex + 1) };
    else if (event.key === 'ArrowUp') next = { ...position, rowIndex: Math.max(0, position.rowIndex - 1) };
    else if (event.key === 'ArrowDown') next = { ...position, rowIndex: Math.min(rows.length - 1, position.rowIndex + 1) };
    else if (event.key === 'Home') next = event.ctrlKey ? { rowIndex: 0, columnIndex: 0 } : { ...position, columnIndex: 0 };
    else if (event.key === 'End') next = event.ctrlKey
      ? { rowIndex: rows.length - 1, columnIndex: columns.length - 1 }
      : { ...position, columnIndex: columns.length - 1 };
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(cell);
      return;
    } else return;

    event.preventDefault();
    focusPosition(next);
  };

  const rootStyle = {
    ...style,
    '--inkra-heatmap-cell-size': normalizeCssSize(cellSize, '56px'),
    '--inkra-heatmap-row-label-width': normalizeCssSize(rowLabelWidth, '8rem'),
    '--inkra-heatmap-column-count': columns.length,
  } as CSSProperties;

  const renderCellContent = (cell: HeatmapCell, context: HeatmapCellContext) => {
    if (renderCell) return renderCell(cell, context);
    if (context.missing) return missingLabel;
    return showValues ? getValueLabel(cell.value as number) : <span aria-hidden="true" className="inkra-heatmap__value-mark" />;
  };

  const detailsFor = (cell: HeatmapCell, position: Position) => {
    const row = rows[position.rowIndex];
    const column = columns[position.columnIndex];
    const missing = isMissing(cell);
    const valueLabel = missing ? missingValueLabel : getValueLabel(cell.value as number);
    const context: HeatmapDetailsContext = {
      row,
      column,
      color: missing ? null : colorForValue(cell.value as number),
      missing,
      selected: sameSelection(resolvedSelection, cell),
      active: positionEquals(inspectedPosition, position),
      valueLabel,
    };
    return { context, valueLabel };
  };

  return (
    <div {...props} className={classes('inkra-heatmap', className)} ref={forwardedRef} style={rootStyle}>
      <div className="inkra-heatmap__heading">
        <div className="inkra-heatmap__label" id={labelId}>
          {typeof label === 'string' ? <PencilText seed={`${generatedId}-label`}>{label}</PencilText> : label}
        </div>
        {description == null ? null : <div className="inkra-heatmap__description" id={descriptionId}>{description}</div>}
      </div>

      {rows.length === 0 || columns.length === 0 ? (
        <div className="inkra-heatmap__empty">{emptyMessage}</div>
      ) : (
        <div className="inkra-heatmap__viewport">
          <div
            aria-describedby={classes(descriptionId, detailsId)}
            aria-labelledby={labelId}
            aria-rowcount={rows.length + 1}
            aria-colcount={columns.length + 1}
            className="inkra-heatmap__grid"
            role="grid"
          >
            <div aria-rowindex={1} className="inkra-heatmap__row inkra-heatmap__row--header" role="row">
              <span aria-colindex={1} aria-label={rowHeaderLabel} className="inkra-heatmap__corner" role="columnheader" />
              {columns.map((column, columnIndex) => (
                <span aria-colindex={columnIndex + 2} className="inkra-heatmap__column-label" key={keyPart(column.id)} role="columnheader">
                  {column.label}
                </span>
              ))}
            </div>
            {matrix.map((rowCells, rowIndex) => {
              const row = rows[rowIndex];
              return (
                <div aria-rowindex={rowIndex + 2} className="inkra-heatmap__row" key={keyPart(row.id)} role="row">
                  <span aria-colindex={1} className="inkra-heatmap__row-label" role="rowheader">{row.label}</span>
                  {rowCells.map((cell, columnIndex) => {
                    const position = { rowIndex, columnIndex };
                    const column = columns[columnIndex];
                    const missing = isMissing(cell);
                    const selected = sameSelection(resolvedSelection, cell);
                    const active = positionEquals(inspectedPosition, position);
                    const color = missing ? null : colorForValue(cell.value as number);
                    const valueLabel = missing ? missingValueLabel : getValueLabel(cell.value as number);
                    const context: HeatmapDetailsContext = { row, column, color, missing, selected, active, valueLabel };
                    const ariaLabel = getCellAriaLabel?.(cell, context)
                      ?? `${axisLabel(row)}, ${axisLabel(column)}: ${valueLabel}`;
                    const resolvedPaintStyle = color ? paintStyle(color) : undefined;

                    return (
                      <button
                        aria-colindex={columnIndex + 2}
                        aria-disabled={cell.disabled || undefined}
                        aria-label={ariaLabel}
                        aria-selected={selectionMode === 'single' ? selected : undefined}
                        className="inkra-heatmap__cell"
                        data-active={active || undefined}
                        data-disabled={cell.disabled || undefined}
                        data-missing={missing || undefined}
                        data-selected={selected || undefined}
                        data-value={missing ? undefined : cell.value}
                        key={cellKey(cell.rowId, cell.columnId)}
                        onBlur={() => setFocusedPosition(current => positionEquals(current, position) ? null : current)}
                        onClick={() => select(cell)}
                        onFocus={() => {
                          setActivePosition(position);
                          setFocusedPosition(position);
                        }}
                        onKeyDown={event => onCellKeyDown(event, position, cell)}
                        onMouseEnter={() => setHoveredPosition(position)}
                        onMouseLeave={() => setHoveredPosition(current => positionEquals(current, position) ? null : current)}
                        ref={node => {
                          const key = cellKey(cell.rowId, cell.columnId);
                          if (node) cellRefs.current.set(key, node);
                          else cellRefs.current.delete(key);
                        }}
                        role="gridcell"
                        tabIndex={positionEquals(activePosition, position) ? 0 : -1}
                        type="button"
                      >
                        <PencilSurface
                          aria-hidden="true"
                          as="span"
                          className="inkra-heatmap__cell-paint"
                          radius={6}
                          seed={`heatmap-${cellKey(cell.rowId, cell.columnId)}-paint`}
                          style={resolvedPaintStyle}
                          variant={missing ? 'outline' : 'action'}
                        />
                        {selected ? <PencilSurface aria-hidden="true" as="span" className="inkra-heatmap__cell-selection" radius={6} seed={`heatmap-${cellKey(cell.rowId, cell.columnId)}-selection`} variant="selection" /> : null}
                        <span className="inkra-heatmap__cell-content">{renderCellContent(cell, context)}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showLegend && rows.length > 0 && columns.length > 0 ? (
        <div aria-label={typeof legendLabel === 'string' ? legendLabel : undefined} className="inkra-heatmap__legend" role="group">
          <div className="inkra-heatmap__legend-label">{legendLabel}</div>
          {scaleType === 'continuous' ? (
            <div className="inkra-heatmap__legend-continuous">
              <div aria-hidden="true" className="inkra-heatmap__legend-strip">
                {Array.from({ length: 7 }, (_, index) => {
                  const value = domain[0] + ((domain[1] - domain[0]) * index) / 6;
                  const color = continuousScale(value);
                  return <PencilSurface as="span" className="inkra-heatmap__legend-swatch" key={index} seed={`heatmap-legend-${index}`} style={paintStyle(color)} variant="action" />;
                })}
              </div>
              <div className="inkra-heatmap__legend-values">
                <span>{getValueLabel(domain[0])}</span>
                <span>{getValueLabel((domain[0] + domain[1]) / 2)}</span>
                <span>{getValueLabel(domain[1])}</span>
              </div>
            </div>
          ) : (
            <div className="inkra-heatmap__legend-bins" role="list">
              {quantizedColors.map((color, index) => {
                const [from, to] = quantizeScale.invertExtent(color);
                return <div className="inkra-heatmap__legend-bin" key={`${color}-${index}`} role="listitem">
                  <PencilSurface aria-hidden="true" as="span" className="inkra-heatmap__legend-swatch" seed={`heatmap-bin-${index}`} style={paintStyle(color)} variant="action" />
                  <span>{getValueLabel(from)}–{getValueLabel(to)}</span>
                </div>;
              })}
            </div>
          )}
          <div className="inkra-heatmap__legend-missing">
            <PencilSurface aria-hidden="true" as="span" className="inkra-heatmap__legend-swatch" seed="heatmap-missing" variant="outline" />
            <span>{missingValueLabel}</span>
          </div>
        </div>
      ) : null}

      <div aria-live="polite" className="inkra-heatmap__details" id={detailsId}>
        {inspectedCell && inspectedPosition ? (() => {
          const { context, valueLabel } = detailsFor(inspectedCell, inspectedPosition);
          return renderDetails
            ? renderDetails(inspectedCell, context)
            : <><strong>{axisLabel(context.row)} · {axisLabel(context.column)}</strong><span>{valueLabel}</span></>;
        })() : null}
      </div>
    </div>
  );
});
