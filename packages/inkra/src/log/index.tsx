import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type UIEvent,
} from 'react';

import { Button } from '../Button.js';
import { PencilIcon, type PencilIconPath } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import { isNearLogBottom, shouldFollowLogUpdate } from './model.js';

export type LogLevelTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface LogLevelDefinition {
  value: string;
  label: ReactNode;
  tone?: LogLevelTone;
}

export interface LogEntry {
  /** Stable and unique within this Log. Changing an id replaces that record. */
  id: string;
  /** Entries render in the exact order supplied by the items array. */
  level?: string;
  time?: ReactNode;
  dateTime?: string;
  icon?: ReactNode;
  content: ReactNode;
}

export interface LogLabels {
  filters: string;
  allLevels: string;
  pause: string;
  resume: string;
  latest: string;
  empty: string;
  noMatches: string;
  list: string;
}

export interface LogProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  items: readonly LogEntry[];
  levels?: readonly LogLevelDefinition[];
  filteredLevels?: readonly string[];
  defaultFilteredLevels?: readonly string[];
  onFilteredLevelsChange?: (levels: readonly string[]) => void;
  paused?: boolean;
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  showLevelFilter?: boolean;
  showFollowControl?: boolean;
  nearBottomThreshold?: number;
  empty?: ReactNode;
  noMatches?: ReactNode;
  labels?: Partial<LogLabels>;
  viewportProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children'>;
}

const defaultLabels: LogLabels = {
  filters: 'Filter log levels',
  allLevels: 'All',
  pause: 'Pause automatic follow',
  resume: 'Resume automatic follow',
  latest: 'Go to latest record',
  empty: 'No records yet',
  noMatches: 'No records match the selected levels',
  list: 'Log records',
};

const defaultTones: Record<string, LogLevelTone> = {
  debug: 'neutral',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'danger',
};

const pausePaths: readonly PencilIconPath[] = [
  { d: 'M8 5v14' },
  { d: 'M16 5v14' },
];
const followPaths: readonly PencilIconPath[] = [
  { d: 'M12 5v14' },
  { d: 'm6 13 6 6 6-6' },
];

function classes(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(' ');
}

function renderText(value: ReactNode, className?: string) {
  return typeof value === 'string' ? <PencilText className={className}>{value}</PencilText> : value;
}

function normalizedThreshold(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value!) : 32;
}

export const Log = forwardRef<HTMLDivElement, LogProps>(function Log(
  {
    'aria-label': ariaLabel,
    className,
    defaultFilteredLevels,
    defaultPaused = false,
    empty,
    filteredLevels,
    items,
    labels: labelOverrides,
    levels,
    nearBottomThreshold,
    noMatches,
    onFilteredLevelsChange,
    onPausedChange,
    paused,
    showFollowControl = true,
    showLevelFilter = true,
    viewportProps,
    ...props
  },
  ref,
) {
  const labels = { ...defaultLabels, ...labelOverrides };
  const resolvedLevels = useMemo<readonly LogLevelDefinition[]>(() => {
    if (levels) return levels;
    const seen = new Set<string>();
    return items.flatMap((item) => {
      if (!item.level || seen.has(item.level)) return [];
      seen.add(item.level);
      return [{ value: item.level, label: item.level, tone: defaultTones[item.level] ?? 'neutral' }];
    });
  }, [items, levels]);
  const availableLevels = useMemo(() => new Set(resolvedLevels.map(level => level.value)), [resolvedLevels]);
  const [uncontrolledLevels, setUncontrolledLevels] = useState<readonly string[] | undefined>(defaultFilteredLevels);
  const selectedLevels = (filteredLevels ?? uncontrolledLevels)?.filter(level => availableLevels.has(level));
  const allLevelsSelected = selectedLevels == null
    || (selectedLevels.length === resolvedLevels.length && resolvedLevels.every(level => selectedLevels.includes(level.value)));
  const [uncontrolledPaused, setUncontrolledPaused] = useState(defaultPaused);
  const resolvedPaused = paused ?? uncontrolledPaused;
  const [nearBottom, setNearBottom] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const previousItemIdsRef = useRef<readonly string[] | null>(null);
  const previousVisibleIdsRef = useRef<readonly string[] | null>(null);
  const previousPausedRef = useRef(resolvedPaused);
  const nearBottomRef = useRef(true);
  const threshold = normalizedThreshold(nearBottomThreshold);
  const visibleItems = selectedLevels == null
    ? items
    : items.filter(item => item.level != null && selectedLevels.includes(item.level));
  const itemIds = items.map(item => item.id);
  const visibleIds = visibleItems.map(item => item.id);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    nearBottomRef.current = true;
    setNearBottom(true);
  }, []);

  useBrowserLayoutEffect(() => {
    const previousItemIds = previousItemIdsRef.current;
    const previousVisibleIds = previousVisibleIdsRef.current;
    const initial = previousItemIds == null;
    const resumed = previousPausedRef.current && !resolvedPaused;
    if (resumed || shouldFollowLogUpdate({
      initial,
      nearBottom: nearBottomRef.current,
      paused: resolvedPaused,
      previousItemIds: previousItemIds ?? [],
      nextItemIds: itemIds,
      previousVisibleIds: previousVisibleIds ?? [],
      nextVisibleIds: visibleIds,
    })) scrollToLatest('auto');
    previousItemIdsRef.current = itemIds;
    previousVisibleIdsRef.current = visibleIds;
    previousPausedRef.current = resolvedPaused;
  }, [itemIds.join('\u0000'), resolvedPaused, scrollToLatest, visibleIds.join('\u0000')]);

  function changePaused(nextPaused: boolean) {
    if (paused === undefined) setUncontrolledPaused(nextPaused);
    onPausedChange?.(nextPaused);
  }

  function changeLevels(nextLevels: readonly string[] | undefined) {
    if (filteredLevels === undefined) setUncontrolledLevels(nextLevels);
    onFilteredLevelsChange?.(nextLevels ?? resolvedLevels.map(level => level.value));
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    viewportProps?.onScroll?.(event);
    const viewport = event.currentTarget;
    const nextNearBottom = isNearLogBottom(viewport, threshold);
    nearBottomRef.current = nextNearBottom;
    setNearBottom(current => current === nextNearBottom ? current : nextNearBottom);
  }

  function handleViewportKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    viewportProps?.onKeyDown?.(event);
    if (event.defaultPrevented || event.target !== event.currentTarget) return;
    if (event.key === 'Home') {
      event.preventDefault();
      event.currentTarget.scrollTo({ top: 0 });
    } else if (event.key === 'End') {
      event.preventDefault();
      scrollToLatest();
    }
  }

  const hasFilter = !allLevelsSelected;
  const isEmpty = items.length === 0;
  const viewportLabel = viewportProps?.['aria-label'] ?? ariaLabel ?? labels.list;
  const viewportClassName = classes('inkra-log__viewport', viewportProps?.className);
  const viewportTabIndex = viewportProps?.tabIndex ?? 0;
  const levelMap = new Map(resolvedLevels.map(level => [level.value, level]));

  return (
    <PencilSurface
      {...props}
      as="div"
      className={classes('inkra-log', className)}
      data-paused={resolvedPaused || undefined}
      data-toolbar={((showLevelFilter && resolvedLevels.length > 0) || showFollowControl) || undefined}
      ref={ref}
      variant="paper"
    >
      {(showLevelFilter && resolvedLevels.length > 0) || showFollowControl ? <div className="inkra-log__toolbar">
        {showLevelFilter && resolvedLevels.length > 0 ? <div aria-label={labels.filters} className="inkra-log__filters" role="group">
          <Button
            aria-pressed={!hasFilter}
            size="sm"
            variant={!hasFilter ? 'secondary' : 'ghost'}
            onClick={() => changeLevels(undefined)}
          >
            {labels.allLevels}
          </Button>
          {resolvedLevels.map(level => {
            const selected = allLevelsSelected || selectedLevels?.includes(level.value) === true;
            return <Button
              aria-pressed={selected}
              data-level={level.value}
              data-tone={level.tone ?? defaultTones[level.value] ?? 'neutral'}
              key={level.value}
              size="sm"
              variant={selected ? 'secondary' : 'ghost'}
              onClick={() => {
                const active = selectedLevels ?? resolvedLevels.map(option => option.value);
                changeLevels(selected
                  ? active.filter(value => value !== level.value)
                  : [...active, level.value]);
              }}
            >
              {level.label}
            </Button>;
          })}
        </div> : null}
        {showFollowControl ? <Button
          aria-pressed={resolvedPaused}
          className="inkra-log__follow-control"
          size="sm"
          startIcon={<PencilIcon paths={resolvedPaused ? followPaths : pausePaths} size={18} sourceSize={24} />}
          variant="outline"
          onClick={() => changePaused(!resolvedPaused)}
        >
          {resolvedPaused ? labels.resume : labels.pause}
        </Button> : null}
        <PencilLine className="inkra-log__toolbar-divider" seed="inkra-log-toolbar-divider" />
      </div> : null}
      <div
        {...viewportProps}
        aria-label={viewportLabel}
        className={viewportClassName}
        onKeyDown={handleViewportKeyDown}
        onScroll={handleScroll}
        ref={viewportRef}
        role="region"
        tabIndex={viewportTabIndex}
      >
        {visibleItems.length > 0 ? <ol className="inkra-log__list">
          {visibleItems.map((item, index) => {
            const definition = item.level ? levelMap.get(item.level) : undefined;
            const tone = definition?.tone ?? (item.level ? defaultTones[item.level] : undefined) ?? 'neutral';
            return <li className="inkra-log__item" data-has-icon={item.icon != null || undefined} data-level={item.level} data-tone={tone} key={item.id}>
              {index > 0 ? <PencilLine className="inkra-log__item-divider" seed={`inkra-log-item-${item.id}-divider`} /> : null}
              {item.icon == null ? null : <span aria-hidden="true" className="inkra-log__icon">{item.icon}</span>}
              <div className="inkra-log__record">
                {item.time == null && item.level == null ? null : <div className="inkra-log__meta">
                  {item.time == null ? null : item.dateTime
                    ? <time dateTime={item.dateTime}>{renderText(item.time)}</time>
                    : <span>{renderText(item.time)}</span>}
                  {item.level == null ? null : <span className="inkra-log__level">{renderText(definition?.label ?? item.level)}</span>}
                </div>}
                <div className="inkra-log__content">{renderText(item.content)}</div>
              </div>
            </li>;
          })}
        </ol> : <div className="inkra-log__empty">{renderText(isEmpty ? (empty ?? labels.empty) : (noMatches ?? labels.noMatches))}</div>}
      </div>
      {(!nearBottom || resolvedPaused) && visibleItems.length > 0 ? <div className="inkra-log__latest">
        <Button
          size="sm"
          startIcon={<PencilIcon paths={followPaths} size={18} sourceSize={24} />}
          variant="secondary"
          onClick={() => {
            if (resolvedPaused) changePaused(false);
            else scrollToLatest();
          }}
        >
          {resolvedPaused ? labels.resume : labels.latest}
        </Button>
      </div> : null}
    </PencilSurface>
  );
});
