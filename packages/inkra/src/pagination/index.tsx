import { useInkraLocale, type InkraTranslate } from '../i18n/index.js';
import { forwardRef, useEffect, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { Button } from '../Button.js';
import type { ButtonVariant } from '../Button.js';
import { Select } from '../select/index.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { clampPage, getPaginationEntries, normalizeTotal } from './model.js';

export interface PaginationLabels {
  nav: string;
  first: string;
  previous: string;
  next: string;
  last: string;
  page: (page: number) => string;
  ellipsis: string;
  pageSize?: string;
  pageSizeOption?: (pageSize: number) => string;
}

export interface PaginationProps extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'onChange'> {
  totalPages: number;
  page?: number;
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  siblingCount?: number;
  boundaryCount?: number;
  showFirstLast?: boolean;
  showPreviousNext?: boolean;
  hideOnSinglePage?: boolean;
  simple?: boolean;
  /** Non-interactive content inside each numbered page button. */
  renderPage?: (page: number, state: { isCurrent: boolean }) => ReactNode;
  /** Non-interactive current/total content in simple mode. */
  renderSummary?: (page: number, totalPages: number) => ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  labels?: Partial<PaginationLabels>;
  /** Appearance of numbered and boundary buttons; defaults to ghost. */
  variant?: ButtonVariant;
  /** Logical alignment of the size selector and page controls. */
  align?: 'start' | 'center' | 'end';
  /** Wrap page controls instead of scrolling them horizontally. */
  wrap?: boolean;
  /** Controlled positive safe-integer page size. Does not paginate caller data. */
  pageSize?: number;
  /** Initial uncontrolled page size; defaults to 10. */
  defaultPageSize?: number;
  /** Enable the size selector with positive safe integers; invalid entries are ignored. */
  pageSizeOptions?: readonly number[];
  /** Requests a page size, then requests page 1 when the current page is above 1. */
  onPageSizeChange?: (pageSize: number) => void;
}

const defaultLabels = (t: InkraTranslate): Required<PaginationLabels> => ({
  nav: t('pagination.nav'), first: t('pagination.first'), previous: t('common.previousPage'), next: t('common.nextPage'), last: t('pagination.last'),
  page: page => t('pagination.page', { page }), ellipsis: t('pagination.more'),
  pageSize: t('pagination.pageSize'), pageSizeOption: pageSize => t('pagination.pageSizeOption', { pageSize }),
});

export const Pagination = forwardRef<HTMLElement, PaginationProps>(function Pagination({
  totalPages, page, defaultPage = 1, onPageChange, siblingCount = 1, boundaryCount = 1,
  showFirstLast = false, showPreviousNext = true, hideOnSinglePage = false, simple = false,
  renderPage, renderSummary, disabled = false, size = 'md', labels, className,
  variant = 'ghost', align = 'start', wrap = false,
  pageSize, defaultPageSize = 10, pageSizeOptions, onPageSizeChange, ...props
}, ref) {
  const { t } = useInkraLocale();
  const total = normalizeTotal(totalPages);
  const [internalPage, setInternalPage] = useState(() => clampPage(defaultPage, total));
  const current = clampPage(page ?? internalPage, total);
  const [internalPageSize, setInternalPageSize] = useState(() => normalizePageSize(defaultPageSize) ?? 10);
  const currentPageSize = normalizePageSize(pageSize ?? internalPageSize) ?? 10;
  const sizeOptions = [...new Set((pageSizeOptions ?? []).filter(value => normalizePageSize(value) !== undefined))];
  if (sizeOptions.length && !sizeOptions.includes(currentPageSize)) sizeOptions.push(currentPageSize);
  sizeOptions.sort((left, right) => left - right);
  const showPages = !hideOnSinglePage || total > 1;
  const text = { ...defaultLabels(t), ...labels };
  useEffect(() => {
    if (page === undefined) setInternalPage(value => clampPage(value, total));
  }, [page, total]);

  function select(next: number) {
    const target = clampPage(next, total);
    if (disabled || !total || target === current) return;
    if (page === undefined) setInternalPage(target);
    onPageChange?.(target);
  }

  function selectPageSize(value: string) {
    const next = normalizePageSize(Number(value));
    if (disabled || next === undefined || !sizeOptions.includes(next) || next === currentPageSize) return;
    if (pageSize === undefined) setInternalPageSize(next);
    if (page === undefined) setInternalPage(clampPage(1, total));
    onPageSizeChange?.(next);
    if (current > 1) onPageChange?.(1);
  }

  const arrow = (kind: 'first' | 'previous' | 'next' | 'last', target: number, unavailable: boolean) => {
    const backwards = kind === 'first' || kind === 'previous';
    const paths = [{ d: backwards ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6' }];
    if (kind === 'first') paths.push({ d: 'M5 6v12' });
    if (kind === 'last') paths.push({ d: 'M19 6v12' });
    return <li key={kind}><Button variant={variant} size={size === 'md' ? 'icon' : `icon-${size}`}
      aria-label={text[kind]} title={text[kind]} disabled={disabled || unavailable} onClick={() => select(target)}>
      <PencilIcon className="inkra-pagination__arrow" paths={paths} size={20} sourceSize={24} />
    </Button></li>;
  };

  if (!showPages && !sizeOptions.length) return null;
  return <nav aria-label={text.nav} {...props} ref={ref} className={['inkra-pagination', className].filter(Boolean).join(' ')} data-empty={!total || undefined} data-simple={simple || undefined} data-align={align} data-wrap={wrap || undefined}>
    {sizeOptions.length > 0 && <div className="inkra-pagination__size">
      <Select.Root dir={props.dir === 'rtl' ? 'rtl' : props.dir === 'ltr' ? 'ltr' : undefined} value={String(currentPageSize)} onValueChange={selectPageSize} disabled={disabled}>
        <Select.Trigger aria-label={text.pageSize} size={size} fullWidth={false}>
          <Select.Value><PencilText>{text.pageSizeOption(currentPageSize)}</PencilText></Select.Value>
        </Select.Trigger>
        <Select.Portal><Select.Content><Select.Viewport>
          {sizeOptions.map(value => <Select.Item key={value} value={String(value)}>
            <Select.ItemText>{text.pageSizeOption(value)}</Select.ItemText>
            <Select.ItemIndicator />
          </Select.Item>)}
        </Select.Viewport></Select.Content></Select.Portal>
      </Select.Root>
    </div>}
    {showPages && <ul className="inkra-pagination__list">
      {showFirstLast && arrow('first', 1, current <= 1)}
      {showPreviousNext && arrow('previous', current - 1, current <= 1)}
      {simple ? <li className="inkra-pagination__summary" aria-live="polite" aria-atomic="true">
        {renderSummary ? renderSummary(current, total) : <PencilText>{`${current} / ${total}`}</PencilText>}
      </li> : getPaginationEntries(total, current, siblingCount, boundaryCount).map(entry => typeof entry === 'number'
        ? <li key={entry} className="inkra-pagination__page-item"><Button size={size} variant={variant} className="inkra-pagination__page"
          aria-label={text.page(entry)} aria-current={entry === current ? 'page' : undefined}
          disabled={disabled} onClick={() => select(entry)}>
          {entry === current && <PencilSurface as="span" aria-hidden="true" variant="selection" className="inkra-pagination__selection" seed={`page-${entry}`} />}
          {renderPage ? renderPage(entry, { isCurrent: entry === current }) : <PencilText>{String(entry)}</PencilText>}
        </Button></li>
        : <li key={entry} className="inkra-pagination__ellipsis"><span className="inkra-pagination__sr-only">{text.ellipsis}</span><PencilText aria-hidden="true">...</PencilText></li>)}
      {showPreviousNext && arrow('next', current + 1, !total || current >= total)}
      {showFirstLast && arrow('last', total, !total || current >= total)}
    </ul>}
  </nav>;
});

function normalizePageSize(value: number): number | undefined {
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}
