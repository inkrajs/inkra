export type PaginationEntry = number | 'ellipsis-start' | 'ellipsis-end';

export function normalizeTotal(total: number): number {
  return Number.isFinite(total) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(total))) : 0;
}

export function clampPage(page: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(total, Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1));
}

function windowCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(3, Math.floor(value))) : 1;
}

export function getPaginationEntries(total: number, page: number, siblings = 1, boundaries = 1): PaginationEntry[] {
  total = normalizeTotal(total);
  if (!total) return [];
  page = clampPage(page, total);
  siblings = windowCount(siblings);
  boundaries = windowCount(boundaries);
  const visible = new Set<number>([page]);
  for (let offset = 1; offset <= boundaries; offset += 1) {
    visible.add(offset);
    visible.add(total - offset + 1);
  }
  for (let offset = -siblings; offset <= siblings; offset += 1) visible.add(page + offset);
  const pages = [...visible].filter(value => value >= 1 && value <= total).sort((a, b) => a - b);
  const entries: PaginationEntry[] = [];
  let previous = 0;
  for (const value of pages) {
    if (previous && value - previous === 2) entries.push(previous + 1);
    else if (previous && value - previous > 2) entries.push(value <= page ? 'ellipsis-start' : 'ellipsis-end');
    else if (!previous && value > 1) entries.push('ellipsis-start');
    entries.push(value);
    previous = value;
  }
  if (previous < total) entries.push('ellipsis-end');
  return entries;
}
