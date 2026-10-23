import { forwardRef, useEffect, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { Button } from '../Button.js';
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
}

const defaultLabels: PaginationLabels = {
  nav: 'Pagination', first: 'First page', previous: 'Previous page', next: 'Next page', last: 'Last page',
  page: page => `Page ${page}`, ellipsis: 'More pages',
};

export const Pagination = forwardRef<HTMLElement, PaginationProps>(function Pagination({
  totalPages, page, defaultPage = 1, onPageChange, siblingCount = 1, boundaryCount = 1,
  showFirstLast = false, showPreviousNext = true, hideOnSinglePage = false, simple = false,
  renderPage, renderSummary, disabled = false, size = 'md', labels, className, ...props
}, ref) {
  const total = normalizeTotal(totalPages);
  const [internalPage, setInternalPage] = useState(() => clampPage(defaultPage, total));
  const current = clampPage(page ?? internalPage, total);
  const text = { ...defaultLabels, ...labels };
  useEffect(() => {
    if (page === undefined) setInternalPage(value => clampPage(value, total));
  }, [page, total]);

  function select(next: number) {
    const target = clampPage(next, total);
    if (disabled || !total || target === current) return;
    if (page === undefined) setInternalPage(target);
    onPageChange?.(target);
  }

  const arrow = (kind: 'first' | 'previous' | 'next' | 'last', target: number, unavailable: boolean) => {
    const backwards = kind === 'first' || kind === 'previous';
    const paths = [{ d: backwards ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6' }];
    if (kind === 'first') paths.push({ d: 'M5 6v12' });
    if (kind === 'last') paths.push({ d: 'M19 6v12' });
    return <li key={kind}><Button variant="ghost" size={size === 'md' ? 'icon' : `icon-${size}`}
      aria-label={text[kind]} title={text[kind]} disabled={disabled || unavailable} onClick={() => select(target)}>
      <PencilIcon className="inkra-pagination__arrow" paths={paths} size={20} sourceSize={24} />
    </Button></li>;
  };

  if (hideOnSinglePage && total <= 1) return null;
  return <nav aria-label={text.nav} {...props} ref={ref} className={['inkra-pagination', className].filter(Boolean).join(' ')} data-empty={!total || undefined} data-simple={simple || undefined}>
    <ul className="inkra-pagination__list">
      {showFirstLast && arrow('first', 1, current <= 1)}
      {showPreviousNext && arrow('previous', current - 1, current <= 1)}
      {simple ? <li className="inkra-pagination__summary" aria-live="polite" aria-atomic="true">
        {renderSummary ? renderSummary(current, total) : <PencilText>{`${current} / ${total}`}</PencilText>}
      </li> : getPaginationEntries(total, current, siblingCount, boundaryCount).map(entry => typeof entry === 'number'
        ? <li key={entry}><Button size={size} variant="ghost" className="inkra-pagination__page"
          aria-label={text.page(entry)} aria-current={entry === current ? 'page' : undefined}
          disabled={disabled} onClick={() => select(entry)}>
          {entry === current && <PencilSurface as="span" aria-hidden="true" variant="selection" className="inkra-pagination__selection" seed={`page-${entry}`} />}
          {renderPage ? renderPage(entry, { isCurrent: entry === current }) : <PencilText>{String(entry)}</PencilText>}
        </Button></li>
        : <li key={entry} className="inkra-pagination__ellipsis"><span className="inkra-pagination__sr-only">{text.ellipsis}</span><PencilText aria-hidden="true">...</PencilText></li>)}
      {showPreviousNext && arrow('next', current + 1, !total || current >= total)}
      {showFirstLast && arrow('last', total, !total || current >= total)}
    </ul>
  </nav>;
});
