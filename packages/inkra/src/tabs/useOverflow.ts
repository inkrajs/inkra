import { useCallback, useEffect, useRef, useState } from 'react';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import { calculateOverflowListLayout } from '../overflow-list/layout.js';

export type TabsOverflow = 'scroll' | 'menu' | 'buttons';
interface OverflowItem { value: string; label: string; disabled: boolean }
interface OverflowState {
  overflowing: boolean;
  previous: boolean;
  next: boolean;
  rtl: boolean;
  items: OverflowItem[];
}
const initialState: OverflowState = { overflowing: false, previous: false, next: false, rtl: false, items: [] };

function triggers(list: HTMLDivElement) {
  return Array.from(list.querySelectorAll<HTMLButtonElement>('[data-tabs-value]'))
    .filter(node => node.closest('[role="tablist"]') === list);
}

export function revealTab(list: HTMLDivElement | null, tab: HTMLElement | null) {
  if (!list || !tab || tab.hasAttribute('data-overflow-hidden')) return;
  const view = list.getBoundingClientRect();
  const item = tab.getBoundingClientRect();
  const delta = item.left < view.left ? item.left - view.left : item.right > view.right ? item.right - view.right : 0;
  if (delta) list.scrollBy({ left: delta, behavior: 'instant' });
}

export function useTabsOverflow(mode: TabsOverflow, current: string | undefined) {
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const focusAfterLayout = useRef<'more' | 'selected' | null>(null);
  const [state, setState] = useState(initialState);

  const measure = useCallback(() => {
    const list = listRef.current;
    const container = containerRef.current;
    if (mode === 'scroll' || !list || !container || container.clientWidth <= 0) return;
    const nodes = triggers(list);
    const rtl = getComputedStyle(list).direction === 'rtl';
    let next: OverflowState;
    if (mode === 'menu') {
      const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
      const controlWidth = moreRef.current?.getBoundingClientRect().width || 44;
      // Use the layout box, not scrollWidth: pencil canvases include decorative paint bleed.
      const items = nodes.map(node => {
        const style = getComputedStyle(node);
        const label = node.querySelector<HTMLElement>('.inkra-tabs__label');
        const labelWidth = label ? parseFloat(getComputedStyle(label).width) || label.offsetWidth : 0;
        const icons = Array.from(node.querySelectorAll<HTMLElement>(':scope > .inkra-tabs__icon'));
        const width = Math.max(parseFloat(style.minWidth) || 44,
          labelWidth + icons.reduce((sum, icon) => sum + icon.offsetWidth, 0)
          + icons.length * (parseFloat(style.columnGap) || 0)
          + (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0));
        return { key: node.dataset.tabsValue!, width, priority: node.dataset.tabsValue === current ? 1 : 0 };
      });
      const layout = calculateOverflowListLayout({ items, containerWidth: container.clientWidth, gap, strategy: 'priority', triggerWidth: controlWidth });
      const hidden = new Set(layout.overflowKeys);
      next = {
        overflowing: hidden.size > 0, previous: false, next: false, rtl,
        items: nodes.filter(node => hidden.has(node.dataset.tabsValue!)).map(node => ({
          value: node.dataset.tabsValue!,
          label: node.dataset.overflowLabel ?? node.getAttribute('aria-label') ?? node.querySelector('.inkra-tabs__label')?.textContent ?? '',
          disabled: node.disabled,
        })),
      };
    } else {
      const max = Math.max(0, list.scrollWidth - list.clientWidth);
      const position = Math.min(max, Math.max(0, rtl ? -list.scrollLeft : list.scrollLeft));
      next = { overflowing: list.scrollWidth > container.clientWidth + 1, previous: position > 1, next: position < max - 1, rtl, items: [] };
    }
    const active = list.ownerDocument.activeElement;
    if (mode === 'menu' && active && nodes.some(node => node === active && next.items.some(item => item.value === node.dataset.tabsValue))) {
      focusAfterLayout.current = 'more';
    } else if (!next.overflowing && moreRef.current && (active === moreRef.current || moreRef.current.getAttribute('aria-expanded') === 'true')) {
      focusAfterLayout.current = 'selected';
    }
    setState(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
  }, [mode, current]);

  useBrowserLayoutEffect(measure);
  useBrowserLayoutEffect(() => {
    if (!focusAfterLayout.current || !listRef.current) return;
    const nodes = triggers(listRef.current);
    const target = focusAfterLayout.current === 'more' ? moreRef.current
      : nodes.find(node => node.dataset.tabsValue === current && !node.disabled) ?? nodes.find(node => !node.disabled);
    if (target) {
      target.focus({ preventScroll: true });
      focusAfterLayout.current = null;
    }
  }, [state, current]);
  useEffect(() => {
    const list = listRef.current;
    if (!list || mode === 'scroll') return;
    let frame = 0;
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    const observe = () => {
      resize?.disconnect();
      resize?.observe(list);
      if (containerRef.current) resize?.observe(containerRef.current);
      for (const node of triggers(list)) {
        resize?.observe(node);
        const label = node.querySelector('.inkra-tabs__label');
        if (label) resize?.observe(label);
      }
    };
    observe();
    const mutation = new MutationObserver(records => {
      if (records.some(record => record.type === 'childList')) observe();
      schedule();
    });
    mutation.observe(list, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'data-tabs-value', 'data-overflow-label'] });
    const direction = new MutationObserver(schedule);
    for (let node: HTMLElement | null = list; node; node = node.parentElement) {
      direction.observe(node, { attributes: true, attributeFilter: ['dir', 'style', 'class'] });
    }
    list.addEventListener('scroll', schedule, { passive: true });
    if (!resize) window.addEventListener('resize', schedule);
    document.fonts?.addEventListener('loadingdone', schedule);
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      mutation.disconnect();
      direction.disconnect();
      list.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.fonts?.removeEventListener('loadingdone', schedule);
    };
  }, [measure, mode]);

  useBrowserLayoutEffect(() => {
    const list = listRef.current;
    if (list && mode !== 'menu') revealTab(list, triggers(list).find(node => node.dataset.tabsValue === current) ?? null);
  }, [current, mode]);

  const scroll = (direction: -1 | 1) => {
    const list = listRef.current;
    if (!list) return;
    list.scrollBy({
      left: direction * (state.rtl ? -1 : 1) * Math.max(44, list.clientWidth * 0.8),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };
  return { ...state, listRef, containerRef, moreRef, scroll, measure };
}
