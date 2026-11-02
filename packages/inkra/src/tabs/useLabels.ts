import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
export type TabsLabelVisibility = 'always' | 'auto' | 'hidden';
export function shouldCollapseTabLabels(items: readonly { width: number; icon: boolean }[], available: number, gap: number, equalWidth: boolean, vertical: boolean) {
  if (available <= 0 || !items.some(item => item.icon)) return false;
  const allowance = vertical ? available : (available - gap * Math.max(0, items.length - 1)) / Math.max(1, items.length);
  if ((equalWidth || vertical) && items.some(item => item.icon && item.width > allowance + .5)) return true;
  return !vertical && items.reduce((sum, item) => sum + item.width, 0) + gap * Math.max(0, items.length - 1) > available + .5;
}
export function useTabsLabels(listRef: RefObject<HTMLDivElement | null>, containerRef: RefObject<HTMLDivElement | null>, mode: TabsLabelVisibility, fullWidth: boolean, vertical: boolean, menu: boolean) {
  const [collapsed, setCollapsed] = useState(mode === 'hidden');
  const frame = useRef<number | undefined>(undefined);
  const measure = useCallback(() => {
    const list = listRef.current;
    if (mode !== 'auto') { setCollapsed(mode === 'hidden'); return; }
    if (!list || !list.clientWidth) return;
    const nodes = Array.from(list.querySelectorAll<HTMLElement>('[data-tabs-value]')).filter(node => node.closest('[role="tablist"]') === list);
    const style = getComputedStyle(list), gap = parseFloat(style.columnGap) || 0;
    const available = (containerRef.current?.clientWidth || list.clientWidth) - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
    list.setAttribute('data-measuring-labels', '');
    let items;
    try {
      items = nodes.map(node => {
        const css = getComputedStyle(node), label = node.querySelector<HTMLElement>(':scope > .inkra-tabs__label');
        const icons = Array.from(node.querySelectorAll<HTMLElement>(':scope > .inkra-tabs__icon'));
        return { icon: icons.length > 0, width: Math.max(parseFloat(css.minWidth) || 44,
          (label?.getBoundingClientRect().width || 0) + icons.reduce((sum, icon) => sum + icon.getBoundingClientRect().width, 0)
          + icons.length * (parseFloat(css.columnGap) || 0) + (parseFloat(css.paddingLeft) || 0) + (parseFloat(css.paddingRight) || 0)
          + (parseFloat(css.borderLeftWidth) || 0) + (parseFloat(css.borderRightWidth) || 0)) };
      });
    } finally { list.removeAttribute('data-measuring-labels'); }
    setCollapsed(shouldCollapseTabLabels(items, available, gap, fullWidth && !menu, vertical));
  }, [listRef, containerRef, mode, fullWidth, vertical, menu]);
  useBrowserLayoutEffect(measure, [measure]);
  useEffect(() => {
    const list = listRef.current;
    if (!list || mode !== 'auto') return;
    const schedule = () => { if (frame.current === undefined) frame.current = requestAnimationFrame(() => { frame.current = undefined; measure(); }); };
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    const observe = () => { resize?.disconnect(); resize?.observe(list); if (containerRef.current) resize?.observe(containerRef.current); for (const node of list.querySelectorAll('[data-tabs-value]')) resize?.observe(node); };
    observe();
    const mutation = new MutationObserver(records => { if (records.some(record => record.type === 'childList')) observe(); schedule(); });
    mutation.observe(list, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'data-tabs-value'] });
    const appearance = new MutationObserver(schedule);
    for (let node: HTMLElement | null = list.parentElement; node; node = node.parentElement) appearance.observe(node, { attributes: true, attributeFilter: ['dir', 'class', 'style'] });
    document.fonts?.addEventListener('loadingdone', schedule); window.addEventListener('resize', schedule);
    return () => { if (frame.current !== undefined) cancelAnimationFrame(frame.current); frame.current = undefined; resize?.disconnect(); mutation.disconnect(); appearance.disconnect(); document.fonts?.removeEventListener('loadingdone', schedule); window.removeEventListener('resize', schedule); };
  }, [measure, listRef, containerRef, mode]);
  return mode === 'hidden' || (mode === 'auto' && collapsed);
}
